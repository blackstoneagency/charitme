'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type LedgerItem = {
  id: string;
  item_type: string;
  title: string;
  amount_cents: number | null;
  category: string | null;
  status: string;
  created_at: string;
};

type Campaign = { id: string; title: string };

const ITEM_TYPES = [
  { value: 'expense', label: 'Expense' },
  { value: 'milestone', label: 'Milestone reached' },
  { value: 'receipt', label: 'Receipt / proof of purchase' },
  { value: 'payout', label: 'Payout made' },
  { value: 'offline_donation', label: 'Offline donation received' },
  { value: 'other', label: 'Other update' },
];

const STATUS_OPTIONS = ['pending', 'received', 'paid', 'verified'];

const fmtCents = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function LedgerPanel({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    item_type: 'expense',
    title: '',
    amount: '',
    category: '',
    status: 'pending',
  });

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    void (async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/ledger`).catch(() => null);
      if (!active) return;
      if (!res || res.status === 401) { router.push('/login'); return; }
      if (!res.ok) { setError('Could not load the ledger.'); setLoading(false); return; }
      const d = await res.json() as { campaign: Campaign; items: LedgerItem[] };
      if (!active) return;
      setCampaign(d.campaign);
      setItems(d.items);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [campaignId, router]);

  async function handleAdd() {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true); setError('');
    try {
      const amountCents = form.amount ? Math.round(parseFloat(form.amount) * 100) : null;
      const res = await fetch(`/api/campaigns/${campaignId}/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: form.item_type,
          title: form.title.trim(),
          amountCents,
          category: form.category.trim() || null,
          status: form.status,
        }),
      });
      const d = await res.json() as { item?: LedgerItem; error?: string };
      if (!res.ok || !d.item) { setError(d.error ?? 'Failed to add entry.'); return; }
      setItems(prev => [d.item!, ...prev]);
      setForm({ item_type: 'expense', title: '', amount: '', category: '', status: 'pending' });
      setShowForm(false);
    } catch { setError('Something went wrong. Please try again.'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/campaigns/${campaignId}/ledger?itemId=${id}`, { method: 'DELETE' }).catch(() => undefined);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  if (loading) return <div style={{ padding: '24px 0', color: 'var(--t3)', fontSize: 14 }}>Loading…</div>;

  const typeLabel = (t: string) => ITEM_TYPES.find(x => x.value === t)?.label ?? t;
  const statusColor = (s: string) => s === 'verified' || s === 'paid' || s === 'received' ? 'green' : 'orange';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20, maxWidth: 720 }}>
      <div style={{ display: 'flex', minWidth: 0, justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: 'var(--t1)' }}>Transparency Ledger</h2>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--t3)' }}>
            Show donors exactly how {campaign?.title ?? 'this campaign'}&apos;s funds are used.
          </p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setError(''); }} className="kf-primary" style={{ height: 40, padding: '0 18px', fontSize: 13 }}>
          {showForm ? 'Cancel' : '+ Add Entry'}
        </button>
      </div>

      {error && <div style={{ padding: '12px 16px', background: 'rgba(255,59,95,.08)', border: '1px solid rgba(255,59,95,.28)', borderRadius: 10, color: 'var(--red-text)', fontSize: 14, fontWeight: 600 }}>⚠ {error}</div>}

      {/* Add entry form */}
      {showForm && (
        <section className="kf-card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 650, margin: '0 0 18px' }}>New Ledger Entry</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
            <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
              Entry type
              <select value={form.item_type} onChange={e => setForm(p => ({ ...p, item_type: e.target.value }))}
                style={{ height: 42, border: '1px solid var(--b2)', borderRadius: 9, padding: '0 12px', fontSize: 14, background: 'var(--s1)' }}>
                {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
              Title / Description *
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} maxLength={200}
                placeholder="e.g. Hospital invoice — surgery" style={{ height: 42, border: '1px solid var(--b2)', borderRadius: 9, padding: '0 12px', fontSize: 14 }} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 14 }}>
              <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
                Amount ($) <span style={{ fontWeight: 400 }}>optional</span>
                <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} min="0" step="0.01"
                  placeholder="0.00" style={{ height: 42, border: '1px solid var(--b2)', borderRadius: 9, padding: '0 12px', fontSize: 14 }} />
              </label>
              <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
                Category <span style={{ fontWeight: 400 }}>optional</span>
                <input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} maxLength={80}
                  placeholder="Medical, Travel…" style={{ height: 42, border: '1px solid var(--b2)', borderRadius: 9, padding: '0 12px', fontSize: 14 }} />
              </label>
              <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
                Status
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                  style={{ height: 42, border: '1px solid var(--b2)', borderRadius: 9, padding: '0 12px', fontSize: 14, background: 'var(--s1)' }}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </label>
            </div>
            <button type="button" onClick={() => void handleAdd()} disabled={saving || !form.title.trim()}
              style={{ height: 44, border: 0, borderRadius: 10, background: saving ? 'var(--b2)' : 'linear-gradient(135deg,#6c35ff,#4d1ee0)', color: '#fff', fontWeight: 650, fontSize: 14, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Saving…' : 'Add to Ledger'}
            </button>
          </div>
        </section>
      )}

      {/* Ledger list */}
      <section className="kf-card" style={{ overflow: 'hidden' }}>
        <div className="kf-card-head">
          <h2>All Entries ({items.length})</h2>
        </div>

        {items.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--t3)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📒</div>
            <p style={{ fontWeight: 700, margin: '0 0 6px' }}>No ledger entries yet.</p>
            <p style={{ fontSize: 13 }}>Add entries to show donors exactly how their money is being used. This builds trust and increases future donations.</p>
          </div>
        ) : (
          <div>
            {items.map(item => (
              <div key={item.id} style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--b1)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', minWidth: 0, gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 14 }}>{item.title}</strong>
                    <span className={`kf-pill ${statusColor(item.status)}`} style={{ fontSize: 10 }}>{item.status}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}>
                    {typeLabel(item.item_type)}
                    {item.category ? ` · ${item.category}` : ''}
                    {' · '}{fmtDate(item.created_at)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {item.amount_cents !== null && item.amount_cents > 0 && (
                    <strong style={{ fontSize: 15, color: item.item_type === 'offline_donation' ? 'var(--green)' : 'var(--t1)' }}>
                      {item.item_type === 'offline_donation' ? '+' : ''}{fmtCents(item.amount_cents)}
                    </strong>
                  )}
                </div>
                <button type="button" onClick={() => void handleDelete(item.id)}
                  title="Delete entry"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 18, padding: '4px', lineHeight: 1 }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <p style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.5 }}>
        💡 Ledger entries are shown publicly on your campaign page. Keep them accurate and up-to-date to build donor trust. Verified entries may improve your CharitMe Trust Score.
      </p>
    </div>
  );
}
