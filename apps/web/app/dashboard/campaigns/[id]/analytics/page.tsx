'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatMoneyShort } from '@shared/currencies';

type DailyPoint = { date: string; count: number; amount: number };
type SourceRow  = { source: string; count: number; amount: number };
type ChannelRow = { channel: string; shares: number; conversions: number; conversionRate: number };

type Analytics = {
  campaign: {
    id: string; title: string; slug: string; status: string;
    raised_amount: number; goal_amount: number; backer_count: number;
  };
  currency?: string;
  period: { days: number; from: string };
  summary: {
    donationsLast30Days: number;
    raisedLast30Days: number;
    uniqueDonors: number;
    guestDonors: number;
    totalSharesLast30Days: number;
    shareConversions: number;
    overallConversionRate: number;
    activeRecurringDonors: number;
    estimatedMonthlyRecurring: number;
  };
  dailyTrend: DailyPoint[];
  topSources: SourceRow[];
  sharesByChannel: ChannelRow[];
};

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

const CHANNEL_ICON: Record<string, string> = {
  facebook: '📘', twitter: '🐦', instagram: '📸', linkedin: '💼',
  whatsapp: '💬', email: '✉️', sms: '📱', qr: '📷', link: '🔗', other: '🌐',
};

export default function CampaignAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      const { id } = await params;
      try {
        const r = await fetch(`/api/campaigns/${id}/analytics`);
        if (!r.ok) { setError('Failed to load analytics'); return; }
        const d: Analytics = await r.json();
        if (active) setAnalytics(d);
      } catch { setError('Network error'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [params]);

  if (loading) return <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--t3, #94a3b8)' }}>Loading analytics…</div>;
  if (error || !analytics) return <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--red, #ef4444)' }}>{error || 'No data'}</div>;

  const { campaign, summary, dailyTrend, topSources, sharesByChannel } = analytics;
  const currency = analytics.currency ?? 'usd';
  const fmt = (cents: number) => formatMoneyShort(cents, currency);
  const goalPct = pct(campaign.raised_amount, campaign.goal_amount);
  const maxDay = Math.max(...dailyTrend.map(d => d.amount), 1);

  const metricCard = (label: string, value: string, sub?: string) => (
    <div style={{ background: 'var(--s1, #fff)', border: '1px solid var(--b1, #e8ecf4)', borderRadius: 14, padding: '20px 22px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t4, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--t1, #1a1a2e)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--t3, #64748b)', marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding: '32px 24px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <Link href={`/dashboard/campaigns/${campaign.id}`} style={{ color: 'var(--t3, #94a3b8)', fontSize: 13, textDecoration: 'none' }}>
          ← {campaign.title}
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--t1, #1a1a2e)', margin: 0 }}>Analytics <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t3, #94a3b8)' }}>last 30 days</span></h1>
          <a href={`/campaigns/${campaign.slug}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 13, color: 'var(--violet, #6c35ff)', fontWeight: 700, textDecoration: 'none' }}>
            View campaign →
          </a>
        </div>
      </div>

      {/* Campaign progress */}
      <div style={{ background: 'var(--s2, #f5f0ff)', border: '1px solid var(--b2, #e0d4ff)', borderRadius: 14, padding: '16px 22px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--t1, #1a1a2e)' }}>{fmt(campaign.raised_amount)} raised</span>
          <span style={{ fontSize: 13, color: 'var(--violet, #6c35ff)', fontWeight: 700 }}>{goalPct}% of {fmt(campaign.goal_amount)} goal</span>
        </div>
        <div style={{ background: 'var(--b2, #e0d4ff)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
          <div style={{ background: 'var(--violet, #6c35ff)', width: `${Math.min(100, goalPct)}%`, height: '100%', borderRadius: 99, transition: 'width .6s' }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--t3, #64748b)', marginTop: 8 }}>{campaign.backer_count.toLocaleString()} total donors</div>
      </div>

      {/* Summary metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 28 }}>
        {metricCard('Donations (30d)', summary.donationsLast30Days.toString(), `${summary.uniqueDonors} unique + ${summary.guestDonors} guest`)}
        {metricCard('Raised (30d)', fmt(summary.raisedLast30Days))}
        {metricCard('Shares (30d)', summary.totalSharesLast30Days.toString(), `${summary.shareConversions} converted`)}
        {metricCard('Share → Donate', `${summary.overallConversionRate}%`)}
        {metricCard('Recurring Donors', summary.activeRecurringDonors.toString(), `~${fmt(summary.estimatedMonthlyRecurring)}/mo`)}
      </div>

      {/* Daily trend chart */}
      {dailyTrend.length > 0 && (
        <div style={{ background: 'var(--s1, #fff)', border: '1px solid var(--b1, #e8ecf4)', borderRadius: 14, padding: '20px 22px', marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800, color: 'var(--t1, #1a1a2e)' }}>Daily donations (last 30 days)</h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80, overflow: 'hidden' }}>
            {dailyTrend.map(d => (
              <div key={d.date} title={`${d.date}: ${fmt(d.amount)} (${d.count} donors)`}
                style={{ flex: 1, minWidth: 6, background: '#6c35ff', borderRadius: '3px 3px 0 0', opacity: 0.8,
                  height: `${Math.max(4, Math.round((d.amount / maxDay) * 80))}px`, transition: 'height .3s' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--t3, #94a3b8)' }}>
            <span>{dailyTrend[0]?.date}</span>
            <span>{dailyTrend[dailyTrend.length - 1]?.date}</span>
          </div>
        </div>
      )}

      <div className="kf-two-col" style={{ marginBottom: 20 }}>
        {/* Top referral sources */}
        <div style={{ background: 'var(--s1, #fff)', border: '1px solid var(--b1, #e8ecf4)', borderRadius: 14, padding: '20px 22px' }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: 'var(--t1, #1a1a2e)' }}>Top referral sources</h2>
          {topSources.length === 0 ? (
            <div style={{ color: 'var(--t3, #94a3b8)', fontSize: 13 }}>No UTM data yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topSources.map(s => (
                <div key={s.source} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--t2, #334064)', fontWeight: 600, textTransform: 'capitalize' }}>{s.source}</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1, #1a1a2e)' }}>{fmt(s.amount)}</span>
                    <span style={{ fontSize: 11, color: 'var(--t3, #94a3b8)', marginLeft: 6 }}>{s.count} donors</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Shares by channel */}
        <div style={{ background: 'var(--s1, #fff)', border: '1px solid var(--b1, #e8ecf4)', borderRadius: 14, padding: '20px 22px' }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: 'var(--t1, #1a1a2e)' }}>Shares by channel</h2>
          {sharesByChannel.length === 0 ? (
            <div style={{ color: 'var(--t3, #94a3b8)', fontSize: 13 }}>No shares yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sharesByChannel.map(ch => (
                <div key={ch.channel} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13 }}>
                    {CHANNEL_ICON[ch.channel] ?? '🌐'} <span style={{ fontWeight: 600, color: 'var(--t2, #334064)', textTransform: 'capitalize' }}>{ch.channel}</span>
                  </span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1, #1a1a2e)' }}>{ch.shares}</span>
                    <span style={{ fontSize: 11, color: ch.conversionRate > 0 ? '#19b86a' : 'var(--t3, #94a3b8)', marginLeft: 6 }}>
                      {ch.conversionRate}% converted
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
