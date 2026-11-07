'use client';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { amend, defaultRules as rules, generateReportText, type ExamRecord } from '@cfwu/engine';
import { Section, TextInput } from '@/components/fields';
import { techniqueText, userById, type StoredExam } from '@/lib/model';
import { useExam, useStore } from '@/lib/store';

const fmt = (iso: string) => new Date(iso).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });

function reportFor(exam: StoredExam, rec: ExamRecord): string {
  // Header with synthetic patient identifiers; the engine report body follows.
  const head = [
    `Patient: ${exam.patient.name} | MRN ${exam.patient.mrn} | DOB ${exam.patient.dob}`,
    `Site: ${exam.meta.site} | Exam: ${exam.meta.examDateTime.replace('T', ' ')}`,
    '',
  ].join('\n');
  return head + generateReportText({ ...rec, input: { ...rec.input, technique: rec.input.technique ?? techniqueText(exam.meta.techniques) } }, rules);
}

export default function ReportStep() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const exam = useExam(id)!;
  const { act } = useStore();
  const [viewVersion, setViewVersion] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const r = exam.record;
  const shown = viewVersion === null ? r : r.history.find((h) => h.version === viewVersion) ?? r;
  const text = reportFor(exam, shown);

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setMsg('Copied — paste into the Gentu report.'); }
    catch { setMsg('Copy failed — select the text and copy manually.'); }
  };

  return (
    <div className="stack narrow">
      <div className="row between no-print">
        <div className="row">
          <span className={`status status-${shown.status}`}>{shown.status}</span>
          <span className="muted small">Report version {shown.version}{shown !== r ? ' (historical)' : ''}</span>
        </div>
        <div className="row">
          <button className="btn" onClick={copy} data-testid="copy-report">Copy text for Gentu</button>
          <button className="btn" onClick={() => window.print()}>Print / save PDF</button>
        </div>
      </div>
      {msg && <div className="notice no-print">{msg}</div>}
      {r.status !== 'signed' && <div className="notice no-print">Preview — not signed yet. Sign on the Review step.</div>}

      <pre className="report" data-testid="report-text">{text}</pre>

      {r.history.length > 0 && (
        <Section title="Versions">
          <div className="row wrap no-print">
            {[...r.history, r].map((h) => (
              <button key={h.version} className={(viewVersion ?? r.version) === h.version ? 'btn small on' : 'btn small'}
                onClick={() => setViewVersion(h.version === r.version ? null : h.version)}>
                v{h.version} · {h.status}
              </button>
            ))}
          </div>
        </Section>
      )}

      {r.status === 'signed' && (
        <Section title="Amend signed report">
          <p className="small muted">Amending creates a new version; the signed version is kept unchanged.</p>
          <div className="grid2">
            <TextInput label="Amendment reason (mandatory)" value={reason} onChange={setReason} testId="amend-reason" />
            <div className="row end">
              <button className="btn warn" data-testid="amend" onClick={() => {
                const res = act(id, (rec, u, at) => amend(rec, reason, u, at));
                if (res.ok) router.push(`/exams/${id}/patient`); else setMsg(res.error);
              }}>Amend</button>
            </div>
          </div>
        </Section>
      )}

      <Section title="Audit log">
        <div className="table-wrap">
          <table className="table small" data-testid="audit-log">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Lesion</th><th>Detail</th></tr></thead>
            <tbody>
              {[...r.audit].reverse().map((e, k) => (
                <tr key={k}>
                  <td>{fmt(e.at)}</td>
                  <td>{userById(e.userId).name}</td>
                  <td>{e.action}</td>
                  <td>{e.lesionId ?? ''}</td>
                  <td>{[e.from !== undefined && `from ${JSON.stringify(e.from)}`, e.to !== undefined && `to ${JSON.stringify(e.to)}`, e.reason && `reason: ${e.reason}`].filter(Boolean).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
