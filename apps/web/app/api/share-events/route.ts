import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimitDurable } from '../../../lib/rate-limit-durable';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { canViewCampaignAnalytics } from '../../../lib/campaign-access';

const Schema = z.object({
  campaignId: z.string().uuid(),
  channel: z.enum(['link', 'email', 'sms', 'facebook', 'twitter', 'instagram', 'linkedin', 'whatsapp', 'qr', 'other']).default('link'),
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

  const { data, error } = await supabaseAdmin
    .from('share_events')
    .insert({
      campaign_id: parsed.data.campaignId,
      sharer_id: sharerId,
      team_member_id: teamMemberId,
      channel: parsed.data.channel,
      utm_source: parsed.data.utm_source ?? null,
      utm_medium: parsed.data.utm_medium ?? null,
      utm_campaign: parsed.data.utm_campaign ?? null,
      utm_content: parsed.data.utm_content ?? null,
      referrer: parsed.data.referrer ?? null,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: 'Unable to record share event', code: 'INTERNAL_ERROR' }, { status: 500 });

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
