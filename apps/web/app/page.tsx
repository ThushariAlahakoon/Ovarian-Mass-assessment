'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ORadsChip } from '@/components/RiskPanel';
import { useStore } from '@/lib/store';

const statusLabel: Record<string, string> = { draft: 'Draft', 'for-review': 'For review', signed: 'Signed', amended: 'Amended (draft)' };

export default function Home() {
  const { hydrated, state, newExam, seedDemo, resetAll, deleteExam } = useStore();
  const router = useRouter();
  if (!hydrated) return <p className="muted">Loading…</p>;
  const exams = state.order.map((id) => state.exams[id]!).filter(Boolean);

  return (
    <div className="stack">
      <div className="row between">
        <h1>Examinations</h1>
        <div className="row">
          <button className="btn" data-testid="seed-demo" onClick={seedDemo}>Load demo cases</button>
          <button className="btn primary" data-testid="new-exam" onClick={() => router.push(`/exams/${newExam()}/patient`)}>New examination</button>
        </div>
      </div>

      {exams.length === 0 ? (
        <div className="card empty">
          <p>No examinations yet.</p>
          <p className="muted">Start a new examination with a synthetic patient, or load the demo cases (BD1 endometrioma, O-RADS 4 with ADNEX 12%, malignant Simple Rules with ascites, 12 cm cyst needing ADNEX, postmenopausal ovaries not visualised).</p>
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr><th>Patient (synthetic)</th><th>Exam</th><th>Status</th><th>Lesions</th><th>O-RADS</th><th>Flags</th><th /></tr>
            </thead>
            <tbody>
              {exams.map((e) => {
                const a = e.record.assessment;
                const finals = Object.values(e.record.decisions).map((d) => d.finalCategory);
                const shown = finals.length ? (Math.max(...finals) as 0 | 1 | 2 | 3 | 4 | 5) : a.highestSuggested;
                return (
                  <tr key={e.id} data-testid="exam-row">
                    <td><Link href={`/exams/${e.id}/patient`}><b>{e.patient.name}</b></Link><div className="muted small">{e.patient.mrn}</div></td>
                    <td>{e.meta.examDateTime.replace('T', ' ')}<div className="muted small">{e.meta.site}</div></td>
                    <td><span className={`status status-${e.record.status}`}>{statusLabel[e.record.status]}</span> <span className="muted small">v{e.record.version}</span></td>
                    <td>{e.draft.lesions.map((l) => l.id).join(', ') || '–'}</td>
                    <td><ORadsChip c={shown} /></td>
                    <td>{a.flags.length ? <span className="flag-count">{a.flags.length}</span> : '–'}</td>
                    <td className="right">
                      <Link className="btn small" href={`/exams/${e.id}/${e.record.status === 'signed' ? 'report' : 'patient'}`}>Open</Link>
                      {e.record.status !== 'signed' && (
                        <button className="btn small ghost" onClick={() => { if (confirm('Delete this synthetic exam?')) deleteExam(e.id); }}>Delete</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="row">
        <button className="btn ghost small" onClick={() => { if (confirm('Remove all prototype data from this browser?')) resetAll(); }}>Reset all prototype data</button>
        <span className="muted small">Data is stored only in this browser (prototype). Phase 2 moves it to a secure database.</span>
      </div>
    </div>
  );
}
