'use client';

import React, { useState } from 'react';
import { formatMoneyShort } from '@shared/currencies';

interface Campaign { id: string; title: string; raised_amount: number; currency?: string | null }
interface Props { campaigns: Campaign[] }

type Speed = 'standard' | 'same_day' | 'instant';
type Urgency = 'urgent' | 'moderate' | 'flexible';

type SpeedOption = { speed: Speed; label: string; etaLabel: string; feeCents: number; netCents: number };

type OptimizerResult = {
  availableCents: number;
  daysLeft: number | null;
  recommended: Speed;
  urgency: Urgency;
  speedOptions: SpeedOption[];
  totalFeesPaidCents: number;
  message: string;
};

const URGENCY_STYLE: Record<Urgency, { label: string; color: string; bg: string }> = {
  urgent:   { label: 'Time-sensitive', color: 'var(--red)', bg: 'rgba(255,59,95,.1)' },
  moderate: { label: 'Some urgency', color: '#f59e0b', bg: 'rgba(245,158,11,.14)' },
  flexible: { label: 'No rush', color: 'var(--green-dark)', bg: 'rgba(18,166,83,.14)' },
};

export default function FeeOptimizerCard({ campaigns }: Props) {
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const selected = campaigns.find(c => c.id === campaignId);
  const currency = selected?.currency ?? 'usd';
  const fmt = (cents: number) => formatMoneyShort(cents, currency);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<OptimizerResult | null>(null);

  if (campaigns.length === 0) return null;

  async function handleCheck() {
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch(`/api/ai/fee-optimizer?campaignId=${encodeURIComponent(campaignId)}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Could not load fee guidance.'); return; }
      setResult(json as OptimizerResult);
    } catch {
      setError('Could not load fee guidance. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const tone = result ? URGENCY_STYLE[result.urgency] : null;

  return (
    <section className="kf-card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>✨ AI Fee Optimizer</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {campaigns.length > 1 && (
            <select aria-label="Campaign to optimise fees for" value={campaignId} onChange={e => { setCampaignId(e.target.value); setResult(null); }}
              style={{ height: 36, border: '1px solid var(--b2)', borderRadius: 8, padding: '0 10px', fontSize: 13, background: 'var(--s1)' }}>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          )}
          <button type="button" onClick={() => void handleCheck()} disabled={loading}
            style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: loading ? 'var(--b2)' : 'linear-gradient(135deg,var(--violet),#4d1ee0)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? 'Analyzing…' : 'Get fee guidance'}
          </button>
        </div>
      </div>

      {error && <div style={{ padding: '10px 14px', background: 'rgba(255,59,95,.08)', border: '1px solid rgba(255,59,95,.28)', borderRadius: 8, color: 'var(--red)', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>⚠ {error}</div>}

      {!result && !error && (
        <p style={{ fontSize: 13, color: 'var(--t3)', margin: 0 }}>
          Get a recommended payout speed based on your available balance, campaign timeline, and the fee for each option.
        </p>
      )}

      {result && tone && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ background: tone.bg, color: tone.color, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800 }}>
              {tone.label}
            </span>
            <span style={{ fontSize: 13, color: 'var(--t3)' }}>Available balance: <strong style={{ color: 'var(--t1)' }}>{fmt(result.availableCents)}</strong></span>
            {result.daysLeft !== null && (
              <span style={{ fontSize: 13, color: 'var(--t3)' }}>{result.daysLeft >= 0 ? `${result.daysLeft} day${result.daysLeft === 1 ? '' : 's'} left` : 'Campaign ended'}</span>
            )}
          </div>

          <div style={{ fontSize: 13.5, color: 'var(--violet)', background: 'rgba(109,53,255,.08)', border: '1px solid rgba(109,53,255,.18)', borderRadius: 8, padding: '10px 14px', lineHeight: 1.5 }}>
            {result.message}
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--t2)', marginBottom: 6 }}>Payout speed comparison</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {result.speedOptions.map((opt) => (
                <div key={opt.speed} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 13,
                  padding: '8px 12px', borderRadius: 8,
                  border: opt.speed === result.recommended ? '1.5px solid var(--violet)' : '1px solid var(--b1)',
                  background: opt.speed === result.recommended ? 'rgba(109,53,255,.08)' : 'transparent',
                }}>
                  <div>
                    <strong style={{ color: 'var(--t1)' }}>{opt.label}</strong>
                    {opt.speed === result.recommended && (
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, color: 'var(--violet)' }}>✨ Recommended</span>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--t3)' }}>{opt.etaLabel}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: 'var(--green)' }}>{fmt(opt.netCents)}</div>
                    <div style={{ fontSize: 12, color: opt.feeCents > 0 ? '#f59e0b' : 'var(--t3)' }}>
                      {opt.feeCents > 0 ? `−${fmt(opt.feeCents)} fee` : 'No fee'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {result.totalFeesPaidCents > 0 && (
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>
              You&apos;ve paid {fmt(result.totalFeesPaidCents)} in expedited payout fees so far.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
