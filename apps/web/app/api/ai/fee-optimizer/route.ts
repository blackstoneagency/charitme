import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { openai, OPENAI_MODEL } from '../../../../lib/openai';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/roles';

export const dynamic = 'force-dynamic';

type Speed = 'standard' | 'same_day' | 'instant';

type Campaign = {
  id: string;
  title: string;
  user_id: string;
  raised_amount: number;
  payout_frozen: boolean;
  deadline: string | null;
  status: string;
};

type PayoutHistoryRow = { fee_cents: number; payout_speed: Speed; status: string };

const SPEED_RATES: Record<Speed, number> = { standard: 0, same_day: 0.005, instant: 0.015 };
const SPEED_LABELS: Record<Speed, string> = { standard: 'Standard', same_day: 'Same day', instant: 'Instant' };
const SPEED_ETA: Record<Speed, string> = {
  standard: '3–5 business days',
  same_day: 'Within 24 hours',
  instant: 'Within minutes',
};

type SpeedOption = { speed: Speed; label: string; etaLabel: string; feeCents: number; netCents: number };

type Urgency = 'urgent' | 'moderate' | 'flexible';

function fallbackMessage(opts: {
  title: string;
  availableCents: number;
  recommended: Speed;
  urgency: Urgency;
  daysLeft: number | null;
  savingsCents: number;
}): string {
  const { title, availableCents, recommended, urgency, daysLeft, savingsCents } = opts;
  const fmt = (c: number) => `$${(c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  if (availableCents <= 0) {
    return `"${title}" has no available balance to pay out right now — once new donations come in, we'll help you choose the most cost-effective payout speed.`;
  }
  if (urgency === 'urgent' && daysLeft !== null) {
    return `With only ${daysLeft} day${daysLeft === 1 ? '' : 's'} left on "${title}", an Instant payout gets your ${fmt(availableCents)} balance into your account within minutes — worth the small fee given the timeline.`;
  }
  if (recommended === 'standard') {
    return `No rush on "${title}" — choosing Standard payout gets you the full ${fmt(availableCents)} with zero fees in 3–5 business days. Switching to Instant would cost you ${fmt(savingsCents)} for funds in minutes instead.`;
  }
  return `For "${title}", Same day payout balances speed and cost — you'll receive ${fmt(availableCents)} within 24 hours for a small fee, saving ${fmt(savingsCents)} compared to Instant.`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaignId = request.nextUrl.searchParams.get('campaignId');
  if (!campaignId) return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 });

  if (!checkRateLimit(`fee-optimizer:${user.id}`, 12, 60_000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, user_id, raised_amount, payout_frozen, deadline, status')
    .eq('id', campaignId)
    .maybeSingle<Campaign>();

  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const admin = await isAdmin(user.id, user.email);
  if (campaign.user_id !== user.id && !admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: payoutHistoryData } = await supabaseAdmin
    .from('payouts')
    .select('amount_cents, fee_cents, payout_speed, status')
    .eq('campaign_id', campaignId)
    .limit(100);

  const payoutHistory = (payoutHistoryData ?? []) as (PayoutHistoryRow & { amount_cents: number })[];

  const alreadyPaidOrPending = payoutHistory
    .filter((p) => ['requested', 'approved', 'paid'].includes(p.status))
    .reduce((s, p) => s + (p.amount_cents ?? 0), 0);
  const availableCents = Math.max(0, (campaign.raised_amount ?? 0) - alreadyPaidOrPending);

  const totalFeesPaidCents = payoutHistory
    .filter((p) => p.status === 'paid')
    .reduce((s, p) => s + (p.fee_cents ?? 0), 0);

  let daysLeft: number | null = null;
  if (campaign.deadline) {
    const ms = new Date(campaign.deadline).getTime() - Date.now();
    daysLeft = Math.ceil(ms / (24 * 60 * 60 * 1000));
  }

  const speedOptions: SpeedOption[] = (Object.keys(SPEED_RATES) as Speed[]).map((speed) => {
    const feeCents = Math.round(availableCents * SPEED_RATES[speed]);
    return {
      speed,
      label: SPEED_LABELS[speed],
      etaLabel: SPEED_ETA[speed],
      feeCents,
      netCents: availableCents - feeCents,
    };
  });

  const instantFee = speedOptions.find((s) => s.speed === 'instant')?.feeCents ?? 0;
  const sameDayFee = speedOptions.find((s) => s.speed === 'same_day')?.feeCents ?? 0;

  const urgency: Urgency =
    daysLeft !== null && daysLeft <= 3 ? 'urgent'
    : daysLeft !== null && daysLeft <= 14 ? 'moderate'
    : 'flexible';

  const recommended: Speed =
    availableCents <= 0 ? 'standard'
    : urgency === 'urgent' ? 'instant'
    : urgency === 'moderate' ? 'same_day'
    : 'standard';

  const savingsCents = recommended === 'standard' ? instantFee : recommended === 'same_day' ? instantFee - sameDayFee : 0;

  let message = fallbackMessage({ title: campaign.title, availableCents, recommended, urgency, daysLeft, savingsCents });
  let model = 'fallback';

  if (openai && availableCents > 0) {
    try {
      const response = await openai.responses.create({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content: 'You are CharitMe Fee Optimizer AI. Recommend the best payout speed (standard, same_day, or instant) for a fundraiser given their available balance, days left on their campaign, and the fee for each speed. Write one short (1-2 sentence), friendly, specific explanation using only facts from the input — never invent amounts or timelines. Return strict JSON: {"message": string}.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              campaignTitle: campaign.title,
              availableDollars: Math.round(availableCents / 100),
              daysLeft,
              recommended,
              speedOptions: speedOptions.map((s) => ({ speed: s.speed, feeDollars: Math.round(s.feeCents / 100), etaLabel: s.etaLabel })),
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
    generation_type: 'fee_optimizer',
    prompt: { campaignId, availableCents, daysLeft, urgency },
    output: { recommended, speedOptions, message },
    model,
  });

  return NextResponse.json({
    availableCents,
    daysLeft,
    recommended,
    urgency,
    speedOptions,
    totalFeesPaidCents,
    message,
    model,
  });
}
