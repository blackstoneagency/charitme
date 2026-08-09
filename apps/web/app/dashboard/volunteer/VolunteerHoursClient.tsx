'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { EmptyState, BtnLink } from '../../../components/ui';

// ─────────────────────────────────────────────────────────────────────────────
// Volunteer hours — the UI half of CHAR-1102.
//
// Check-in, check-out and verify all shipped as API routes, but nothing listed
// hours: a volunteer could not see what they had logged, and an organizer had no
// queue to verify from, so the verify endpoint had no caller at all.
//
// Verified / pending / rejected are shown as SEPARATE totals, never summed. Only
// verified hours may be presented to an employer, and one combined figure would
// invite exactly the conflation this feature exists to prevent.
// ─────────────────────────────────────────────────────────────────────────────

type HoursRow = {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  orgName: string | null;
  volunteerUserId: string;
  volunteerName: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  hours: number;
  source: string;
  status: string;
  open: boolean;
};

type Totals = { verified: number; pending: number; rejected: number };

type Payload = { hours: HoursRow[]; totals: Totals; opportunities: { id: string; title: string }[] };

const EMPTY: Payload = { hours: [], totals: { verified: 0, pending: 0, rejected: 0 }, opportunities: [] };

function statusStyle(status: string): React.CSSProperties {
  const map: Record<string, { bg: string; fg: string }> = {
    verified: { bg: 'var(--green-light)', fg: 'var(--green-dark)' },
    pending: { bg: 'var(--s2)', fg: 'var(--t2)' },
    rejected: { bg: 'var(--s2)', fg: 'var(--t3)' },
  };
  const c = map[status] ?? map.pending;
  return {
    background: c.bg, color: c.fg, padding: '2px 9px', borderRadius: 999,
    fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
  };
}

function when(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Hours are reported to two decimals; anything finer is noise here. */
const fmtHours = (n: number) => `${n.toFixed(2)} h`;

export default function VolunteerHoursClient({ scope }: { scope: 'mine' | 'to-verify' }) {
  const [data, setData] = useState<Payload>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/volunteers/hours?scope=${scope}`);
      if (!res.ok) throw new Error('load failed');
      setData(await res.json());
      setFailed(false);
    } catch {
      // Hours are work someone actually did — reporting zero because a read failed
      // would be a claim we cannot make.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/volunteers/hours?scope=${scope}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((json: Payload) => { if (!cancelled) { setData(json); setFailed(false); } })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [scope]);

  async function act(id: string, url: string, body?: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? 'That did not work. Try again.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p style={{ color: 'var(--t3)', fontSize: 14 }}>Loading hours…</p>;

  if (failed) {
    return (
      <div role="alert" style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--s2)', border: '1px solid var(--b2)', color: 'var(--t1)' }}>
        <strong style={{ display: 'block', marginBottom: 4 }}>We couldn&apos;t load these hours</strong>
        <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>
          No logged hours have been lost — this is a temporary problem on our side.
          Reload to try again.
        </span>
      </div>
    );
  }

  const { hours, totals } = data;

  if (hours.length === 0) {
    // The shared EmptyState card, not a bare <p>. "Your applications" on this
    // same page already used it, so the four sections were rendering two
    // different treatments of the same idea — a card for one, loose text for
    // the rest. Same component now, so they cannot drift again.
    return scope === 'mine' ? (
      <EmptyState
        icon="⏱️"
        title="No logged hours yet"
        body="Check in at a shift to start the clock — your hours appear here once they are recorded."
        action={<BtnLink href="/volunteer">Find opportunities</BtnLink>}
      />
    ) : (
      <EmptyState
        icon="📋"
        title="No hours to verify"
        body="When someone logs hours on one of your opportunities, they arrive here for approval."
      />
    );
  }

  const pendingRows = hours.filter((h) => h.status === 'pending');
  const rest = hours.filter((h) => h.status !== 'pending');

  const row = (h: HoursRow) => (
    <li
      key={h.id}
      style={{
        border: '1px solid var(--b2)', borderRadius: 12, padding: '12px 14px',
        background: 'var(--s1)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8,
      }}
    >
      <div style={{ display: 'flex', minWidth: 0, alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ fontSize: 14.5, color: 'var(--t1)' }}>
            {scope === 'to-verify' ? (h.volunteerName ?? 'Volunteer') : h.opportunityTitle}
          </strong>
          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--t3)', marginTop: 2 }}>
            {scope === 'to-verify' ? h.opportunityTitle : (h.orgName ?? '')}
            {' · '}{when(h.checkedInAt)}
            {h.source === 'check_in' ? ' · checked in' : ' · entered manually'}
          </span>
        </div>
        <span style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
            {h.open ? 'running…' : fmtHours(h.hours)}
          </strong>
          <span style={statusStyle(h.status)}>{h.status}</span>
        </span>
      </div>

      {scope === 'mine' && h.open && (
        <div>
          <button
            type="button"
            className="kf-primary"
            disabled={busyId === h.id}
            onClick={() => void act(h.id, `/api/volunteers/hours/${h.id}/check-out`)}
          >
            {busyId === h.id ? 'Saving…' : 'Check out'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 10 }}>
            Checking out records the time. Your organizer verifies it separately.
          </span>
        </div>
      )}

      {scope === 'to-verify' && h.status === 'pending' && !h.open && (
        <div style={{ display: 'flex', minWidth: 0, gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="kf-primary"
            disabled={busyId === h.id}
            onClick={() => void act(h.id, `/api/volunteers/hours/${h.id}/verify`, { decision: 'verified' })}
          >
            {busyId === h.id ? 'Saving…' : 'Verify'}
          </button>
          <button
            type="button"
            className="kf-outline"
            disabled={busyId === h.id}
            onClick={() => void act(h.id, `/api/volunteers/hours/${h.id}/verify`, { decision: 'rejected' })}
          >
            Reject
          </button>
        </div>
      )}
    </li>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>
      {error && <p role="alert" style={{ color: 'var(--red-text)', fontSize: 13.5, margin: 0 }}>{error}</p>}

      {/* Never summed into one number — see the note at the top of this file. */}
      <div style={{ display: 'flex', minWidth: 0, gap: 10, flexWrap: 'wrap' }}>
        {([
          ['Verified', totals.verified, 'Only these may be reported to an employer'],
          ['Awaiting verification', totals.pending, 'Recorded, not yet certified'],
          ['Rejected', totals.rejected, 'Not counted anywhere'],
        ] as const).map(([label, value, hint]) => (
          <div key={label} style={{ flex: '1 1 160px', border: '1px solid var(--b2)', borderRadius: 12, padding: '10px 14px', background: 'var(--s1)' }}>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--t3)', fontWeight: 600 }}>{label}</span>
            <strong style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>{fmtHours(value)}</strong>
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--t3)', marginTop: 2 }}>{hint}</span>
          </div>
        ))}
      </div>

      {pendingRows.length > 0 && (
        <section>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px' }}>
            {scope === 'to-verify' ? `Awaiting your verification (${pendingRows.length})` : `Awaiting verification (${pendingRows.length})`}
          </h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>{pendingRows.map(row)}</ul>
        </section>
      )}

      {rest.length > 0 && (
        <section>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px' }}>Settled ({rest.length})</h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>{rest.map(row)}</ul>
        </section>
      )}
    </div>
  );
}
