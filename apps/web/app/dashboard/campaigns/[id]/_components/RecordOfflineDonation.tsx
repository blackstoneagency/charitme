'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

// ─────────────────────────────────────────────────────────────────────────────
// Record a cash / cheque / bank-transfer donation.
//
// `/api/offline-donations` was fully built — auth, ownership, validation, a
// durable rate limit — and **nothing in the product ever called it**, so an
// organizer handed £200 in cash at an event had no way to get it into the
// campaign.
//
// The Ledger panel's "Offline donation received" item type is NOT this: it writes
// a `transparency_ledger_items` row, which is a public note about money. It does
// not create a donation, so it never moves `raised_amount` or the backer count.
// An organizer using it would reasonably believe the total should have changed.
// This form is the one that actually records the gift.
// ─────────────────────────────────────────────────────────────────────────────

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
] as const;

const field: React.CSSProperties = {
  width: '100%', height: 40, padding: '0 12px', borderRadius: 9,
  border: '1px solid var(--b2)', background: 'var(--s1)', color: 'var(--t1)', fontSize: 14,
};
const label: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--t3)', marginBottom: 5,
};

export default function RecordOfflineDonation({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [form, setForm] = useState({
    amount: '', donorName: '', donorEmail: '', method: 'cash', notes: '', donatedAt: '',
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(null);

    // Parse money as cents without floating-point drift: "12.34" → 1234.
    const cleaned = form.amount.replace(/[^0-9.]/g, '');
    const amountCents = Math.round(Number(cleaned) * 100);
    if (!Number.isFinite(amountCents) || amountCents < 1) {
      setError('Enter an amount greater than zero.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/offline-donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          amountCents,
          method: form.method,
          ...(form.donorName.trim() ? { donorName: form.donorName.trim() } : {}),
          ...(form.donorEmail.trim() ? { donorEmail: form.donorEmail.trim() } : {}),
          ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
          ...(form.donatedAt ? { donatedAt: new Date(form.donatedAt).toISOString() } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Could not record this donation.');
      setDone('Recorded. It now counts toward the campaign total.');
      setForm({ amount: '', donorName: '', donorEmail: '', method: 'cash', notes: '', donatedAt: '' });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 14, padding: '18px 22px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>Offline donation</h3>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--t3)' }}>
            Cash, cheque or a transfer you received directly. It counts toward your total.
          </p>
        </div>
        <button type="button" className="kf-outline" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? 'Cancel' : 'Record a donation'}
        </button>
      </div>

      {done && (
        <p role="status" style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--green-dark)', fontWeight: 600 }}>{done}</p>
      )}

      {open && (
        <form onSubmit={submit} style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label style={label} htmlFor="od-amount">Amount</label>
              <input id="od-amount" style={field} inputMode="decimal" placeholder="0.00"
                value={form.amount} onChange={(e) => set('amount', e.target.value)} required />
            </div>
            <div>
              <label style={label} htmlFor="od-method">Method</label>
              <select id="od-method" style={field} value={form.method} onChange={(e) => set('method', e.target.value)}>
                {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label style={label} htmlFor="od-date">Date received</label>
              <input id="od-date" style={field} type="date"
                value={form.donatedAt} onChange={(e) => set('donatedAt', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label style={label} htmlFor="od-name">Donor name <span style={{ fontWeight: 500 }}>(optional)</span></label>
              <input id="od-name" style={field} value={form.donorName} onChange={(e) => set('donorName', e.target.value)} />
            </div>
            <div>
              <label style={label} htmlFor="od-email">Donor email <span style={{ fontWeight: 500 }}>(optional)</span></label>
              <input id="od-email" style={field} type="email" value={form.donorEmail} onChange={(e) => set('donorEmail', e.target.value)} />
            </div>
          </div>

          <div>
            <label style={label} htmlFor="od-notes">Notes <span style={{ fontWeight: 500 }}>(optional)</span></label>
            <input id="od-notes" style={field} maxLength={500} placeholder="Cheque number, event name…"
              value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>

          {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--red-text)' }}>{error}</p>}

          <div>
            <button type="submit" className="kf-primary" disabled={saving}>
              {saving ? 'Recording…' : 'Record donation'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 10 }}>
              Recorded gifts appear in your supporter list and raise your campaign total.
            </span>
          </div>
        </form>
      )}
    </section>
  );
}
