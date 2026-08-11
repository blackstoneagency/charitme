import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { canManageCampaign } from '../../../../../lib/auth';
import {
  aggregateSupporters,
  supporterListRows,
  filterTargets,
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
    .select('donor_id, amount_cents, created_at, anonymous, offline_donor_email, offline_donor_name, profiles:donor_id(email, full_name, show_public_profile)')
    .eq('campaign_id', id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(2000);

  const rows: DonationRow[] = (donations ?? []).map((d) => {
    const profile = d.profiles as unknown as { email: string | null; full_name: string | null; show_public_profile: boolean | null } | null;
    // A donor who gave anonymously, or who set Profile Visibility to Private,
    // must not be named to the organizer. This route already masks emails
    // ("organizers see names + masked emails, never raw addresses") but took
    // full_name unconditionally, so anonymous gifts were attributed by name in
    // the supporter list. The organizer can still reach them through the engage
    // flow, which addresses the donor directly — they just don't learn who it is.
    //
    // Both settings feed the same flag, so the redaction is all-or-nothing.
    // Carrying `anonymous: d.anonymous` here while blanking only the name let
    // `supporterListRows` file a Private donor's gifts into a named bucket that
    // happened to have no name — half-redacted, and inconsistent between rows.
    const hideIdentity = d.anonymous || !(profile?.show_public_profile ?? true);
    return {
      donor_id: d.donor_id,
      amount_cents: d.amount_cents,
      created_at: d.created_at,
      anonymous: hideIdentity,
      email: profile?.email ?? d.offline_donor_email ?? null,
      name: hideIdentity ? 'Anonymous donor' : (profile?.full_name ?? d.offline_donor_name ?? null),
    };
  });

  // Two views of the same donations, deliberately different:
  //   · `supporters`      — one row per PERSON. Drives the send counts, so it
  //                         has to match what /engage will actually target.
  //   · `supporterListRows` — one row per person PER ANONYMITY. What ships.
  const supporters = aggregateSupporters(rows);
  const listRows = supporterListRows(rows);

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
    // Privacy: organizers see names + masked emails, never raw addresses — and
    // never a name beside money that was given anonymously. Already redacted by
    // `supporterListRows`; this hands the rows over untouched so no field can be
    // re-derived here.
    supporters: listRows.slice(0, 200),
    attribution,
    templates: ORGANIZER_TEMPLATES,
    targetGroups: TARGET_GROUPS,
    sendsRemainingToday: sendsRemainingToday((todaySends ?? []).map(s => s.created_at)),
    history: history ?? [],
  });
}
