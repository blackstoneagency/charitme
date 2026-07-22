'use client';

import Link from 'next/link';
import React, { useState } from 'react';

interface Props { campaignId: string }

type Signal = { label: string; state: 'verified' | 'watch' | 'pending'; detail: string };
type Suggestion = { code: string; label: string; pointsGain: number; actionUrl: string | null; actionLabel: string | null };

type TrustScoreResult = {
  score: number;
  status: string;
  signals: Signal[];
  suggestions: Suggestion[];
  message: string;
};

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  'Verified':       { color: '#079447', bg: '#def7e7' },
  'Strong Trust':   { color: '#079447', bg: '#def7e7' },
  'Needs More Info': { color: '#f97316', bg: '#fff0dc' },
  'Under Review':   { color: '#6b7280', bg: '#f1f5f9' },
};

const SIGNAL_ICON: Record<Signal['state'], { icon: string; color: string }> = {
  verified: { icon: '✓', color: '#19b86a' },
  watch:    { icon: '⚠', color: '#f59e0b' },
  pending:  { icon: '○', color: '#94a3b8' },
};

export default function TrustScoreCard({ campaignId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TrustScoreResult | null>(null);

  async function handleCheck() {
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch(`/api/ai/trust-score?campaignId=${encodeURIComponent(campaignId)}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Could not load trust score.'); return; }
      setResult(json as TrustScoreResult);
    } catch {
      setError('Could not load trust score. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const tone = result ? (STATUS_STYLE[result.status] ?? STATUS_STYLE['Needs More Info']) : null;

  return (
    <section className="kf-card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>✨ AI Trust Score Coach</h2>
        <button type="button" onClick={() => void handleCheck()} disabled={loading}
          style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: loading ? 'var(--b2)' : 'linear-gradient(135deg,#6c35ff,#4d1ee0)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: loading ? 'wait' : 'pointer' }}>
          {loading ? 'Analyzing…' : 'Check my CharitScore'}
        </button>
      </div>

      {error && <div style={{ padding: '10px 14px', background: 'rgba(255,59,95,.08)', border: '1px solid rgba(255,59,95,.28)', borderRadius: 8, color: 'var(--red)', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>⚠ {error}</div>}

      {!result && !error && (
        <p style={{ fontSize: 13, color: 'var(--t3)', margin: 0 }}>
          See your public CharitScore, what donors see as trust signals, and the fastest ways to raise it.
        </p>
      )}

      {result && tone && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ background: tone.bg, color: tone.color, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800 }}>
              {result.status}
            </span>
            <span style={{ fontSize: 13, color: 'var(--t3)' }}>CharitScore: <strong style={{ color: 'var(--t1)' }}>{result.score}/99</strong></span>
          </div>

          <div style={{ fontSize: 13.5, color: 'var(--violet)', background: 'rgba(109,53,255,.08)', border: '1px solid rgba(109,53,255,.2)', borderRadius: 8, padding: '10px 14px', lineHeight: 1.5 }}>
            {result.message}
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--t2)', marginBottom: 6 }}>Trust signals</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {result.signals.map((s) => {
                const sig = SIGNAL_ICON[s.state];
                return (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, padding: '6px 0' }}>
                    <span style={{ color: sig.color, fontWeight: 800, flexShrink: 0 }}>{sig.icon}</span>
                    <div>
                      <strong style={{ color: 'var(--t1)' }}>{s.label}</strong>
                      <div style={{ fontSize: 12, color: 'var(--t3)' }}>{s.detail}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {result.suggestions.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--t2)', marginBottom: 6 }}>Ways to raise your score</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {result.suggestions.map((sug) => {
                  const content = (
                    <>
                      <span>{sug.label}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontWeight: 800, color: '#19b86a', fontSize: 12 }}>+{sug.pointsGain}</span>
                        {sug.actionUrl && (
                          <span style={{ color: 'var(--violet)', fontWeight: 700, fontSize: 12 }}>{sug.actionLabel ?? 'Resolve'} →</span>
                        )}
                      </span>
                    </>
                  );
                  const style: React.CSSProperties = {
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 13,
                    padding: '8px 12px', borderRadius: 8, border: '1px solid var(--b1)', textDecoration: 'none', color: 'var(--t1)',
                  };
                  return sug.actionUrl ? (
                    <Link key={sug.code} href={sug.actionUrl} style={style}>{content}</Link>
                  ) : (
                    <div key={sug.code} style={style}>{content}</div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
