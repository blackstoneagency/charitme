'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CharitMeShell, TopBar } from '../../../../../components/CharitMeApp';
import { createClient } from '../../../../../lib/supabase-browser';
import { formatMoneyShort, currencySymbol } from '@shared/currencies';

type Reward = {
  id: string;
  title: string;
  description: string | null;
  amount_cents: number;
  estimated_delivery: string | null;
  item_limit: number | null;
  claimed_count: number;
  sort_order: number;
};

export default function CampaignRewardsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState('');
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [currency, setCurrency] = useState('usd');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDelivery, setNewDelivery] = useState('');
  const [newLimit, setNewLimit] = useState('');

  useEffect(() => {
    params.then(({ id }) => {
      setCampaignId(id);
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) { router.push('/login'); return; }
        fetch(`/api/campaigns/${id}/rewards`)
          .then(res => res.json())
          .then((data: { rewards?: Reward[]; currency?: string }) => {
            setRewards(data.rewards ?? []);
            setCurrency(data.currency ?? 'usd');
            setLoading(false);
          })
          .catch(() => setLoading(false));
      });
    });
  }, [params, router]);

  async function addReward() {
    if (!newTitle.trim()) { setError('A title is required.'); return; }
    const dollars = Number.parseFloat(newAmount);
    if (!newAmount.trim() || Number.isNaN(dollars) || dollars <= 0) { setError('Enter a valid pledge amount.'); return; }
    setSaving(true); setError('');
    try {
      const limit = Number.parseInt(newLimit, 10);
      const itemLimit = newLimit.trim() && !Number.isNaN(limit) && limit > 0 ? limit : null;
      const res = await fetch(`/api/campaigns/${campaignId}/rewards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
          amountCents: Math.round(dollars * 100),
          estimatedDelivery: newDelivery.trim() || undefined,
          itemLimit,
          sortOrder: rewards.length,
        }),
      });
      const data = await res.json() as { reward?: Reward; error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed to add reward.'); return; }
      if (data.reward) {
        setRewards(prev => [...prev, data.reward!]);
        setNewTitle(''); setNewDescription(''); setNewAmount(''); setNewDelivery(''); setNewLimit('');
      }
    } catch { setError('Network error. Please try again.'); }
    finally { setSaving(false); }
  }

  async function deleteReward(id: string) {
    setRewards(prev => prev.filter(r => r.id !== id));
    await fetch(`/api/campaigns/${campaignId}/rewards/${id}`, { method: 'DELETE' }).catch(() => undefined);
  }

  const money = (cents: number) => formatMoneyShort(cents, currency);

  if (loading) {
    return <CharitMeShell active="My Campaigns"><TopBar title="Reward Tiers" subtitle="Loading…" /><div style={{ padding: 32, color: 'var(--t3)' }}>Loading…</div></CharitMeShell>;
  }

  return (
    <CharitMeShell active="My Campaigns">
      <TopBar
        title="Reward Tiers"
        subtitle="Offer perks at pledge levels, Kickstarter-style. Shown to donors at checkout."
        actions={
          <Link href={`/dashboard/campaigns/${campaignId}`} className="kf-outline" style={{ textDecoration: 'none' }}>← Back</Link>
        }
      />

      <div className="kf-admin-dash" style={{ maxWidth: 720 }}>
        {error && <div style={{ padding: '12px 16px', background: '#fff0f3', border: '1px solid #fecdd3', borderRadius: 10, color: '#be123c', fontSize: 14, fontWeight: 600 }}>⚠ {error}</div>}

        {/* Existing rewards */}
        {rewards.length > 0 && (
          <section className="kf-card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 16px' }}>Current Reward Tiers ({rewards.length})</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {rewards.map((r) => (
                <div key={r.id} style={{ padding: '14px 16px', border: '1px solid var(--b2)', borderRadius: 10, background: 'var(--s1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: 13, color: 'var(--t1)', display: 'block', marginBottom: 4 }}>
                        {money(r.amount_cents)} or more — {r.title}
                      </strong>
                      {r.description && <span style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.5, display: 'block', marginBottom: 4 }}>{r.description}</span>}
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--t3)', fontWeight: 600 }}>
                        {r.estimated_delivery && <span>📦 Est. delivery: {r.estimated_delivery}</span>}
                        {r.item_limit != null
                          ? <span>{r.claimed_count} of {r.item_limit} claimed</span>
                          : <span>{r.claimed_count} claimed</span>}
                      </div>
                    </div>
                    <button type="button" onClick={() => void deleteReward(r.id)}
                      title="Delete reward"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 16, padding: '2px 4px', lineHeight: 1, flexShrink: 0 }}>
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Add reward form */}
        <section className="kf-card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 16px' }}>Add a Reward Tier</h2>
          <div style={{ display: 'grid', gap: 14 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: '#26335c' }}>
              Title
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} maxLength={200}
                placeholder="e.g. Hand-written thank-you card" style={{ height: 42, border: '1px solid var(--b2)', borderRadius: 9, padding: '0 12px', fontSize: 14 }} />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: '#26335c' }}>
              Minimum pledge amount
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: 0, bottom: 0, display: 'flex', alignItems: 'center', color: 'var(--t3)', fontWeight: 800 }}>{currencySymbol(currency)}</span>
                <input value={newAmount} onChange={e => setNewAmount(e.target.value)} type="number" min="1" step="1"
                  placeholder="25" style={{ width: '100%', boxSizing: 'border-box', height: 42, border: '1px solid var(--b2)', borderRadius: 9, padding: '0 12px 0 26px', fontSize: 14 }} />
              </div>
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: '#26335c' }}>
              Description (optional)
              <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={3} maxLength={1000}
                placeholder="What does the donor get for this pledge?" style={{ border: '1px solid var(--b2)', borderRadius: 9, padding: '10px 12px', fontSize: 14, resize: 'vertical', lineHeight: 1.6 }} />
            </label>
            <div className="kf-two-col" style={{ gap: 14 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: '#26335c' }}>
                Estimated delivery (optional)
                <input value={newDelivery} onChange={e => setNewDelivery(e.target.value)} maxLength={100}
                  placeholder="e.g. August 2026" style={{ height: 42, border: '1px solid var(--b2)', borderRadius: 9, padding: '0 12px', fontSize: 14 }} />
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: '#26335c' }}>
                Quantity available (optional)
                <input value={newLimit} onChange={e => setNewLimit(e.target.value)} type="number" min="1" step="1"
                  placeholder="Unlimited" style={{ height: 42, border: '1px solid var(--b2)', borderRadius: 9, padding: '0 12px', fontSize: 14 }} />
              </label>
            </div>
            <button type="button" onClick={() => void addReward()} disabled={saving || !newTitle.trim()}
              style={{ height: 44, border: 0, borderRadius: 10, background: saving ? 'var(--b2)' : 'linear-gradient(135deg,#6c35ff,#4d1ee0)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Adding…' : 'Add Reward Tier'}
            </button>
          </div>
        </section>

        {rewards.length === 0 && (
          <div style={{ padding: '32px 24px', textAlign: 'center', background: 'var(--s2)', borderRadius: 14, border: '1px solid var(--b2)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🎁</div>
            <p style={{ fontWeight: 700, margin: '0 0 6px' }}>No reward tiers yet</p>
            <p style={{ fontSize: 13, color: 'var(--t3)', margin: '0 0 16px' }}>Offer perks at different pledge levels to give donors an extra reason to give more.</p>
          </div>
        )}

        <p style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.6 }}>
          💡 Donors who pledge at least the listed amount can select this reward at checkout. Set a quantity to limit availability — once claimed out, it shows as &ldquo;Sold out&rdquo;.
        </p>
      </div>
    </CharitMeShell>
  );
}
