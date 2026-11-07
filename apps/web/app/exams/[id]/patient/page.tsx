'use client';
import { useParams } from 'next/navigation';
import { Check, NumberInput, Section, Segmented, TextInput } from '@/components/fields';
import { StepShell } from '@/components/StepShell';
import { SITES } from '@/lib/model';
import { useExam, useStore } from '@/lib/store';

export default function PatientStep() {
  const { id } = useParams<{ id: string }>();
  const exam = useExam(id)!;
  const { updatePatient, updateMeta, updateDraft } = useStore();
  const { patient: p, meta: m, draft: d } = exam;
  const rf = d.riskFactors ?? {};

  return (
    <StepShell step="patient">
      <Section title="1 · Patient (synthetic)" aside={<span className="muted small">Never enter real patient details in the prototype</span>}>
        <div className="grid3">
          <TextInput label="Name" value={p.name} onChange={(v) => updatePatient(id, { ...p, name: v })} testId="patient-name" />
          <TextInput label="MRN (Gentu)" value={p.mrn} onChange={(v) => updatePatient(id, { ...p, mrn: v })} />
          <TextInput label="Date of birth" type="date" value={p.dob} onChange={(v) => updatePatient(id, { ...p, dob: v })} testId="patient-dob" hint={`Age at exam: ${d.age} y`} />
        </div>
      </Section>

      <Section title="Examination">
        <div className="grid3">
          <Segmented label="Site" value={m.site} options={SITES.map((s) => ({ value: s, label: s }))} onChange={(v) => updateMeta(id, { ...m, site: v })} />
          <TextInput label="Date / time" type="datetime-local" value={m.examDateTime} onChange={(v) => updateMeta(id, { ...m, examDateTime: v })} />
          <Segmented label="Centre type (ADNEX)" value={d.centreType ?? 'non-oncology'} options={[{ value: 'non-oncology', label: 'Non-oncology centre' }, { value: 'oncology', label: 'Oncology centre' }]}
            onChange={(v) => updateDraft(id, (x) => ({ ...x, centreType: v }))} hint="Non-oncology unless scanned in a tertiary gyn-oncology unit." />
        </div>
      </Section>

      <Section title="Clinical data (mandatory for risk models)">
        <div className="grid3">
          <Segmented
            label="Menopausal status" required testId="menopause"
            value={d.menopause}
            options={[{ value: 'premenopausal', label: 'Premenopausal' }, { value: 'postmenopausal', label: 'Postmenopausal' }]}
            onChange={(v) => updateDraft(id, (x) => ({ ...x, menopause: v }))}
            hint="Postmenopausal = ≥12 months amenorrhoea, or age ≥50 after hysterectomy."
          />
          <TextInput label="LMP / cycle day" value={d.lmpOrCycleDay} onChange={(v) => updateDraft(id, (x) => ({ ...x, lmpOrCycleDay: v || null }))} />
          <TextInput label="Hormonal therapy" value={m.hormones} onChange={(v) => updateMeta(id, { ...m, hormones: v })} />
          <TextInput label="Symptoms / indication" value={m.symptoms} onChange={(v) => updateMeta(id, { ...m, symptoms: v })} placeholder="pain, bloating, early satiety, bleeding…" />
          <Segmented label="Pregnant" value={!!d.pregnant} options={[{ value: false, label: 'No' }, { value: true, label: 'Yes' }]} onChange={(v) => updateDraft(id, (x) => ({ ...x, pregnant: v }))} />
          <Segmented
            label="Acute presentation suspected"
            value={d.acuteCondition ?? null}
            options={[{ value: null, label: 'None' }, { value: 'torsion', label: 'Torsion' }, { value: 'ectopic', label: 'Ectopic' }, { value: 'toa-pid', label: 'TOA / PID' }]}
            onChange={(v) => updateDraft(id, (x) => ({ ...x, acuteCondition: v }))}
            hint="Acute presentations are reported descriptively; no O-RADS."
          />
        </div>
        <div className="checks">
          <Check label="Family history (ovarian, breast, bowel, endometrial cancer)" checked={rf.familyHistory} onChange={(v) => updateDraft(id, (x) => ({ ...x, riskFactors: { ...x.riskFactors, familyHistory: v } }))} />
          <Check label="BRCA" checked={rf.brca} onChange={(v) => updateDraft(id, (x) => ({ ...x, riskFactors: { ...x.riskFactors, brca: v } }))} />
          <Check label="Lynch" checked={rf.lynch} onChange={(v) => updateDraft(id, (x) => ({ ...x, riskFactors: { ...x.riskFactors, lynch: v } }))} />
          <Check label="Prior adnexal surgery" checked={m.priorAdnexalSurgery} onChange={(v) => updateMeta(id, { ...m, priorAdnexalSurgery: v })} />
          <Check label="Endometriosis" checked={m.endometriosis} onChange={(v) => updateMeta(id, { ...m, endometriosis: v })} />
        </div>
      </Section>

      <Section title="Bloods (if available)">
        <div className="grid3">
          <NumberInput label="CA125" unit="U/mL" value={d.ca125?.value ?? null}
            onChange={(v) => updateDraft(id, (x) => ({ ...x, ca125: v === null ? null : { value: v, date: x.ca125?.date ?? '' } }))}
            hint="Absence of CA125 does not delay the scan — ADNEX can run without it." testId="ca125" />
          <TextInput label="CA125 date" type="date" value={d.ca125?.date ?? ''}
            onChange={(v) => updateDraft(id, (x) => (x.ca125 ? { ...x, ca125: { ...x.ca125, date: v } } : x))} />
        </div>
      </Section>
    </StepShell>
  );
}
