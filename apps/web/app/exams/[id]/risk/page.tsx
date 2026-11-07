'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RiskPanel } from '@/components/RiskPanel';
import { useExam, useStore } from '@/lib/store';

export default function RiskStep() {
  const { id } = useParams<{ id: string }>();
  const exam = useExam(id)!;
  const { commit } = useStore();
  return (
    <div className="stack narrow">
      <RiskPanel input={exam.draft} />
      <div className="row end">
        <Link className="btn" href={`/exams/${id}/lesions`} onClick={() => commit(id)}>Back to lesions</Link>
        <Link className="btn primary" href={`/exams/${id}/review`} onClick={() => commit(id)} data-testid="next-step">Save &amp; continue to review</Link>
      </div>
    </div>
  );
}
