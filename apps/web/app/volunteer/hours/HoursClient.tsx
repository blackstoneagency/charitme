'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Btn, Input, Badge, Card, EmptyState } from '../../../components/ui';

export interface HoursRow {
  id: string;
  opportunity_id: string;
  shift_id: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  hours: number;
  status: 'pending' | 'verified' | 'rejected';
  source: 'manual' | 'check_in';
}

interface Props {
  rows: HoursRow[];
  titles: Record<string, string>;
  totals: { verified: number; pending: number; rejected: number };
  loadFailed: boolean;
}

/** Plain-language refusals. The API returns a machine reason; users need a sentence. */
const REASON_COPY: Record<string, string> = {
  shift_cancelled: 'That shift was cancelled.',
  shift_full: 'That shift is already full.',
  already_checked_in: 'You are already checked in to this shift.',
  too_early: 'It is too early to check in — try again closer to the start time.',
  shift_over: 'That shift has finished, so check-in is closed.',
};

const STATUS_COLOR = { verified: 'green', pending: 'gray', rejected: 'red' } as const;

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function HoursClient({ rows, titles, totals, loadFailed }: Props) {
  const router = useRouter();
  const [shiftId, setShiftId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const openRow = rows.find((r) => r.checked_in_at && !r.checked_out_at);

  async function checkIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setNotice(null); setBusy('in');
    try {
      const res = await fetch(`/api/volunteers/shifts/${encodeURIComponent(shiftId.trim())}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(REASON_COPY[json?.reason] ?? json?.error ?? 'Could not check in.');
        return;
      }
      setNotice('Checked in. Your clock is running.');
      setCode(''); setShiftId('');
      router.refresh();
    } catch {
      setError('Network problem — your check-in was not recorded. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function checkOut(id: string) {
    setError(null); setNotice(null); setBusy(id);
    try {
      const res = await fetch(`/api/volunteers/hours/${id}/check-out`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? 'Could not check out.');
        return;
      }
      // `capped` means the elapsed time hit the 24h ceiling. Say so plainly
      // rather than showing a clamped number as though it were measured.
      setNotice(
        json?.capped
          ? 'Checked out. That entry ran past 24 hours, so it was capped — your organizer will review it.'
          : 'Checked out. Your hours are pending verification.',
      );
      router.refresh();
    } catch {
      setError('Network problem — you may still be checked in. Refresh before retrying.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
        {/* Verified is the only figure an employer accepts, so it is stated first
            and the others are never folded into it. */}
        <Card>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Verified</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--t1)', marginTop: 4 }}>
            {loadFailed ? '—' : totals.verified.toFixed(2)}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Pending</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--t2)', marginTop: 4 }}>
            {loadFailed ? '—' : totals.pending.toFixed(2)}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Not counted</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--t3)', marginTop: 4 }}>
            {loadFailed ? '—' : totals.rejected.toFixed(2)}
          </div>
        </Card>
      </div>

      {error && (
        <div role="alert" style={{ border: '1px solid var(--b2)', background: 'var(--s2)', color: 'var(--t1)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}
      {notice && (
        <div role="status" style={{ border: '1px solid var(--b2)', background: 'var(--s2)', color: 'var(--t1)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 14 }}>
          {notice}
        </div>
      )}

      {openRow ? (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 800, color: 'var(--t1)', marginBottom: 4 }}>You are checked in</div>
          <div style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 12 }}>
            {titles[openRow.opportunity_id] ?? 'Volunteering'} — since {fmtTime(openRow.checked_in_at)}
          </div>
          <Btn onClick={() => checkOut(openRow.id)} disabled={busy === openRow.id}>
            {busy === openRow.id ? 'Checking out…' : 'Check out'}
          </Btn>
        </Card>
      ) : (
        <Card style={{ marginBottom: 24 }}>
          <form onSubmit={checkIn}>
            <div style={{ fontWeight: 800, color: 'var(--t1)', marginBottom: 4 }}>Check in to a shift</div>
            <div style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 12 }}>
              Scan the QR your organizer displays, or enter the shift ID and code by hand.
            </div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
              <Input
                label="Shift ID"
                value={shiftId}
                onChange={(e) => setShiftId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                required
              />
              <Input
                label="Check-in code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABCD2345"
                required
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <Btn type="submit" disabled={busy === 'in' || !shiftId.trim() || !code.trim()}>
                {busy === 'in' ? 'Checking in…' : 'Check in'}
              </Btn>
            </div>
          </form>
        </Card>
      )}

      {rows.length === 0 && !loadFailed ? (
        <EmptyState
          icon="🕓"
          title="No hours logged yet"
          body="Once you check in to a shift, your time will appear here."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
          {rows.map((r) => (
            <Card key={r.id}>
              <div style={{ display: 'flex', minWidth: 0, justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: 15 }}>
                    {titles[r.opportunity_id] ?? 'Volunteering'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 2 }}>
                    {fmtDate(r.checked_in_at)} · {fmtTime(r.checked_in_at)} – {r.checked_out_at ? fmtTime(r.checked_out_at) : 'in progress'}
                  </div>
                </div>
                <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 800, color: 'var(--t1)' }}>
                    {r.checked_out_at ? `${r.hours.toFixed(2)} h` : '—'}
                  </span>
                  <Badge color={STATUS_COLOR[r.status]}>
                    {r.status === 'verified' ? 'Verified' : r.status === 'pending' ? 'Pending' : 'Not counted'}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loadFailed && totals.verified > 0 && (
        <div style={{ marginTop: 24 }}>
          <a
            href="/api/volunteers/hours/export"
            style={{ fontSize: 14, fontWeight: 700, color: 'var(--t2)', textDecoration: 'underline' }}
          >
            Download my verified hours (CSV)
          </a>
        </div>
      )}
    </>
  );
}
