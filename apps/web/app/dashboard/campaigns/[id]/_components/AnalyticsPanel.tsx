'use client';

import React, { useEffect, useState } from 'react';

type DailyPoint = { date: string; count: number; amount: number };
type SourceRow  = { source: string; count: number; amount: number };
type ChannelRow = { channel: string; shares: number; conversions: number; conversionRate: number };

type Analytics = {
  campaign: {
    id: string; title: string; slug: string; status: string;
    raised_amount: number; goal_amount: number; backer_count: number;
  };
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

function fmt(cents: number) {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

const CHANNEL_ICON: Record<string, string> = {
  facebook: '📘', twitter: '🐦', instagram: '📸', linkedin: '💼',
  whatsapp: '💬', email: '✉️', sms: '📱', qr: '📷', link: '🔗', other: '🌐',
};

export default function AnalyticsPanel({ campaignId }: { campaignId: string }) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    void (async () => {
      try {
        const r = await fetch(`/api/campaigns/${campaignId}/analytics`);
        if (!r.ok) { setError('Failed to load analytics'); return; }
        const d: Analytics = await r.json();
        if (active) setAnalytics(d);
      } catch { setError('Network error'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [campaignId]);

  if (loading) return <div style={{ padding: '24px 0', color: '#94a3b8', fontSize: 14 }}>Loading analytics…</div>;
  if (error || !analytics) return <div style={{ padding: '24px 0', color: '#ef4444', fontSize: 14 }}>{error || 'No data'}</div>;

  const { campaign, summary, dailyTrend, topSources, sharesByChannel } = analytics;
  const goalPct = pct(campaign.raised_amount, campaign.goal_amount);
  const maxDay = Math.max(...dailyTrend.map(d => d.amount), 1);

  const metricCard = (label: string, value: string, sub?: string) => (
    <div style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 14, padding: '20px 22px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1a2e' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Analytics <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>last 30 days</span></h2>
          <a href={`/campaigns/${campaign.slug}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 13, color: '#6c35ff', fontWeight: 700, textDecoration: 'none' }}>
            View campaign →
          </a>
        </div>
      </div>

      {/* Campaign progress */}
      <div style={{ background: '#f5f0ff', border: '1px solid #e0d4ff', borderRadius: 14, padding: '16px 22px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 650, fontSize: 15, color: '#1a1a2e' }}>{fmt(campaign.raised_amount)} raised</span>
          <span style={{ fontSize: 13, color: '#6c35ff', fontWeight: 700 }}>{goalPct}% of {fmt(campaign.goal_amount)} goal</span>
        </div>
        <div style={{ background: '#e0d4ff', borderRadius: 99, height: 8, overflow: 'hidden' }}>
          <div style={{ background: '#6c35ff', width: `${Math.min(100, goalPct)}%`, height: '100%', borderRadius: 99, transition: 'width .6s' }} />
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>{campaign.backer_count.toLocaleString()} total donors</div>
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
        <div style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 14, padding: '20px 22px', marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 650, color: '#1a1a2e' }}>Daily donations (last 30 days)</h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80, overflow: 'hidden' }}>
            {dailyTrend.map(d => (
              <div key={d.date} title={`${d.date}: ${fmt(d.amount)} (${d.count} donors)`}
                style={{ flex: 1, minWidth: 6, background: '#6c35ff', borderRadius: '3px 3px 0 0', opacity: 0.8,
                  height: `${Math.max(4, Math.round((d.amount / maxDay) * 80))}px`, transition: 'height .3s' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#94a3b8' }}>
            <span>{dailyTrend[0]?.date}</span>
            <span>{dailyTrend[dailyTrend.length - 1]?.date}</span>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Top referral sources */}
        <div style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 14, padding: '20px 22px' }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 650, color: '#1a1a2e' }}>Top referral sources</h2>
          {topSources.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 13 }}>No UTM data yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topSources.map(s => (
                <div key={s.source} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#334064', fontWeight: 600, textTransform: 'capitalize' }}>{s.source}</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 13, fontWeight: 650, color: '#1a1a2e' }}>{fmt(s.amount)}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>{s.count} donors</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Shares by channel */}
        <div style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 14, padding: '20px 22px' }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 650, color: '#1a1a2e' }}>Shares by channel</h2>
          {sharesByChannel.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 13 }}>No shares yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sharesByChannel.map(ch => (
                <div key={ch.channel} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13 }}>
                    {CHANNEL_ICON[ch.channel] ?? '🌐'} <span style={{ fontWeight: 600, color: '#334064', textTransform: 'capitalize' }}>{ch.channel}</span>
                  </span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 13, fontWeight: 650, color: '#1a1a2e' }}>{ch.shares}</span>
                    <span style={{ fontSize: 11, color: ch.conversionRate > 0 ? '#19b86a' : '#94a3b8', marginLeft: 6 }}>
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
