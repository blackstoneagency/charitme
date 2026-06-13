import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { isAdmin } from '../../../../../lib/roles';

export const dynamic = 'force-dynamic';

// ── GET /api/campaigns/[id]/analytics ────────────────────────────────────────
// Returns donation trends (daily for last 30 days), share event breakdown,
// and UTM source attribution for the campaign owner.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify ownership or team membership
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, slug, user_id, raised_amount, goal_amount, backer_count, status')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (campaign.user_id !== user.id) {
    const { data: tm } = await supabaseAdmin
      .from('team_members').select('id').eq('campaign_id', id).eq('user_id', user.id).maybeSingle();
    if (!tm && !(await isAdmin(user.id, user.email))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [
    { data: donations },
    { data: shareEvents },
    { data: recurringDonations },
    { data: launchSettings },
  ] = await Promise.all([
    supabaseAdmin
      .from('donations')
      .select('id, amount_cents, created_at, source_utm, anonymous, donor_id')
      .eq('campaign_id', id)
      .eq('status', 'completed')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('share_events')
      .select('id, channel, utm_source, utm_medium, converted, created_at')
      .eq('campaign_id', id)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('recurring_donations')
      .select('id, amount_cents, cadence, status')
      .eq('campaign_id', id)
      .eq('status', 'active'),
    supabaseAdmin
      .from('campaign_launch_settings')
      .select('currency')
      .eq('campaign_id', id)
      .maybeSingle(),
  ]);

  // ── Daily donation trend (last 30 days) ──────────────────────────────────
  const dailyMap: Record<string, { count: number; amount: number }> = {};
  for (const d of donations ?? []) {
    const day = d.created_at.slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { count: 0, amount: 0 };
    dailyMap[day].count += 1;
    dailyMap[day].amount += d.amount_cents;
  }
  const dailyTrend = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  // ── UTM / source attribution ──────────────────────────────────────────────
  const utmMap: Record<string, { count: number; amount: number }> = {};
  for (const d of donations ?? []) {
    const utm = d.source_utm as Record<string, string> | null;
    const source = utm?.utm_source ?? 'direct';
    if (!utmMap[source]) utmMap[source] = { count: 0, amount: 0 };
    utmMap[source].count += 1;
    utmMap[source].amount += d.amount_cents;
  }
  const topSources = Object.entries(utmMap)
    .sort(([, a], [, b]) => b.amount - a.amount)
    .slice(0, 10)
    .map(([source, v]) => ({ source, ...v }));

  // ── Share event aggregation by channel ────────────────────────────────────
  const channelMap: Record<string, { shares: number; conversions: number }> = {};
  for (const ev of shareEvents ?? []) {
    const ch = ev.channel ?? 'other';
    if (!channelMap[ch]) channelMap[ch] = { shares: 0, conversions: 0 };
    channelMap[ch].shares += 1;
    if (ev.converted) channelMap[ch].conversions += 1;
  }
  const sharesByChannel = Object.entries(channelMap)
    .sort(([, a], [, b]) => b.shares - a.shares)
    .map(([channel, v]) => ({
      channel,
      ...v,
      conversionRate: v.shares > 0 ? Math.round((v.conversions / v.shares) * 100) : 0,
    }));

  // ── Aggregate totals ──────────────────────────────────────────────────────
  const allDonations = donations ?? [];
  const totalRaisedLast30 = allDonations.reduce((s, d) => s + d.amount_cents, 0);
  const donorIds = new Set(allDonations.filter(d => d.donor_id).map(d => d.donor_id));
  const guestCount = allDonations.filter(d => !d.donor_id).length;
  const totalShares = (shareEvents ?? []).length;
  const totalConversions = (shareEvents ?? []).filter(e => e.converted).length;
  const overallConversionRate = totalShares > 0
    ? Math.round((totalConversions / totalShares) * 100)
    : 0;

  const monthlyRecurring = (recurringDonations ?? [])
    .reduce((s, r) => {
      const monthly = r.cadence === 'weekly' ? r.amount_cents * 4.33
        : r.cadence === 'quarterly' ? r.amount_cents / 3
        : r.cadence === 'annual' ? r.amount_cents / 12
        : r.amount_cents;
      return s + monthly;
    }, 0);

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      title: campaign.title,
      slug: campaign.slug,
      status: campaign.status,
      raised_amount: campaign.raised_amount,
      goal_amount: campaign.goal_amount,
      backer_count: campaign.backer_count,
    },
    currency: launchSettings?.currency ?? 'usd',
    period: { days: 30, from: thirtyDaysAgo.slice(0, 10) },
    summary: {
      donationsLast30Days: allDonations.length,
      raisedLast30Days: totalRaisedLast30,
      uniqueDonors: donorIds.size,
      guestDonors: guestCount,
      totalSharesLast30Days: totalShares,
      shareConversions: totalConversions,
      overallConversionRate,
      activeRecurringDonors: (recurringDonations ?? []).length,
      estimatedMonthlyRecurring: Math.round(monthlyRecurring),
    },
    dailyTrend,
    topSources,
    sharesByChannel,
  });
}
