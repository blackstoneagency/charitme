import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { openai, OPENAI_MODEL } from '../../../../lib/openai';
import { checkRateLimitDurable } from '../../../../lib/rate-limit-durable';
import { supabaseAdmin } from '../../../../lib/supabase';
import { formatMoney, normalizeCurrency } from '@shared/currencies';

export const dynamic = 'force-dynamic';

type Campaign = {
  id: string;
  title: string;
  goal_amount: number;
  raised_amount: number;
  backer_count: number;
  deadline: string | null;
  status: string;
};

const DEFAULT_AVG_CENTS = 5_000; // $50 — used when a campaign has no donations yet

function roundToNice(dollars: number): number {
  if (dollars < 100) return Math.max(5, Math.round(dollars / 5) * 5);
  if (dollars < 1_000) return Math.round(dollars / 25) * 25;
  return Math.round(dollars / 100) * 100;
}

function buildSuggestedAmounts(avgCents: number): number[] {
  const avgDollars = Math.max(10, avgCents / 100);
  const multipliers = [0.5, 1, 1.5, 2, 3, 5];
  const amounts = multipliers.map((m) => roundToNice(avgDollars * m));

  const unique: number[] = [];
  for (const a of amounts) {
    if (!unique.includes(a)) unique.push(a);
  }
  let filler = unique[unique.length - 1] ?? roundToNice(avgDollars);
  while (unique.length < 6) {
    filler += roundToNice(avgDollars);
    if (!unique.includes(filler)) unique.push(filler);
  }
  return unique.slice(0, 6).sort((a, b) => a - b);
}

function fallbackMessage(opts: {
  title: string;
  percentFunded: number;
  donorCount: number;
  avgDonationCents: number;
  daysLeft: number | null;
  currency: string;
}): string {
  const { title, percentFunded, donorCount, avgDonationCents, daysLeft, currency } = opts;
  const avgStr = formatMoney(avgDonationCents, currency);

  if (daysLeft !== null && daysLeft <= 3 && daysLeft >= 0) {
    return `Time is running out for "${title}" — only ${daysLeft} day${daysLeft === 1 ? '' : 's'} left. The average gift is ${avgStr}, and every donation helps close the gap.`;
  }
  if (percentFunded >= 90) {
    return `"${title}" is ${Math.round(percentFunded)}% funded — your gift could help cross the finish line! The average donation is ${avgStr}.`;
  }
  if (donorCount > 0) {
    return `Join ${donorCount.toLocaleString('en-US')} other supporter${donorCount === 1 ? '' : 's'} backing "${title}". The average gift is ${avgStr} — every contribution adds up.`;
  }
  return `Be among the first to support "${title}". A gift of ${avgStr} can make a meaningful impact.`;
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  // Durable, cross-instance limit: this endpoint is unauthenticated AND calls
  // OpenAI, so the in-memory limiter's per-instance counter (effectively
  // limit x instanceCount on Vercel) is not enough to bound spend.
  if (!(await checkRateLimitDurable(`donor-conversion:${ip}`, 30, 60_000))) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const campaignId = request.nextUrl.searchParams.get('campaignId');
  if (!campaignId) return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 });

  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, goal_amount, raised_amount, backer_count, deadline, status')
    .eq('id', campaignId)
    .maybeSingle<Campaign>();

  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const [{ data: recentDonations }, { data: launchSettings }] = await Promise.all([
    supabaseAdmin
      .from('donations')
      .select('amount_cents')
      .eq('campaign_id', campaignId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('campaign_launch_settings')
      .select('currency')
      .eq('campaign_id', campaignId)
      .maybeSingle(),
  ]);

  const currency = normalizeCurrency(launchSettings?.currency);

  const amounts = (recentDonations ?? []).map((d) => d.amount_cents).filter((n): n is number => typeof n === 'number' && n > 0);
  const avgDonationCents = amounts.length > 0
    ? Math.round(amounts.reduce((s, n) => s + n, 0) / amounts.length)
    : DEFAULT_AVG_CENTS;

  const percentFunded = campaign.goal_amount > 0
    ? (campaign.raised_amount / campaign.goal_amount) * 100
    : 0;

  let daysLeft: number | null = null;
  if (campaign.deadline) {
    const ms = new Date(campaign.deadline).getTime() - Date.now();
    daysLeft = Math.ceil(ms / (24 * 60 * 60 * 1000));
  }

  const suggestedAmounts = buildSuggestedAmounts(avgDonationCents);

  let message = fallbackMessage({
    title: campaign.title,
    percentFunded,
    donorCount: campaign.backer_count,
    avgDonationCents,
    daysLeft,
    currency,
  });
  let model = 'fallback';

  if (openai) {
    try {
      const response = await openai.responses.create({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content: 'You are CharitMe Donor Conversion AI. Write a single short (1-2 sentence), warm, persuasive nudge encouraging a visitor to donate to a campaign. Use only facts from the input — never invent amounts, donor counts, or deadlines that are not provided. When mentioning the average donation, use the pre-formatted "avgDonationFormatted" string verbatim (it is already in the campaign\'s currency) rather than inventing your own currency symbol. Return strict JSON: {"message": string}.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              campaignTitle: campaign.title,
              percentFunded: Math.round(percentFunded),
              donorCount: campaign.backer_count,
              avgDonationFormatted: formatMoney(avgDonationCents, currency),
              daysLeft,
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
    user_id: null,
    campaign_id: campaign.id,
    generation_type: 'donor_conversion',
    prompt: { campaignId, percentFunded: Math.round(percentFunded), donorCount: campaign.backer_count, avgDonationCents, daysLeft },
    output: { suggestedAmounts, message },
    model,
  });

  return NextResponse.json({
    suggestedAmounts,
    message,
    model,
    avgDonationCents,
    percentFunded,
  });
}
