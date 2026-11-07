'use client';
// Tablet-friendly inputs: large touch targets, segmented buttons for IOTA choices.
import { useId, type ReactNode } from 'react';

export function Field({ label, hint, children, required }: { label: string; hint?: ReactNode; children: ReactNode; required?: boolean }) {
  return (
    <div className="field">
      <div className="field-label">{label}{required && <span className="req" aria-hidden> *</span>}</div>
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

export interface Opt<T> { value: T; label: string }

export function Segmented<T extends string | number | boolean | null>({
  label, value, options, onChange, required, hint, testId,
}: { label: string; value: T | null | undefined; options: Opt<T>[]; onChange: (v: T) => void; required?: boolean; hint?: ReactNode; testId?: string }) {
  return (
    <Field label={label} required={required} hint={hint}>
      <div className="seg" role="group" aria-label={label} data-testid={testId}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            className={value === o.value ? 'seg-btn on' : 'seg-btn'}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

function parseNum(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function NumberInput({
  label, value, onChange, unit, step = 'any', required, hint, testId, min = 0,
}: { label: string; value: number | null | undefined; onChange: (v: number | null) => void; unit?: string; step?: string; required?: boolean; hint?: ReactNode; testId?: string; min?: number }) {
  const id = useId();
  return (
    <Field label={label} required={required} hint={hint}>
      <div className="num">
        <input
          id={id}
          aria-label={label}
          data-testid={testId}
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={value ?? ''}
          onChange={(e) => onChange(parseNum(e.target.value))}
        />
        {unit && <span className="unit">{unit}</span>}
      </div>
    </Field>
  );
}

export type Triple = [number, number, number];

export function TripleInput({
  label, value, onChange, required, hint, testId,
}: { label: string; value: Triple | null | undefined; onChange: (v: Triple) => void; required?: boolean; hint?: ReactNode; testId?: string }) {
  const v: Triple = value ?? [0, 0, 0];
  const set = (i: number, n: number | null) => {
    const next: Triple = [...v] as Triple;
    next[i] = n ?? 0;
    onChange(next);
  };
  return (
    <Field label={label} required={required} hint={hint}>
      <div className="triple" data-testid={testId}>
        {[0, 1, 2].map((i) => (
          <div className="num" key={i}>
            <input
              aria-label={`${label} ${i + 1}`}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={v[i] ? v[i] : ''}
              onChange={(e) => set(i, parseNum(e.target.value))}
            />
            {i < 2 ? <span className="x">×</span> : <span className="unit">mm</span>}
          </div>
        ))}
      </div>
    </Field>
  );
}

export function TextInput({
  label, value, onChange, placeholder, required, hint, testId, type = 'text', multiline,
}: { label: string; value: string | null | undefined; onChange: (v: string) => void; placeholder?: string; required?: boolean; hint?: ReactNode; testId?: string; type?: string; multiline?: boolean }) {
  return (
    <Field label={label} required={required} hint={hint}>
      {multiline ? (
        <textarea aria-label={label} data-testid={testId} value={value ?? ''} placeholder={placeholder} rows={3} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input aria-label={label} data-testid={testId} type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

export function Check({ label, checked, onChange, testId }: { label: string; checked: boolean | null | undefined; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <label className="check">
      <input type="checkbox" data-testid={testId} checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="card">
      <div className="card-head"><h2>{title}</h2>{aside}</div>
      {children}
    </section>
  );
}
