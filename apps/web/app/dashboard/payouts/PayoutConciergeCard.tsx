'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import { formatMoneyShort } from '@shared/currencies';

interface Campaign { id: string; title: string; raised_amount: number; currency?: string | null }
interface Props { campaigns: Campaign[] }

type Blocker = { code: string; label: string; actionUrl: string };
type Readiness = 'ready' | 'action_needed' | 'blocked';

type ConciergeResult = {
  readiness: Readiness;
  availableCents: number;
  blockers: Blocker[];
  message: string;
  timelines: Record<string, string>;
  payoutReady: boolean;
};

const READINESS_STYLE: Record<Readiness, { label: string; color: string; bg: string }> = {
  ready:         { label: 'Ready for payout', color: 'var(--green-dark)', bg: 'rgba(18,166,83,.14)' },
  action_needed: { label: 'Action needed', color: '#f97316', bg: 'rgba(245,158,11,.14)' },
  blocked:       { label: 'On hold', color: 'var(--red)', bg: 'rgba(255,59,95,.1)' },
};

export default function PayoutConciergeCard({ campaigns }: Props) {
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const selected = campaigns.find(c => c.id === campaignId);
  const currency = selected?.currency ?? 'usd';
  const fmt = (cents: number) => formatMoneyShort(cents, currency);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ConciergeResult | null>(null);

  if (campaigns.length === 0) return null;

  async function handleCheck() {
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch(`/api/ai/payout-concierge?campaignId=${encodeURIComponent(campaignId)}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Could not load payout guidance.'); return; }
      setResult(json as ConciergeResult);
    } catch {
      setError('Could not load payout guidance. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const tone = result ? READINESS_STYLE[result.readiness] : null;

  return (
    <section className="kf-card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>✨ AI Payout Concierge</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {campaigns.length > 1 && (
            <select aria-label="Campaign to review payouts for" value={campaignId} onChange={e => { setCampaignId(e.target.value); setResult(null); }}
              style={{ height: 36, border: '1px solid var(--b2)', borderRadius: 8, padding: '0 10px', fontSize: 13, background: 'var(--s1)' }}>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          )}
          <button type="button" onClick={() => void handleCheck()} disabled={loading}
            style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: loading ? 'var(--b2)' : 'linear-gradient(135deg,var(--violet),#4d1ee0)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? 'Checking…' : 'Check payout status'}
          </button>
        </div>
      </div>

      {error && <div style={{ padding: '10px 14px', background: 'rgba(255,59,95,.08)', border: '1px solid rgba(255,59,95,.28)', borderRadius: 8, color: 'var(--red)', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>⚠ {error}</div>}

      {!result && !error && (
        <p style={{ fontSize: 13, color: 'var(--t3)', margin: 0 }}>
          Get a personalized readiness check, blockers, and an estimated timeline for your next payout.
        </p>
      )}

      {result && tone && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ background: tone.bg, color: tone.color, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800 }}>
              {tone.label}
            </span>
            <span style={{ fontSize: 13, color: 'var(--t3)' }}>Available balance: <strong style={{ color: 'var(--t1)' }}>{fmt(result.availableCents)}</strong></span>
          </div>

          <div style={{ fontSize: 13.5, color: 'var(--violet)', background: 'rgba(109,53,255,.08)', border: '1px solid rgba(109,53,255,.18)', borderRadius: 8, padding: '10px 14px', lineHeight: 1.5 }}>
            {result.message}
          </div>

          {result.blockers.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--t2)', marginBottom: 6 }}>Next steps</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {result.blockers.map(b => (
                  <Link key={b.code} href={b.actionUrl}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 13, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--b1)', textDecoration: 'none', color: 'var(--t1)' }}>
                    {b.label}
                    <span style={{ color: 'var(--violet)', fontWeight: 700, fontSize: 12 }}>Resolve →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {result.readiness === 'ready' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--t2)', marginBottom: 6 }}>Payout speed timelines</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {Object.entries(result.timelines).map(([speed, desc]) => (
                  <div key={speed} style={{ fontSize: 12.5, color: 'var(--t3)', display: 'flex', gap: 8 }}>
                    <strong style={{ color: 'var(--t1)', textTransform: 'capitalize', minWidth: 70 }}>{speed.replace('_', ' ')}</strong>
                    {desc}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
