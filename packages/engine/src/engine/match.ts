import type { Condition, NumericTest } from '../rules';
import type { LesionInput, Menopause, PapillaryCount } from '../types';

/** Facts a rules-file condition can test, derived from one lesion plus its exam. */
export interface LesionFacts {
  tumourType: string;
  echogenicity: string | null;
  wallRegularity: string;
  solidSurface: string;
  menopause: Menopause | null;
  acousticShadows: boolean;
  ascites: boolean;
  solidComponentPresent: boolean;
  colourScore: number | null;
  largestDiameterMm: number;
  largestSolidDiameterMm: number | null;
  papillaryCount: number | null;
}

/** '>3' means four or more, so it compares as 4. */
export function papillaryAsNumber(p: PapillaryCount | null): number | null {
  if (p === null) return null;
  return p === '>3' ? 4 : p;
}

export function largest(d: readonly number[] | null | undefined): number | null {
  if (!d || d.length === 0) return null;
  return Math.max(...d);
}

export function factsFor(lesion: LesionInput, menopause: Menopause | null, ascites: boolean): LesionFacts {
  return {
    tumourType: lesion.tumourType,
    echogenicity: lesion.echogenicity,
    wallRegularity: lesion.wallRegularity,
    solidSurface: lesion.solidSurface,
    menopause,
    acousticShadows: lesion.acousticShadows,
    ascites,
    solidComponentPresent: lesion.solidComponentPresent || lesion.tumourType === 'solid',
    colourScore: lesion.colourScore,
    largestDiameterMm: largest(lesion.diametersMm) ?? 0,
    largestSolidDiameterMm: largest(lesion.solidDiametersMm ?? null),
    papillaryCount: papillaryAsNumber(lesion.papillaryCount),
  };
}

function numeric(value: number | null, t: NumericTest): boolean {
  if (value === null) return false;
  if (t.lt !== undefined && !(value < t.lt)) return false;
  if (t.lte !== undefined && !(value <= t.lte)) return false;
  if (t.gt !== undefined && !(value > t.gt)) return false;
  if (t.gte !== undefined && !(value >= t.gte)) return false;
  return true;
}

/** True when every key in the condition holds. Unknown/missing facts never match. */
export function matches(c: Condition, f: LesionFacts): boolean {
  if (c.tumourType && !c.tumourType.includes(f.tumourType)) return false;
  if (c.echogenicity && (f.echogenicity === null || !c.echogenicity.includes(f.echogenicity))) return false;
  if (c.wallRegularity !== undefined && c.wallRegularity !== f.wallRegularity) return false;
  if (c.solidSurface !== undefined && c.solidSurface !== f.solidSurface) return false;
  if (c.menopause !== undefined && c.menopause !== f.menopause) return false;
  if (c.acousticShadows !== undefined && c.acousticShadows !== f.acousticShadows) return false;
  if (c.ascites !== undefined && c.ascites !== f.ascites) return false;
  if (c.solidComponentPresent !== undefined && c.solidComponentPresent !== f.solidComponentPresent) return false;
  if (c.colourScore && (f.colourScore === null || !c.colourScore.includes(f.colourScore as never))) return false;
  if (c.largestDiameterMm && !numeric(f.largestDiameterMm, c.largestDiameterMm)) return false;
  if (c.largestSolidDiameterMm && !numeric(f.largestSolidDiameterMm, c.largestSolidDiameterMm)) return false;
  if (c.papillaryCount && !numeric(f.papillaryCount, c.papillaryCount)) return false;
  if (c.anyOf && !c.anyOf.some((sub) => matches(sub, f))) return false;
  return true;
}
