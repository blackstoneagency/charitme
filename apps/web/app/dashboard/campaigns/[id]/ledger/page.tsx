'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CharitMeShell, TopBar } from '../../../../../components/CharitMeApp';
import { createClient } from '../../../../../lib/supabase-browser';

type LedgerItem = {
  id: string;
  item_type: string;
  title: string;
  description: string | null;
  amount_cents: number | null;
  category: string | null;
  status: string;
  created_at: string;
  receipt_url: string | null;
  ai_summary: string | null;
  risk_score: number | null;
  review_status: string;
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

const REVIEW_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  auto_approved: { label: 'Visible to donors', color: 'green' },
  approved: { label: 'Approved · Visible to donors', color: 'green' },
  pending_review: { label: 'Pending admin review', color: 'orange' },
  rejected: { label: 'Rejected · Hidden from donors', color: 'red' },
};

const fmtCents = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function LedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState('');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    item_type: 'expense',
    title: '',
    description: '',
    amount: '',
    category: '',
    status: 'pending',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [receiptBusyId, setReceiptBusyId] = useState<string | null>(null);

  const LEDGER_SELECT = 'id, item_type, title, description, amount_cents, category, status, created_at, receipt_url, ai_summary, risk_score, review_status';

  useEffect(() => { params.then(({ id }) => setCampaignId(id)); }, [params]);

  useEffect(() => {
    if (!campaignId) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      Promise.all([
        supabase.from('campaigns').select('id, title').eq('id', campaignId).eq('user_id', user.id).single(),
        supabase.from('transparency_ledger_items').select(LEDGER_SELECT).eq('campaign_id', campaignId).order('created_at', { ascending: false }),
      ]).then(([{ data: camp }, { data: ledger }]) => {
        if (!camp) { router.push('/dashboard/campaigns'); return; }
        setCampaign(camp as Campaign);
        setItems((ledger ?? []) as LedgerItem[]);
        setLoading(false);
      });
    });
  }, [campaignId, router]);

  async function handleAdd() {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true); setError('');
    try {
      const supabase = createClient();
      const amountCents = form.amount ? Math.round(parseFloat(form.amount) * 100) : null;
      const { data, error: err } = await supabase
        .from('transparency_ledger_items')
        .insert({
          campaign_id: campaignId,
          item_type: form.item_type,
          title: form.title.trim(),
          description: form.description.trim() || null,
          amount_cents: amountCents,
          category: form.category.trim() || null,
          status: form.status,
        })
        .select(LEDGER_SELECT)
        .single();
      if (err) { setError(err.message); return; }
      let newItem = data as LedgerItem;

      if (receiptFile) {
        const uploaded = await uploadReceipt(newItem.id, receiptFile);
        if (uploaded) newItem = { ...newItem, receipt_url: uploaded };
      }

      setItems(prev => [newItem, ...prev]);
      setForm({ item_type: 'expense', title: '', description: '', amount: '', category: '', status: 'pending' });
      setReceiptFile(null);
      setShowForm(false);
    } catch { setError('Something went wrong. Please try again.'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from('transparency_ledger_items').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  async function uploadReceipt(itemId: string, file: File): Promise<string | null> {
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('campaignId', campaignId);
      fd.append('ledgerItemId', itemId);
      const res = await fetch('/api/upload/receipt', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Receipt upload failed.'); return null; }
      return json.path as string;
    } catch {
      setError('Receipt upload failed. Please try again.');
      return null;
    }
  }

  async function handleReceiptUpload(item: LedgerItem, file: File) {
    setReceiptBusyId(item.id); setError('');
    const path = await uploadReceipt(item.id, file);
    if (path) setItems(prev => prev.map(i => (i.id === item.id ? { ...i, receipt_url: path } : i)));
    setReceiptBusyId(null);
  }

  async function handleViewReceipt(item: LedgerItem) {
    if (!item.receipt_url) return;
    setReceiptBusyId(item.id); setError('');
    try {
      const res = await fetch(`/api/upload/receipt?path=${encodeURIComponent(item.receipt_url)}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Could not load receipt.'); return; }
      window.open(json.url as string, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Could not load receipt. Please try again.');
    } finally {
      setReceiptBusyId(null);
    }
  }

  async function handleGenerateAiSummary(itemId: string) {
    setAiLoadingId(itemId); setError('');
    try {
      const res = await fetch('/api/ai/impact-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ledgerItemId: itemId }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Could not generate AI summary.'); return; }
      setItems(prev => prev.map(i => (i.id === itemId
        ? { ...i, ai_summary: json.ai_summary, risk_score: json.risk_score, review_status: json.review_status }
        : i)));
    } catch {
      setError('Could not generate AI summary. Please try again.');
    } finally {
      setAiLoadingId(null);
    }
  }

  if (loading) return <CharitMeShell active="My Campaigns"><TopBar title="Transparency Ledger" subtitle="Loading…" /><div style={{ padding: 32, color: 'var(--t3)' }}>Loading…</div></CharitMeShell>;

  const typeLabel = (t: string) => ITEM_TYPES.find(x => x.value === t)?.label ?? t;
  const statusColor = (s: string) => s === 'verified' || s === 'paid' || s === 'received' ? 'green' : 'orange';

  return (
    <CharitMeShell active="My Campaigns">
      <TopBar
        title="Transparency Ledger"
        subtitle={`Show donors exactly how ${campaign?.title ?? 'this campaign'}'s funds are used.`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowForm(!showForm); setError(''); }} className="kf-primary" style={{ height: 40, padding: '0 18px', fontSize: 13 }}>
              {showForm ? 'Cancel' : '+ Add Entry'}
            </button>
            <Link href={`/dashboard/campaigns/${campaignId}`} className="kf-outline" style={{ textDecoration: 'none' }}>← Back</Link>
          </div>
        }
      />

      <div className="kf-admin-dash" style={{ maxWidth: 720 }}>
        {error && <div style={{ padding: '12px 16px', background: '#fff0f3', border: '1px solid #fecdd3', borderRadius: 10, color: '#be123c', fontSize: 14, fontWeight: 600 }}>⚠ {error}</div>}

        {/* Add entry form */}
        {showForm && (
          <section className="kf-card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 18px' }}>New Ledger Entry</h2>
            <div style={{ display: 'grid', gap: 14 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 750, color: '#26335c' }}>
                Entry type
                <select value={form.item_type} onChange={e => setForm(p => ({ ...p, item_type: e.target.value }))}
                  style={{ height: 42, border: '1px solid var(--b2)', borderRadius: 9, padding: '0 12px', fontSize: 14, background: '#fff' }}>
                  {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 750, color: '#26335c' }}>
                Title *
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} maxLength={200}
                  placeholder="e.g. Hospital invoice — surgery" style={{ height: 42, border: '1px solid var(--b2)', borderRadius: 9, padding: '0 12px', fontSize: 14 }} />
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 750, color: '#26335c' }}>
                Details <span style={{ fontWeight: 400 }}>optional — helps the AI write a better donor summary</span>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} maxLength={1000} rows={3}
                  placeholder="What was this for? Who was it paid to? How does it help the campaign?"
                  style={{ border: '1px solid var(--b2)', borderRadius: 9, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 750, color: '#26335c' }}>
                Receipt / proof <span style={{ fontWeight: 400 }}>optional — JPG, PNG, or PDF, max 5MB</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
                  style={{ fontSize: 13 }} />
              </label>
              <div className="kf-three-col" style={{ gap: 14 }}>
                <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 750, color: '#26335c' }}>
                  Amount ($) <span style={{ fontWeight: 400 }}>optional</span>
                  <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} min="0" step="0.01"
                    placeholder="0.00" style={{ height: 42, border: '1px solid var(--b2)', borderRadius: 9, padding: '0 12px', fontSize: 14 }} />
                </label>
                <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 750, color: '#26335c' }}>
                  Category <span style={{ fontWeight: 400 }}>optional</span>
                  <input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} maxLength={80}
                    placeholder="Medical, Travel…" style={{ height: 42, border: '1px solid var(--b2)', borderRadius: 9, padding: '0 12px', fontSize: 14 }} />
                </label>
                <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 750, color: '#26335c' }}>
                  Status
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                    style={{ height: 42, border: '1px solid var(--b2)', borderRadius: 9, padding: '0 12px', fontSize: 14, background: '#fff' }}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </label>
              </div>
              <button type="button" onClick={() => void handleAdd()} disabled={saving || !form.title.trim()}
                style={{ height: 44, border: 0, borderRadius: 10, background: saving ? 'var(--b2)' : 'linear-gradient(135deg,#6c35ff,#4d1ee0)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: saving ? 'wait' : 'pointer' }}>
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
              {items.map(item => {
                const review = REVIEW_STATUS_LABELS[item.review_status] ?? REVIEW_STATUS_LABELS.auto_approved;
                return (
                <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 20px', borderBottom: '1px solid var(--b1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 14 }}>{item.title}</strong>
                        <span className={`kf-pill ${statusColor(item.status)}`} style={{ fontSize: 10 }}>{item.status}</span>
                        <span className={`kf-pill ${review.color}`} style={{ fontSize: 10 }}>{review.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}>
                        {typeLabel(item.item_type)}
                        {item.category ? ` · ${item.category}` : ''}
                        {' · '}{fmtDate(item.created_at)}
                        {item.risk_score !== null ? ` · AI risk score ${item.risk_score}/100` : ''}
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

                  {item.ai_summary && (
                    <div style={{ fontSize: 12.5, color: '#4338ca', background: '#f5f3ff', border: '1px solid #ede9fe', borderRadius: 8, padding: '8px 12px', lineHeight: 1.5 }}>
                      ✨ <strong>AI summary for donors:</strong> {item.ai_summary}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => void handleGenerateAiSummary(item.id)} disabled={aiLoadingId === item.id}
                      style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 7, border: '1px solid #ede9fe', background: '#fff', color: '#6c35ff', cursor: aiLoadingId === item.id ? 'wait' : 'pointer' }}>
                      {aiLoadingId === item.id ? 'Generating…' : item.ai_summary ? '✨ Regenerate AI summary' : '✨ Generate AI summary'}
                    </button>

                    {item.receipt_url ? (
                      <button type="button" onClick={() => void handleViewReceipt(item)} disabled={receiptBusyId === item.id}
                        style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--b2)', background: '#fff', color: 'var(--t2)', cursor: receiptBusyId === item.id ? 'wait' : 'pointer' }}>
                        {receiptBusyId === item.id ? 'Loading…' : '📎 View receipt'}
                      </button>
                    ) : (
                      <label style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--b2)', background: '#fff', color: 'var(--t2)', cursor: receiptBusyId === item.id ? 'wait' : 'pointer' }}>
                        {receiptBusyId === item.id ? 'Uploading…' : '📎 Upload receipt'}
                        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display: 'none' }}
                          disabled={receiptBusyId === item.id}
                          onChange={e => { const f = e.target.files?.[0]; if (f) void handleReceiptUpload(item, f); e.target.value = ''; }} />
                      </label>
                    )}
                  </div>
                </div>
              );})}
            </div>
          )}
        </section>

        <p style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.5 }}>
          💡 Ledger entries are shown publicly on your campaign page. Keep them accurate and up-to-date to build donor trust. Verified entries may improve your CharitMe Trust Score.
        </p>
      </div>
    </CharitMeShell>
  );
}
