'use client';
import { useParams } from 'next/navigation';
import type { OvaryFinding, OvaryStatus } from '@cfwu/engine';
import { Check, NumberInput, Section, Segmented, TextInput, TripleInput } from '@/components/fields';
import { StepShell } from '@/components/StepShell';
import { useExam, useStore } from '@/lib/store';

const OVARY_OPTS: { value: OvaryStatus; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'contains-lesion', label: 'Contains lesion' },
  { value: 'not-visualised', label: 'Not visualised' },
];

type Fluid = 'none' | 'pod' | 'ascites';

export default function SurveyStep() {
  const { id } = useParams<{ id: string }>();
  const exam = useExam(id)!;
  const { updateDraft, updateMeta } = useStore();
  const { draft: d, meta: m } = exam;
  const ua = d.upperAbdomen ?? { assessed: false };

  const fluid: Fluid | null = d.ascites === true ? 'ascites' : d.ascites === false ? (d.podFluidDepthMm ? 'pod' : 'none') : null;
  const setFluid = (f: Fluid) =>
    updateDraft(id, (x) => ({ ...x, ascites: f === 'ascites', podFluidDepthMm: f === 'pod' ? (x.podFluidDepthMm || null) : null }));
  const setOvary = (side: 'right' | 'left', o: OvaryFinding) => updateDraft(id, (x) => ({ ...x, ovaries: { ...x.ovaries, [side]: o } }));

  return (
    <StepShell step="survey">
      <Section title="2 · Technique and image quality">
        <div className="checks">
          <Check label="Transvaginal" checked={m.techniques.tv} onChange={(v) => updateMeta(id, { ...m, techniques: { ...m.techniques, tv: v } })} />
          <Check label="Transabdominal" checked={m.techniques.ta} onChange={(v) => updateMeta(id, { ...m, techniques: { ...m.techniques, ta: v } })} />
          <Check label="Transrectal" checked={m.techniques.tr} onChange={(v) => updateMeta(id, { ...m, techniques: { ...m.techniques, tr: v } })} />
        </div>
        <div className="grid3">
          <Segmented label="Image quality" value={d.imageQuality?.good ?? true} options={[{ value: true, label: 'Good' }, { value: false, label: 'Limited' }]}
            onChange={(v) => updateDraft(id, (x) => ({ ...x, imageQuality: { good: v, reason: v ? undefined : x.imageQuality?.reason } }))} />
          {d.imageQuality?.good === false && (
            <TextInput label="Limitation reason" value={d.imageQuality.reason} onChange={(v) => updateDraft(id, (x) => ({ ...x, imageQuality: { good: false, reason: v } }))} />
          )}
        </div>
      </Section>

      <Section title="Uterus">
        <TextInput label="Size, endometrial thickness and pattern, other findings" value={d.uterus} multiline
          onChange={(v) => updateDraft(id, (x) => ({ ...x, uterus: v || null }))} />
      </Section>

      <Section title="Ovaries">
        {(['right', 'left'] as const).map((side) => {
          const o = d.ovaries[side];
          return (
            <div className="grid2" key={side}>
              <Segmented label={`${side === 'right' ? 'Right' : 'Left'} ovary`} value={o.status} options={OVARY_OPTS} testId={`ovary-${side}`}
                onChange={(v) => setOvary(side, { ...o, status: v })}
                hint={o.status === 'not-visualised' ? 'Document; try transabdominal. The report will say "not visualised", not "normal".' : undefined} />
              {o.status !== 'not-visualised' && (
                <TripleInput label="Dimensions" value={o.dimensionsMm ?? null} onChange={(v) => setOvary(side, { ...o, dimensionsMm: v })} />
              )}
            </div>
          );
        })}
      </Section>

      <Section title="Free fluid">
        <div className="grid2">
          <Segmented label="Free fluid" required value={fluid} testId="fluid"
            options={[{ value: 'none', label: 'None' }, { value: 'pod', label: 'Pouch of Douglas only' }, { value: 'ascites', label: 'Ascites' }]}
            onChange={setFluid}
            hint="Ascites (IOTA) = fluid outside the pouch of Douglas." />
          {fluid === 'pod' && (
            <NumberInput label="POD depth" unit="mm" value={d.podFluidDepthMm} onChange={(v) => updateDraft(id, (x) => ({ ...x, podFluidDepthMm: v }))} />
          )}
        </div>
      </Section>

      <Section title="Upper abdomen (transabdominal)" aside={<span className="muted small">Required when O-RADS ≥4 or any M feature</span>}>
        <Check label="Upper abdomen assessed" checked={ua.assessed} onChange={(v) => updateDraft(id, (x) => ({ ...x, upperAbdomen: { ...ua, assessed: v } }))} />
        {ua.assessed && (
          <div className="checks">
            <Check label="Fluid in Morison's pouch" checked={ua.morisonPouchFluid} onChange={(v) => updateDraft(id, (x) => ({ ...x, upperAbdomen: { ...ua, morisonPouchFluid: v } }))} />
            <Check label="Omental thickening / cake" checked={ua.omentalCake} onChange={(v) => updateDraft(id, (x) => ({ ...x, upperAbdomen: { ...ua, omentalCake: v } }))} />
            <Check label="Peritoneal nodules" checked={ua.peritonealNodules} onChange={(v) => updateDraft(id, (x) => ({ ...x, upperAbdomen: { ...ua, peritonealNodules: v } }))} />
            <Check label="Hydronephrosis" checked={ua.hydronephrosis} onChange={(v) => updateDraft(id, (x) => ({ ...x, upperAbdomen: { ...ua, hydronephrosis: v } }))} />
            <Check label="Pleural effusion" checked={ua.pleuralEffusion} onChange={(v) => updateDraft(id, (x) => ({ ...x, upperAbdomen: { ...ua, pleuralEffusion: v } }))} />
          </div>
        )}
      </Section>
    </StepShell>
  );
}
