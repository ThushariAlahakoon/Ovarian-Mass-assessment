'use client';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { STEPS } from '@/lib/steps';
import { useExam, useStore } from '@/lib/store';



export default function ExamLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const path = usePathname();
  const { hydrated, commit } = useStore();
  const exam = useExam(id);

  if (!hydrated) return <p className="muted">Loading…</p>;
  if (!exam) return <div className="card"><p>Examination not found in this browser.</p><Link href="/">Back to exams</Link></div>;

  const current = path.split('/').pop();
  const a = exam.record.assessment;
  return (
    <div className="stack">
      <div className="exam-head">
        <div>
          <h1 className="exam-title">{exam.patient.name} <span className="muted small">{exam.patient.mrn} · {exam.draft.age} y · {exam.draft.menopause ?? 'menopausal status not set'}</span></h1>
          <div className="muted small">{exam.meta.site} · {exam.meta.examDateTime.replace('T', ' ')} · <span className={`status status-${exam.record.status}`}>{exam.record.status}</span> · report v{exam.record.version}</div>
        </div>
        {a.flags.length > 0 && <span className="flag-count" title="Red flags">{a.flags.length} red flag{a.flags.length > 1 ? 's' : ''}</span>}
      </div>
      <nav className="stepper" aria-label="Examination steps">
        {STEPS.map((s) => (
          <Link
            key={s.slug}
            href={`/exams/${id}/${s.slug}`}
            className={current === s.slug ? 'step on' : 'step'}
            aria-current={current === s.slug ? 'step' : undefined}
            onClick={() => commit(id)}
            data-testid={`step-${s.slug}`}
          >
            <span className="step-n">{s.n}</span>{s.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
