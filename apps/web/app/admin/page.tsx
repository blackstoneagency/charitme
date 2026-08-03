import { boundedQuery } from '../../lib/query-timeout';
import 'server-only';
import { requireAdmin } from '../../lib/auth';
import { supabaseAdmin } from '../../lib/supabase';
import { CharitMeShell, TopBar } from '../../components/CharitMeShellServer';
import AdminDashboardClient, { type DashMetric, type CampaignRow, type DonationRow, type WeekPoint, type SourceItem, type SystemService } from './_components/AdminDashboardClient';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtCents(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${Math.round(dollars).toLocaleString('en-US')}`;
  return `$${Math.round(dollars).toLocaleString('en-US')}`;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
}

function weekLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function AdminDashboardPage() {
  await requireAdmin();

  // Fetch all needed data in parallel
  const now = new Date();
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const twoMonthsAgo = new Date(now);
  twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);
  const eightWeeksAgo = new Date(now);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const [
    donationsResult,
    lastMonthDonationsResult,
    prevMonthDonationsResult,
    donorCountResult,
    activeCampaignsResult,
    payoutsResult,
    topCampaignsResult,
    recentDonationsResult,
    weeklyDonationsResult,
    integrationCountResult,
    webhookErrorsResult,
    donStatusCompletedResult,
    donStatusPendingResult,
    donStatusRefundedResult,
    donStatusFailedResult,
  ] = await Promise.all([
    boundedQuery(() => supabaseAdmin.from('donations').select('amount_cents').eq('status', 'completed')),
    boundedQuery(() => supabaseAdmin.from('donations').select('donor_id, amount_cents').eq('status', 'completed').gte('created_at', monthAgo.toISOString())),
    boundedQuery(() => supabaseAdmin.from('donations').select('amount_cents').eq('status', 'completed').gte('created_at', twoMonthsAgo.toISOString()).lt('created_at', monthAgo.toISOString())),
    boundedQuery(() => supabaseAdmin.from('donations').select('donor_id').eq('status', 'completed')),
    boundedQuery(() => supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true }).eq('status', 'active')),
    boundedQuery(() => supabaseAdmin.from('payouts').select('amount_cents').eq('status', 'paid')),
    boundedQuery(() => supabaseAdmin.from('campaigns').select('id, title, status, raised_amount, goal_amount').order('raised_amount', { ascending: false }).limit(10)),
    boundedQuery(() => supabaseAdmin.from('donations').select('id, amount_cents, donor_id, campaign_id, created_at').eq('status', 'completed').order('created_at', { ascending: false }).limit(10)),
    boundedQuery(() => supabaseAdmin.from('donations').select('amount_cents, created_at').eq('status', 'completed').gte('created_at', eightWeeksAgo.toISOString())),
    boundedQuery(() => supabaseAdmin.from('integration_connections').select('id', { count: 'exact', head: true }).eq('status', 'connected')),
    boundedQuery(() => supabaseAdmin.from('webhook_events').select('id', { count: 'exact', head: true }).not('processing_error', 'is', null)),
    boundedQuery(() => supabaseAdmin.from('donations').select('id', { count: 'exact', head: true }).eq('status', 'completed')),
    boundedQuery(() => supabaseAdmin.from('donations').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
    boundedQuery(() => supabaseAdmin.from('donations').select('id', { count: 'exact', head: true }).eq('status', 'refunded')),
    boundedQuery(() => supabaseAdmin.from('donations').select('id', { count: 'exact', head: true }).eq('status', 'failed')),
  ]);

  // Surface DB connectivity errors immediately
  if (donationsResult.error) {
    const errMsg = donationsResult.error.message;
    const isKeyMissing = errMsg.includes('not set') || errMsg.includes('Invalid API');
    return (
      <CharitMeShell active="Dashboard" mode="admin">
        <div style={{ padding: '40px 32px', maxWidth: 720 }}>
          <div style={{ padding: '24px 28px', background: 'var(--tint-rose)', border: '1.5px solid #fecdd3', borderRadius: 14 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--red-text)', margin: '0 0 10px' }}>
              ❌ {isKeyMissing ? 'Missing Supabase credentials' : 'Database connection error'}
            </h2>
            <p style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--red-text)', margin: '0 0 14px', lineHeight: 1.7 }}>
              {donationsResult.error.code}: {errMsg}
            </p>
            <div style={{ fontSize: 14, color: '#334064', lineHeight: 1.8 }}>
              <strong>Steps to fix:</strong>
              <ol style={{ paddingLeft: 20, margin: '8px 0' }}>
                <li>Go to <strong>Vercel → your project → Settings → Environment Variables</strong></li>
                <li>Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to your Supabase service role key</li>
                <li>Set <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your Supabase anon key</li>
                <li>Set <code>NEXT_PUBLIC_SUPABASE_URL</code> to <code>https://yanexccimwooursawynm.supabase.co</code></li>
                <li>Redeploy from Vercel dashboard (env vars require a new deploy)</li>
                <li>If the database is not set up yet, run <code>supabase/catch_up.sql</code> in the Supabase SQL Editor (idempotent — safe on a fresh or existing database)</li>
              </ol>
            </div>
            <a href="/api/health?details=1" target="_blank" style={{ display: 'inline-block', marginTop: 12, padding: '10px 22px', background: '#6c35ff', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              Run Diagnostic → /api/health
            </a>
          </div>
        </div>
      </CharitMeShell>
    );
  }

  // Total donations
  const allDonations = (donationsResult.data ?? []) as { amount_cents: number }[];
  const totalDonationsCents = allDonations.reduce((s, d) => s + (d.amount_cents ?? 0), 0);

  // Last month donations
  const lastMonthDons = (lastMonthDonationsResult.data ?? []) as { donor_id: string; amount_cents: number }[];
  const lastMonthCents = lastMonthDons.reduce((s, d) => s + (d.amount_cents ?? 0), 0);
  const prevMonthDons = (prevMonthDonationsResult.data ?? []) as { amount_cents: number }[];
  const prevMonthCents = prevMonthDons.reduce((s, d) => s + (d.amount_cents ?? 0), 0);

  // Percent change helper
  function pctChange(curr: number, prev: number): string {
    if (prev === 0) return curr > 0 ? '+100%' : '0%';
    const diff = ((curr - prev) / prev) * 100;
    return (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
  }

  // Total donors
  const allDonorRows = (donorCountResult.data ?? []) as { donor_id: string }[];
  const totalDonors = new Set(allDonorRows.map(d => d.donor_id)).size;
  const lastMonthDonors = new Set(lastMonthDons.map(d => d.donor_id)).size;

  // Active campaigns
  const activeCampaigns = activeCampaignsResult.count ?? 0;

  // Total payouts
  const allPayouts = (payoutsResult.data ?? []) as { amount_cents: number }[];
  const totalPayoutsCents = allPayouts.reduce((s, p) => s + (p.amount_cents ?? 0), 0);

  // Build metrics
  const metrics: DashMetric[] = [
    {
      label: 'Total Donations',
      value: fmtCents(totalDonationsCents),
      change: pctChange(lastMonthCents, prevMonthCents) + ' vs last month',
      tone: 'violet',
      icon: 'gift',
    },
    {
      label: 'Total Donors',
      value: totalDonors.toLocaleString(),
      change: lastMonthDonors > 0 ? `+${lastMonthDonors} this month` : 'all time',
      tone: 'green',
      icon: 'users',
    },
    {
      label: 'Active Campaigns',
      value: activeCampaigns.toLocaleString(),
      change: 'currently live',
      tone: 'blue',
      icon: 'stack',
    },
    {
      label: 'Total Payouts',
      value: fmtCents(totalPayoutsCents),
      change: 'all time paid',
      tone: 'orange',
      icon: 'wallet',
    },
  ];

  // Build top campaigns
  type CampaignDb = { id: string; title: string; status: string; raised_amount: number; goal_amount: number };
  const topCampaignsRaw = (topCampaignsResult.data ?? []) as CampaignDb[];
  const campaigns: CampaignRow[] = topCampaignsRaw.map(c => ({
    id: c.id,
    title: c.title,
    raised: fmtCents(c.raised_amount ?? 0),
    goal: fmtCents(c.goal_amount ?? 0),
    status: capitalize(c.status),
  }));

  // Build recent donations (join donor names where possible)
  type DonationDb = { id: string; amount_cents: number; donor_id: string; campaign_id: string | null; created_at: string };
  const recentDonationsRaw = (recentDonationsResult.data ?? []) as DonationDb[];

  // Fetch donor profiles
  const donorIds = [...new Set(recentDonationsRaw.map(d => d.donor_id))];
  const donorMap = new Map<string, string>();
  if (donorIds.length > 0) {
    const { data: profiles } = await boundedQuery(() => supabaseAdmin.from('profiles').select('id, full_name').in('id', donorIds));
    for (const p of (profiles ?? []) as { id: string; full_name: string | null }[]) {
      if (p.full_name) donorMap.set(p.id, p.full_name);
    }
  }

  // Fetch campaign titles
  const campaignIds = [...new Set(recentDonationsRaw.map(d => d.campaign_id).filter(Boolean))] as string[];
  const campaignMap = new Map<string, string>();
  if (campaignIds.length > 0) {
    const { data: clist } = await boundedQuery(() => supabaseAdmin.from('campaigns').select('id, title').in('id', campaignIds));
    for (const c of (clist ?? []) as { id: string; title: string }[]) {
      campaignMap.set(c.id, c.title);
    }
  }

  const donations: DonationRow[] = recentDonationsRaw.map(d => ({
    id: d.id,
    amount: fmtCents(d.amount_cents),
    donor: donorMap.get(d.donor_id) ?? 'Anonymous',
    campaign: d.campaign_id ? (campaignMap.get(d.campaign_id) ?? 'Unknown') : 'Direct',
    date: new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  // Build weekly line chart data (8 weeks)
  type WeeklyDon = { amount_cents: number; created_at: string };
  const weeklyRaw = (weeklyDonationsResult.data ?? []) as WeeklyDon[];

  const weekBuckets: Map<string, number> = new Map();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weekBuckets.set(weekLabel(d), 0);
  }

  for (const d of weeklyRaw) {
    const date = new Date(d.created_at);
    // Find which week bucket this belongs to
    let found = false;
    const bucketKeys = [...weekBuckets.keys()];
    for (let i = 0; i < bucketKeys.length - 1; i++) {
      const bucketStart = new Date(now);
      bucketStart.setDate(bucketStart.getDate() - (7 - i) * 7);
      const bucketEnd = new Date(now);
      bucketEnd.setDate(bucketEnd.getDate() - (7 - i - 1) * 7);
      if (date >= bucketStart && date < bucketEnd) {
        const key = bucketKeys[i];
        weekBuckets.set(key, (weekBuckets.get(key) ?? 0) + (d.amount_cents ?? 0));
        found = true;
        break;
      }
    }
    if (!found) {
      const lastKey = bucketKeys[bucketKeys.length - 1];
      weekBuckets.set(lastKey, (weekBuckets.get(lastKey) ?? 0) + (d.amount_cents ?? 0));
    }
  }

  const weekPoints: WeekPoint[] = [...weekBuckets.entries()].map(([label, value]) => ({
    label,
    value: Math.round(value / 100), // in dollars
  }));

  // Donation status breakdown — real counts from DB
  const cntCompleted = donStatusCompletedResult.count ?? 0;
  const cntPending = donStatusPendingResult.count ?? 0;
  const cntRefunded = donStatusRefundedResult.count ?? 0;
  const cntFailed = donStatusFailedResult.count ?? 0;
  const cntTotal = cntCompleted + cntPending + cntRefunded + cntFailed || 1;
  const pct = (n: number) => Math.round((n / cntTotal) * 100);

  const sources: SourceItem[] = [
    { label: 'Completed', pct: pct(cntCompleted), color: 'var(--green-text)' },
    { label: 'Pending', pct: pct(cntPending), color: 'var(--orange-text)' },
    { label: 'Refunded', pct: pct(cntRefunded), color: 'var(--t3)' },
    { label: 'Failed', pct: pct(cntFailed), color: 'var(--red-text)' },
  ].filter(s => s.pct > 0);

  // System health services.
  //
  // `count` is null whenever the query errors, so `?? 0` reported **zero webhook
  // errors** — i.e. "Payment Gateway: Operational" — precisely when the database
  // was in trouble. Zero is the favourable answer here, so it needs proof.
  const webhookErrorsUnknown = Boolean(webhookErrorsResult.error) || webhookErrorsResult.count == null;
  const webhookErrors = webhookErrorsResult.count ?? 0;
  const integrationsUnknown = Boolean(integrationCountResult.error) || integrationCountResult.count == null;
  const integrations = integrationCountResult.count ?? 0;

  // Only claim a status we actually measured.
  //
  // Platform / Storage / Email had a hardcoded 'Operational' — they were never
  // checked, so the panel asserted green for four of six services no matter what
  // was happening. 'Unknown' is honest and visibly different; asserting health we
  // have not verified is the failure this whole panel is supposed to prevent.
  // Database is the one safe inference: these very queries just returned, so it is
  // reachable.
  const services: SystemService[] = [
    { name: 'Platform', status: 'Unknown' },
    { name: 'Database', status: 'Operational' },
    { name: 'Storage', status: 'Unknown' },
    {
      name: 'Payment Gateway',
      status: webhookErrorsUnknown ? 'Unknown' : webhookErrors > 5 ? 'Degraded' : 'Operational',
    },
    { name: 'Email Service', status: 'Unknown' },
    {
      name: integrationsUnknown ? 'Integrations (—)' : `Integrations (${integrations})`,
      status: integrationsUnknown ? 'Unknown' : 'Operational',
    },
  ];

  return (
    <CharitMeShell active="Dashboard" mode="admin">
      <TopBar
        title="Admin Dashboard"
        subtitle="High-level platform overview — all data live from Supabase."
        actions={<></>}
      />
      <AdminDashboardClient
        metrics={metrics}
        campaigns={campaigns}
        donations={donations}
        weekPoints={weekPoints}
        sources={sources}
        services={services}
      />
    </CharitMeShell>
  );
}

