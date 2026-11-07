// Examination record lifecycle as pure functions: each call returns a new record.
// "The app suggests; the reporting clinician always confirms or overrides ... with the reason recorded."

import { assessExam } from './engine/assess.js';
import type { RulesFile } from './rules.js';
import type { ExamAssessment, ExamInput, ORadsCategory, User } from './types.js';

export type ExamStatus = 'draft' | 'for-review' | 'signed' | 'amended';

export interface AuditEntry {
  at: string;
  userId: string;
  action: string;
  lesionId?: string;
  from?: unknown;
  to?: unknown;
  reason?: string;
}

export interface LesionDecision {
  /** Category the clinician confirmed or assigned. */
  finalCategory: ORadsCategory;
  overridden: boolean;
  overrideReason: string | null;
  /** Edited management text, if the clinician changed it (logged as an override). */
  managementText: string | null;
  managementEditReason: string | null;
}

export interface ReferrerCall {
  at: string;
  recipient: string;
  byUserId: string;
}

export interface ExamRecord {
  examId: string;
  version: number;
  status: ExamStatus;
  input: ExamInput;
  assessment: ExamAssessment;
  decisions: Record<string, LesionDecision>;
  acknowledgedFlags: Record<string, { byUserId: string; at: string }>;
  referrerCall: ReferrerCall | null;
  sonographer: User;
  reportingClinician: User | null;
  signedAt: string | null;
  amendmentReason: string | null;
  audit: AuditEntry[];
  /** Earlier signed versions, oldest first (kept so any report can be reproduced). */
  history: ExamRecord[];
}

export class RecordError extends Error {}

function assertEditable(r: ExamRecord): void {
  if (r.status === 'signed') throw new RecordError('Signed report: create an amendment to change it.');
}

export function createExam(examId: string, input: ExamInput, sonographer: User, at: string, rules: RulesFile): ExamRecord {
  return {
    examId, version: 1, status: 'draft', input,
    assessment: assessExam(input, rules),
    decisions: {}, acknowledgedFlags: {}, referrerCall: null,
    sonographer, reportingClinician: null, signedAt: null, amendmentReason: null,
    audit: [{ at, userId: sonographer.id, action: 'create' }],
    history: [],
  };
}

/** Replace the exam input and re-run the engine. Decisions for lesions whose suggestion changed are cleared. */
export function updateInput(r: ExamRecord, input: ExamInput, user: User, at: string, rules: RulesFile): ExamRecord {
  assertEditable(r);
  const assessment = assessExam(input, rules);
  const decisions: Record<string, LesionDecision> = {};
  for (const [id, d] of Object.entries(r.decisions)) {
    const before = r.assessment.lesions.find((l) => l.lesionId === id)?.orads?.suggested;
    const after = assessment.lesions.find((l) => l.lesionId === id)?.orads?.suggested;
    if (before === after && after !== undefined) decisions[id] = d;
  }
  // Acknowledgements only carry over for flags that still exist.
  const keys = new Set(assessment.flags.map((f) => f.key));
  const acknowledgedFlags = Object.fromEntries(Object.entries(r.acknowledgedFlags).filter(([k]) => keys.has(k)));
  return {
    ...r, input, assessment, decisions, acknowledgedFlags,
    audit: [...r.audit, { at, userId: user.id, action: 'update-input' }],
  };
}

function requireClinician(user: User): void {
  if (user.role !== 'reporting-clinician') throw new RecordError('Only a reporting clinician can confirm, override or sign.');
}

function suggestedFor(r: ExamRecord, lesionId: string): ORadsCategory | null {
  const l = r.assessment.lesions.find((x) => x.lesionId === lesionId);
  if (!l) throw new RecordError(`Unknown lesion ${lesionId}`);
  return l.orads?.suggested ?? null;
}

/** Confirm the engine's suggested category unchanged. */
export function confirmCategory(r: ExamRecord, lesionId: string, user: User, at: string): ExamRecord {
  assertEditable(r);
  requireClinician(user);
  const suggested = suggestedFor(r, lesionId);
  if (suggested === null) throw new RecordError('No suggested category to confirm - complete ADNEX or assign by O-RADS descriptors.');
  return {
    ...r,
    decisions: { ...r.decisions, [lesionId]: { finalCategory: suggested, overridden: false, overrideReason: null, managementText: null, managementEditReason: null } },
    audit: [...r.audit, { at, userId: user.id, action: 'confirm-category', lesionId, to: suggested }],
  };
}

/** Assign a different category. A reason is mandatory and the change is audited. */
export function overrideCategory(r: ExamRecord, lesionId: string, category: ORadsCategory, reason: string, user: User, at: string): ExamRecord {
  assertEditable(r);
  requireClinician(user);
  const suggested = suggestedFor(r, lesionId);
  if (category === suggested) return confirmCategory(r, lesionId, user, at);
  if (!reason || !reason.trim()) throw new RecordError('An override reason is mandatory.');
  const prev = r.decisions[lesionId];
  return {
    ...r,
    decisions: {
      ...r.decisions,
      [lesionId]: { finalCategory: category, overridden: true, overrideReason: reason.trim(), managementText: prev?.managementText ?? null, managementEditReason: prev?.managementEditReason ?? null },
    },
    audit: [...r.audit, { at, userId: user.id, action: 'override-category', lesionId, from: suggested, to: category, reason: reason.trim() }],
  };
}

/** Edit the management text for a lesion. Logged as an override; reason mandatory. */
export function editManagement(r: ExamRecord, lesionId: string, text: string, reason: string, user: User, at: string): ExamRecord {
  assertEditable(r);
  requireClinician(user);
  const d = r.decisions[lesionId];
  if (!d) throw new RecordError('Confirm or override the category before editing management text.');
  if (!reason || !reason.trim()) throw new RecordError('A reason is mandatory when editing management text.');
  return {
    ...r,
    decisions: { ...r.decisions, [lesionId]: { ...d, managementText: text, managementEditReason: reason.trim() } },
    audit: [...r.audit, { at, userId: user.id, action: 'override-management', lesionId, to: text, reason: reason.trim() }],
  };
}

export function acknowledgeFlag(r: ExamRecord, flagKey: string, user: User, at: string): ExamRecord {
  assertEditable(r);
  if (!r.assessment.flags.some((f) => f.key === flagKey)) throw new RecordError(`No flag ${flagKey}`);
  if (user.role === 'student' || user.role === 'admin') throw new RecordError('Flags are acknowledged by the sonographer or reporting clinician.');
  return {
    ...r,
    acknowledgedFlags: { ...r.acknowledgedFlags, [flagKey]: { byUserId: user.id, at } },
    audit: [...r.audit, { at, userId: user.id, action: 'acknowledge-flag', to: flagKey }],
  };
}

export function logReferrerCall(r: ExamRecord, recipient: string, user: User, at: string): ExamRecord {
  assertEditable(r);
  if (!recipient.trim()) throw new RecordError('Record who was called.');
  return {
    ...r,
    referrerCall: { at, recipient: recipient.trim(), byUserId: user.id },
    audit: [...r.audit, { at, userId: user.id, action: 'log-referrer-call', to: recipient.trim() }],
  };
}

export function finalCategory(r: ExamRecord, lesionId: string): ORadsCategory | null {
  return r.decisions[lesionId]?.finalCategory ?? null;
}

/** Everything that stops the report being signed. Empty list = can sign. */
export function signingBlockers(r: ExamRecord, signer: User, rules: RulesFile): string[] {
  const b: string[] = [];
  if (signer.role !== 'reporting-clinician') b.push('Only a reporting clinician can sign.');
  if (r.status === 'signed') b.push('Already signed.');

  for (const issue of r.assessment.issues) if (issue.severity === 'error') b.push(`Exam: ${issue.message}`);
  const acute = !!r.input.acuteCondition;
  for (const l of r.assessment.lesions) {
    if (l.status === 'invalid') {
      b.push(`${l.lesionId}: fix validation errors (${l.issues.filter((i) => i.severity === 'error').map((i) => i.message).join(' ')})`);
      continue;
    }
    if (l.status === 'excluded-acute') continue;
    if (!r.decisions[l.lesionId]) b.push(`${l.lesionId}: confirm or override the O-RADS category.`);
    const cat = finalCategory(r, l.lesionId) ?? l.orads?.suggested ?? null;
    const needsIII = l.requiresLevelIIIReview || (cat !== null && rules.review.levelIIIRequiredForCategories.includes(cat));
    if (needsIII && signer.level !== 'III') b.push(`${l.lesionId}: ${rules.review.text}`);
  }

  const unacked = r.assessment.flags.filter((f) => !r.acknowledgedFlags[f.key]);
  for (const f of unacked) b.push(`Red flag not acknowledged: ${f.detail} - ${f.message}`);

  const finals = r.assessment.lesions.map((l) => finalCategory(r, l.lesionId));
  const verbal = finals.some((c) => c !== null && rules.management.verbalCommunicationCategories.includes(c));
  if ((r.assessment.flags.length > 0 || verbal || acute) && !r.referrerCall) {
    b.push('Log the referrer phone call (time and recipient) before signing.');
  }
  return [...new Set(b)];
}

export function sign(r: ExamRecord, signer: User, at: string, rules: RulesFile): ExamRecord {
  const blockers = signingBlockers(r, signer, rules);
  if (blockers.length) throw new RecordError(`Cannot sign:\n- ${blockers.join('\n- ')}`);
  return {
    ...r,
    status: 'signed',
    reportingClinician: signer,
    signedAt: at,
    audit: [...r.audit, { at, userId: signer.id, action: 'sign', to: { version: r.version, rulesVersion: r.assessment.rulesVersion } }],
  };
}

/** Open an amendment of a signed report: a new version; the signed version is kept in history unchanged. */
export function amend(r: ExamRecord, reason: string, user: User, at: string): ExamRecord {
  if (r.status !== 'signed') throw new RecordError('Only a signed report can be amended.');
  requireClinician(user);
  if (!reason.trim()) throw new RecordError('An amendment reason is mandatory.');
  const { history, ...snapshot } = r;
  return {
    ...r,
    version: r.version + 1,
    status: 'amended',
    signedAt: null,
    amendmentReason: reason.trim(),
    history: [...history, { ...snapshot, history: [] }],
    audit: [...r.audit, { at, userId: user.id, action: 'amend', from: r.version, to: r.version + 1, reason: reason.trim() }],
  };
}
