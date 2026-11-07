// Synthetic test data only. No real patients.
import type { ExamInput, LesionInput, User } from '../src/types';

export const AT = '2026-11-07T10:00:00+11:00';

export const sonographer: User = { id: 'u-sono', name: 'Test Sonographer', role: 'sonographer', level: 'II' };
export const student: User = { id: 'u-student', name: 'Test Student', role: 'student' };
export const clinicianIII: User = { id: 'u-clin3', name: 'Dr Test Sonologist', role: 'reporting-clinician', qualification: 'FRANZCOG COGU', level: 'III' };
export const clinicianII: User = { id: 'u-clin2', name: 'Dr Test Level II', role: 'reporting-clinician', level: 'II' };

/** A smooth unilocular anechoic cyst, 45 mm; override fields per test. */
export function lesion(over: Partial<LesionInput> = {}): LesionInput {
  return {
    id: 'R1',
    side: 'right',
    origin: 'ovarian',
    diametersMm: [45, 38, 35],
    tumourType: 'unilocular',
    loculeCount: 1,
    moreThan10Locules: false,
    wallRegularity: 'smooth',
    echogenicity: 'anechoic',
    solidComponentPresent: false,
    solidDiametersMm: null,
    papillaryCount: 0,
    solidSurface: 'n/a',
    acousticShadows: false,
    colourScore: 2,
    ...over,
  };
}

export function exam(over: Partial<ExamInput> = {}, lesions: LesionInput[] = [lesion()]): ExamInput {
  return {
    age: 40,
    menopause: 'premenopausal',
    ovaries: { right: { status: 'contains-lesion' }, left: { status: 'normal', dimensionsMm: [28, 20, 18] } },
    ascites: false,
    podFluidDepthMm: null,
    upperAbdomen: { assessed: false },
    centreType: 'non-oncology',
    lesions,
    ...over,
  };
}
