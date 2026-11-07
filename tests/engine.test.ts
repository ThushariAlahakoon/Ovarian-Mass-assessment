// Unit tests: thresholds at their boundaries, rule ordering, rules-file integrity, record gate.
import { describe, expect, it } from 'vitest';
import { assessExam, managementFor, oradsFromAdnex, rmi } from '../src/engine/assess.js';
import { defaultRules as rules, validateRulesFile, type RulesFile } from '../src/rules.js';
import { confirmCategory, createExam, editManagement, logReferrerCall, sign, signingBlockers, updateInput } from '../src/record.js';
import { generateReportText } from '../src/report.js';
import { AT, clinicianII, clinicianIII, exam, lesion, sonographer, student } from './fixtures.js';

describe('rules file', () => {
  it('passes structural validation', () => {
    expect(validateRulesFile(rules)).toEqual([]);
  });
  it('rejects unknown condition keys and broken ADNEX bands', () => {
    const bad = structuredClone(rules) as RulesFile;
    (bad.benignDescriptors.items[0]!.when as Record<string, unknown>).colour = 1;
    bad.orads.adnexBands[1]!.minInclusivePct = 2;
    const errs = validateRulesFile(bad);
    expect(errs.some((e) => e.includes('unknown condition key'))).toBe(true);
    expect(errs.some((e) => e.includes('not contiguous'))).toBe(true);
  });
  it('is not signed off yet, so every assessment carries the not-for-clinical-use banner', () => {
    const a = assessExam(exam(), rules);
    expect(a.rulesSignedOff).toBe(false);
    expect(a.notices).toContain(rules.signOff.notForClinicalUseBanner);
  });
});

describe('ADNEX -> O-RADS bands (boundaries)', () => {
  it.each([
    [0, 2], [0.99, 2], [1, 3], [9.99, 3], [10, 4], [49.9, 4], [50, 5], [100, 5],
  ])('%s%% -> O-RADS %s', (pct, cat) => {
    expect(oradsFromAdnex(pct, rules)).toBe(cat);
  });
});

describe('benign descriptors', () => {
  it('9.9 cm still qualifies; 10.0 cm does not', () => {
    expect(assessExam(exam({}, [lesion({ diametersMm: [99, 80, 70] })]), rules).lesions[0]!.benignDescriptor?.id).toBe('BD3');
    expect(assessExam(exam({}, [lesion({ diametersMm: [100, 80, 70] })]), rules).lesions[0]!.benignDescriptor?.applies).toBe(false);
  });
  it('BD1 and BD2 are premenopausal only', () => {
    const post = assessExam(exam({ menopause: 'postmenopausal', age: 60 }, [lesion({ echogenicity: 'ground-glass' })]), rules);
    expect(post.lesions[0]!.benignDescriptor?.id).toBe('BD4'); // smooth unilocular, any other content
  });
  it('BD1 and BD2 require regular walls', () => {
    const bd1 = assessExam(exam({}, [lesion({ echogenicity: 'ground-glass', wallRegularity: 'irregular' })]), rules).lesions[0]!;
    expect(bd1.benignDescriptor?.applies).toBe(false);
    const bd2 = assessExam(exam({}, [lesion({ echogenicity: 'mixed', acousticShadows: true, wallRegularity: 'irregular' })]), rules).lesions[0]!;
    expect(bd2.benignDescriptor?.applies).toBe(false);
  });
  it('BD4 covers other smooth unilocular content; irregular walls get no BD', () => {
    expect(assessExam(exam({}, [lesion({ echogenicity: 'haemorrhagic' })]), rules).lesions[0]!.benignDescriptor?.id).toBe('BD4');
    expect(assessExam(exam({}, [lesion({ wallRegularity: 'irregular' })]), rules).lesions[0]!.benignDescriptor?.applies).toBe(false);
  });
  it('a BD lesion is O-RADS 2 even if ADNEX is also entered (ADNEX is used only when no BD applies)', () => {
    const l = assessExam(exam({}, [lesion({ adnex: { withCa125: false, total: 20, benign: 80, borderline: 5, stageI: 5, stageIIToIV: 5, metastatic: 5 } })]), rules).lesions[0]!;
    expect(l.orads?.suggested).toBe(2);
    expect(l.flags).toEqual([]);
  });
  it('a higher descriptor-derived category wins and both are shown', () => {
    const l = assessExam(exam({}, [lesion({ descriptorCategory: 3 })]), rules).lesions[0]!;
    expect(l.orads?.suggested).toBe(3);
    expect(l.orads?.basis).toMatch(/BD3 applies -> O-RADS 2; O-RADS descriptors -> O-RADS 3/);
  });
});

describe('physiological check', () => {
  it('premenopausal follicle <=3 cm -> O-RADS 1, no follow-up', () => {
    const l = assessExam(exam({}, [lesion({ physiological: true, diametersMm: [30, 25, 20] })]), rules).lesions[0]!;
    expect(l.orads?.suggested).toBe(1);
    expect(l.management?.recommendation).toBe('No follow-up');
  });
  it('rejects the tick when >3 cm or postmenopausal', () => {
    expect(assessExam(exam({}, [lesion({ physiological: true, diametersMm: [31, 25, 20] })]), rules).lesions[0]!.status).toBe('invalid');
    expect(assessExam(exam({ menopause: 'postmenopausal' }, [lesion({ physiological: true, diametersMm: [20, 15, 15] })]), rules).lesions[0]!.status).toBe('invalid');
  });
});

describe('Simple Rules features', () => {
  it('B2 at <7 mm solid; not at 7 mm', () => {
    const mk = (s: number) => lesion({ tumourType: 'unilocular-solid', solidComponentPresent: true, solidDiametersMm: [s, 5, 4], papillaryCount: 1 });
    expect(assessExam(exam({}, [mk(6.9)]), rules).lesions[0]!.simpleRules!.bFeatures.map((f) => f.id)).toContain('B2');
    expect(assessExam(exam({}, [mk(7)]), rules).lesions[0]!.simpleRules!.bFeatures.map((f) => f.id)).not.toContain('B2');
  });
  it('B4 smooth multilocular <100 mm; M4 needs >=100 mm', () => {
    const b4 = assessExam(exam({}, [lesion({ tumourType: 'multilocular', diametersMm: [99, 80, 70] })]), rules).lesions[0]!;
    expect(b4.simpleRules!.bFeatures.map((f) => f.id)).toContain('B4');
    const ms = (d: number) => lesion({ tumourType: 'multilocular-solid', wallRegularity: 'irregular', solidComponentPresent: true, solidDiametersMm: [20, 15, 10], diametersMm: [d, 80, 70] });
    expect(assessExam(exam({}, [ms(99)]), rules).lesions[0]!.simpleRules!.mFeatures.map((f) => f.id)).not.toContain('M4');
    expect(assessExam(exam({}, [ms(100)]), rules).lesions[0]!.simpleRules!.mFeatures.map((f) => f.id)).toContain('M4');
  });
  it('M4 "irregular" means irregular walls/septa only - an irregular solid surface with smooth walls is not M4', () => {
    const l = lesion({ tumourType: 'multilocular-solid', wallRegularity: 'smooth', solidSurface: 'irregular', solidComponentPresent: true, solidDiametersMm: [20, 15, 10], diametersMm: [120, 90, 80] });
    expect(assessExam(exam({}, [l]), rules).lesions[0]!.simpleRules!.mFeatures.map((f) => f.id)).not.toContain('M4');
  });
  it('M1 irregular solid tumour; M3 needs four or more papillary projections', () => {
    const solid = lesion({ tumourType: 'solid', echogenicity: null, solidComponentPresent: true, solidDiametersMm: [40, 30, 30], diametersMm: [40, 30, 30], solidSurface: 'irregular' });
    expect(assessExam(exam({}, [solid]), rules).lesions[0]!.simpleRules!.mFeatures.map((f) => f.id)).toContain('M1');
    const pap = (n: 3 | '>3') => lesion({ tumourType: 'unilocular-solid', solidComponentPresent: true, solidDiametersMm: [10, 8, 6], papillaryCount: n });
    expect(assessExam(exam({}, [pap(3)]), rules).lesions[0]!.simpleRules!.mFeatures.map((f) => f.id)).not.toContain('M3');
    expect(assessExam(exam({}, [pap('>3')]), rules).lesions[0]!.simpleRules!.mFeatures.map((f) => f.id)).toContain('M3');
  });
  it('neither B nor M -> inconclusive', () => {
    const l = lesion({ tumourType: 'unilocular-solid', solidComponentPresent: true, solidDiametersMm: [15, 10, 8], papillaryCount: 1, colourScore: 2 });
    expect(assessExam(exam({}, [l]), rules).lesions[0]!.simpleRules!.result).toBe('inconclusive');
  });
});

describe('validation', () => {
  it('mandatory worksheet fields cannot be blank', () => {
    const a = assessExam(exam({ menopause: null, ascites: null }, [lesion({ colourScore: null, papillaryCount: null })]), rules);
    const fields = [...a.issues, ...a.lesions[0]!.issues].map((i) => i.field);
    expect(fields).toEqual(expect.arrayContaining(['menopause', 'ascites', 'colourScore', 'papillaryCount']));
    expect(a.lesions[0]!.status).toBe('invalid');
  });
  it('solid component present requires its size', () => {
    const l = lesion({ tumourType: 'unilocular-solid', solidComponentPresent: true, solidDiametersMm: null, papillaryCount: 1 });
    expect(assessExam(exam({}, [l]), rules).lesions[0]!.issues.map((i) => i.field)).toContain('solidDiametersMm');
  });
  it('a unilocular lesion cannot have a solid component', () => {
    const l = lesion({ solidComponentPresent: true, solidDiametersMm: [5, 5, 5] });
    expect(assessExam(exam({}, [l]), rules).lesions[0]!.status).toBe('invalid');
  });
  it('ADNEX arithmetic mismatch is a warning, not a block', () => {
    const l = lesion({ tumourType: 'multilocular', diametersMm: [120, 90, 80], adnex: { withCa125: false, total: 5, benign: 90, borderline: 2, stageI: 1, stageIIToIV: 1, metastatic: 1 } });
    const la = assessExam(exam({}, [l]), rules).lesions[0]!;
    expect(la.status).toBe('assessed');
    expect(la.issues.some((i) => i.severity === 'warning' && i.field === 'adnex')).toBe(true);
  });
});

describe('RMI-I', () => {
  it('lists U features always; calculates only with CA125', () => {
    const l = lesion({ tumourType: 'multilocular-solid', solidComponentPresent: true, solidDiametersMm: [20, 15, 10], diametersMm: [70, 60, 50] });
    const noCa = rmi(exam({ menopause: 'postmenopausal' }, [l]), rules)!;
    expect(noCa.uFeatures).toEqual(['multilocular', 'solid']);
    expect(noCa.score).toBeNull();
    const withCa = rmi(exam({ menopause: 'postmenopausal', ca125: { value: 30, date: '2026-11-01' } }, [l]), rules)!;
    expect(withCa.score).toBe(3 * 3 * 30);
  });
  it('RMI >200 raises a flag; exactly 200 does not', () => {
    const l = lesion({ tumourType: 'multilocular', diametersMm: [70, 60, 50] }); // U = 1
    const at = (v: number) => assessExam(exam({ menopause: 'postmenopausal', ca125: { value: v, date: '2026-11-01' } }, [l]), rules).flags.map((f) => f.id);
    expect(at(200 / 3)).not.toContain('RMI');
    expect(at(67)).toContain('RMI');
  });
});

describe('exam-level behaviour', () => {
  it('ascites raises an exam flag and M2', () => {
    const a = assessExam(exam({ ascites: true }), rules);
    expect(a.flags.map((f) => f.id)).toContain('ASCITES');
    expect(a.lesions[0]!.simpleRules!.mFeatures.map((f) => f.id)).toContain('M2');
  });
  it('acute presentation: no O-RADS assigned, descriptive report, call required', () => {
    let r = createExam('acute', exam({ acuteCondition: 'torsion' }), sonographer, AT, rules);
    expect(r.assessment.lesions[0]!.status).toBe('excluded-acute');
    expect(r.assessment.lesions[0]!.orads).toBeNull();
    expect(signingBlockers(r, clinicianIII, rules)).toContain('Log the referrer phone call (time and recipient) before signing.');
    r = logReferrerCall(r, 'ED registrar', clinicianIII, AT);
    expect(generateReportText(sign(r, clinicianIII, AT, rules), rules)).toMatch(/O-RADS not assigned \(acute presentation\)/);
  });
  it('multiple lesions: highest category drives the exam', () => {
    const a = assessExam(exam({}, [
      lesion(),
      lesion({ id: 'L1', side: 'left', tumourType: 'multilocular', diametersMm: [70, 60, 50], adnex: { withCa125: false, total: 25, benign: 75, borderline: 10, stageI: 5, stageIIToIV: 5, metastatic: 5 } }),
    ]), rules);
    expect(a.highestSuggested).toBe(4);
    expect(a.rmi!.uFeatures).toContain('bilateral');
  });
  it('management lookup is verbatim from the protocol table', () => {
    expect(managementFor(5, 'postmenopausal', [], rules).communication).toBe('Phone referrer same day; document time and recipient');
  });
});

describe('record gate and roles', () => {
  it('students and Level II clinicians cannot sign an O-RADS 3 lesion', () => {
    const e = exam({}, [lesion({ tumourType: 'multilocular', diametersMm: [70, 60, 50], adnex: { withCa125: false, total: 4, benign: 96, borderline: 2, stageI: 1, stageIIToIV: 0.5, metastatic: 0.5 } })]);
    let r = createExam('gate', e, student, AT, rules);
    expect(() => confirmCategory(r, 'R1', student, AT)).toThrow();
    r = confirmCategory(r, 'R1', clinicianIII, AT);
    expect(signingBlockers(r, clinicianII, rules).join(' ')).toMatch(/Level III/);
    expect(signingBlockers(r, clinicianIII, rules)).toEqual([]);
  });
  it('O-RADS 4 requires the referrer call even without other flags', () => {
    const e = exam({}, [lesion({ descriptorCategory: 4 })]);
    let r = confirmCategory(createExam('o4', e, sonographer, AT, rules), 'R1', clinicianIII, AT);
    expect(signingBlockers(r, clinicianIII, rules)).toContain('Log the referrer phone call (time and recipient) before signing.');
    r = logReferrerCall(r, 'Dr Referrer', clinicianIII, AT);
    expect(generateReportText(sign(r, clinicianIII, AT, rules), rules)).toMatch(/verbal communication if applicable: 2026-11-07T10:00:00\+11:00 to Dr Referrer/);
  });
  it('editing management text needs a reason and is audited', () => {
    let r = confirmCategory(createExam('m', exam(), sonographer, AT, rules), 'R1', clinicianIII, AT);
    expect(() => editManagement(r, 'R1', 'Rescan 6 weeks', '', clinicianIII, AT)).toThrow();
    r = editManagement(r, 'R1', 'Rescan 6 weeks', 'Symptomatic patient', clinicianIII, AT);
    expect(r.audit.at(-1)).toMatchObject({ action: 'override-management', reason: 'Symptomatic patient' });
    expect(generateReportText(r, rules)).toMatch(/Rescan 6 weeks/);
  });
  it('changing input clears a decision whose suggestion changed', () => {
    let r = confirmCategory(createExam('u', exam(), sonographer, AT, rules), 'R1', clinicianIII, AT);
    r = updateInput(r, exam({}, [lesion({ diametersMm: [120, 90, 80] })]), sonographer, AT, rules);
    expect(r.decisions['R1']).toBeUndefined();
  });
  it('a signed report cannot be edited', () => {
    const r = sign(confirmCategory(createExam('s', exam(), sonographer, AT, rules), 'R1', clinicianIII, AT), clinicianIII, AT, rules);
    expect(() => updateInput(r, exam(), sonographer, AT, rules)).toThrow(/amendment/);
  });
});
