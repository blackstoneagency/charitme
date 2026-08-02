'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

type Nonprofit = { id: string; name: string };
type Day = {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  ends_at: string;
  goal_amount: number | null;
  phase: 'upcoming' | 'live' | 'ended';
  raisedCents: number;
};

/**
 * The first thing in the product that can put a row in `giving_days`.
 *
 * The window inputs are `datetime-local`, which produces a value with NO time
 * zone. Sending that string straight to a `timestamptz` column would have the
 * database read it as UTC, so a giving day scheduled for 9am local would open at
 * 9am UTC — hours early or late depending on where the organiser sits. It is
 * converted through `new Date(...).toISOString()` here, in the browser, which is
 * the only place the organiser's zone is actually known.
 */
export default function GivingDaysClient({
  nonprofits,
  initialDays,
  loadFailed,
}: {
  nonprofits: Nonprofit[];
  initialDays: Day[];
  loadFailed: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [nonprofitId, setNonprofitId] = useState(nonprofits[0]?.id ?? '');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = title.trim().length >= 3 && nonprofitId && startsAt && endsAt && !busy;

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    // Validate the window here as well as on the server. The server is the
    // authority; this exists so the organiser is told before a round trip.
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (!(start.getTime() < end.getTime())) {
      setError('The end has to come after the start.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/giving-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          nonprofitId,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          goalAmountCents: goal ? Math.round(Number(goal) * 100) : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Could not save that.');
        return;
      }
      setTitle(''); setStartsAt(''); setEndsAt(''); setGoal('');
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/giving-days', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) setError('Could not delete that.');
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (nonprofits.length === 0) {
    return (
      <p style={{ fontSize: 14.5, color: 'var(--t2)', maxWidth: 620, lineHeight: 1.65 }}>
        {/* Said plainly rather than showing a form whose every submission would
            be refused: the table's foreign key requires a nonprofit profile. */}
        A giving day belongs to a nonprofit profile, and this account does not own
        one yet. Set one up under <a href="/dashboard/nonprofit">Your Organization</a> and
        this page turns on.
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 22, maxWidth: 760 }}>
      <form onSubmit={create} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, padding: 18, border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s1)' }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 750, color: 'var(--t1)' }}>Schedule a giving day</h2>

        <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 5 }}>
          <span style={labelStyle}>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Giving Tuesday 2026" style={inputStyle} required minLength={3} maxLength={120} />
        </label>

        {nonprofits.length > 1 && (
          <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 5 }}>
            <span style={labelStyle}>Organisation</span>
            <select value={nonprofitId} onChange={(e) => setNonprofitId(e.target.value)} style={inputStyle}>
              {nonprofits.map((np) => <option key={np.id} value={np.id}>{np.name}</option>)}
            </select>
          </label>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 5 }}>
            <span style={labelStyle}>Opens</span>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} style={inputStyle} required />
          </label>
          <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 5 }}>
            <span style={labelStyle}>Closes</span>
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} style={inputStyle} required />
          </label>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--t3)', margin: 0 }}>
          Times are in your device&rsquo;s time zone and stored as an exact instant,
          so the window opens when you mean it to wherever a donor is.
        </p>

        <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 5 }}>
          <span style={labelStyle}>Goal (optional)</span>
          <input type="number" min={0} step="1" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="50000" style={inputStyle} />
          <span style={{ fontSize: 12.5, color: 'var(--t3)' }}>
            Leave this empty and the page shows the amount raised with no progress
            bar — better than a bar at 0%, which reads as a goal you missed.
          </span>
        </label>

        {error && <p style={{ color: 'var(--red-text)', fontSize: 13, margin: 0 }}>{error}</p>}

        <div>
          <button type="submit" className="kf-primary" disabled={!canSubmit} style={{ cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.6 }}>
            {busy ? 'Saving…' : 'Schedule giving day'}
          </button>
        </div>
      </form>

      <section>
        <h2 style={{ fontSize: 15, fontWeight: 750, color: 'var(--t1)', margin: '0 0 10px' }}>Your giving days</h2>
        {loadFailed ? (
          <p style={{ fontSize: 14, color: 'var(--red-text)' }}>
            We could not load your giving days. That is a read failure, not an empty list.
          </p>
        ) : initialDays.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--t3)' }}>None scheduled yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
            {initialDays.map((day) => (
              <li key={day.id} style={{ padding: 14, border: '1px solid var(--b1)', borderRadius: 'var(--r)', background: 'var(--s1)', minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 14.5, color: 'var(--t1)' }}>{day.title}</strong>
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: day.phase === 'live' ? 'var(--green-text)' : 'var(--t3)' }}>
                    {day.phase}
                  </span>
                  <a href={`/giving-days/${day.slug}`} style={{ fontSize: 12.5, color: 'var(--brand-text)', marginLeft: 'auto' }}>View public page ↗</a>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--t3)', margin: '6px 0 8px' }}>
                  {new Date(day.starts_at).toLocaleString()} → {new Date(day.ends_at).toLocaleString()}
                </p>
                <button
                  type="button"
                  onClick={() => void remove(day.id)}
                  disabled={busy}
                  style={{ fontSize: 12, fontWeight: 600, color: 'var(--red-text)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 650, color: 'var(--t2)' };
const inputStyle: React.CSSProperties = {
  width: '100%', minWidth: 0, padding: '9px 11px', fontSize: 14, fontFamily: 'inherit',
  color: 'var(--t1)', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--r)',
};
