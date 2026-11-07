'use client';
// Live risk panel (Spec screen 4). Re-runs the rules engine on every change to the draft.
import { assessExam, categoryLabel, defaultRules as rules, type ExamInput, type LesionAssessment, type ORadsCategory } from '@cfwu/engine';

export function ORadsChip({ c, size = 'md' }: { c: ORadsCategory | null | undefined; size?: 'md' | 'lg' }) {
  if (c === null || c === undefined) return <span className={`chip chip-none ${size}`}>O-RADS –</span>;
  return <span className={`chip chip-o${c} ${size}`} title={categoryLabel(rules, c)}>O-RADS {c}</span>;
}

const pct = (n: number) => `${Number(n.toFixed(1))}%`;

function LesionCard({ l }: { l: LesionAssessment }) {
  const errors = l.issues.filter((i) => i.severity === 'error');
  const warnings = l.issues.filter((i) => i.severity === 'warning');
  return (
    <div className="risk-lesion" data-testid={`risk-${l.lesionId}`}>
      <div className="risk-lesion-head">
        <strong>{l.lesionId}</strong>
        {l.status === 'excluded-acute' ? <span className="chip chip-none">O-RADS not assigned</span> : <ORadsChip c={l.orads?.suggested} />}
      </div>

      {errors.length > 0 && (
        <ul className="issues err">{errors.map((i, k) => <li key={k}>{i.message}</li>)}</ul>
      )}
      {l.status === 'invalid' && <p className="muted">No result until the errors above are corrected.</p>}

      {l.status !== 'invalid' && (
        <dl className="kv">
          {l.status === 'excluded-acute' && <><dt>Acute</dt><dd>{rules.specialSituations.acute.text}</dd></>}
          {l.physiological && <><dt>Step 1</dt><dd>Physiological → O-RADS 1</dd></>}
          {!l.physiological && l.status === 'assessed' && (
            <>
              <dt>Benign descriptor</dt>
              <dd data-testid={`bd-${l.lesionId}`}>
                {l.benignDescriptor?.applies ? <><b>{l.benignDescriptor.id}</b> applies — {l.benignDescriptor.text}</> : <>Not applicable. {l.benignDescriptor?.reason}</>}
              </dd>
              <dt>ADNEX</dt>
              <dd>
                {l.benignDescriptor?.applies ? 'Not needed (BD applies)'
                  : l.adnex ? <>{pct(l.adnex.total)} total ({l.adnex.withCa125 ? 'with' : 'without'} CA125) → O-RADS {l.orads?.fromAdnex}<br />
                    <span className="muted small">benign {pct(l.adnex.benign)} · borderline {pct(l.adnex.borderline)} · stage I {pct(l.adnex.stageI)} · II–IV {pct(l.adnex.stageIIToIV)} · metastatic {pct(l.adnex.metastatic)}</span></>
                  : <span className="warn-text">Required — enter the result from the IOTA app</span>}
              </dd>
              {l.orads?.fromDescriptors != null && <><dt>Descriptors</dt><dd>O-RADS {l.orads.fromDescriptors} (clinician)</dd></>}
            </>
          )}
          {l.simpleRules && (
            <>
              <dt>Simple Rules</dt>
              <dd data-testid={`sr-${l.lesionId}`}>
                <span className={`sr sr-${l.simpleRules.result}`}>{l.simpleRules.result}</span>{' '}
                B: {l.simpleRules.bFeatures.map((f) => f.id).join(', ') || 'none'} · M: {l.simpleRules.mFeatures.map((f) => f.id).join(', ') || 'none'}
              </dd>
            </>
          )}
          {l.orads?.basis && <><dt>Basis</dt><dd className="small">{l.orads.basis}</dd></>}
          {l.management && (
            <>
              <dt>Management</dt>
              <dd className="small">{l.management.recommendation}<br /><b>{l.management.communication}</b>
                {l.management.additional.map((a, k) => <div key={k} className="warn-text">{a}</div>)}
              </dd>
            </>
          )}
        </dl>
      )}
      {warnings.length > 0 && <ul className="issues warn">{warnings.map((i, k) => <li key={k}>{i.message}</li>)}</ul>}
    </div>
  );
}

export function RiskPanel({ input, compact }: { input: ExamInput; compact?: boolean }) {
  const a = assessExam(input, rules);
  const examErrors = a.issues.filter((i) => i.severity === 'error');
  const examWarnings = a.issues.filter((i) => i.severity === 'warning');
  return (
    <div className={compact ? 'risk compact' : 'risk'} data-testid="risk-panel" aria-live="polite">
      <div className="risk-top">
        <div>
          <div className="eyebrow">Live risk panel</div>
          <div className="muted small">Rules {a.rulesVersion}{a.rulesSignedOff ? '' : ' (draft)'}</div>
        </div>
        <div className="risk-highest"><span className="muted small">Highest</span><ORadsChip c={a.highestSuggested} size="lg" /></div>
      </div>

      {a.flags.length > 0 && (
        <div className="redflag" role="alert" data-testid="red-flags">
          <strong>Red flag — same-day review before the patient leaves</strong>
          <ul>{a.flags.map((f) => <li key={f.key}><b>{f.detail}</b> — {f.message}</li>)}</ul>
        </div>
      )}

      {examErrors.length > 0 && <ul className="issues err">{examErrors.map((i, k) => <li key={k}>{i.message}</li>)}</ul>}
      {examWarnings.length > 0 && <ul className="issues warn">{examWarnings.map((i, k) => <li key={k}>{i.message}</li>)}</ul>}

      {a.lesions.length === 0 && <p className="muted">No lesions entered.</p>}
      {a.lesions.map((l) => <LesionCard key={l.lesionId} l={l} />)}

      {a.rmi && (
        <div className="risk-rmi small">
          <b>RMI U-score features:</b> {a.rmi.uFeatures.join(', ') || 'none'}
          {' · '}{a.rmi.score !== null ? <>RMI-I <b>{Math.round(a.rmi.score)}</b></> : 'RMI not calculated (no CA125)'}
        </div>
      )}
      {!compact && a.notices.length > 0 && (
        <ul className="notices">{a.notices.map((n, k) => <li key={k}>{n}</li>)}</ul>
      )}
    </div>
  );
}
