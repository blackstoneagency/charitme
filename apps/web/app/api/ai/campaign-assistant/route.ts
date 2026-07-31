import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { openai, OPENAI_MODEL } from '../../../../lib/openai';
import { checkRateLimitDurable } from '../../../../lib/rate-limit-durable';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { formatMoney, normalizeCurrency } from '@shared/currencies';
import { campaignDaysLeft, campaignLifecycle } from '../../../../lib/campaign-lifecycle';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  campaignId: z.string().uuid(),
  question: z.string().trim().min(1).max(300),
});

type Campaign = {
  id: string;
  title: string;
  tagline: string | null;
  description: string | null;
  category: string | null;
  location: string | null;
  goal_amount: number;
  raised_amount: number;
  backer_count: number;
  deadline: string | null;
  trust_status: string | null;
  nonprofit_verified: boolean | null;
};

type Faq = { question: string; answer: string };

const GENERIC_ANSWER = "I don't have specific information on that yet — check the FAQ section above, or ask the organizer directly in the campaign comments.";

function fallbackAnswer(question: string, facts: {
  title: string;
  raisedFormatted: string;
  goalFormatted: string;
  percentFunded: number;
  backerCount: number;
  daysLeft: number | null;
  isVerified: boolean;
  isTaxDeductible: boolean;
  faqs: Faq[];
}): string {
  const q = question.toLowerCase();

  // Prefer an organizer-provided FAQ answer if the question overlaps with one
  for (const faq of facts.faqs) {
    const faqWords = faq.question.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const overlap = faqWords.filter((w) => q.includes(w));
    if (faqWords.length > 0 && overlap.length / faqWords.length >= 0.5) {
      return faq.answer;
    }
  }

  if (/verif|trust|legit|real|scam/.test(q)) {
    return facts.isVerified
      ? `Yes — "${facts.title}" has CharitMe's Verified badge, meaning the organizer's identity and payout account have been checked.`
      : `"${facts.title}" hasn't completed CharitMe's verification process yet, but every donation is still protected by CharitMe's fraud guarantee.`;
  }
  if (/tax|deduct/.test(q)) {
    return facts.isTaxDeductible
      ? `Yes, donations to "${facts.title}" are tax-deductible — you'll receive an emailed receipt for your records.`
      : `Donations to "${facts.title}" aren't currently marked as tax-deductible. You'll still get an emailed receipt, but check with a tax professional about deductibility.`;
  }
  if (/fee|charge|cut|commission/.test(q)) {
    return `CharitMe doesn't take a mandatory platform fee — 100% of your donation goes toward "${facts.title}". You can optionally add a tip to support CharitMe.`;
  }
  if (/refund|guarantee|protect/.test(q)) {
    return `CharitMe guarantees a full refund for up to a year if fraud is confirmed on a donation to "${facts.title}".`;
  }
  if (/goal|raise|target|much/.test(q)) {
    return `"${facts.title}" has raised ${facts.raisedFormatted} of its ${facts.goalFormatted} goal (${Math.round(facts.percentFunded)}% funded) from ${facts.backerCount.toLocaleString('en-US')} supporters.`;
  }
  if (/deadline|end|when|time left|days left|expire/.test(q)) {
    return facts.daysLeft !== null
      ? `"${facts.title}" has ${facts.daysLeft} day${facts.daysLeft === 1 ? '' : 's'} left to reach its goal.`
      : `"${facts.title}" doesn't have a fixed deadline — it stays open until the organizer closes it.`;
  }
  if (/spend|use|fund|money go|where.*go|payout/.test(q)) {
    return `Donations to "${facts.title}" go directly to the recipient's bank account via Stripe — CharitMe never holds funds, and the organizer can post updates so donors can see progress.`;
  }

  return GENERIC_ANSWER;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!(await checkRateLimitDurable(`campaign-assistant:${ip}`, 15, 5 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const { campaignId, question } = parsed.data;

  const [{ data: campaign, error: campaignError }, { data: launchSettings }, { data: faqRows }] = await Promise.all([
    supabaseAdmin
      .from('campaigns')
      .select('id, title, tagline, description, category, location, goal_amount, raised_amount, backer_count, deadline, status, trust_status, nonprofit_verified')
      .eq('id', campaignId)
      .maybeSingle<Campaign>(),
    supabaseAdmin
      .from('campaign_launch_settings')
      .select('currency')
      .eq('campaign_id', campaignId)
      .maybeSingle(),
    supabaseAdmin
      .from('campaign_faqs')
      .select('question, answer')
      .eq('campaign_id', campaignId)
      .eq('is_public', true)
      .order('sort_order', { ascending: true })
      .limit(10),
  ]);

  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const currency = normalizeCurrency(launchSettings?.currency);
  const percentFunded = campaign.goal_amount > 0
    ? Math.min(100, (campaign.raised_amount / campaign.goal_amount) * 100)
    : 0;
  // null once the campaign is over, so the assistant cannot tell a donor there
  // is time left to give on a campaign that has ended. `status` is selected
  // above purely for this — the previous version read the deadline alone and
  // would happily answer "136 days left" for a completed campaign.
  const lifecycleInput = {
    status: (campaign as { status?: string | null }).status,
    deadline: campaign.deadline,
  };
  const daysLeft = campaignLifecycle(lifecycleInput) === 'ended'
    ? null
    : campaignDaysLeft(campaign.deadline);

  const facts = {
    title: campaign.title,
    raisedFormatted: formatMoney(campaign.raised_amount ?? 0, currency),
    goalFormatted: formatMoney(campaign.goal_amount, currency),
    percentFunded,
    backerCount: campaign.backer_count ?? 0,
    daysLeft,
    isVerified: campaign.trust_status === 'Verified',
    isTaxDeductible: !!campaign.nonprofit_verified,
    faqs: (faqRows ?? []) as Faq[],
  };

  let answer = fallbackAnswer(question, facts);
  let model = 'fallback';

  if (openai) {
    try {
      const response = await openai.responses.create({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content: 'You are CharitMe\'s donor assistant for one specific fundraising campaign. Answer the donor\'s question in 1-3 short sentences using ONLY the facts provided — never invent amounts, dates, policies, or guarantees that aren\'t listed. If the question cannot be answered from the facts, say so plainly and suggest checking the FAQ section or asking the organizer in the campaign comments. Never give personalized financial, legal, or tax advice — for those, suggest consulting a professional. Use the pre-formatted currency strings verbatim. Return strict JSON: {"answer": string}.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              campaignTitle: campaign.title,
              tagline: campaign.tagline,
              category: campaign.category,
              location: campaign.location,
              description: (campaign.description ?? '').slice(0, 800),
              raisedFormatted: facts.raisedFormatted,
              goalFormatted: facts.goalFormatted,
              percentFunded: Math.round(percentFunded),
              backerCount: facts.backerCount,
              daysLeft,
              isVerified: facts.isVerified,
              isTaxDeductible: facts.isTaxDeductible,
              platformFeePolicy: 'CharitMe charges 0% mandatory platform fee; donors may optionally add a tip.',
              refundGuarantee: "CharitMe guarantees a full refund for up to a year if fraud is confirmed.",
              payoutPolicy: "Funds transfer directly to the recipient's bank account via Stripe; CharitMe never holds donor funds.",
              organizerFaqs: facts.faqs,
              question,
            }),
          },
        ],
      });
      const json = JSON.parse(response.output_text) as { answer?: string };
      if (typeof json.answer === 'string' && json.answer.trim()) {
        answer = json.answer.trim();
        model = OPENAI_MODEL;
      }
    } catch {
      // keep fallback answer
    }
  }

  await supabaseAdmin.from('ai_generations').insert({
    user_id: user?.id ?? null,
    campaign_id: campaign.id,
    generation_type: 'campaign_assistant',
    prompt: { campaignId, question },
    output: { answer },
    model,
  });

  return NextResponse.json({ answer, model });
}
