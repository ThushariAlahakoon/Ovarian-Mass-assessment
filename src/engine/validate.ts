import type { RulesFile } from '../rules.js';
import type { AdnexManualEntry, ExamInput, LesionInput, ValidationIssue } from '../types.js';
import { largest } from './match.js';

const err = (field: string, message: string, lesionId?: string): ValidationIssue => ({ severity: 'error', field, message, lesionId });
const warn = (field: string, message: string, lesionId?: string): ValidationIssue => ({ severity: 'warning', field, message, lesionId });

/** Exam-level checks (mandatory worksheet fields that are not per lesion). */
export function validateExam(exam: ExamInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (exam.menopause === null || exam.menopause === undefined) {
    issues.push(err('menopause', 'Menopausal status is mandatory (postmenopausal = >=12 months amenorrhoea, or age >=50 after hysterectomy).'));
  }
  if (exam.ascites === null || exam.ascites === undefined) {
    issues.push(err('ascites', 'Ascites (fluid outside the pouch of Douglas) must be recorded as yes or no.'));
  }
  if (!Number.isFinite(exam.age) || exam.age <= 0) issues.push(err('age', 'Age must be a positive number.'));
  if (exam.ca125 && !(exam.ca125.value >= 0)) issues.push(err('ca125.value', 'CA125 must be zero or more.'));

  for (const side of ['right', 'left'] as const) {
    const hasLesion = exam.lesions.some((l) => l.side === side);
    if (hasLesion && exam.ovaries[side].status === 'normal') {
      issues.push(warn(`ovaries.${side}`, `The ${side} ovary is recorded as normal but a ${side} lesion is entered.`));
    }
  }
  const ids = exam.lesions.map((l) => l.id);
  if (new Set(ids).size !== ids.length) issues.push(err('lesions', 'Lesion labels must be unique.'));
  return issues;
}

function validateAdnex(a: AdnexManualEntry, lesionId: string, tolerance: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const parts: [keyof AdnexManualEntry, number][] = [
    ['total', a.total], ['benign', a.benign], ['borderline', a.borderline],
    ['stageI', a.stageI], ['stageIIToIV', a.stageIIToIV], ['metastatic', a.metastatic],
  ];
  for (const [k, v] of parts) {
    if (!Number.isFinite(v) || v < 0 || v > 100) issues.push(err(`adnex.${k}`, 'ADNEX percentages must be between 0 and 100.', lesionId));
  }
  if (issues.length) return issues;
  if (Math.abs(a.benign + a.total - 100) > tolerance) {
    issues.push(warn('adnex', `ADNEX benign (${a.benign}%) + total risk (${a.total}%) does not equal 100% - check transcription from the IOTA app.`, lesionId));
  }
  const subSum = a.borderline + a.stageI + a.stageIIToIV + a.metastatic;
  if (Math.abs(subSum - a.total) > tolerance) {
    issues.push(warn('adnex', `ADNEX subclasses sum to ${subSum.toFixed(1)}% but total risk is ${a.total}% - check transcription.`, lesionId));
  }
  return issues;
}

/** Per-lesion checks. Any 'error' blocks calculation for that lesion. */
export function validateLesion(l: LesionInput, exam: ExamInput, rules: RulesFile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const id = l.id;

  if (!Array.isArray(l.diametersMm) || l.diametersMm.length !== 3 || l.diametersMm.some((d) => !(d > 0))) {
    issues.push(err('diametersMm', 'Enter three orthogonal lesion diameters (mm), all greater than zero.', id));
  }
  if (l.colourScore === null || l.colourScore === undefined) {
    issues.push(err('colourScore', 'Colour score (1-4) is mandatory.', id));
  }
  if (l.papillaryCount === null || l.papillaryCount === undefined) {
    issues.push(err('papillaryCount', 'Papillary projection count (0, 1, 2, 3, >3) is mandatory.', id));
  }

  const solidExpected = l.tumourType === 'unilocular-solid' || l.tumourType === 'multilocular-solid' || l.tumourType === 'solid';
  if ((l.tumourType === 'unilocular' || l.tumourType === 'multilocular') && l.solidComponentPresent) {
    issues.push(err('solidComponentPresent', `A ${l.tumourType} lesion has no solid component by IOTA definition - change the tumour type or the solid component.`, id));
  }
  if (solidExpected && !l.solidComponentPresent) {
    issues.push(err('solidComponentPresent', `A ${l.tumourType} lesion must have a solid component recorded.`, id));
  }
  if (l.papillaryCount !== null && l.papillaryCount !== 0 && !l.solidComponentPresent) {
    issues.push(err('papillaryCount', 'Papillary projections are solid components - record the solid component.', id));
  }
  if (l.tumourType !== 'solid' && l.echogenicity === null) {
    issues.push(err('echogenicity', 'Cyst content echogenicity is required for cystic lesions.', id));
  }

  // Mandatory: solid component size when present.
  if (l.solidComponentPresent) {
    const s = l.solidDiametersMm;
    if (!s || s.length !== 3 || s.some((d) => !(d > 0))) {
      issues.push(err('solidDiametersMm', 'Solid component present: enter the largest solid component in three planes (mm).', id));
    } else {
      const lesionMax = largest(l.diametersMm) ?? 0;
      const solidMax = largest(s) ?? 0;
      if (solidMax > lesionMax) {
        issues.push(err('solidDiametersMm', `Largest solid component (${solidMax} mm) is larger than the lesion (${lesionMax} mm). Correct the measurements - no result is calculated.`, id));
      }
    }
  }

  if (l.physiological) {
    const max = largest(l.diametersMm) ?? Infinity;
    if (exam.menopause !== rules.physiological.requiresMenopause) {
      issues.push(err('physiological', 'Physiological (follicle / corpus luteum) applies only to premenopausal women.', id));
    }
    if (max > rules.physiological.maxDiameterMm) {
      issues.push(err('physiological', `Physiological applies only to follicle / corpus luteum <=${rules.physiological.maxDiameterMm / 10} cm.`, id));
    }
  }

  if (l.moreThan10Locules && l.loculeCount != null && l.loculeCount <= 10) {
    issues.push(err('moreThan10Locules', '">10 locules" is ticked but the locule count is 10 or fewer.', id));
  }

  if (l.adnex) issues.push(...validateAdnex(l.adnex, id, rules.adnex.sumToleranceWarningPct));
  return issues;
}
