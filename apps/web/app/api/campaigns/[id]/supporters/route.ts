import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { canManageCampaign } from '../../../../../lib/auth';
import {
  aggregateSupporters,
  filterTargets,
  maskEmail,
  sendsRemainingToday,
  TARGET_GROUPS,
  ORGANIZER_TEMPLATES,
  type DonationRow,
} from '../../../../../lib/organizer-marketing';

type Params = { params: Promise<{ id: string }> };

/** Owner-only: supporters, target-group counts, attribution, and send quota. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, slug, user_id')
    .eq('id', id)
    .single();
  if (!campaign || !(await canManageCampaign(user, campaign.user_id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: donations } = await supabaseAdmin
    .from('donations')
    .select('donor_id, amount_cents, created_at, anonymous, offline_donor_email, offline_donor_name, profiles:donor_id(email, full_name)')
    .eq('campaign_id', id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(2000);

  const rows: DonationRow[] = (donations ?? []).map((d) => {
    const profile = d.profiles as unknown as { email: string | null; full_name: string | null } | null;
    return {
      donor_id: d.donor_id,
      amount_cents: d.amount_cents,
      created_at: d.created_at,
      anonymous: d.anonymous,
      email: profile?.email ?? d.offline_donor_email ?? null,
      name: profile?.full_name ?? d.offline_donor_name ?? null,
    };
  });

  const supporters = aggregateSupporters(rows);

  // Channel attribution from share_events (tolerate table absence)
  let attribution: { channel: string; clicks: number; conversions: number }[] = [];
  try {
    const { data: shares } = await supabaseAdmin
      .from('share_events')
      .select('channel, converted')
      .eq('campaign_id', id)
      .limit(2000);
    const byChannel = new Map<string, { clicks: number; conversions: number }>();
    for (const s of shares ?? []) {
      const c = byChannel.get(s.channel) ?? { clicks: 0, conversions: 0 };
      c.clicks++;
      if (s.converted) c.conversions++;
      byChannel.set(s.channel, c);
    }
    attribution = [...byChannel.entries()]
      .map(([channel, v]) => ({ channel, ...v }))
      .sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks);
  } catch { /* table may not exist in this environment */ }

  // Send quota
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const { data: todaySends } = await supabaseAdmin
    .from('organizer_sends')
    .select('created_at')
    .eq('campaign_id', id)
    .gte('created_at', dayStart.toISOString());

  // Send history
  const { data: history } = await supabaseAdmin
    .from('organizer_sends')
    .select('id, template_key, target_group, subject, recipient_count, sent_count, suppressed_count, status, created_at')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({
    campaign: { id: campaign.id, title: campaign.title, slug: campaign.slug },
    stats: {
      supporters: supporters.length,
      emailable: supporters.filter(s => s.email).length,
      repeat: supporters.filter(s => s.isRepeat).length,
      lapsed: supporters.filter(s => s.isLapsed && s.email).length,
      totalCents: supporters.reduce((sum, s) => sum + s.totalCents, 0),
    },
    targetCounts: Object.fromEntries(
      TARGET_GROUPS.map(g => [g.key, filterTargets(supporters, g.key).length]),
    ),
    // Privacy: organizers see names + masked emails, never raw addresses
    supporters: supporters.slice(0, 200).map(s => ({
      key: s.key,
      name: s.name,
      emailMasked: s.email ? maskEmail(s.email) : null,
      reachable: Boolean(s.email),
      giftCount: s.giftCount,
      totalCents: s.totalCents,
      lastGiftAt: s.lastGiftAt,
      isRepeat: s.isRepeat,
      isLapsed: s.isLapsed,
    })),
    attribution,
    templates: ORGANIZER_TEMPLATES,
    targetGroups: TARGET_GROUPS,
    sendsRemainingToday: sendsRemainingToday((todaySends ?? []).map(s => s.created_at)),
    history: history ?? [],
  });
}
