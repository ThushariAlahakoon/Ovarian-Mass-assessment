'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { defaultRules as rules } from '@cfwu/engine';
import { Section, Segmented, TextInput } from '@/components/fields';
import { FollowUpTable } from '@/components/FollowUpTable';
import { useExam, useStore } from '@/lib/store';

export default function ExamFollowUp() {
  const { id } = useParams<{ id: string }>();
  const exam = useExam(id)!;
  const { addFollowUp } = useStore();
  const [lesionId, setLesionId] = useState<string | null>(exam.draft.lesions[0]?.id ?? null);
  const [due, setDue] = useState('');
  const [reason, setReason] = useState('');
  const recs = exam.record.assessment.lesions
    .map((l) => ({ id: l.lesionId, cat: exam.record.decisions[l.lesionId]?.finalCategory ?? l.orads?.suggested ?? null, rec: exam.record.decisions[l.lesionId]?.managementText ?? l.management?.recommendation }))
    .filter((x) => x.rec);

  return (
    <div className="stack narrow">
      <Section title="7 · Follow-up for this examination">
        {recs.length > 0 && (
          <ul className="small">
            {recs.map((x) => <li key={x.id}><b>{x.id}</b> (O-RADS {x.cat ?? '–'}): {x.rec}</li>)}
          </ul>
        )}
        <p className="small muted">Set the due date from the recommendation above. {rules.management.followUp}</p>
        <div className="grid3">
          <Segmented label="Lesion" value={lesionId} options={[{ value: null, label: 'Whole exam' }, ...exam.draft.lesions.map((l) => ({ value: l.id, label: l.id }))]} onChange={setLesionId} />
          <TextInput label="Due date" type="date" value={due} onChange={setDue} testId="fu-due" />
          <TextInput label="Reason" value={reason} onChange={setReason} placeholder="e.g. rescan 8–12 weeks, haemorrhagic cyst" testId="fu-reason" />
        </div>
        <div className="row end">
          <button className="btn primary" disabled={!due || !reason.trim()} data-testid="fu-add"
            onClick={() => { addFollowUp(id, { lesionId, dueDate: due, reason: reason.trim(), outcome: 'pending', histology: '' }); setDue(''); setReason(''); }}>
            Add follow-up
          </button>
        </div>
      </Section>
      <FollowUpTable examIds={[id]} />
      <p className="small"><Link href="/follow-up">All follow-ups due →</Link></p>
    </div>
  );
}
