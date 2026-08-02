'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TopBar } from '../../../../../components/CharitMeApp';
import { CharitMeShell } from '../../../../../components/ShellSessionProvider';
import { createClient } from '../../../../../lib/supabase-browser';
import { formatMoneyShort, currencySymbol } from '@shared/currencies';

type Milestone = {
  id: string;
  title: string;
  description: string | null;
  target_amount: number | null;
  reached_at: string | null;
  sort_order: number;
};

export default function CampaignMilestonesPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState('');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [currency, setCurrency] = useState('usd');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTarget, setNewTarget] = useState('');

  useEffect(() => {
    params.then(({ id }) => {
      setCampaignId(id);
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) { router.push('/login'); return; }
        fetch(`/api/campaigns/${id}/milestones`)
          .then(res => res.json())
          .then((data: { milestones?: Milestone[]; currency?: string }) => {
            setMilestones(data.milestones ?? []);
            setCurrency(data.currency ?? 'usd');
            setLoading(false);
          })
          .catch(() => setLoading(false));
      });
    });
  }, [params, router]);

  async function addMilestone() {
    if (!newTitle.trim()) { setError('A title is required.'); return; }
    setSaving(true); setError('');
    try {
      const dollars = Number.parseFloat(newTarget);
      const targetAmount = newTarget.trim() && !Number.isNaN(dollars) && dollars > 0
        ? Math.round(dollars * 100)
        : null;
      const res = await fetch(`/api/campaigns/${campaignId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
          targetAmount,
          sortOrder: milestones.length,
        }),
      });
      const data = await res.json() as { milestone?: Milestone; error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed to add milestone.'); return; }
      if (data.milestone) {
        setMilestones(prev => [...prev, data.milestone!]);
        setNewTitle(''); setNewDescription(''); setNewTarget('');
      }
    } catch { setError('Network error. Please try again.'); }
    finally { setSaving(false); }
  }

  async function toggleReached(milestone: Milestone) {
    const reachedAt = milestone.reached_at ? null : new Date().toISOString();
    setMilestones(prev => prev.map(m => m.id === milestone.id ? { ...m, reached_at: reachedAt } : m));
    await fetch(`/api/campaigns/${campaignId}/milestones/${milestone.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reachedAt }),
    }).catch(() => undefined);
  }

  async function deleteMilestone(id: string) {
    setMilestones(prev => prev.filter(m => m.id !== id));
    await fetch(`/api/campaigns/${campaignId}/milestones/${id}`, { method: 'DELETE' }).catch(() => undefined);
  }

  const money = (cents: number) => formatMoneyShort(cents, currency);

  if (loading) {
    return <CharitMeShell active="My Campaigns"><TopBar title="Campaign Milestones" subtitle="Loading…" /><div style={{ padding: 32, color: 'var(--t3)' }}>Loading…</div></CharitMeShell>;
  }

  return (
    <CharitMeShell active="My Campaigns">
      <TopBar
        title="Campaign Milestones"
        subtitle="Set stretch goals donors can track. Shown publicly on your campaign page."
        actions={
          <Link href={`/dashboard/campaigns/${campaignId}`} className="kf-outline" style={{ textDecoration: 'none' }}>← Back</Link>
        }
      />

      <div className="kf-admin-dash" style={{ maxWidth: 720 }}>
        {error && <div style={{ padding: '12px 16px', background: 'rgba(255,59,95,.08)', border: '1px solid rgba(255,59,95,.28)', borderRadius: 10, color: 'var(--red)', fontSize: 14, fontWeight: 600 }}>⚠ {error}</div>}

        {/* Existing milestones */}
        {milestones.length > 0 && (
          <section className="kf-card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 16px' }}>Current Milestones ({milestones.length})</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
              {milestones.map((m, i) => (
                <div key={m.id} style={{ padding: '14px 16px', border: '1px solid var(--b2)', borderRadius: 10, background: 'var(--s1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: 13, color: 'var(--t1)', display: 'block', marginBottom: 4 }}>
                        {i + 1}. {m.title}{m.target_amount != null ? ` — ${money(m.target_amount)}` : ''}
                      </strong>
                      {m.description && <span style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.5 }}>{m.description}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: m.reached_at ? 'var(--green-dark, var(--green-dark))' : 'var(--t3)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!m.reached_at} onChange={() => void toggleReached(m)} style={{ accentColor: 'var(--violet)', width: 15, height: 15 }} />
                        Reached
                      </label>
                      <button type="button" onClick={() => void deleteMilestone(m.id)}
                        title="Delete milestone"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 16, padding: '2px 4px', lineHeight: 1 }}>
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Add milestone form */}
        <section className="kf-card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 16px' }}>Add a Milestone</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
            <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--t2)' }}>
              Title
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} maxLength={200}
                placeholder="e.g. Cover first month of rent" style={{ height: 42, border: '1px solid var(--b2)', borderRadius: 9, padding: '0 12px', fontSize: 14 }} />
            </label>
            <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--t2)' }}>
              Target amount (optional)
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: 0, bottom: 0, display: 'flex', alignItems: 'center', color: 'var(--t3)', fontWeight: 800 }}>{currencySymbol(currency)}</span>
                <input value={newTarget} onChange={e => setNewTarget(e.target.value)} type="number" min="1" step="1"
                  placeholder="2500" style={{ width: '100%', boxSizing: 'border-box', height: 42, border: '1px solid var(--b2)', borderRadius: 9, padding: '0 12px 0 26px', fontSize: 14 }} />
              </div>
            </label>
            <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--t2)' }}>
              Description (optional)
              <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={3} maxLength={1000}
                placeholder="What happens once this goal is reached?" style={{ border: '1px solid var(--b2)', borderRadius: 9, padding: '10px 12px', fontSize: 14, resize: 'vertical', lineHeight: 1.6 }} />
            </label>
            <button type="button" onClick={() => void addMilestone()} disabled={saving || !newTitle.trim()}
              style={{ height: 44, border: 0, borderRadius: 10, background: saving ? 'var(--b2)' : 'linear-gradient(135deg,var(--violet),#4d1ee0)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Adding…' : 'Add Milestone'}
            </button>
          </div>
        </section>

        {milestones.length === 0 && (
          <div style={{ padding: '32px 24px', textAlign: 'center', background: 'var(--s2)', borderRadius: 14, border: '1px solid var(--b2)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
            <p style={{ fontWeight: 700, margin: '0 0 6px' }}>No milestones yet</p>
            <p style={{ fontSize: 13, color: 'var(--t3)', margin: '0 0 16px' }}>Add stretch goals to give donors something to rally behind as your campaign grows.</p>
          </div>
        )}

        <p style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.6 }}>
          💡 Milestones with a target amount automatically show progress based on funds raised. Mark a milestone &ldquo;Reached&rdquo; to highlight it as complete regardless of target.
        </p>
      </div>
    </CharitMeShell>
  );
}
