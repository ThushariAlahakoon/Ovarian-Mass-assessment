'use client';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import {
  assessLesion, defaultRules as rules,
  type AdnexManualEntry, type ColourScore, type Echogenicity, type LesionInput, type ORadsCategory, type PapillaryCount, type Side, type TumourType,
} from '@cfwu/engine';
import { Check, NumberInput, Section, Segmented, TextInput, TripleInput } from '@/components/fields';
import { StepShell } from '@/components/StepShell';
import { blankLesion, nextLesionId } from '@/lib/model';
import { useExam, useStore } from '@/lib/store';

const TYPES: { value: TumourType; label: string }[] = [
  { value: 'unilocular', label: 'Unilocular' },
  { value: 'unilocular-solid', label: 'Unilocular-solid' },
  { value: 'multilocular', label: 'Multilocular' },
  { value: 'multilocular-solid', label: 'Multilocular-solid' },
  { value: 'solid', label: 'Solid (≥80%)' },
];
const ECHO: { value: Echogenicity; label: string }[] = [
  { value: 'anechoic', label: 'Anechoic' },
  { value: 'low-level', label: 'Low-level' },
  { value: 'ground-glass', label: 'Ground-glass' },
  { value: 'haemorrhagic', label: 'Haemorrhagic' },
  { value: 'mixed', label: 'Mixed' },
];
const PAP: { value: PapillaryCount; label: string }[] = [0, 1, 2, 3, '>3'].map((v) => ({ value: v as PapillaryCount, label: String(v) }));
const CS: { value: ColourScore; label: string }[] = [
  { value: 1, label: '1 · No flow' }, { value: 2, label: '2 · Minimal' }, { value: 3, label: '3 · Moderate' }, { value: 4, label: '4 · Abundant' },
];
const YN = [{ value: true, label: 'Yes' }, { value: false, label: 'No' }];
const hasSolid = (t: TumourType) => t === 'unilocular-solid' || t === 'multilocular-solid' || t === 'solid';

const blankAdnex = (): AdnexManualEntry => ({ withCa125: false, total: NaN, benign: NaN, borderline: NaN, stageI: NaN, stageIIToIV: NaN, metastatic: NaN });
const nz = (n: number) => (Number.isFinite(n) ? n : null);

function LesionForm({ l, onChange, menopause }: { l: LesionInput; onChange: (fn: (l: LesionInput) => LesionInput) => void; menopause: string | null }) {
  const { id: examId } = useParams<{ id: string }>();
  const exam = useExam(examId)!;
  const set = <K extends keyof LesionInput>(k: K, v: LesionInput[K]) => onChange((x) => ({ ...x, [k]: v }));
  const live = assessLesion(l, exam.draft, rules);
  const bdApplies = live.benignDescriptor?.applies === true;
  const adnex = l.adnex;
  const setAdnex = (k: keyof AdnexManualEntry, v: number | boolean | null) =>
    onChange((x) => ({ ...x, adnex: { ...(x.adnex ?? blankAdnex()), [k]: v === null ? NaN : v } }));

  const setType = (t: TumourType) => onChange((x) => ({
    ...x,
    tumourType: t,
    // IOTA definition: solid types have a solid component; unilocular/multilocular do not.
    solidComponentPresent: hasSolid(t),
    solidDiametersMm: hasSolid(t) ? x.solidDiametersMm : null,
    solidSurface: hasSolid(t) ? (x.solidSurface === 'n/a' ? 'regular' : x.solidSurface) : 'n/a',
    // Force an explicit papillary count when a solid component first appears.
    papillaryCount: hasSolid(t) ? (hasSolid(x.tumourType) ? x.papillaryCount : null) : 0,
    echogenicity: t === 'solid' ? null : x.echogenicity,
  }));

  return (
    <div className="stack">
      <Section title={`Lesion ${l.id} — location and size`}>
        <div className="grid3">
          <Segmented label="Origin" value={l.origin} options={[{ value: 'ovarian', label: 'Ovarian' }, { value: 'para-ovarian', label: 'Para-ovarian' }, { value: 'tubal', label: 'Tubal' }, { value: 'uncertain', label: 'Uncertain' }]} onChange={(v) => set('origin', v)} />
          <TripleInput label="Lesion diameters (largest first)" required value={l.diametersMm} onChange={(v) => set('diametersMm', v)} testId="lesion-diameters" />
          {menopause === 'premenopausal' && (
            <Check label="Physiological: follicle / corpus luteum ≤3 cm" checked={l.physiological} onChange={(v) => set('physiological', v)} testId="physiological" />
          )}
        </div>
      </Section>

      <Section title="IOTA description">
        <Segmented label="Tumour type" required value={l.tumourType} options={TYPES} onChange={setType} testId="tumour-type" />
        <div className="grid3">
          <NumberInput label="Locule count" value={l.loculeCount ?? null} step="1" onChange={(v) => onChange((x) => ({ ...x, loculeCount: v, moreThan10Locules: v !== null ? v > 10 : x.moreThan10Locules }))} />
          <Segmented label=">10 locules" value={l.moreThan10Locules} options={YN} onChange={(v) => set('moreThan10Locules', v)} />
          <Segmented label="Walls / septa" required value={l.wallRegularity} options={[{ value: 'smooth', label: 'Smooth' }, { value: 'irregular', label: 'Irregular' }]} onChange={(v) => set('wallRegularity', v)} hint="Irregularity <3 mm is not a papillary projection." testId="walls" />
        </div>
        {l.tumourType !== 'solid' && (
          <Segmented label="Cyst content" required value={l.echogenicity} options={ECHO} onChange={(v) => set('echogenicity', v)} testId="echogenicity" />
        )}
        {hasSolid(l.tumourType) && (
          <div className="grid3">
            <TripleInput label="Largest solid component" required value={l.solidDiametersMm ?? null} onChange={(v) => set('solidDiametersMm', v)} hint="Papillary projections count as solid; measure the largest in three planes." testId="solid-diameters" />
            <Segmented label="Papillary projections (≥3 mm)" required value={l.papillaryCount} options={PAP} onChange={(v) => set('papillaryCount', v)} testId="papillary" />
            <Segmented label="Flow in papillations" value={l.papillaryFlow ?? null} options={YN} onChange={(v) => set('papillaryFlow', v)} />
            <Segmented label="Solid surface" value={l.solidSurface} options={[{ value: 'regular', label: 'Regular' }, { value: 'irregular', label: 'Irregular' }]} onChange={(v) => set('solidSurface', v)} testId="solid-surface" />
          </div>
        )}
        {!hasSolid(l.tumourType) && (
          <p className="muted small">No solid component (by IOTA definition). Papillary projections: 0.</p>
        )}
        <div className="grid3">
          <Segmented label="Acoustic shadowing" value={l.acousticShadows} options={YN} onChange={(v) => set('acousticShadows', v)} testId="shadows" />
          <Segmented label="Colour score (whole lesion)" required value={l.colourScore} options={CS} onChange={(v) => set('colourScore', v)} testId="colour-score" />
        </div>
        <div className="grid3">
          <Segmented label="Tender" value={l.tenderness ?? null} options={YN} onChange={(v) => set('tenderness', v)} />
          <Segmented label="Mobile" value={l.mobile ?? null} options={YN} onChange={(v) => set('mobile', v)} />
        </div>
      </Section>

      <Section title="Pattern recognition">
        <div className="grid2">
          <TextInput label="Suggested diagnosis" value={l.suggestedDiagnosis} onChange={(v) => set('suggestedDiagnosis', v || null)} placeholder="e.g. endometrioma, dermoid, haemorrhagic cyst" />
          <Segmented label="Confidence" value={l.diagnosisConfidence ?? null} options={[{ value: 'low', label: 'Low' }, { value: 'moderate', label: 'Moderate' }, { value: 'high', label: 'High' }]} onChange={(v) => set('diagnosisConfidence', v)} />
        </div>
      </Section>

      <Section title="IOTA ADNEX (entered from the IOTA app)" aside={
        bdApplies ? <span className="ok-text small">Not needed — {live.benignDescriptor?.id} applies</span>
          : <span className="warn-text small">Required — no benign descriptor applies</span>
      }>
        <p className="muted small">The ADNEX calculation is not built into this version. Copy the result from the IOTA app / online calculator. Inputs: age, CA125 (optional), centre type, max lesion diameter, max solid diameter, &gt;10 locules, papillary count, shadows, ascites.</p>
        {adnex == null ? (
          <button className="btn" type="button" onClick={() => onChange((x) => ({ ...x, adnex: blankAdnex() }))} data-testid="add-adnex">Enter ADNEX result</button>
        ) : (
          <>
            <Segmented label="Model" value={adnex.withCa125} options={[{ value: true, label: 'With CA125' }, { value: false, label: 'Without CA125' }]} onChange={(v) => setAdnex('withCa125', v)} />
            <div className="grid3">
              <NumberInput label="Total risk of malignancy" unit="%" value={nz(adnex.total)} onChange={(v) => setAdnex('total', v)} testId="adnex-total" />
              <NumberInput label="Benign" unit="%" value={nz(adnex.benign)} onChange={(v) => setAdnex('benign', v)} testId="adnex-benign" />
              <NumberInput label="Borderline" unit="%" value={nz(adnex.borderline)} onChange={(v) => setAdnex('borderline', v)} testId="adnex-borderline" />
              <NumberInput label="Stage I" unit="%" value={nz(adnex.stageI)} onChange={(v) => setAdnex('stageI', v)} testId="adnex-stage1" />
              <NumberInput label="Stage II–IV" unit="%" value={nz(adnex.stageIIToIV)} onChange={(v) => setAdnex('stageIIToIV', v)} testId="adnex-stage2" />
              <NumberInput label="Metastatic" unit="%" value={nz(adnex.metastatic)} onChange={(v) => setAdnex('metastatic', v)} testId="adnex-metastatic" />
            </div>
            <button className="btn ghost small" type="button" onClick={() => onChange((x) => ({ ...x, adnex: null }))}>Remove ADNEX result</button>
          </>
        )}
      </Section>

      <Section title="O-RADS by descriptors (optional)">
        <Segmented<ORadsCategory | null>
          label="Clinician-assigned O-RADS from v2022 descriptors"
          value={l.descriptorCategory ?? null}
          options={[{ value: null, label: 'Not assigned' }, ...[0, 1, 2, 3, 4, 5].map((c) => ({ value: c as ORadsCategory, label: String(c) }))]}
          onChange={(v) => set('descriptorCategory', v)}
          hint="The higher of the ADNEX band and the descriptor category is suggested; both are shown."
        />
      </Section>
    </div>
  );
}

export default function LesionsStep() {
  const { id } = useParams<{ id: string }>();
  const exam = useExam(id)!;
  const { updateDraft } = useStore();
  const lesions = exam.draft.lesions;
  const [active, setActive] = useState<string | null>(lesions[0]?.id ?? null);
  const current = lesions.find((l) => l.id === active) ?? lesions[0];

  const add = (side: Side) => {
    const lid = nextLesionId(lesions, side);
    updateDraft(id, (d) => ({
      ...d,
      lesions: [...d.lesions, blankLesion(lid, side)],
      ovaries: d.ovaries[side].status === 'normal' ? { ...d.ovaries, [side]: { ...d.ovaries[side], status: 'contains-lesion' } } : d.ovaries,
    }));
    setActive(lid);
  };
  const remove = (lid: string) => {
    if (!confirm(`Remove lesion ${lid}?`)) return;
    updateDraft(id, (d) => ({ ...d, lesions: d.lesions.filter((l) => l.id !== lid) }));
    setActive(null);
  };

  return (
    <StepShell step="lesions">
      <div className="card row between">
        <div className="tabs" role="tablist">
          {lesions.map((l) => (
            <button key={l.id} role="tab" aria-selected={current?.id === l.id} className={current?.id === l.id ? 'tab on' : 'tab'} onClick={() => setActive(l.id)}>{l.id}</button>
          ))}
          {lesions.length === 0 && <span className="muted">3 · No lesions yet — add one per lesion; bilateral lesions are scored separately.</span>}
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={() => add('right')} data-testid="add-right">+ Right lesion</button>
          <button className="btn" type="button" onClick={() => add('left')} data-testid="add-left">+ Left lesion</button>
          {current && <button className="btn ghost" type="button" onClick={() => remove(current.id)}>Remove {current.id}</button>}
        </div>
      </div>
      {current && (
        <LesionForm
          key={current.id}
          l={current}
          menopause={exam.draft.menopause}
          onChange={(fn) => updateDraft(id, (d) => ({ ...d, lesions: d.lesions.map((x) => (x.id === current.id ? fn(x) : x)) }))}
        />
      )}
    </StepShell>
  );
}
