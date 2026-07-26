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
};

function fallbackMessage(opts: {
  title: string;
  amountFormatted: string;
  percentFunded: number;
  remainingCents: number;
  remainingFormatted: string;
  backerCount: number;
}): string {
  const { title, amountFormatted, percentFunded, remainingCents, remainingFormatted, backerCount } = opts;
  if (remainingCents <= 0) {
    return `Your gift of ${amountFormatted} helped "${title}" reach its goal! Thank you for being one of ${backerCount.toLocaleString('en-US')} supporters who made this happen.`;
  }
  if (percentFunded >= 90) {
    return `Your gift of ${amountFormatted} brings "${title}" to ${Math.round(percentFunded)}% funded — just ${remainingFormatted} away from the goal!`;
  }
  return `Your gift of ${amountFormatted} helps "${title}" move closer to its goal — now ${Math.round(percentFunded)}% funded with ${remainingFormatted} left to go. You're one of ${backerCount.toLocaleString('en-US')} supporters making this happen.`;
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  // Durable, cross-instance limit: this endpoint is unauthenticated AND calls
  // OpenAI, so the in-memory limiter's per-instance counter (effectively
  // limit x instanceCount on Vercel) is not enough to bound spend.
  if (!(await checkRateLimitDurable(`donation-impact:${ip}`, 30, 60_000))) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const campaignId = request.nextUrl.searchParams.get('campaignId');
  const amountParam = request.nextUrl.searchParams.get('amount');
  const amountCents = amountParam ? Number.parseInt(amountParam, 10) : NaN;

  if (!campaignId) return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 });
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: 'Missing or invalid amount' }, { status: 400 });
  }

  const [{ data: campaign, error: campaignError }, { data: launchSettings }] = await Promise.all([
    supabaseAdmin
      .from('campaigns')
      .select('id, title, goal_amount, raised_amount, backer_count')
      .eq('id', campaignId)
      .maybeSingle<Campaign>(),
    supabaseAdmin
      .from('campaign_launch_settings')
      .select('currency')
      .eq('campaign_id', campaignId)
      .maybeSingle(),
  ]);

  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const currency = normalizeCurrency(launchSettings?.currency);
  const percentFunded = campaign.goal_amount > 0
    ? Math.min(100, (campaign.raised_amount / campaign.goal_amount) * 100)
    : 0;
  const remainingCents = Math.max(0, campaign.goal_amount - campaign.raised_amount);

  const amountFormatted = formatMoney(amountCents, currency);
  const remainingFormatted = formatMoney(remainingCents, currency);

  let message = fallbackMessage({
    title: campaign.title,
    amountFormatted,
    percentFunded,
    remainingCents,
    remainingFormatted,
    backerCount: campaign.backer_count,
  });
  let model = 'fallback';

  if (openai) {
    try {
      const response = await openai.responses.create({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content: 'You are CharitMe Impact AI. Write a single short (1-2 sentence), warm, celebratory, donor-facing thank-you message that frames the impact of the donor\'s own gift on this specific campaign. Use only the facts provided — never invent amounts, percentages, or supporter counts. Use the pre-formatted currency strings verbatim. Return strict JSON: {"message": string}.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              campaignTitle: campaign.title,
              donationAmountFormatted: amountFormatted,
              percentFunded: Math.round(percentFunded),
              remainingFormatted,
              goalReached: remainingCents <= 0,
              backerCount: campaign.backer_count,
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
    generation_type: 'donation_impact',
    prompt: {
      campaignId,
      amountCents,
      percentFunded: Math.round(percentFunded),
      remainingCents,
      backerCount: campaign.backer_count,
    },
    output: { message },
    model,
  });

  return NextResponse.json({ message, percentFunded, remainingCents, currency, model });
}
