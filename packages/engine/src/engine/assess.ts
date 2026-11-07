// Pure rules engine. Order per lesion follows Protocol E (Risk assessment - apply in order)
// and Spec "Rule engine, in order (per lesion)".

import { isSignedOff, type RulesFile } from '../rules';
import type {
  AdnexManualEntry, BenignDescriptorResult, ExamAssessment, ExamInput, Flag, LesionAssessment,
  LesionInput, ManagementOutcome, Menopause, ORadsCategory, ORadsOutcome, RmiOutcome, SimpleRulesOutcome,
} from '../types';
import { factsFor, matches, type LesionFacts } from './match';
import { validateExam, validateLesion } from './validate';

// ---------- Step 2: modified benign descriptors ----------
export function benignDescriptor(f: LesionFacts, rules: RulesFile): BenignDescriptorResult {
  const bd = rules.benignDescriptors;
  if (!matches(bd.precondition, f)) {
    return { applies: false, id: null, text: null, reason: `No BD: ${bd.preconditionText} (largest diameter ${f.largestDiameterMm} mm).` };
  }
  for (const item of bd.items) {
    if (matches(item.when, f)) return { applies: true, id: item.id, text: item.text, reason: null };
  }
  return { applies: false, id: null, text: null, reason: 'No BD criteria met.' };
}

// ---------- Step 4: Simple Rules ----------
export function simpleRules(f: LesionFacts, rules: RulesFile): SimpleRulesOutcome {
  const bFeatures = rules.simpleRules.bFeatures.filter((r) => matches(r.when, f)).map(({ id, text }) => ({ id, text }));
  const mFeatures = rules.simpleRules.mFeatures.filter((r) => matches(r.when, f)).map(({ id, text }) => ({ id, text }));
  const result = mFeatures.length > 0 && bFeatures.length === 0 ? 'malignant'
    : bFeatures.length > 0 && mFeatures.length === 0 ? 'benign'
    : 'inconclusive';
  return { bFeatures, mFeatures, result };
}

// ---------- Step 6: O-RADS from ADNEX band ----------
export function oradsFromAdnex(totalPct: number, rules: RulesFile): ORadsCategory {
  for (const b of rules.orads.adnexBands) {
    if (totalPct >= b.minInclusivePct && (b.maxExclusivePct === null || totalPct < b.maxExclusivePct)) {
      return b.category as ORadsCategory;
    }
  }
  throw new Error(`ADNEX total ${totalPct}% does not fall in any band`);
}

// ---------- Step 8: management lookup ----------
export function managementFor(
  category: ORadsCategory,
  menopause: Menopause | null,
  triggers: string[],
  rules: RulesFile,
): ManagementOutcome {
  const key = String(category);
  const entry = (menopause && rules.management.byMenopause[menopause]?.[key]) || rules.management.byCategory[key];
  if (!entry) throw new Error(`No management entry for O-RADS ${category}`);
  const additional = [...new Set(triggers)]
    .map((t) => rules.management.additionalTriggers[t])
    .filter((t): t is string => !!t);
  return { category, recommendation: entry.recommendation, communication: entry.communication, additional };
}

function flagText(rules: RulesFile, id: string): string {
  const f = rules.flags.items.find((x) => x.id === id);
  if (!f) throw new Error(`Flag ${id} missing from rules file`);
  return f.text;
}

function flagThreshold(rules: RulesFile, id: string): number {
  const f = rules.flags.items.find((x) => x.id === id);
  const t = f?.thresholdPct ?? f?.thresholdExclusive;
  if (t === undefined) throw new Error(`Flag ${id} has no threshold in rules file`);
  return t;
}

function maxCategory(cs: (ORadsCategory | null)[]): ORadsCategory | null {
  const v = cs.filter((c): c is ORadsCategory => c !== null);
  return v.length ? (Math.max(...v) as ORadsCategory) : null;
}

const pct = (n: number) => `${Number(n.toFixed(1))}%`;

/** Assess one lesion. `exam` supplies menopause, ascites and the acute-presentation exclusion. */
export function assessLesion(lesion: LesionInput, exam: ExamInput, rules: RulesFile): LesionAssessment {
  const base: LesionAssessment = {
    lesionId: lesion.id,
    rulesVersion: rules.rulesVersion,
    status: 'assessed',
    issues: validateLesion(lesion, exam, rules),
    physiological: false,
    benignDescriptor: null,
    adnexRequired: false,
    adnex: lesion.adnex ?? null,
    simpleRules: null,
    orads: null,
    flags: [],
    management: null,
    triggers: [],
    requiresLevelIIIReview: false,
  };

  const examErrors = validateExam(exam).filter((i) => i.severity === 'error');
  if (base.issues.some((i) => i.severity === 'error') || examErrors.length) {
    return { ...base, status: 'invalid', issues: [...base.issues, ...examErrors] };
  }

  const menopause = exam.menopause as Menopause;
  const facts = factsFor(lesion, menopause, exam.ascites === true);

  // Simple Rules are always shown, even for acute or physiological findings.
  const sr = simpleRules(facts, rules);
  const flags: Flag[] = [];
  const triggers: string[] = [];
  if (sr.mFeatures.length) {
    flags.push({
      key: `${lesion.id}:M-FEATURE`, id: 'M-FEATURE', scope: 'lesion', lesionId: lesion.id,
      message: flagText(rules, 'M-FEATURE'), detail: `${lesion.id}: ${sr.mFeatures.map((m) => m.id).join(', ')}`,
    });
    triggers.push('M-FEATURE');
  }

  // Special situation: acute presentation -> descriptive only, no O-RADS.
  if (exam.acuteCondition) {
    return { ...base, status: 'excluded-acute', simpleRules: sr, flags, triggers };
  }

  // Step 1: physiological.
  if (lesion.physiological) {
    const cat = rules.physiological.category as ORadsCategory;
    return {
      ...base, physiological: true, simpleRules: sr, flags, triggers,
      orads: { fromAdnex: null, fromDescriptors: null, suggested: cat, basis: 'Physiological (follicle / corpus luteum <=3 cm, premenopausal)' },
      management: managementFor(cat, menopause, triggers, rules),
    };
  }

  // Step 2: benign descriptors.
  const bd = benignDescriptor(facts, rules);

  // Step 3: ADNEX (manual entry) when no BD applies.
  const adnex: AdnexManualEntry | null = lesion.adnex ?? null;
  const adnexRequired = !bd.applies && adnex === null;
  let fromAdnex: ORadsCategory | null = null;
  if (adnex && !bd.applies) {
    fromAdnex = oradsFromAdnex(adnex.total, rules);
    if (adnex.total >= flagThreshold(rules, 'ADNEX-TOTAL')) {
      flags.push({ key: `${lesion.id}:ADNEX-TOTAL`, id: 'ADNEX-TOTAL', scope: 'lesion', lesionId: lesion.id,
        message: flagText(rules, 'ADNEX-TOTAL'), detail: `${lesion.id}: ADNEX total ${pct(adnex.total)}` });
    }
    if (adnex.metastatic >= flagThreshold(rules, 'ADNEX-METASTATIC')) {
      flags.push({ key: `${lesion.id}:ADNEX-METASTATIC`, id: 'ADNEX-METASTATIC', scope: 'lesion', lesionId: lesion.id,
        message: flagText(rules, 'ADNEX-METASTATIC'), detail: `${lesion.id}: ADNEX metastatic ${pct(adnex.metastatic)}` });
      triggers.push('ADNEX-METASTATIC');
    }
  }

  // Step 6: O-RADS - BD, ADNEX band or descriptors, whichever is higher.
  const fromDescriptors = lesion.descriptorCategory ?? null;
  const fromBd = bd.applies ? (rules.benignDescriptors.category as ORadsCategory) : null;
  const suggested = maxCategory([fromBd, fromAdnex, fromDescriptors]);
  const basisParts: string[] = [];
  if (fromBd !== null) basisParts.push(`${bd.id} applies -> O-RADS ${fromBd}`);
  if (fromAdnex !== null && adnex) basisParts.push(`ADNEX ${pct(adnex.total)} -> O-RADS ${fromAdnex}`);
  if (fromDescriptors !== null) basisParts.push(`O-RADS descriptors -> O-RADS ${fromDescriptors}`);
  if (suggested === null) basisParts.push('No BD applies: ADNEX required (enter the result from the IOTA app) or assign by O-RADS descriptors');
  const orads: ORadsOutcome = { fromAdnex, fromDescriptors, suggested, basis: basisParts.join('; ') };

  const reviewCats = rules.review.levelIIIRequiredForCategories;
  const requiresLevelIIIReview =
    (suggested !== null && reviewCats.includes(suggested)) ||
    rules.review.levelIIIRequiredForSimpleRules.includes(sr.result);

  return {
    ...base,
    benignDescriptor: bd,
    adnexRequired,
    adnex,
    simpleRules: sr,
    orads,
    flags,
    management: suggested === null ? null : managementFor(suggested, menopause, triggers, rules),
    triggers,
    requiresLevelIIIReview,
  };
}

// ---------- Step 5: RMI-I ----------
export function rmi(exam: ExamInput, rules: RulesFile): RmiOutcome | null {
  if (exam.menopause === null) return null;
  const ls = exam.lesions.filter((l) => !l.physiological);
  const features: string[] = [];
  if (ls.some((l) => l.tumourType === 'multilocular' || l.tumourType === 'multilocular-solid')) features.push('multilocular');
  if (ls.some((l) => l.solidComponentPresent || l.tumourType === 'solid')) features.push('solid');
  if (ls.some((l) => l.side === 'right') && ls.some((l) => l.side === 'left')) features.push('bilateral');
  if (exam.ascites) features.push('ascites');
  if (exam.upperAbdomen?.peritonealNodules || exam.upperAbdomen?.omentalCake) features.push('metastases');

  const table = rules.rmi.uScoreByFeatureCount;
  const uScore = table[Math.min(features.length, table.length - 1)] ?? null;
  const mScore = rules.rmi.mScore[exam.menopause];
  const score = exam.ca125 && uScore !== null ? uScore * mScore * exam.ca125.value : null;
  return { uFeatures: features, uScore, mScore, score };
}

/** Assess a whole examination: every lesion, RMI, exam-level flags and notices. */
export function assessExam(exam: ExamInput, rules: RulesFile): ExamAssessment {
  const issues = validateExam(exam);
  const lesions = exam.lesions.map((l) => assessLesion(l, exam, rules));
  const rmiOut = rmi(exam, rules);

  const flags: Flag[] = lesions.flatMap((l) => l.flags);
  if (exam.ascites === true) {
    flags.push({ key: 'EXAM:ASCITES', id: 'ASCITES', scope: 'exam', message: flagText(rules, 'ASCITES'), detail: 'Ascites recorded' });
  }
  if (rmiOut?.score != null && rmiOut.score > flagThreshold(rules, 'RMI')) {
    flags.push({ key: 'EXAM:RMI', id: 'RMI', scope: 'exam', message: flagText(rules, 'RMI'), detail: `RMI ${Math.round(rmiOut.score)}` });
  }
  // RMI >200 also adds its management trigger to every assessed lesion.
  if (flags.some((f) => f.id === 'RMI')) {
    for (const l of lesions) {
      const extra = rules.management.additionalTriggers['RMI'];
      if (!l.triggers.includes('RMI')) l.triggers.push('RMI');
      if (l.management && extra && !l.management.additional.includes(extra)) l.management.additional.push(extra);
    }
  }

  const s = rules.specialSituations;
  const notices: string[] = [];
  if (!isSignedOff(rules)) notices.push(rules.signOff.notForClinicalUseBanner);
  if (exam.acuteCondition) notices.push(s.acute.text);
  if (exam.pregnant) notices.push(s.pregnancy);
  if (exam.riskFactors?.brca || exam.riskFactors?.lynch) notices.push(s.highRisk);
  if (exam.ovaries.right.status === 'not-visualised' || exam.ovaries.left.status === 'not-visualised') notices.push(s.ovariesNotVisualised);

  const highestSuggested = maxCategory(lesions.map((l) => l.orads?.suggested ?? null));
  const suspicious = (highestSuggested !== null && highestSuggested >= 4) || lesions.some((l) => (l.simpleRules?.mFeatures.length ?? 0) > 0);
  if (suspicious && !exam.upperAbdomen?.assessed) notices.push(s.upperAbdomenSurvey);
  const needIII = lesions.filter((l) => l.requiresLevelIIIReview).map((l) => l.lesionId);
  if (needIII.length) notices.push(`Level III review advised (${needIII.join(', ')}): ${rules.review.text}`);
  if (lesions.some((l) => l.adnexRequired)) notices.push('ADNEX required for at least one lesion: no benign descriptor applies.');

  return {
    rulesVersion: rules.rulesVersion,
    protocolVersion: rules.protocol.version,
    rulesSignedOff: isSignedOff(rules),
    issues,
    lesions,
    rmi: rmiOut,
    flags,
    notices,
    highestSuggested,
  };
}

