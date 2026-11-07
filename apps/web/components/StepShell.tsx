'use client';
import { useParams, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { RiskPanel } from '@/components/RiskPanel';
import { nextStep, type StepSlug } from '@/lib/steps';
import { useExam, useStore } from '@/lib/store';

/** Form step with the live risk panel alongside. Locks the form when the report is signed. */
export function StepShell({ step, children }: { step: StepSlug; children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { commit } = useStore();
  const exam = useExam(id)!;
  const locked = exam.record.status === 'signed';
  const next = nextStep(step);

  return (
    <div className="with-panel">
      <div className="stack">
        {locked && (
          <div className="notice">This report is signed and read-only. Open <b>Report</b> and choose <b>Amend</b> to change it.</div>
        )}
        <fieldset disabled={locked} className="plain">{children}</fieldset>
        {next && (
          <div className="row end">
            <button
              className="btn primary"
              data-testid="next-step"
              onClick={() => { commit(id); router.push(`/exams/${id}/${next}`); }}
            >
              Save &amp; continue
            </button>
          </div>
        )}
      </div>
      <aside className="panel-col"><RiskPanel input={exam.draft} compact /></aside>
    </div>
  );
}
