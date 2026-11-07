'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  acknowledgeFlag, categoryLabel, confirmCategory, defaultRules as rules, editManagement, logReferrerCall, overrideCategory,
  sign, signingBlockers, submitForReview, type LesionAssessment, type ORadsCategory,
} from '@cfwu/engine';
import { Section, TextInput } from '@/components/fields';
import { ORadsChip } from '@/components/RiskPanel';
import { userById } from '@/lib/model';
import { useExam, useStore } from '@/lib/store';

const fmt = (iso: string) => new Date(iso).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });

function LesionDecision({ l, onError }: { l: LesionAssessment; onError: (e: string | null) => void }) {
  const { id } = useParams<{ id: string }>();
  const exam = useExam(id)!;
  const { act } = useStore();
  const d = exam.record.decisions[l.lesionId];
  const suggested = l.orads?.suggested ?? null;
  const [cat, setCat] = useState<ORadsCategory | null>(d?.finalCategory ?? suggested);
  const [reason, setReason] = useState('');
  const [mgmt, setMgmt] = useState('');
  const [mgmtReason, setMgmtReason] = useState('');
  const run = (fn: Parameters<typeof act>[1]) => { const r = act(id, fn); onError(r.ok ? null : r.error); return r.ok; };

  if (l.status === 'invalid') return <div className="card"><b>{l.lesionId}</b>: <span className="err-text">fix the validation errors on the Lesions step.</span></div>;
  if (l.status === 'excluded-acute') return <div className="card"><b>{l.lesionId}</b>: acute presentation — reported descriptively, no O-RADS assigned.</div>;

  const currentMgmt = d?.managementText ?? (d ? rules.management.byCategory[String(d.finalCategory)]?.recommendation : l.management?.recommendation) ?? '';

  return (
    <div className="card" data-testid={`decision-${l.lesionId}`}>
      <div className="card-head">
        <h2>{l.lesionId} · O-RADS decision</h2>
        <div className="row">
          <span className="muted small">Suggested</span><ORadsChip c={suggested} />
          {d && <><span className="muted small">Final</span><ORadsChip c={d.finalCategory} /></>}
        </div>
      </div>
      <p className="small muted">{l.orads?.basis}</p>
      {l.requiresLevelIIIReview && <p className="notice small">{rules.review.text} (advisory)</p>}

      {d && (
        <p className="small" data-testid={`decision-status-${l.lesionId}`}>
          {d.overridden ? <>Overridden to <b>{categoryLabel(rules, d.finalCategory)}</b> — reason: {d.overrideReason}</> : <>Confirmed <b>{categoryLabel(rules, d.finalCategory)}</b></>}
        </p>
      )}

      <div className="row wrap">
        {suggested !== null && (
          <button className="btn primary" data-testid={`confirm-${l.lesionId}`}
            onClick={() => run((r, u, at) => confirmCategory(r, l.lesionId, u, at))}>
            Confirm O-RADS {suggested}
          </button>
        )}
        <span className="muted small">or assign</span>
        <div className="seg" role="group" aria-label="Assign category">
          {([0, 1, 2, 3, 4, 5] as ORadsCategory[]).map((c) => (
            <button key={c} type="button" className={cat === c ? 'seg-btn on' : 'seg-btn'} aria-pressed={cat === c} onClick={() => setCat(c)} data-testid={`assign-${l.lesionId}-${c}`}>{c}</button>
          ))}
        </div>
      </div>
      {cat !== null && cat !== suggested && (
        <div className="grid2">
          <TextInput label="Override reason (mandatory)" value={reason} onChange={setReason} testId={`override-reason-${l.lesionId}`} />
          <div className="row end">
            <button className="btn warn" data-testid={`override-${l.lesionId}`}
              onClick={() => { if (run((r, u, at) => overrideCategory(r, l.lesionId, cat, reason, u, at))) setReason(''); }}>
              Override to O-RADS {cat}
            </button>
          </div>
        </div>
      )}

      <details className="mgmt">
        <summary>Management text {d?.managementText ? '(edited)' : ''}</summary>
        <p className="small">{currentMgmt}</p>
        <TextInput label="Edited management text" value={mgmt} onChange={setMgmt} multiline placeholder={currentMgmt} />
        <TextInput label="Reason for edit (mandatory, logged as override)" value={mgmtReason} onChange={setMgmtReason} />
        <button className="btn" onClick={() => { if (run((r, u, at) => editManagement(r, l.lesionId, mgmt, mgmtReason, u, at))) { setMgmt(''); setMgmtReason(''); } }}>Save edited management</button>
      </details>
    </div>
  );
}

export default function ReviewStep() {
  const { id } = useParams<{ id: string }>();
  const exam = useExam(id)!;
  const { act, commit, user } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [recipient, setRecipient] = useState('');
  // Commit the live draft once on entry so decisions apply to what was entered.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { commit(id); }, [id]);

  const r = exam.record;
  const a = r.assessment;
  const blockers = signingBlockers(r, user, rules);
  const run = (fn: Parameters<typeof act>[1]) => { const res = act(id, fn); setError(res.ok ? null : res.error); return res.ok; };

  if (r.status === 'signed') {
    return <div className="card"><p>Signed {r.signedAt && fmt(r.signedAt)} by {r.reportingClinician?.name}.</p><Link className="btn" href={`/exams/${id}/report`}>View report</Link></div>;
  }

  return (
    <div className="stack narrow">
      {error && <div className="alert-err" role="alert" data-testid="action-error">{error}</div>}

      <Section title="5 · Review" aside={<span className="muted small">Acting as {user.name}</span>}>
        <p className="small muted">The app suggests; the reporting clinician confirms or overrides each category, with a reason for any change.</p>
        {r.status === 'draft' || r.status === 'amended' ? (
          <button className="btn" data-testid="submit-review" onClick={() => run((rec, u, at) => submitForReview(rec, u, at))}>Submit for clinician review</button>
        ) : <p className="small">Status: <b>for review</b></p>}
      </Section>

      {a.lesions.length === 0 && <div className="card muted">No lesions — report ovaries and uterus only.</div>}
      {a.lesions.map((l) => <LesionDecision key={`${l.lesionId}-${l.orads?.suggested}`} l={l} onError={setError} />)}

      {a.flags.length > 0 && (
        <div className="redflag" role="alert">
          <strong>Red flags — must be acknowledged and the referrer called before signing</strong>
          <ul className="flag-list">
            {a.flags.map((f) => {
              const ack = r.acknowledgedFlags[f.key];
              return (
                <li key={f.key}>
                  <div><b>{f.detail}</b> — {f.message}</div>
                  {ack ? <span className="ok-text small">Acknowledged by {userById(ack.byUserId).name}, {fmt(ack.at)}</span>
                    : <button className="btn small" data-testid={`ack-${f.key}`} onClick={() => run((rec, u, at) => acknowledgeFlag(rec, f.key, u, at))}>Acknowledge</button>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Section title="Referrer communication">
        {r.referrerCall ? (
          <p data-testid="call-logged">Called <b>{r.referrerCall.recipient}</b> at {fmt(r.referrerCall.at)} ({userById(r.referrerCall.byUserId).name}).</p>
        ) : (
          <div className="grid2">
            <TextInput label="Who was called (name / role)" value={recipient} onChange={setRecipient} testId="call-recipient" />
            <div className="row end"><button className="btn" data-testid="log-call" onClick={() => { if (run((rec, u, at) => logReferrerCall(rec, recipient, u, at))) setRecipient(''); }}>Log call now</button></div>
          </div>
        )}
        <p className="small muted">Required for red flags, final O-RADS 4–5 and acute presentations. O-RADS 3: report to referrer within 24 h.</p>
      </Section>

      <Section title="Sign report">
        {blockers.length > 0 ? (
          <ul className="issues err" data-testid="blockers">{blockers.map((b, k) => <li key={k}>{b}</li>)}</ul>
        ) : <p className="ok-text">Ready to sign.</p>}
        <div className="row end">
          <button className="btn primary" disabled={blockers.length > 0} data-testid="sign"
            onClick={() => run((rec, u, at) => sign(rec, u, at, rules))}>Sign report</button>
        </div>
      </Section>
    </div>
  );
}
