// App-level data model for the Phase 1 prototype. Clinical logic stays in @cfwu/engine.
import type { ExamInput, ExamRecord, LesionInput, Side, User } from '@cfwu/engine';

export const SITES = ['Westmead Innovation Quarter', 'Norwest Private Hospital, Bella Vista'] as const;
export type Site = (typeof SITES)[number];

/** Synthetic patient. Never shown in a URL. */
export interface Patient {
  name: string;
  mrn: string;
  dob: string; // YYYY-MM-DD
}

export interface ExamMeta {
  site: Site;
  examDateTime: string; // local ISO, YYYY-MM-DDTHH:mm
  hormones: string;
  symptoms: string;
  priorAdnexalSurgery: boolean;
  endometriosis: boolean;
  techniques: { tv: boolean; ta: boolean; tr: boolean };
}

export type FollowUpOutcome = 'pending' | 'resolved' | 'stable' | 'surgery';

export interface FollowUp {
  id: string;
  lesionId: string | null;
  dueDate: string; // YYYY-MM-DD
  reason: string;
  outcome: FollowUpOutcome;
  histology: string;
  createdBy: string;
  createdAt: string;
}

export interface StoredExam {
  id: string; // random internal id; the only thing that appears in URLs
  patient: Patient;
  meta: ExamMeta;
  /** Live form state; the risk panel always runs on this. */
  draft: ExamInput;
  /** Committed record (audit, decisions, signing). */
  record: ExamRecord;
  followUps: FollowUp[];
}

export interface AppState {
  version: 1;
  exams: Record<string, StoredExam>;
  order: string[];
  currentUserId: string;
}

export const USERS: User[] = [
  { id: 'demo-sono', name: 'Sam Sonographer (demo)', role: 'sonographer', level: 'II' },
  { id: 'demo-student', name: 'Wren Student (demo)', role: 'student' },
  { id: 'demo-clin3', name: 'Dr Lee Level III (demo)', role: 'reporting-clinician', level: 'III', qualification: 'FRANZCOG, COGU' },
  { id: 'demo-clin2', name: 'Dr Kim Level II (demo)', role: 'reporting-clinician', level: 'II', qualification: 'FRANZCOG' },
  { id: 'demo-admin', name: 'Alex Admin (demo)', role: 'admin' },
];

export function userById(id: string): User {
  return USERS.find((u) => u.id === id) ?? USERS[0]!;
}

export function ageAt(dob: string, at: string): number {
  const b = new Date(dob);
  const d = new Date(at);
  if (Number.isNaN(b.getTime()) || Number.isNaN(d.getTime())) return 0;
  let age = d.getFullYear() - b.getFullYear();
  const m = d.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && d.getDate() < b.getDate())) age--;
  return age;
}

export function techniqueText(t: ExamMeta['techniques']): string {
  const parts = [t.tv && 'Transvaginal', t.ta && 'transabdominal', t.tr && 'transrectal'].filter(Boolean);
  return parts.length ? `${parts.join(' + ')}, grey-scale and colour Doppler.` : 'Not recorded.';
}

/** Next free label for a side, e.g. R1, R2, L1. */
export function nextLesionId(lesions: LesionInput[], side: Side): string {
  const prefix = side === 'right' ? 'R' : 'L';
  let n = 1;
  while (lesions.some((l) => l.id === `${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export function blankLesion(id: string, side: Side): LesionInput {
  return {
    id, side, origin: 'ovarian',
    diametersMm: [0, 0, 0],
    physiological: false,
    tumourType: 'unilocular',
    loculeCount: null,
    moreThan10Locules: false,
    wallRegularity: 'smooth',
    echogenicity: null,
    solidComponentPresent: false,
    solidDiametersMm: null,
    papillaryCount: 0, // unilocular by default: no solid component
    papillaryFlow: null,
    solidSurface: 'n/a',
    acousticShadows: false,
    colourScore: null,
    tenderness: null,
    mobile: null,
    suggestedDiagnosis: null,
    diagnosisConfidence: null,
    adnex: null,
    descriptorCategory: null,
  };
}

export function blankExamInput(): ExamInput {
  return {
    age: 0,
    menopause: null,
    lmpOrCycleDay: null,
    indication: null,
    pregnant: false,
    acuteCondition: null,
    riskFactors: { familyHistory: false, brca: false, lynch: false },
    ca125: null,
    centreType: 'non-oncology',
    technique: undefined,
    imageQuality: { good: true },
    uterus: null,
    ovaries: { right: { status: 'normal', dimensionsMm: null }, left: { status: 'normal', dimensionsMm: null } },
    ascites: null,
    podFluidDepthMm: null,
    upperAbdomen: { assessed: false },
    lesions: [],
  };
}

export function blankMeta(now: Date): ExamMeta {
  const pad = (n: number) => String(n).padStart(2, '0');
  const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return {
    site: SITES[0], examDateTime: local, hormones: '', symptoms: '',
    priorAdnexalSurgery: false, endometriosis: false,
    techniques: { tv: true, ta: false, tr: false },
  };
}

/** Fill derived exam fields (age from DOB, technique text) before the engine sees the input. */
export function withDerived(input: ExamInput, patient: Patient, meta: ExamMeta): ExamInput {
  const symptoms = meta.symptoms.trim();
  return {
    ...input,
    age: ageAt(patient.dob, meta.examDateTime),
    technique: techniqueText(meta.techniques),
    indication: symptoms || null,
  };
}
