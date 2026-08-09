'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Btn, Badge, Spinner } from '../../../components/ui';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
// Campaign-builder styles, scoped here rather than in globals.css so the
// ~36KB of .cr2-* rules does not ship on every other public route.
import '../../create/builder.css';

// ─────────────────────────────────────────────────────────────────────────────
// "Find grants that fit" — the UI for POST /api/ai/grant-match.
//
// That endpoint was fully built, auth-guarded and Supabase-wired, and had ZERO
// callers anywhere in the codebase: no user could reach it. Nothing catches
// that — the build, tests and lint all pass for an endpoint nobody invokes.
//
// The ranking behind it (`rankGrantMatches`) is deterministic rather than an
// LLM call, so results are stable and explainable — each match comes back with
// the reasons it scored, which are shown rather than hidden behind a number.
// ─────────────────────────────────────────────────────────────────────────────

type Match = {
  grantId: string;
  score: number;
  reasons?: string[];
  grant: {
    id: string; slug: string; title: string; funder_name: string;
    amount_min: number | null; amount_max: number | null; currency: string | null;
    deadline_at: string | null;
  } | null;
};

function money(cents: number | null, currency = 'USD'): string {
  if (cents === null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100);
}

export default function GrantMatchClient() {
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [keywords, setKeywords] = useState('');
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function findMatches(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(''); setMatches(null);
    try {
      const amountNeeded = Math.round((parseFloat(amount) || 0) * 100);
      const res = await fetch('/api/ai/grant-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(category ? { category } : {}),
          ...(amountNeeded > 0 ? { amountNeeded } : {}),
          ...(keywords.trim() ? { keywords: keywords.trim() } : {}),
          limit: 10,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error === 'Too many requests'
          ? 'Too many searches just now — give it a minute and try again.'
          : 'Could not load matches right now. Please try again.');
        return;
      }
      setMatches((data?.matches ?? []) as Match[]);
    } catch {
      setError('Could not reach the matching service. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="kf-card" style={{ marginBottom: 18 }}>
      <div className="kf-card-head">
        <h2>Find grants that fit</h2>
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 13.5, lineHeight: 1.7, color: 'var(--t2)' }}>
        Tell us what you need funding for and we&apos;ll rank open grants against it. Matching is
        rule-based, so you can see exactly why each one scored.
      </p>

      <form onSubmit={findMatches} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--t2)' }}>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ height: 40, borderRadius: 10, border: '1.5px solid var(--b2)', background: 'var(--s1)', color: 'var(--t1)', padding: '0 10px', fontSize: 14 }}
            >
              <option value="">Any category</option>
              {CAMPAIGN_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--t2)' }}>
            Amount needed (USD)
            <input
              type="number" min="0" step="any" inputMode="decimal" placeholder="25,000"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              style={{ height: 40, borderRadius: 10, border: '1.5px solid var(--b2)', background: 'var(--s1)', color: 'var(--t1)', padding: '0 10px', fontSize: 14 }}
            />
          </label>
        </div>

        <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--t2)' }}>
          What is the funding for?
          <input
            type="text" maxLength={500} placeholder="After-school tutoring for 120 students"
            value={keywords} onChange={(e) => setKeywords(e.target.value)}
            style={{ height: 40, borderRadius: 10, border: '1.5px solid var(--b2)', background: 'var(--s1)', color: 'var(--t1)', padding: '0 10px', fontSize: 14 }}
          />
        </label>

        <div>
          <Btn type="submit" loading={loading}>Find matching grants</Btn>
        </div>
      </form>

      {error && <div className="cr2-error" role="alert" style={{ marginTop: 14 }}>{error}</div>}

      {loading && <div style={{ padding: '18px 0' }}><Spinner /></div>}

      {matches && matches.length === 0 && !loading && (
        <p style={{ marginTop: 16, fontSize: 13.5, color: 'var(--t3)' }}>
          No open grants matched that yet. Try a broader category or drop the amount —{' '}
          <Link href="/grants" style={{ color: 'var(--violet-ink)', fontWeight: 700 }}>browse all grants</Link>.
        </p>
      )}

      {matches && matches.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10, marginTop: 16 }}>
          {matches.map((m) => m.grant && (
            <div key={m.grantId} style={{ padding: 12, borderRadius: 12, border: '1px solid var(--b1)', background: 'var(--s1)' }}>
              <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <Link href={`/grants/${m.grant.slug}`} style={{ fontWeight: 800, color: 'var(--t1)', textDecoration: 'none', fontSize: 14.5 }}>
                  {m.grant.title}
                </Link>
                <Badge color={m.score >= 70 ? 'green' : m.score >= 40 ? 'blue' : 'gray'}>{m.score}% match</Badge>
              </div>
              <p style={{ margin: '0 0 6px', fontSize: 12.5, color: 'var(--t3)' }}>
                {m.grant.funder_name} · {money(m.grant.amount_min, m.grant.currency ?? 'USD')}–{money(m.grant.amount_max, m.grant.currency ?? 'USD')}
              </p>
              {m.reasons && m.reasons.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7, color: 'var(--t2)' }}>
                  {m.reasons.slice(0, 3).map((r) => <li key={r}>{r}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
