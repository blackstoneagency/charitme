'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Btn, Input, Badge, Card, EmptyState } from '../../../../components/ui';

export interface ManageShift {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  capacity: number | null;
  filled_count: number;
  status: 'scheduled' | 'cancelled' | 'completed';
  checkin_code: string | null;
}

export interface PendingEntry {
  id: string;
  volunteer_user_id: string;
  volunteer_name: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  hours: number;
  status: 'pending' | 'verified' | 'rejected';
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Entries at or above the cap were clamped; an organizer should look before verifying. */
const CAP_HOURS = 24;

export default function ManageClient({
  opportunityId, shifts, pending,
}: { opportunityId: string; shifts: ManageShift[]; pending: PendingEntry[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ title: '', starts_at: '', ends_at: '', location: '', capacity: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function createShift(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setNotice(null); setBusy('create');
    try {
      const res = await fetch('/api/volunteers/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity_id: opportunityId,
          title: form.title.trim(),
          starts_at: new Date(form.starts_at).toISOString(),
          ends_at: new Date(form.ends_at).toISOString(),
          location: form.location.trim() || undefined,
          capacity: form.capacity.trim() === '' ? null : Number(form.capacity),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json?.error ?? 'Could not create that shift.'); return; }
      setNotice('Shift created. Share its check-in code with volunteers when they arrive.');
      setForm({ title: '', starts_at: '', ends_at: '', location: '', capacity: '' });
      router.refresh();
    } catch {
      setError('Network problem — the shift was not created.');
    } finally { setBusy(null); }
  }

  async function decide(id: string, decision: 'verified' | 'rejected') {
    setError(null); setNotice(null); setBusy(id);
    try {
      const res = await fetch(`/api/volunteers/hours/${id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json?.error ?? 'Could not record that decision.'); return; }
      setNotice(decision === 'verified'
        ? 'Hours verified — they can now be exported.'
        : 'Hours rejected — they will not be exported.');
      router.refresh();
    } catch {
      setError('Network problem — the decision was not recorded.');
    } finally { setBusy(null); }
  }

  return (
    <>
      {error && (
        <div role="alert" style={{ border: '1px solid var(--b2)', background: 'var(--s2)', color: 'var(--t1)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 14 }}>{error}</div>
      )}
      {notice && (
        <div role="status" style={{ border: '1px solid var(--b2)', background: 'var(--s2)', color: 'var(--t1)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 14 }}>{notice}</div>
      )}

      {/* ── Hours awaiting verification ─────────────────────────────────── */}
      <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: '8px 0 12px' }}>
        Hours awaiting your verification
      </h2>
      {pending.length === 0 ? (
        <EmptyState icon="✅" title="Nothing to verify" body="Completed check-outs will appear here for review." />
      ) : (
        <div style={{ display: 'grid', gap: 10, marginBottom: 32 }}>
          {pending.map((p) => {
            const capped = p.hours >= CAP_HOURS;
            return (
              <Card key={p.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: 15 }}>{p.volunteer_name}</div>
                    <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 2 }}>
                      {fmt(p.checked_in_at)} → {fmt(p.checked_out_at)}
                    </div>
                    {capped && (
                      // Surfaced, not silently accepted: this entry hit the 24h ceiling,
                      // which usually means a missed check-out rather than a real day.
                      <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 6, fontWeight: 700 }}>
                        ⚠ Capped at {CAP_HOURS}h — likely a missed check-out. Confirm before verifying.
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: 'var(--t1)' }}>{p.hours.toFixed(2)} h</span>
                    <Btn onClick={() => decide(p.id, 'verified')} disabled={busy === p.id}>
                      {busy === p.id ? 'Saving…' : 'Verify'}
                    </Btn>
                    <Btn variant="secondary" onClick={() => decide(p.id, 'rejected')} disabled={busy === p.id}>
                      Reject
                    </Btn>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Shifts ──────────────────────────────────────────────────────── */}
      <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: '8px 0 12px' }}>Shifts</h2>

      <Card style={{ marginBottom: 20 }}>
        <form onSubmit={createShift}>
          <div style={{ fontWeight: 800, color: 'var(--t1)', marginBottom: 10 }}>Schedule a shift</div>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
            <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <Input label="Starts" type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} required />
            <Input label="Ends" type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} required />
            <Input label="Location (optional)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Input label="Capacity (blank = unlimited)" type="number" min={0} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          </div>
          <div style={{ marginTop: 12 }}>
            <Btn type="submit" disabled={busy === 'create'}>{busy === 'create' ? 'Creating…' : 'Create shift'}</Btn>
          </div>
        </form>
      </Card>

      {shifts.length === 0 ? (
        <EmptyState icon="🗓" title="No shifts yet" body="Schedule one above so volunteers can check in." />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {shifts.map((s) => (
            <Card key={s.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: 15 }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 2 }}>
                    {fmt(s.starts_at)} → {fmt(s.ends_at)}
                    {s.location ? ` · ${s.location}` : ''}
                    {' · '}
                    {s.filled_count}{s.capacity == null ? '' : `/${s.capacity}`} checked in
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 8 }}>
                    Check-in code:{' '}
                    <code style={{ fontFamily: 'var(--mono)', fontWeight: 800, letterSpacing: '.08em', color: 'var(--t1)' }}>
                      {s.checkin_code ?? '—'}
                    </code>
                    {' · '}
                    <span style={{ color: 'var(--t3)' }}>Shift ID: </span>
                    <code style={{ fontFamily: 'var(--mono)', color: 'var(--t3)' }}>{s.id}</code>
                  </div>
                </div>
                <Badge color={s.status === 'scheduled' ? 'green' : 'gray'}>
                  {s.status === 'scheduled' ? 'Scheduled' : s.status === 'cancelled' ? 'Cancelled' : 'Completed'}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
