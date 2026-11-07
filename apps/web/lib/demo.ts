// Synthetic demonstration cases. Names and MRNs are obviously fake. No real patient data.
import { createExam, defaultRules, type ExamInput, type LesionInput } from '@cfwu/engine';
import { blankExamInput, blankLesion, blankMeta, USERS, withDerived, type Patient, type StoredExam } from './model';

function lesion(over: Partial<LesionInput>): LesionInput {
  return { ...blankLesion('R1', 'right'), papillaryCount: 0, colourScore: 2, echogenicity: 'anechoic', ...over };
}

interface Case {
  patient: Patient;
  symptoms: string;
  input: Partial<ExamInput>;
}

const CASES: Case[] = [
  {
    patient: { name: 'TEST, Alpha', mrn: 'SYN-0001', dob: '1992-03-14' },
    symptoms: 'Dysmenorrhoea',
    input: {
      menopause: 'premenopausal', lmpOrCycleDay: 'Day 12', ascites: false,
      ovaries: { right: { status: 'contains-lesion' }, left: { status: 'normal', dimensionsMm: [28, 20, 18] } },
      uterus: 'Normal size; endometrium 7 mm, trilaminar',
      lesions: [lesion({ echogenicity: 'ground-glass', diametersMm: [45, 40, 38], loculeCount: 1, suggestedDiagnosis: 'Endometrioma', diagnosisConfidence: 'high' })],
    },
  },
  {
    patient: { name: 'TEST, Bravo', mrn: 'SYN-0002', dob: '1974-07-02' },
    symptoms: 'Bloating, pelvic pain',
    input: {
      menopause: 'postmenopausal', ascites: false, ca125: { value: 48, date: '2026-11-01' },
      ovaries: { right: { status: 'contains-lesion' }, left: { status: 'not-visualised' } },
      uterus: 'Normal size; endometrium 3 mm, homogeneous',
      lesions: [lesion({
        tumourType: 'multilocular-solid', loculeCount: 4, echogenicity: 'low-level', solidComponentPresent: true,
        solidDiametersMm: [15, 12, 10], diametersMm: [60, 50, 45], solidSurface: 'regular', colourScore: 3, papillaryCount: 1,
        suggestedDiagnosis: 'Cystadenofibroma vs borderline tumour', diagnosisConfidence: 'moderate',
        adnex: { withCa125: true, total: 12, benign: 88, borderline: 6, stageI: 2.5, stageIIToIV: 1.5, metastatic: 2 },
      })],
    },
  },
  {
    patient: { name: 'TEST, Charlie', mrn: 'SYN-0003', dob: '1968-01-20' },
    symptoms: 'Abdominal distension, early satiety',
    input: {
      menopause: 'postmenopausal', ascites: true,
      ovaries: { right: { status: 'contains-lesion' }, left: { status: 'not-visualised' } },
      upperAbdomen: { assessed: true, omentalCake: true, peritonealNodules: false },
      lesions: [lesion({
        tumourType: 'multilocular-solid', loculeCount: 8, wallRegularity: 'irregular', echogenicity: 'low-level',
        diametersMm: [130, 110, 95], solidComponentPresent: true, solidDiametersMm: [50, 40, 35],
        solidSurface: 'irregular', papillaryCount: 1, colourScore: 4, suggestedDiagnosis: 'Primary ovarian malignancy', diagnosisConfidence: 'high',
      })],
    },
  },
  {
    patient: { name: 'TEST, Delta', mrn: 'SYN-0004', dob: '1981-09-09' },
    symptoms: 'Incidental finding',
    input: {
      menopause: 'premenopausal', ascites: false,
      ovaries: { right: { status: 'contains-lesion' }, left: { status: 'normal' } },
      lesions: [lesion({ diametersMm: [120, 100, 90], loculeCount: 1, suggestedDiagnosis: 'Simple cyst', diagnosisConfidence: 'moderate' })],
    },
  },
  {
    patient: { name: 'TEST, Echo', mrn: 'SYN-0005', dob: '1958-05-30' },
    symptoms: 'Postmenopausal bleeding',
    input: {
      menopause: 'postmenopausal', ascites: false,
      ovaries: { right: { status: 'not-visualised' }, left: { status: 'not-visualised' } },
      uterus: 'Atrophic; endometrium 3 mm',
      lesions: [],
    },
  },
];

export function demoExams(now: Date, newId: () => string): StoredExam[] {
  const sono = USERS[0]!;
  return CASES.map((c) => {
    const meta = { ...blankMeta(now), symptoms: c.symptoms };
    const draft = withDerived({ ...blankExamInput(), ...c.input }, c.patient, meta);
    const id = newId();
    return { id, patient: c.patient, meta, draft, record: createExam(id, draft, sono, now.toISOString(), defaultRules), followUps: [] };
  });
}
