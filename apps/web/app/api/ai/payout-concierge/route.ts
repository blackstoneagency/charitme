import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { openai, OPENAI_MODEL } from '../../../../lib/openai';
import { checkRateLimitDurable } from '../../../../lib/rate-limit-durable';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/roles';
import { resolvePayoutDestination } from '../../../../lib/payout-destination';

export const dynamic = 'force-dynamic';

type Blocker = { code: string; label: string; actionUrl: string };
type Readiness = 'ready' | 'action_needed' | 'blocked';

type Campaign = {
  id: string;
  title: string;
  user_id: string;
  beneficiary_profile_id: string | null;
  beneficiary_name: string | null;
  raised_amount: number;
  payout_frozen: boolean;
  status: string;
};

const SPEED_TIMELINES: Record<string, string> = {
  standard: 'Funds typically arrive in 3–5 business days at no extra cost.',
  same_day: 'Funds typically arrive within 24 hours for a 0.5% fee.',
  instant: 'Funds typically arrive within minutes for a 1.5% fee (debit card required).',
};

function fallbackMessage(readiness: Readiness, blockers: Blocker[], availableCents: number, title: string): string {
  const amountStr = `$${(availableCents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (readiness === 'blocked') {
    return `Payouts for "${title}" are currently on hold. ${blockers[0]?.label ?? 'Our team is reviewing your account.'} Reach out to support if you have questions — we'll work to resolve this quickly.`;
  }
  if (readiness === 'action_needed') {
    return `You're almost ready to receive funds from "${title}". ${blockers[0]?.label ?? 'Complete the remaining setup step'} to unlock payouts.`;
  }
  return `Great news — "${title}" is ready for payout with ${amountStr} available. Choose a payout speed below to get your funds moving.`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaignId = request.nextUrl.searchParams.get('campaignId');
  if (!campaignId) return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 });

  if (!(await checkRateLimitDurable(`payout-concierge:${user.id}`, 12, 60_000))) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, user_id, beneficiary_profile_id, beneficiary_name, raised_amount, payout_frozen, status')
    .eq('id', campaignId)
    .maybeSingle<Campaign>();

  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const admin = await isAdmin(user.id, user.email);
  if (campaign.user_id !== user.id && !admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Available balance: raised minus already-paid-or-pending payouts
  const { data: existingPayouts } = await supabaseAdmin
    .from('payouts')
    .select('amount_cents')
    .eq('campaign_id', campaignId)
    .in('status', ['requested', 'approved', 'paid']);
  const alreadyPaidOrPending = (existingPayouts ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);
  const availableCents = Math.max(0, (campaign.raised_amount ?? 0) - alreadyPaidOrPending);

  // Open risk flags for this campaign
  const { data: openFlags } = await supabaseAdmin
    .from('risk_flags')
    .select('id, flag_type, severity, description')
    .eq('campaign_id', campaignId)
    .eq('resolved', false);

  // Stripe Connect / payout destination status
  const destination = await resolvePayoutDestination(campaign);
  const { data: organizerAccount } = await supabaseAdmin
    .from('connected_accounts')
    .select('details_submitted, payouts_enabled, charges_enabled')
    .eq('user_id', campaign.user_id)
    .maybeSingle();

  const blockers: Blocker[] = [];

  if (campaign.payout_frozen) {
    blockers.push({ code: 'payout_frozen', label: 'Payouts are frozen for this campaign pending admin review.', actionUrl: '/dashboard/support' });
  }
  if (!destination) {
    blockers.push({ code: 'connect_incomplete', label: 'Connect a Stripe account to receive payouts.', actionUrl: `/dashboard/campaigns/${campaignId}/payout-setup` });
  } else if (organizerAccount && (!organizerAccount.details_submitted || !organizerAccount.payouts_enabled)) {
    blockers.push({ code: 'connect_pending', label: 'Finish Stripe onboarding to enable payouts.', actionUrl: `/dashboard/campaigns/${campaignId}/payout-setup` });
  }
  if (availableCents <= 0) {
    blockers.push({ code: 'no_balance', label: 'No available balance to pay out yet.', actionUrl: `/campaigns/${campaign.id}` });
  }
  for (const flag of openFlags ?? []) {
    blockers.push({
      code: `risk_${flag.id}`,
      label: flag.description ?? `Open ${flag.severity} risk flag: ${String(flag.flag_type).replace(/_/g, ' ')}`,
      actionUrl: '/dashboard/support',
    });
  }

  const readiness: Readiness =
    campaign.payout_frozen || (openFlags && openFlags.length > 0) ? 'blocked'
    : blockers.length > 0 ? 'action_needed'
    : 'ready';

  let message = fallbackMessage(readiness, blockers, availableCents, campaign.title);
  let model = 'fallback';

  if (openai) {
    try {
      const response = await openai.responses.create({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content: 'You are CharitMe Payout Concierge AI. Write a short (2-4 sentence), warm, reassuring message to a fundraiser explaining the status of their payout, any blockers preventing payout, and the single most important next step. Be specific and only use facts from the input — never invent amounts or timelines. Return strict JSON: {"message": string}.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              campaignTitle: campaign.title,
              readiness,
              availableCents,
              blockers: blockers.map((b) => b.label),
              payoutFrozen: campaign.payout_frozen,
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
    generation_type: 'payout_concierge',
    prompt: { campaignId, readiness, availableCents, blockers: blockers.map((b) => b.code) },
    output: { message, readiness, availableCents },
    model,
  });

  return NextResponse.json({
    readiness,
    availableCents,
    blockers,
    message,
    model,
    timelines: SPEED_TIMELINES,
    payoutReady: !!destination,
  });
}
