// Plain-text report following the protocol's "Structured report template".
// This text is what gets pasted into Gentu (Spec, Report output).

import { categoryLabel, type RulesFile } from './rules.js';
import type { ExamRecord } from './record.js';
import type { LesionAssessment, LesionInput, OvaryFinding, Side } from './types.js';

const yn = (b: boolean | null | undefined) => (b ? 'Y' : 'N');
const dims = (d: readonly number[] | null | undefined) => (d && d.length ? `${d.join(' x ')} mm` : '');
const pct = (n: number) => `${Number(n.toFixed(1))}%`;

function ovaryLine(side: Side, o: OvaryFinding, lesions: LesionInput[]): string {
  const label = side === 'right' ? 'RIGHT OVARY' : 'LEFT OVARY';
  if (o.status === 'not-visualised') return `${label}: not visualised`;
  const size = o.dimensionsMm ? `${dims(o.dimensionsMm)} ` : '';
  if (o.status === 'contains-lesion') {
    const ids = lesions.filter((l) => l.side === side).map((l) => l.id).join(', ');
    return `${label}: ${size}contains lesion ${ids}`.trimEnd();
  }
  return `${label}: ${size}normal`;
}

function lesionBlock(l: LesionInput): string[] {
  const solid = l.solidComponentPresent ? `present - largest ${dims(l.solidDiametersMm)}` : 'absent';
  const locules = l.loculeCount != null ? String(l.loculeCount) : 'n/a';
  return [
    `LESION [${l.id}]:`,
    `  Origin: ${l.origin}`,
    `  Size: ${dims(l.diametersMm)}`,
    `  IOTA type: ${l.tumourType}`,
    `  Locules: ${locules}; >10 ${yn(l.moreThan10Locules)}   Walls/septa: ${l.wallRegularity}`,
    `  Content: ${l.echogenicity ?? 'n/a'}`,
    `  Solid component: ${solid}`,
    `  Papillary projections: ${l.papillaryCount}; flow ${yn(l.papillaryFlow)}`,
    `  Solid surface: ${l.solidSurface}   Acoustic shadowing: ${yn(l.acousticShadows)}`,
    `  Colour score: ${l.colourScore}`,
  ];
}

function riskBlock(a: LesionAssessment, r: ExamRecord, rules: RulesFile): string[] {
  const out = [`  [${a.lesionId}]`];
  if (a.status === 'invalid') return [...out, '    Not assessed - validation errors.'];
  if (a.status === 'excluded-acute') {
    out.push(`    ${rules.specialSituations.acute.text}`);
  } else if (a.physiological) {
    out.push('    Physiological finding (follicle / corpus luteum <=3 cm, premenopausal).');
  } else {
    const bd = a.benignDescriptor;
    out.push(`    IOTA modified benign descriptor: ${bd?.applies ? `${bd.id} applies (${bd.text})` : 'not applicable'}`);
    if (a.adnex) {
      const x = a.adnex;
      out.push(`    IOTA ADNEX [${x.withCa125 ? 'with' : 'without'} CA125]: risk of malignancy ${pct(x.total)} (entered from IOTA app)`);
      out.push(`      benign ${pct(x.benign)} | borderline ${pct(x.borderline)} | stage I ${pct(x.stageI)} | stage II-IV ${pct(x.stageIIToIV)} | metastatic ${pct(x.metastatic)}`);
    } else if (!bd?.applies) {
      out.push('    IOTA ADNEX: not entered');
    }
  }
  if (a.simpleRules) {
    const s = a.simpleRules;
    const b = s.bFeatures.map((f) => f.id).join(', ') || 'none';
    const m = s.mFeatures.map((f) => f.id).join(', ') || 'none';
    out.push(`    IOTA Simple Rules: B features [${b}] | M features [${m}] -> ${s.result}`);
  }
  if (a.status === 'assessed') {
    const suggested = a.orads?.suggested ?? null;
    const d = r.decisions[a.lesionId];
    if (d?.overridden && suggested !== null) {
      out.push(`    O-RADS US v2022: ${categoryLabel(rules, d.finalCategory)} (clinician-assigned; engine suggested ${categoryLabel(rules, suggested)}. Reason: ${d.overrideReason})`);
    } else {
      const c = d?.finalCategory ?? suggested;
      out.push(`    O-RADS US v2022: ${c === null ? 'not yet assigned' : categoryLabel(rules, c)}${d ? '' : ' (suggested - not yet confirmed)'}`);
    }
    if (a.orads?.basis) out.push(`      Basis: ${a.orads.basis}`);
  }
  return out;
}

export function generateReportText(r: ExamRecord, rules: RulesFile): string {
  const e = r.input;
  const a = r.assessment;
  const lines: string[] = [];

  if (!a.rulesSignedOff) lines.push(`*** ${rules.signOff.notForClinicalUseBanner} ***`, '');

  lines.push('ADNEXAL ULTRASOUND REPORT');
  if (r.version > 1) lines.push(`AMENDED REPORT - version ${r.version}. Reason: ${r.amendmentReason ?? ''}`);
  lines.push(`Clinical: ${e.age} y | ${e.menopause ?? 'menopausal status not recorded'} | LMP/day ${e.lmpOrCycleDay ?? '-'} | Indication ${e.indication ?? '-'}`);
  const rf = e.riskFactors ?? {};
  const rfList = [rf.familyHistory && 'family history', rf.brca && 'BRCA', rf.lynch && 'Lynch'].filter(Boolean).join(', ') || 'none';
  const ca = e.ca125 ? `${e.ca125.value} U/mL (${e.ca125.date})` : 'not available';
  lines.push(`Risk factors: ${rfList} | CA125: ${ca}`);
  lines.push(`Technique: ${e.technique ?? 'Transvaginal +/- transabdominal, grey-scale and colour Doppler.'}`);
  lines.push(`Image quality: ${e.imageQuality ? (e.imageQuality.good ? 'good' : `limited - ${e.imageQuality.reason ?? ''}`) : '-'}`);
  lines.push('');
  lines.push(`UTERUS: ${e.uterus ?? '-'}`);
  lines.push(ovaryLine('right', e.ovaries.right, e.lesions));
  lines.push(ovaryLine('left', e.ovaries.left, e.lesions));
  lines.push('');
  for (const l of e.lesions) lines.push(...lesionBlock(l), '');

  const fluid = e.ascites ? 'ascites' : e.podFluidDepthMm ? `POD only - depth ${e.podFluidDepthMm} mm` : 'none';
  lines.push(`FREE FLUID: ${fluid}`);
  const ua = e.upperAbdomen;
  const uaText = !ua?.assessed ? 'not assessed'
    : [ua.peritonealNodules && 'peritoneal nodules', ua.omentalCake && 'omental cake', ua.hydronephrosis && 'hydronephrosis', ua.pleuralEffusion && 'pleural effusion', ua.morisonPouchFluid && "fluid in Morison's pouch"].filter(Boolean).join(', ') || 'none';
  lines.push(`UPPER ABDOMEN (if assessed): ${uaText}`);
  const tm = e.lesions.map((l) => `${l.id} tender ${yn(l.tenderness)}, mobile ${l.mobile == null ? '-' : yn(l.mobile)}`).join('; ');
  lines.push(`TENDERNESS / MOBILITY: ${tm || '-'}`);
  lines.push('');

  lines.push('RISK ASSESSMENT:');
  for (const la of a.lesions) lines.push(...riskBlock(la, r, rules));
  if (a.rmi) {
    const rmiScore = a.rmi.score !== null ? ` | RMI-I ${Math.round(a.rmi.score)}` : ' | RMI not calculated (CA125 not available)';
    lines.push(`  RMI U-score features: ${a.rmi.uFeatures.join(' / ') || 'none'}${rmiScore}`);
  }
  if (a.flags.length) {
    lines.push('  ESCALATION FLAGS:');
    for (const f of a.flags) {
      const ack = r.acknowledgedFlags[f.key];
      lines.push(`    - ${f.detail}: ${f.message}${ack ? ` [acknowledged ${ack.at}]` : ' [NOT ACKNOWLEDGED]'}`);
    }
  }
  lines.push('');

  lines.push('CONCLUSION:');
  let n = 1;
  for (const la of a.lesions) {
    const l = e.lesions.find((x) => x.id === la.lesionId)!;
    const d = r.decisions[la.lesionId];
    const cat = d?.finalCategory ?? la.orads?.suggested ?? null;
    const dx = l.suggestedDiagnosis ?? 'Adnexal lesion';
    const adnex = la.adnex ? `, ADNEX ${pct(la.adnex.total)}` : '';
    const oradsText = la.status === 'excluded-acute' ? 'O-RADS not assigned (acute presentation)' : `O-RADS ${cat ?? '-'}`;
    lines.push(`  ${n++}. ${dx} ${l.side} ${dims(l.diametersMm)}, ${oradsText}${adnex}.`);
    const recText = d?.managementText ?? (cat !== null && la.management
      ? (cat === la.management.category ? la.management.recommendation : rules.management.byCategory[String(cat)]?.recommendation)
      : null);
    if (la.status === 'excluded-acute') {
      lines.push(`     Recommendation: ${rules.specialSituations.acute.text}`);
    } else if (recText) {
      const comm = cat !== null ? rules.management.byCategory[String(cat)]?.communication : '';
      lines.push(`     Recommendation: ${recText.replace(/\.?$/, '.')}${comm ? ` Communication: ${comm}.` : ''}`);
      if (d?.managementText) lines.push(`     (Management text edited by reporting clinician. Reason: ${d.managementEditReason})`);
    }
    for (const extra of la.management?.additional ?? []) lines.push(`     ${extra}`);
  }
  for (const notice of a.notices) {
    if (notice !== rules.signOff.notForClinicalUseBanner) lines.push(`  Note: ${notice}`);
  }
  lines.push(`  ${n}. Comparison with prior study: -`);
  lines.push('');

  const clin = r.reportingClinician;
  lines.push(`Reported by: ${clin ? `${clin.name}${clin.qualification ? `, ${clin.qualification}` : ''}` : '-'}   Sonographer: ${r.sonographer.name}`);
  lines.push(`Date/time of verbal communication if applicable: ${r.referrerCall ? `${r.referrerCall.at} to ${r.referrerCall.recipient}` : '-'}`);
  lines.push(`Status: ${r.status}${r.signedAt ? ` (signed ${r.signedAt})` : ''} | Report version ${r.version}`);
  lines.push(`Protocol: ${rules.protocol.title} (version ${a.protocolVersion}) | Rules file version ${a.rulesVersion}`);
  return lines.join('\n');
}
