'use client';
// Prototype store: React context persisted to this browser's localStorage.
// Phase 2 replaces this with PostgreSQL (Australian region) behind SSO.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createExam, defaultRules, RecordError, updateInput, type ExamRecord, type User } from '@cfwu/engine';
import { demoExams } from './demo';
import {
  blankExamInput, blankMeta, USERS, userById, withDerived,
  type AppState, type ExamMeta, type FollowUp, type Patient, type StoredExam,
} from './model';

const KEY = 'cfwu-ovarian-prototype-v1';
const empty = (): AppState => ({ version: 1, exams: {}, order: [], currentUserId: USERS[0]!.id });

function load(): AppState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const s = JSON.parse(raw) as AppState;
    return s && s.version === 1 ? s : empty();
  } catch {
    return empty();
  }
}

function save(s: AppState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: the prototype still works for this page view */
  }
}

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `x${Date.now()}${Math.random().toString(16).slice(2)}`);
const nowIso = () => new Date().toISOString();

type Result = { ok: true } | { ok: false; error: string };

interface Store {
  hydrated: boolean;
  state: AppState;
  user: User;
  setUser(id: string): void;
  newExam(): string;
  seedDemo(): void;
  resetAll(): void;
  deleteExam(id: string): void;
  updatePatient(id: string, p: Patient): void;
  updateMeta(id: string, m: ExamMeta): void;
  updateDraft(id: string, fn: (d: StoredExam['draft']) => StoredExam['draft']): void;
  /** Commit the live draft into the record (audited). No-op if unchanged or signed. */
  commit(id: string): void;
  /** Run an engine record action; RecordError messages come back as { ok: false }. */
  act(id: string, fn: (r: ExamRecord, user: User, at: string) => ExamRecord): Result;
  addFollowUp(id: string, f: Omit<FollowUp, 'id' | 'createdBy' | 'createdAt'>): void;
  updateFollowUp(id: string, followUpId: string, patch: Partial<FollowUp>): void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(empty);
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    setState(load());
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) save(state);
  }, [state, hydrated]);

  const user = userById(state.currentUserId);

  const patchExam = useCallback((id: string, fn: (e: StoredExam) => StoredExam) => {
    setState((s) => {
      const e = s.exams[id];
      if (!e) return s;
      const next = fn(e);
      return next === e ? s : { ...s, exams: { ...s.exams, [id]: next } };
    });
  }, []);

  const store = useMemo<Store>(() => ({
    hydrated,
    state,
    user,
    setUser: (uid) => setState((s) => ({ ...s, currentUserId: uid })),
    newExam: () => {
      const id = newId();
      const n = Object.keys(stateRef.current.exams).length + 1;
      const patient: Patient = { name: `TEST, Patient ${n}`, mrn: `SYN-${String(1000 + n)}`, dob: '1985-01-01' };
      const meta = blankMeta(new Date());
      const draft = withDerived(blankExamInput(), patient, meta);
      const record = createExam(id, draft, userById(stateRef.current.currentUserId), nowIso(), defaultRules);
      setState((s) => ({ ...s, exams: { ...s.exams, [id]: { id, patient, meta, draft, record, followUps: [] } }, order: [id, ...s.order] }));
      return id;
    },
    seedDemo: () => {
      const exams = demoExams(new Date(), newId);
      setState((s) => ({
        ...s,
        exams: { ...s.exams, ...Object.fromEntries(exams.map((e) => [e.id, e])) },
        order: [...exams.map((e) => e.id), ...s.order],
      }));
    },
    resetAll: () => setState((s) => ({ ...empty(), currentUserId: s.currentUserId })),
    deleteExam: (id) => setState((s) => {
      const { [id]: _gone, ...rest } = s.exams;
      return { ...s, exams: rest, order: s.order.filter((x) => x !== id) };
    }),
    updatePatient: (id, p) => patchExam(id, (e) => ({ ...e, patient: p, draft: withDerived(e.draft, p, e.meta) })),
    updateMeta: (id, m) => patchExam(id, (e) => ({ ...e, meta: m, draft: withDerived(e.draft, e.patient, m) })),
    updateDraft: (id, fn) => patchExam(id, (e) => ({ ...e, draft: withDerived(fn(e.draft), e.patient, e.meta) })),
    commit: (id) => {
      const u = userById(stateRef.current.currentUserId);
      patchExam(id, (e) => {
        if (e.record.status === 'signed') return e;
        if (JSON.stringify(e.draft) === JSON.stringify(e.record.input)) return e;
        return { ...e, record: updateInput(e.record, e.draft, u, nowIso(), defaultRules) };
      });
    },
    act: (id, fn) => {
      const e = stateRef.current.exams[id];
      if (!e) return { ok: false, error: 'Exam not found' };
      const u = userById(stateRef.current.currentUserId);
      try {
        let rec = e.record;
        if (rec.status !== 'signed' && JSON.stringify(e.draft) !== JSON.stringify(rec.input)) {
          rec = updateInput(rec, e.draft, u, nowIso(), defaultRules);
        }
        const next = fn(rec, u, nowIso());
        // After an amendment the form edits the amended input.
        patchExam(id, (x) => ({ ...x, record: next, draft: next.status === 'amended' && rec.status === 'signed' ? next.input : x.draft }));
        return { ok: true };
      } catch (err) {
        if (err instanceof RecordError) return { ok: false, error: err.message };
        throw err;
      }
    },
    addFollowUp: (id, f) => {
      const u = userById(stateRef.current.currentUserId);
      patchExam(id, (e) => ({ ...e, followUps: [...e.followUps, { ...f, id: newId(), createdBy: u.id, createdAt: nowIso() }] }));
    },
    updateFollowUp: (id, fid, patch) => patchExam(id, (e) => ({ ...e, followUps: e.followUps.map((f) => (f.id === fid ? { ...f, ...patch } : f)) })),
  }), [hydrated, state, user, patchExam]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

export function useExam(id: string): StoredExam | undefined {
  return useStore().state.exams[id];
}
