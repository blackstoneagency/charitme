import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { openai, OPENAI_MODEL } from '../../../../lib/openai';
import { checkRateLimitDurable } from '../../../../lib/rate-limit-durable';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { canViewCampaignAnalytics } from '../../../../lib/campaign-access';

export const dynamic = 'force-dynamic';

type ShareEvent = { channel: string; converted: boolean };

const CHANNEL_LABELS: Record<string, string> = {
  link: 'Direct link',
  email: 'Email',
  sms: 'SMS',
  facebook: 'Facebook',
  twitter: 'X / Twitter',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  qr: 'QR code',
  other: 'Other',
};

const ALL_CHANNELS = Object.keys(CHANNEL_LABELS);
const SUGGESTABLE_CHANNELS = ALL_CHANNELS.filter((c) => c !== 'other' && c !== 'link');

type ChannelStat = { channel: string; label: string; shares: number; conversions: number; conversionRate: number };

function fallbackMessage(opts: {
  totalShares: number;
  best: ChannelStat | null;
  untried: string[];
}): string {
  const { totalShares, best, untried } = opts;
  if (totalShares === 0) {
    return "You haven't shared this campaign yet. Start with a personal text or email to your closest supporters — those tend to convert best.";
  }
  const parts: string[] = [];
  if (best && best.conversions > 0) {
    parts.push(`${best.label} is your top channel with ${best.conversions} donation${best.conversions === 1 ? '' : 's'} from ${best.shares} share${best.shares === 1 ? '' : 's'} (${Math.round(best.conversionRate * 100)}% conversion). Share there again to keep the momentum.`);
  } else {
    parts.push(`You've shared ${totalShares} time${totalShares === 1 ? '' : 's'} but haven't seen a donation from a share yet — try pairing your next share with a personal note about why this matters.`);
  }
  if (untried.length > 0) {
    parts.push(`You haven't tried ${CHANNEL_LABELS[untried[0]] ?? untried[0]} yet — that could open up a new audience.`);
  }
  return parts.join(' ');
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaignId = request.nextUrl.searchParams.get('campaignId');
  if (!campaignId) return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 });

  if (!(await checkRateLimitDurable(`viral-loop:${user.id}`, 12, 60_000))) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, user_id')
    .eq('id', campaignId)
    .maybeSingle();

  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  if (!(await canViewCampaignAnalytics(user, campaignId, campaign.user_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: events } = await supabaseAdmin
    .from('share_events')
    .select('channel, converted')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(1000);

  const rows = (events ?? []) as ShareEvent[];

  const stats = new Map<string, { shares: number; conversions: number }>();
  for (const ev of rows) {
    const ch = ev.channel ?? 'other';
    const s = stats.get(ch) ?? { shares: 0, conversions: 0 };
    s.shares += 1;
    if (ev.converted) s.conversions += 1;
    stats.set(ch, s);
  }

  const byChannel: ChannelStat[] = ALL_CHANNELS
    .map((channel) => {
      const s = stats.get(channel) ?? { shares: 0, conversions: 0 };
      return {
        channel,
        label: CHANNEL_LABELS[channel],
        shares: s.shares,
        conversions: s.conversions,
        conversionRate: s.shares > 0 ? s.conversions / s.shares : 0,
      };
    })
    .filter((c) => c.shares > 0)
    .sort((a, b) => b.conversions - a.conversions || b.conversionRate - a.conversionRate);

  const totalShares = rows.length;
  const totalConversions = rows.filter((r) => r.converted).length;
  const best = byChannel[0] ?? null;
  const untried = SUGGESTABLE_CHANNELS.filter((c) => !stats.has(c));

  let message = fallbackMessage({ totalShares, best, untried });
  let model = 'fallback';

  if (openai) {
    try {
      const response = await openai.responses.create({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content: "You are CharitMe Viral Loop AI. Analyze a fundraiser's sharing activity and give one short (2-3 sentence), encouraging, specific recommendation for which channel to focus on next and why. Use only facts from the input — never invent numbers. Return strict JSON: {\"message\": string}.",
          },
          {
            role: 'user',
            content: JSON.stringify({
              campaignTitle: campaign.title,
              totalShares,
              totalConversions,
              byChannel: byChannel.map((c) => ({ channel: c.label, shares: c.shares, conversions: c.conversions })),
              untriedChannels: untried.map((c) => CHANNEL_LABELS[c]),
            }),
          },
        ],
      });
      const json = JSON.parse(response.output_text) as { message?: string };
      if (typeof json.message === 'string' && json.message.trim()) {
        message = json.message.trim();
        model = OPENAI_MODEL;
      }
    } catch {
      // keep fallback message
    }
  }

  await supabaseAdmin.from('ai_generations').insert({
    user_id: user.id,
    campaign_id: campaign.id,
    generation_type: 'viral_loop',
    prompt: { campaignId, totalShares, totalConversions, byChannel: byChannel.map((c) => ({ channel: c.channel, shares: c.shares, conversions: c.conversions })) },
    output: { message, recommendedChannel: best?.channel ?? null, untriedChannels: untried },
    model,
  });

  return NextResponse.json({
    totalShares,
    totalConversions,
    conversionRate: totalShares > 0 ? totalConversions / totalShares : 0,
    byChannel,
    untriedChannels: untried.map((c) => ({ channel: c, label: CHANNEL_LABELS[c] })),
    message,
    model,
  });
}
