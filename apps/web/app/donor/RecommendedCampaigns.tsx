'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { formatCents } from '@shared/currencies';
import { Spinner } from '../../components/ui';

type Recommendation = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  category: string;
  coverImageUrl: string | null;
  goalAmount: number;
  raisedAmount: number;
  backerCount: number;
  percentFunded: number;
  trustStatus: string | null;
  healthScore: number;
  matchReason: string;
  currency?: string | null;
};

type MatchingResult = {
  topCategories: string[];
  recommendations: Recommendation[];
  message: string;
};

const cardStyle: React.CSSProperties = {
  background: 'var(--s1, #fff)', border: '1px solid var(--b1, #e8ecf4)', borderRadius: 14,
  padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
};

export default function RecommendedCampaigns() {
  const [data, setData] = useState<MatchingResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/ai/matching-finder')
      .then((res) => (res.ok ? res.json() : null))
      .then((json: MatchingResult | null) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{ ...cardStyle, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--t3, #94a3b8)' }}>
        <Spinner size={16} />
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>Finding campaigns for you…</span>
      </div>
    );
  }

  if (!data || data.recommendations.length === 0) return null;

  return (
    <div style={{ ...cardStyle, marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px' }}>✨ Recommended for You</h2>

      <div style={{ fontSize: 13.5, color: '#4338ca', background: 'rgba(108,53,255,.10)', border: '1px solid #ede9fe', borderRadius: 8, padding: '10px 14px', lineHeight: 1.5, marginBottom: 16 }}>
        {data.message}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
        {data.recommendations.map((r) => (
          <Link key={r.id} href={`/campaigns/${r.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ border: '1px solid var(--b1, #f1f5f9)', borderRadius: 12, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                height: 110, background: r.coverImageUrl ? `url(${r.coverImageUrl}) center/cover` : 'linear-gradient(135deg,#6c35ff,#4d1ee0)',
              }} />
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#6c35ff', textTransform: 'uppercase', letterSpacing: 0.4 }}>{r.category}</span>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--t1, #1a1a2e)', lineHeight: 1.3 }}>{r.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--t3, #94a3b8)' }}>{r.matchReason}</div>
                <div style={{ marginTop: 'auto' }}>
                  <div style={{ background: 'var(--s3, #f1f5f9)', borderRadius: 99, height: 6, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ height: '100%', width: `${r.percentFunded}%`, background: 'var(--green, #19b86a)', borderRadius: 99 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <strong style={{ color: 'var(--t1, #1a1a2e)' }}>{formatCents(r.raisedAmount, r.currency ?? 'usd')}</strong>
                    <span style={{ color: 'var(--t3, #94a3b8)' }}>{r.percentFunded}% funded</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
