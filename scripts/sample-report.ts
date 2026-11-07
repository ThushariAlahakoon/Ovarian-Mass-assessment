// Prints a synthetic O-RADS 4 report: npx vite-node scripts/sample-report.ts
import { defaultRules as rules } from '../src/rules.js';
import { acknowledgeFlag, confirmCategory, createExam, logReferrerCall, sign } from '../src/record.js';
import { generateReportText } from '../src/report.js';
import { AT, clinicianIII, exam, lesion, sonographer } from '../tests/fixtures.js';

const e = exam({ age: 52, menopause: 'postmenopausal', indication: 'Pelvic pain', ca125: { value: 48, date: '2026-11-01' },
  uterus: 'Normal size; endometrium 3 mm, homogeneous', ovaries: { right: { status: 'contains-lesion' }, left: { status: 'not-visualised' } } },
  [lesion({ tumourType: 'multilocular-solid', loculeCount: 4, echogenicity: 'low-level', solidComponentPresent: true,
    solidDiametersMm: [15, 12, 10], diametersMm: [60, 50, 45], solidSurface: 'regular', colourScore: 3, papillaryCount: 1,
    suggestedDiagnosis: 'Cystadenofibroma vs borderline tumour',
    adnex: { withCa125: true, total: 12, benign: 88, borderline: 6, stageI: 2.5, stageIIToIV: 1.5, metastatic: 2 } })]);
let r = createExam('synthetic-demo', e, sonographer, AT, rules);
r = confirmCategory(r, 'R1', clinicianIII, AT);
for (const f of r.assessment.flags) r = acknowledgeFlag(r, f.key, sonographer, AT);
r = logReferrerCall(r, 'Dr Referrer (GP)', clinicianIII, '2026-11-07T10:20:00+11:00');
r = sign(r, clinicianIII, '2026-11-07T10:30:00+11:00', rules);
console.log(generateReportText(r, rules));
