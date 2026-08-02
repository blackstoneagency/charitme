'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { describeRules, isContradictory, isEmptyRuleSet, type SegmentRules } from '../../../lib/donor-segments-core';

type Nonprofit = { id: string; name: string };
type Segment = { id: string; name: string; rules: SegmentRules; memberCount: number; createdAt: string };

/**
 * The first surface that can write `donor_segments`.
 *
 * The empty-rule case is handled explicitly rather than prevented: "everyone" is
 * a legitimate segment, but it must be CHOSEN. A form that silently produced it
 * from dropped inputs would mail the entire contact list, so the button says so
 * and asks for a second click.
 */
export default function SegmentsClient({
  nonprofits,
  initialSegments,
  loadFailed,
  contactCount,
}: {
  nonprofits: Nonprofit[];
  initialSegments: Segment[];
  loadFailed: boolean;
  contactCount: number;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [nonprofitId, setNonprofitId] = useState(nonprofits[0]?.id ?? '');
  const [tags, setTags] = useState('');
  const [minValue, setMinValue] = useState('');
  const [withinDays, setWithinDays] = useState('');
  const [lapsedDays, setLapsedDays] = useState('');
  const [emailConsent, setEmailConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmEveryone, setConfirmEveryone] = useState(false);

  const rules: SegmentRules = {
    ...(tags.trim() ? { tags: tags.split(',').map((t) => t.trim()).filter(Boolean) } : {}),
    ...(minValue ? { minLifetimeValueCents: Math.round(Number(minValue) * 100) } : {}),
    ...(withinDays ? { donatedWithinDays: Number(withinDays) } : {}),
    ...(lapsedDays ? { notDonatedForDays: Number(lapsedDays) } : {}),
    ...(emailConsent ? { requiresEmailConsent: true } : {}),
  };

  const everyone = isEmptyRuleSet(rules);
  const contradictory = isContradictory(rules);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (contradictory) {
      setError('Those rules contradict each other — they would match nobody.');
      return;
    }
    if (everyone && !confirmEveryone) {
      setConfirmEveryone(true);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/crm/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), nonprofitId, rules }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error ?? 'Could not save that.'); return; }
      if (body.membershipWritten === false) {
        setError('The segment was saved but its members could not be written. Refresh it to try again.');
      }
      setName(''); setTags(''); setMinValue(''); setWithinDays(''); setLapsedDays('');
      setEmailConsent(false); setConfirmEveryone(false);
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  // Two explicit calls rather than one with a `method` variable. A dynamic verb
  // is invisible to fetch-methods.test.ts, which reads the literal to check the
  // route exports a handler for it — the guard would have had to assume GET and
  // report a 405 that does not exist. Spelling both out keeps the check real.
  async function refresh(id: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/crm/segments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) setError('Could not refresh that segment.');
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/crm/segments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) setError('Could not delete that segment.');
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (nonprofits.length === 0) {
    return (
      <p style={{ fontSize: 14.5, color: 'var(--t2)', maxWidth: 620, lineHeight: 1.65 }}>
        Segments belong to a nonprofit profile, and this account does not own one
        yet. Set one up under <a href="/dashboard/nonprofit">Your Organization</a> and
        this page turns on.
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 22, maxWidth: 780 }}>
      <p style={{ fontSize: 13.5, color: 'var(--t3)', margin: 0 }}>
        Selecting from <strong style={{ color: 'var(--t2)' }}>{contactCount.toLocaleString()}</strong> contacts.
      </p>

      <form onSubmit={create} style={{ display: 'grid', gap: 12, padding: 18, border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s1)' }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 750, color: 'var(--t1)' }}>New segment</h2>

        <label style={{ display: 'grid', gap: 5 }}>
          <span style={labelStyle}>Name</span>
          <input value={name} onChange={(e) => { setName(e.target.value); setConfirmEveryone(false); }} placeholder="Lapsed major donors" style={inputStyle} required minLength={2} maxLength={80} />
        </label>

        {nonprofits.length > 1 && (
          <label style={{ display: 'grid', gap: 5 }}>
            <span style={labelStyle}>Organisation</span>
            <select value={nonprofitId} onChange={(e) => setNonprofitId(e.target.value)} style={inputStyle}>
              {nonprofits.map((np) => <option key={np.id} value={np.id}>{np.name}</option>)}
            </select>
          </label>
        )}

        <label style={{ display: 'grid', gap: 5 }}>
          <span style={labelStyle}>Tags (comma separated, all must match)</span>
          <input value={tags} onChange={(e) => { setTags(e.target.value); setConfirmEveryone(false); }} placeholder="major, monthly" style={inputStyle} />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 5 }}>
            <span style={labelStyle}>Gave at least ($)</span>
            <input type="number" min={0} value={minValue} onChange={(e) => { setMinValue(e.target.value); setConfirmEveryone(false); }} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 5 }}>
            <span style={labelStyle}>Donated in the last (days)</span>
            <input type="number" min={0} value={withinDays} onChange={(e) => { setWithinDays(e.target.value); setConfirmEveryone(false); }} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 5 }}>
            <span style={labelStyle}>No donation for (days)</span>
            <input type="number" min={0} value={lapsedDays} onChange={(e) => { setLapsedDays(e.target.value); setConfirmEveryone(false); }} style={inputStyle} />
          </label>
        </div>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={emailConsent} onChange={(e) => { setEmailConsent(e.target.checked); setConfirmEveryone(false); }} />
          <span style={{ fontSize: 13.5, color: 'var(--t2)' }}>Only contacts who accept email</span>
        </label>

        <p style={{ fontSize: 12.5, color: 'var(--t3)', margin: 0 }}>
          Matches: <strong style={{ color: 'var(--t2)' }}>{describeRules(rules)}</strong>
        </p>

        {contradictory && (
          <p style={{ color: 'var(--red-text)', fontSize: 13, margin: 0 }}>
            These rules contradict each other and would match nobody.
          </p>
        )}
        {error && <p style={{ color: 'var(--red-text)', fontSize: 13, margin: 0 }}>{error}</p>}

        <div>
          <button
            type="submit"
            className="kf-primary"
            disabled={busy || name.trim().length < 2 || contradictory}
            style={{ cursor: busy ? 'wait' : 'pointer' }}
          >
            {busy ? 'Saving…'
              : confirmEveryone ? `Yes — save a segment of all ${contactCount.toLocaleString()} contacts`
              : everyone ? 'Save segment (matches everyone)'
              : 'Save segment'}
          </button>
          {confirmEveryone && (
            <p style={{ fontSize: 12.5, color: 'var(--t3)', margin: '8px 0 0' }}>
              {/* "Everyone" is a real segment, but it has to be chosen rather
                  than arrived at by a form that dropped its inputs. */}
              No criteria are set, so this will include every contact.
            </p>
          )}
        </div>
      </form>

      <section>
        <h2 style={{ fontSize: 15, fontWeight: 750, color: 'var(--t1)', margin: '0 0 10px' }}>Saved segments</h2>
        {loadFailed ? (
          <p style={{ fontSize: 14, color: 'var(--red-text)' }}>
            We could not load your segments. That is a read failure, not an empty list.
          </p>
        ) : initialSegments.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--t3)' }}>None yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
            {initialSegments.map((seg) => (
              <li key={seg.id} style={{ padding: 14, border: '1px solid var(--b1)', borderRadius: 'var(--r)', background: 'var(--s1)', minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 14.5, color: 'var(--t1)' }}>{seg.name}</strong>
                  <span style={{ fontSize: 12.5, color: 'var(--t2)' }}>{seg.memberCount.toLocaleString()} members</span>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--t3)', margin: '6px 0 8px' }}>{describeRules(seg.rules)}</p>
                <div style={{ display: 'flex', gap: 14 }}>
                  <button type="button" onClick={() => void refresh(seg.id)} disabled={busy} style={linkButton('var(--brand-text)')}>
                    Refresh members
                  </button>
                  <button type="button" onClick={() => void remove(seg.id)} disabled={busy} style={linkButton('var(--red-text)')}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p style={{ fontSize: 12.5, color: 'var(--t3)', marginTop: 12, maxWidth: 620, lineHeight: 1.6 }}>
          Membership is a stored snapshot, not a live query — refresh a segment
          after your contacts change, and contacts who no longer match are removed
          rather than left behind.
        </p>
      </section>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 650, color: 'var(--t2)' };
const inputStyle: React.CSSProperties = {
  width: '100%', minWidth: 0, padding: '9px 11px', fontSize: 14, fontFamily: 'inherit',
  color: 'var(--t1)', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--r)',
};
const linkButton = (color: string): React.CSSProperties => ({
  fontSize: 12, fontWeight: 600, color, background: 'none', border: 'none',
  padding: 0, cursor: 'pointer', textDecoration: 'underline',
});
