import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimitDurable } from '../../../lib/rate-limit-durable';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { canViewCampaignAnalytics } from '../../../lib/campaign-access';

/**
 * Every channel the UI can emit.
 *
 * ⚠️ `messenger` was missing, and the Messenger tile has always sent it. The
 * client posts with `void fetch(...)`, so the 400 was discarded and the share
 * simply never appeared in attribution — invisible from both ends. It only
 * renders when NEXT_PUBLIC_FACEBOOK_APP_ID is set, which is why it survived.
 *
 * `native` is the OS share sheet. `__tests__/share-channels.test.ts` derives the
 * UI's list from the component and fails if this enum does not cover it.
 */
const CHANNELS = ['link', 'email', 'sms', 'facebook', 'messenger', 'twitter', 'instagram', 'linkedin', 'whatsapp', 'qr', 'native', 'other'] as const;

/**
 * What the DATABASE will accept today, which is not the same list.
 *
 * `share_events_channel_check` predates `messenger` and `native`;
 * `20260905010000_share_events_native_channels.sql` extends it, but this repo
 * carries 50 unapplied migrations and cannot apply them from here. Inserting a
 * value the live constraint rejects raises 23514 and loses the event — which is
 * the bug this is fixing, so it must not be reintroduced from the other side.
 * Anything outside this set is retried as its fallback below.
 */
const DB_SAFE_CHANNELS = new Set(['link', 'email', 'sms', 'facebook', 'twitter', 'instagram', 'linkedin', 'whatsapp', 'qr', 'other']);

/** Where a not-yet-permitted channel lands until the migration is applied. */
const CHANNEL_FALLBACK: Record<string, string> = {
  // Messenger IS Facebook's, so folding it there is honest rather than lossy.
  messenger: 'facebook',
  native: 'other',
};

const Schema = z.object({
  campaignId: z.string().uuid(),
  channel: z.enum(CHANNELS).default('link'),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_content: z.string().optional(),
  referrer: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  // Durable, cross-instance limit: this endpoint is unauthenticated and
  // anonymous share events are written to `share_events`, so a per-instance counter does not bound abuse.
  if (!(await checkRateLimitDurable(`share-event:${ip}`, 60, 60_000))) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Optional auth — record sharer_id if logged in
  let sharerId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    sharerId = user?.id ?? null;
  } catch { /* guest */ }

  // Find team_member_id if sharer is a co-organizer
  let teamMemberId: string | null = null;
  if (sharerId) {
    const { data: tm } = await supabaseAdmin
      .from('team_members')
      .select('id')
      .eq('campaign_id', parsed.data.campaignId)
      .eq('user_id', sharerId)
      .maybeSingle();
    teamMemberId = tm?.id ?? null;
  }

  const row = {
    campaign_id: parsed.data.campaignId,
    sharer_id: sharerId,
    team_member_id: teamMemberId,
    utm_source: parsed.data.utm_source ?? null,
    utm_medium: parsed.data.utm_medium ?? null,
    utm_campaign: parsed.data.utm_campaign ?? null,
    utm_content: parsed.data.utm_content ?? null,
    referrer: parsed.data.referrer ?? null,
  };

  // Degrade rather than lose the event. On a database where the migration IS
  // applied the first insert succeeds and the true channel is recorded; where it
  // is not, 23514 (check_violation) means only that this deployment's constraint
  // is older, and the share is still worth counting under its fallback.
  let { data, error } = await supabaseAdmin
    .from('share_events').insert({ ...row, channel: parsed.data.channel }).select('id').single();

  const fallback = CHANNEL_FALLBACK[parsed.data.channel];
  if (error?.code === '23514' && fallback && !DB_SAFE_CHANNELS.has(parsed.data.channel)) {
    ({ data, error } = await supabaseAdmin
      .from('share_events').insert({ ...row, channel: fallback }).select('id').single());
  }

  if (error || !data) return NextResponse.json({ error: 'Unable to record share event', code: 'INTERNAL_ERROR' }, { status: 500 });

  return NextResponse.json({ ok: true, shareEventId: data.id });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get('campaignId');
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });

  // Share conversion analytics include campaign performance data. Viewers may
  // help share a campaign, but only working team roles can inspect the results.
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('user_id')
    .eq('id', campaignId)
    .single();

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  if (!(await canViewCampaignAnalytics(user, campaignId, campaign.user_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: events } = await supabaseAdmin
    .from('share_events')
    .select('id, channel, utm_source, utm_medium, utm_campaign, converted, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(500);

  // Aggregate by channel
  const byChannel: Record<string, { count: number; converted: number }> = {};
  for (const ev of events ?? []) {
    const ch = ev.channel ?? 'other';
    if (!byChannel[ch]) byChannel[ch] = { count: 0, converted: 0 };
    byChannel[ch].count += 1;
    if (ev.converted) byChannel[ch].converted += 1;
  }

  return NextResponse.json({ events: events ?? [], byChannel, total: (events ?? []).length });
}
