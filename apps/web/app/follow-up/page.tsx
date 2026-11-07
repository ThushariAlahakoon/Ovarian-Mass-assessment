'use client';
import { FollowUpTable } from '@/components/FollowUpTable';
import { useStore } from '@/lib/store';

export default function FollowUpList() {
  const { hydrated } = useStore();
  if (!hydrated) return <p className="muted">Loading…</p>;
  return (
    <div className="stack">
      <h1>Follow-up due list</h1>
      <p className="muted small">All follow-ups across examinations, earliest first. Record the outcome (resolved / stable / surgery) and histology for the annual audit.</p>
      <FollowUpTable />
    </div>
  );
}
