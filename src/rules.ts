import defaultRulesJson from '../rules/protocol-v1.json';
import type { ColourScore, ORadsCategory } from './types.js';

/** Declarative condition used by the rules file. All keys are ANDed. */
export interface Condition {
  tumourType?: string[];
  echogenicity?: string[];
  wallRegularity?: 'smooth' | 'irregular';
  solidSurface?: 'regular' | 'irregular' | 'n/a';
  menopause?: 'premenopausal' | 'postmenopausal';
  acousticShadows?: boolean;
  ascites?: boolean;
  solidComponentPresent?: boolean;
  colourScore?: ColourScore[];
  largestDiameterMm?: NumericTest;
  largestSolidDiameterMm?: NumericTest;
  papillaryCount?: NumericTest;
  anyOf?: Condition[];
}

export interface NumericTest {
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
}

export interface RuleItem {
  id: string;
  text: string;
  when: Condition;
}

export interface FlagRule {
  id: string;
  scope: 'lesion' | 'exam';
  text: string;
  thresholdPct?: number;
  thresholdExclusive?: number;
}

export interface ManagementEntry {
  typicalFindings: string;
  recommendation: string;
  communication: string;
}

export interface RulesFile {
  rulesVersion: string;
  protocol: { title: string; date: string; owner: string; version: string };
  signOff: { status: string; clinician: string | null; secondChecker: string | null; date: string | null; notForClinicalUseBanner: string };
  centreType: { default: string };
  physiological: { maxDiameterMm: number; requiresMenopause: string; category: number };
  benignDescriptors: {
    precondition: Condition;
    preconditionText: string;
    category: number;
    items: (RuleItem & { suggestedDiagnosis: string | null })[];
  };
  simpleRules: { bFeatures: RuleItem[]; mFeatures: RuleItem[] };
  adnex: { sumToleranceWarningPct: number };
  orads: {
    categories: Record<string, string>;
    adnexBands: { minInclusivePct: number; maxExclusivePct: number | null; category: number }[];
  };
  flags: { items: FlagRule[] };
  rmi: {
    uScoreByFeatureCount: number[];
    mScore: { premenopausal: number; postmenopausal: number };
    referralThresholdExclusive: number;
  };
  management: {
    byCategory: Record<string, ManagementEntry>;
    byMenopause: Partial<Record<'premenopausal' | 'postmenopausal', Record<string, ManagementEntry>>>;
    additionalTriggers: Record<string, string>;
    verbalCommunicationCategories: number[];
    followUp: string;
  };
  specialSituations: {
    acute: { conditions: string[]; text: string };
    pregnancy: string;
    highRisk: string;
    ovariesNotVisualised: string;
    upperAbdomenSurvey: string;
  };
  review: { levelIIIRequiredForCategories: number[]; levelIIIRequiredForSimpleRules: string[]; enforceAtSigning: boolean; text: string };
}

const CONDITION_KEYS = new Set([
  'tumourType', 'echogenicity', 'wallRegularity', 'solidSurface', 'menopause', 'acousticShadows',
  'ascites', 'solidComponentPresent', 'colourScore', 'largestDiameterMm', 'largestSolidDiameterMm',
  'papillaryCount', 'anyOf',
]);
const NUMERIC_KEYS = new Set(['lt', 'lte', 'gt', 'gte']);

function checkCondition(c: unknown, path: string, errors: string[]): void {
  if (typeof c !== 'object' || c === null) {
    errors.push(`${path}: condition must be an object`);
    return;
  }
  for (const [k, v] of Object.entries(c)) {
    if (!CONDITION_KEYS.has(k)) errors.push(`${path}.${k}: unknown condition key`);
    if (k === 'anyOf') {
      if (!Array.isArray(v) || v.length === 0) errors.push(`${path}.anyOf: must be a non-empty array`);
      else v.forEach((sub, i) => checkCondition(sub, `${path}.anyOf[${i}]`, errors));
    }
    if (k === 'largestDiameterMm' || k === 'largestSolidDiameterMm' || k === 'papillaryCount') {
      for (const nk of Object.keys(v as object)) {
        if (!NUMERIC_KEYS.has(nk)) errors.push(`${path}.${k}.${nk}: unknown numeric test`);
      }
    }
  }
}

/**
 * Structural check of a rules file so that a bad edit fails loudly rather than
 * silently changing clinical output. Returns a list of problems (empty = OK).
 */
export function validateRulesFile(r: RulesFile): string[] {
  const errors: string[] = [];
  if (!r.rulesVersion) errors.push('rulesVersion missing');
  if (!r.protocol?.version) errors.push('protocol.version missing');
  checkCondition(r.benignDescriptors?.precondition, 'benignDescriptors.precondition', errors);
  r.benignDescriptors?.items?.forEach((it, i) => checkCondition(it.when, `benignDescriptors.items[${i}]`, errors));
  r.simpleRules?.bFeatures?.forEach((it, i) => checkCondition(it.when, `simpleRules.bFeatures[${i}]`, errors));
  r.simpleRules?.mFeatures?.forEach((it, i) => checkCondition(it.when, `simpleRules.mFeatures[${i}]`, errors));

  // ADNEX bands must be contiguous from 0 with an open top band.
  const bands = r.orads?.adnexBands ?? [];
  if (bands.length === 0) errors.push('orads.adnexBands empty');
  bands.forEach((b, i) => {
    if (i === 0 && b.minInclusivePct !== 0) errors.push('orads.adnexBands[0] must start at 0');
    const next = bands[i + 1];
    if (next && b.maxExclusivePct !== next.minInclusivePct) errors.push(`orads.adnexBands[${i}] not contiguous with next band`);
    if (!next && b.maxExclusivePct !== null) errors.push('last ADNEX band must be open-ended (maxExclusivePct: null)');
  });

  for (const cat of ['0', '1', '2', '3', '4', '5']) {
    if (!r.management?.byCategory?.[cat]) errors.push(`management.byCategory.${cat} missing`);
    if (!r.orads?.categories?.[cat]) errors.push(`orads.categories.${cat} missing`);
  }
  if (!Array.isArray(r.rmi?.uScoreByFeatureCount) || r.rmi.uScoreByFeatureCount.length === 0) {
    errors.push('rmi.uScoreByFeatureCount missing');
  }
  return errors;
}

export const defaultRules: RulesFile = defaultRulesJson as unknown as RulesFile;

export function isSignedOff(r: RulesFile): boolean {
  return r.signOff.status === 'signed-off' && !!r.signOff.clinician && !!r.signOff.date;
}

export function categoryLabel(r: RulesFile, c: ORadsCategory): string {
  return `O-RADS ${c} - ${r.orads.categories[String(c)] ?? ''}`.trim();
}
