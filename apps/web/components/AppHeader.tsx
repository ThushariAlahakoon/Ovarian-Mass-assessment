'use client';
import Link from 'next/link';
import { defaultRules } from '@cfwu/engine';
import { USERS } from '@/lib/model';
import { useStore } from '@/lib/store';

export function AppHeader() {
  const { user, setUser, hydrated } = useStore();
  return (
    <>
      <div className="proto-banner" role="note">
        PROTOTYPE — SYNTHETIC DATA ONLY — NOT FOR CLINICAL USE · Rules {defaultRules.rulesVersion}
      </div>
      <header className="topbar">
        <Link href="/" className="brand">CFWU Adnexal Mass</Link>
        <nav className="topnav">
          <Link href="/">Exams</Link>
          <Link href="/follow-up">Follow-up</Link>
        </nav>
        <label className="user-switch">
          <span className="muted small">Acting as</span>
          <select
            aria-label="Acting as user"
            data-testid="user-switch"
            value={hydrated ? user.id : ''}
            onChange={(e) => setUser(e.target.value)}
          >
            {USERS.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>
      </header>
    </>
  );
}
