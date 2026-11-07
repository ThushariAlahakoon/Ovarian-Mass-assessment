// The 12 rule-engine acceptance tests from docs/spec.md ("Rule-engine acceptance tests (minimum)").
import { describe, expect, it } from 'vitest';
import { assessExam, assessLesion } from '../src/engine/assess.js';
import { defaultRules as rules } from '../src/rules.js';
import {
  acknowledgeFlag, amend, confirmCategory, createExam, logReferrerCall, overrideCategory, RecordError, sign, signingBlockers,
} from '../src/record.js';
import { generateReportText } from '../src/report.js';
import { AT, clinicianIII, exam, lesion, sonographer } from './fixtures.js';

describe('Spec acceptance tests', () => {
  it('1. 34 y, premenopausal, unilocular, ground-glass, 45 mm -> BD1 -> O-RADS 2; no flags', () => {
    const e = exam({ age: 34 }, [lesion({ echogenicity: 'ground-glass', diametersMm: [45, 40, 38] })]);
    const a = assessExam(e, rules);
    const l = a.lesions[0]!;
    expect(l.benignDescriptor?.id).toBe('BD1');
    expect(l.orads?.suggested).toBe(2);
    expect(a.flags).toEqual([]);
  });

  it('2. 30 y, premenopausal, unilocular, mixed echogenicity, shadows, 60 mm -> BD2 -> O-RADS 2', () => {
    const e = exam({ age: 30 }, [lesion({ echogenicity: 'mixed', acousticShadows: true, diametersMm: [60, 50, 45] })]);
    const l = assessExam(e, rules).lesions[0]!;
    expect(l.benignDescriptor?.id).toBe('BD2');
    expect(l.orads?.suggested).toBe(2);
  });

  it('3. 62 y, postmenopausal, unilocular, anechoic, regular walls, 40 mm -> BD3 -> O-RADS 2', () => {
    const e = exam({ age: 62, menopause: 'postmenopausal' }, [lesion({ diametersMm: [40, 35, 30] })]);
    const l = assessExam(e, rules).lesions[0]!;
    expect(l.benignDescriptor?.id).toBe('BD3');
    expect(l.orads?.suggested).toBe(2);
  });

  it('4. 45 y, unilocular anechoic, regular walls, 120 mm -> no BD (>=10 cm), ADNEX required; Simple Rules B1 benign', () => {
    const e = exam({ age: 45 }, [lesion({ diametersMm: [120, 100, 90] })]);
    const l = assessExam(e, rules).lesions[0]!;
    expect(l.benignDescriptor?.applies).toBe(false);
    expect(l.benignDescriptor?.reason).toMatch(/10 cm/);
    expect(l.adnexRequired).toBe(true);
    expect(l.orads?.suggested).toBeNull();
    expect(l.simpleRules?.bFeatures.map((f) => f.id)).toContain('B1');
    expect(l.simpleRules?.mFeatures).toEqual([]);
    expect(l.simpleRules?.result).toBe('benign');
  });

  it('5. Multilocular-solid, irregular, 130 mm, ascites, colour score 4 -> malignant (M2, M4, M5); red flag blocks finalising', () => {
    const e = exam({ age: 58, menopause: 'postmenopausal', ascites: true }, [lesion({
      tumourType: 'multilocular-solid', loculeCount: 6, wallRegularity: 'irregular', echogenicity: 'low-level',
      diametersMm: [130, 110, 95], solidComponentPresent: true, solidDiametersMm: [50, 40, 35],
      solidSurface: 'irregular', papillaryCount: 1, colourScore: 4,
      adnex: { withCa125: false, total: 85, benign: 15, borderline: 5, stageI: 10, stageIIToIV: 60, metastatic: 10 },
    })]);
    const a = assessExam(e, rules);
    const sr = a.lesions[0]!.simpleRules!;
    expect(sr.mFeatures.map((f) => f.id)).toEqual(['M2', 'M4', 'M5']);
    expect(sr.bFeatures).toEqual([]);
    expect(sr.result).toBe('malignant');
    expect(a.flags.map((f) => f.id)).toContain('M-FEATURE');

    let r = createExam('synthetic-5', e, sonographer, AT, rules);
    r = confirmCategory(r, 'R1', clinicianIII, AT);
    expect(() => sign(r, clinicianIII, AT, rules)).toThrow(RecordError);
    expect(signingBlockers(r, clinicianIII, rules).some((b) => b.startsWith('Red flag not acknowledged'))).toBe(true);

    for (const f of r.assessment.flags) r = acknowledgeFlag(r, f.key, sonographer, AT);
    expect(signingBlockers(r, clinicianIII, rules)).toEqual(['Log the referrer phone call (time and recipient) before signing.']);
    r = logReferrerCall(r, 'Dr Referrer (GP)', clinicianIII, AT);
    expect(sign(r, clinicianIII, AT, rules).status).toBe('signed');
  });

  it('6. Unilocular-solid, 4 papillary projections -> M3 present; escalation flag', () => {
    const e = exam({}, [lesion({
      tumourType: 'unilocular-solid', solidComponentPresent: true, solidDiametersMm: [12, 10, 8],
      papillaryCount: '>3', solidSurface: 'irregular', diametersMm: [55, 48, 40],
    })]);
    const a = assessExam(e, rules);
    expect(a.lesions[0]!.simpleRules!.mFeatures.map((f) => f.id)).toContain('M3');
    expect(a.flags.some((f) => f.id === 'M-FEATURE' && f.lesionId === 'R1')).toBe(true);
  });

  it('7. Solid component diameter > lesion diameter -> validation error; no result', () => {
    const e = exam({}, [lesion({
      tumourType: 'unilocular-solid', solidComponentPresent: true, solidDiametersMm: [60, 20, 20],
      papillaryCount: 1, diametersMm: [50, 40, 30],
    })]);
    const l = assessLesion(e.lesions[0]!, e, rules);
    expect(l.status).toBe('invalid');
    expect(l.issues.some((i) => i.severity === 'error' && i.field === 'solidDiametersMm')).toBe(true);
    expect(l.simpleRules).toBeNull();
    expect(l.orads).toBeNull();
    expect(l.management).toBeNull();
  });

  it('8. Both B and M features present -> Simple Rules inconclusive', () => {
    // Acoustic shadows (B3) + colour score 4 (M5).
    const e = exam({}, [lesion({
      tumourType: 'solid', echogenicity: null, solidComponentPresent: true, solidDiametersMm: [40, 35, 30],
      diametersMm: [40, 35, 30], solidSurface: 'regular', acousticShadows: true, colourScore: 4,
    })]);
    const sr = assessExam(e, rules).lesions[0]!.simpleRules!;
    expect(sr.bFeatures.map((f) => f.id)).toContain('B3');
    expect(sr.mFeatures.map((f) => f.id)).toContain('M5');
    expect(sr.result).toBe('inconclusive');
  });

  it('9. ADNEX entered as 12% total, metastatic 11% -> O-RADS 4; flags for ADNEX >=10% and metastatic >=10%', () => {
    const e = exam({ age: 52, menopause: 'postmenopausal' }, [lesion({
      tumourType: 'multilocular-solid', loculeCount: 4, echogenicity: 'low-level', solidComponentPresent: true,
      solidDiametersMm: [15, 12, 10], diametersMm: [60, 50, 45], solidSurface: 'regular', colourScore: 2,
      adnex: { withCa125: false, total: 12, benign: 88, borderline: 0.5, stageI: 0.3, stageIIToIV: 0.2, metastatic: 11 },
    })]);
    const a = assessExam(e, rules);
    expect(a.lesions[0]!.orads?.fromAdnex).toBe(4);
    expect(a.lesions[0]!.orads?.suggested).toBe(4);
    const ids = a.flags.map((f) => f.id);
    expect(ids).toContain('ADNEX-TOTAL');
    expect(ids).toContain('ADNEX-METASTATIC');
    expect(a.lesions[0]!.management?.additional.join(' ')).toMatch(/CEA and CA19-9/);
  });

  it('10. Clinician changes O-RADS 3 -> 4 -> override reason mandatory; audit entry; report shows both', () => {
    const e = exam({}, [lesion({
      tumourType: 'multilocular', loculeCount: 5, echogenicity: 'low-level', diametersMm: [70, 60, 50],
      adnex: { withCa125: false, total: 4, benign: 96, borderline: 2, stageI: 1, stageIIToIV: 0.5, metastatic: 0.5 },
    })]);
    let r = createExam('synthetic-10', e, sonographer, AT, rules);
    expect(r.assessment.lesions[0]!.orads?.suggested).toBe(3);
    expect(() => overrideCategory(r, 'R1', 4, '', clinicianIII, AT)).toThrow(/reason is mandatory/);
    expect(() => overrideCategory(r, 'R1', 4, '   ', clinicianIII, AT)).toThrow(/reason is mandatory/);
    r = overrideCategory(r, 'R1', 4, 'Level III subjective assessment: suspicious septal flow', clinicianIII, AT);
    const entry = r.audit.find((x) => x.action === 'override-category');
    expect(entry).toMatchObject({ lesionId: 'R1', from: 3, to: 4, userId: clinicianIII.id });
    const text = generateReportText(r, rules);
    expect(text).toMatch(/O-RADS 4 - Intermediate/);
    expect(text).toMatch(/engine suggested O-RADS 3 - Low risk/);
    expect(text).toMatch(/Level III subjective assessment/);
  });

  it('11. Postmenopausal ovaries not visualised -> report states "not visualised", not "normal"', () => {
    const e = exam({ age: 68, menopause: 'postmenopausal', ovaries: { right: { status: 'not-visualised' }, left: { status: 'not-visualised' } } }, []);
    const r = createExam('synthetic-11', e, sonographer, AT, rules);
    const text = generateReportText(r, rules);
    expect(text).toMatch(/RIGHT OVARY: not visualised/);
    expect(text).toMatch(/LEFT OVARY: not visualised/);
    expect(text).not.toMatch(/OVARY:.*normal/);
    expect(text).toMatch(/ovaries not visualised' rather than 'normal'/);
  });

  it('12. Any signed report shows protocol and rules version; amendments create a new version', () => {
    const e = exam({ age: 34 }, [lesion({ echogenicity: 'ground-glass' })]);
    let r = createExam('synthetic-12', e, sonographer, AT, rules);
    r = confirmCategory(r, 'R1', clinicianIII, AT);
    r = sign(r, clinicianIII, AT, rules);
    const signedText = generateReportText(r, rules);
    expect(signedText).toContain(`Rules file version ${rules.rulesVersion}`);
    expect(signedText).toContain(`version ${rules.protocol.version}`);
    expect(signedText).toMatch(/Report version 1/);

    const amended = amend(r, 'Corrected lesion size', clinicianIII, '2026-11-08T09:00:00+11:00');
    expect(amended.version).toBe(2);
    expect(amended.status).toBe('amended');
    expect(amended.history).toHaveLength(1);
    expect(amended.history[0]!.version).toBe(1);
    expect(amended.history[0]!.status).toBe('signed');
    expect(generateReportText(amended, rules)).toMatch(/AMENDED REPORT - version 2/);
    // The original signed record is unchanged (pure functions).
    expect(r.version).toBe(1);
    expect(r.status).toBe('signed');
  });
});
