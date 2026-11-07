'use client';
import Link from 'next/link';
import type { FollowUpOutcome } from '@/lib/model';
import { useStore } from '@/lib/store';

const OUTCOMES: FollowUpOutcome[] = ['pending', 'resolved', 'stable', 'surgery'];

export function FollowUpTable({ examIds }: { examIds?: string[] }) {
  const { state, updateFollowUp } = useStore();
  const today = new Date().toISOString().slice(0, 10);
  const ids = examIds ?? state.order;
  const rows = ids.flatMap((eid) => {
    const e = state.exams[eid];
    return e ? e.followUps.map((f) => ({ e, f })) : [];
  }).sort((a, b) => a.f.dueDate.localeCompare(b.f.dueDate));

  if (rows.length === 0) return <div className="card muted">No follow-ups recorded.</div>;

  return (
    <div className="card table-wrap">
      <table className="table" data-testid="follow-up-table">
        <thead><tr><th>Due</th><th>Patient (synthetic)</th><th>Lesion</th><th>Reason</th><th>Outcome</th><th>Histology</th></tr></thead>
        <tbody>
          {rows.map(({ e, f }) => {
            const overdue = f.outcome === 'pending' && f.dueDate < today;
            return (
              <tr key={f.id} className={overdue ? 'overdue' : undefined}>
                <td>{f.dueDate}{overdue && <div className="err-text small">Overdue</div>}</td>
                <td><Link href={`/exams/${e.id}/report`}>{e.patient.name}</Link><div className="muted small">exam {e.meta.examDateTime.slice(0, 10)}</div></td>
                <td>{f.lesionId ?? 'exam'}</td>
                <td>{f.reason}</td>
                <td>
                  <select aria-label="Outcome" value={f.outcome} onChange={(ev) => updateFollowUp(e.id, f.id, { outcome: ev.target.value as FollowUpOutcome })}>
                    {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td>
                  <input aria-label="Histology" value={f.histology} placeholder={f.outcome === 'surgery' ? 'histology result' : ''} onChange={(ev) => updateFollowUp(e.id, f.id, { histology: ev.target.value })} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
