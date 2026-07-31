import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type Stripe from 'stripe';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createCheckoutSession } from '../../../../lib/stripe';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { getAppOrigin } from '../../../../lib/auth-config';
import {
  buildSplit,
  encodeSplit,
  MAX_PORTFOLIO_CAMPAIGNS,
  MIN_PORTFOLIO_SHARE_CENTS,
} from '../../../../lib/portfolio-split';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// "Give once, fund many" — one payment, several campaigns.
//
// G4 in the GoFundMe teardown. Their answer is a Nonprofit Giving Cart; this is
// deliberately not a cart. The donor names ONE amount and a set of campaigns,
// and CharitMe divides it — one checkout, one receipt, one impact summary.
//
// ⚠️ WHY THIS CANNOT REUSE /api/donations
//
// 1. `transfer_data.destination` takes exactly ONE connected account. A gift
//    split across campaigns owned by different people has no single
//    destination, so this uses Stripe's separate-charges-and-transfers model:
//    the charge lands on the platform, tagged with a `transfer_group`, and the
//    webhook creates one Transfer per campaign.
//
// 2. `record_donation` is idempotent on the checkout session id. N campaigns
//    sharing one session would collapse to a SINGLE donation row — the first
//    call inserts, the rest return `already_processed`. The webhook therefore
//    keys each line as `<session>#<campaignId>` (see `lineSessionId`), which
//    keeps every line independently idempotent while a Stripe retry of the whole
//    session still lands on the same keys and is refused.
//
// Funds sit on the platform balance between the charge and the transfers. That
// is inherent to the model, not an oversight — it is also what makes a single
// refund across the whole gift possible later.
// ─────────────────────────────────────────────────────────────────────────────

const PortfolioSchema = z.object({
  campaignIds: z.array(z.string().uuid()).min(1).max(MAX_PORTFOLIO_CAMPAIGNS),
  totalCents: z.number().int().min(MIN_PORTFOLIO_SHARE_CENTS).max(100_000_00),
  // Optional custom division. Absent means split evenly.
  parts: z
    .array(z.object({ campaignId: z.string().uuid(), amountCents: z.number().int().positive() }))
    .max(MAX_PORTFOLIO_CAMPAIGNS)
    .optional(),
  anonymous: z.boolean().optional(),
  message: z.string().max(500).optional(),
  donorEmail: z.string().email().optional(),
});

interface CampaignRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  visibility: string;
  accept_donations: boolean | null;
  deadline: string | null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(`portfolio:${user?.id ?? ip}`, 20, 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = PortfolioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input', code: 'INVALID_INPUT' },
      { status: 400 },
    );
  }

  const { campaignIds, totalCents, parts, anonymous, message, donorEmail } = parsed.data;

  // Deduplicate BEFORE the existence lookup. `.in()` collapses duplicates, so a
  // list containing the same campaign twice comes back one row short and would
  // otherwise be reported as "one of those campaigns could not be found" — a
  // confusing message for a list where every campaign does exist.
  if (new Set(campaignIds).size !== campaignIds.length) {
    return NextResponse.json(
      { error: 'That list contains the same campaign twice.', code: 'DUPLICATE' },
      { status: 400 },
    );
  }

  // ── Every campaign must independently be able to receive this money ────────
  const { data: rows, error: campaignError } = await supabaseAdmin
    .from('campaigns')
    .select('id, slug, title, status, visibility, accept_donations, deadline')
    .in('id', campaignIds)
    .is('deleted_at', null);

  if (campaignError) {
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }

  const campaigns = (rows ?? []) as CampaignRow[];
  if (campaigns.length !== campaignIds.length) {
    return NextResponse.json(
      { error: 'One of those campaigns could not be found.', code: 'NOT_FOUND' },
      { status: 404 },
    );
  }

  // The same gates /api/donations applies, applied to EVERY campaign. A
  // portfolio must not become a side door that funds a campaign which has
  // closed, ended, or switched donations off — the checks are per campaign
  // precisely because one bad member would otherwise be carried by the others.
  const now = Date.now();
  for (const c of campaigns) {
    if (c.status !== 'active' || c.visibility !== 'public') {
      return NextResponse.json(
        { error: `"${c.title}" is not accepting donations right now.`, code: 'CAMPAIGN_INACTIVE' },
        { status: 400 },
      );
    }
    if (c.accept_donations === false) {
      return NextResponse.json(
        { error: `"${c.title}" has paused donations.`, code: 'DONATIONS_CLOSED' },
        { status: 400 },
      );
    }
    if (c.deadline && new Date(c.deadline).getTime() <= now) {
      return NextResponse.json(
        { error: `"${c.title}" has ended.`, code: 'CAMPAIGN_ENDED' },
        { status: 400 },
      );
    }
  }

  const split = buildSplit(totalCents, campaignIds, parts);
  if (!split.ok) {
    return NextResponse.json({ error: split.message, code: split.code.toUpperCase() }, { status: 400 });
  }

  const origin = getAppOrigin();
  const titles = campaigns.map((c) => c.title);
  const label =
    campaigns.length === 1
      ? `Donation to ${titles[0]}`
      : `Donation split across ${campaigns.length} campaigns`;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: totalCents,
          product_data: {
            name: label,
            description: titles.slice(0, 3).join(', ') + (titles.length > 3 ? `, +${titles.length - 3} more` : ''),
          },
        },
      },
    ],
    ...(donorEmail ? { customer_email: donorEmail } : {}),
    success_url: `${origin}/give/thanks?portfolio=1&total=${totalCents}`,
    cancel_url: `${origin}/give`,
    metadata: {
      // The flag the webhook branches on. Its absence keeps every existing
      // single-campaign donation on exactly the path it uses today.
      portfolio: '1',
      portfolioSplit: encodeSplit(split.parts),
      portfolioCount: String(split.parts.length),
      donorId: user?.id ?? '',
      anonymous: anonymous ? '1' : '0',
      message: message ?? '',
      donationAmountCents: String(totalCents),
    },
    payment_intent_data: {
      // NO transfer_data: the charge lands on the platform and the webhook fans
      // it out. `transfer_group` is what ties those transfers back to this
      // charge in Stripe's own reporting.
      transfer_group: `portfolio_${crypto.randomUUID()}`,
    },
  };

  try {
    const session = await createCheckoutSession(
      sessionParams,
      `portfolio_${user?.id ?? 'guest'}_${totalCents}_${request.headers.get('idempotency-key') ?? crypto.randomUUID()}`,
    );
    return NextResponse.json({ url: session.url, split: split.parts });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe error';
    console.error('[portfolio] Stripe error:', msg);
    if (msg.includes('STRIPE_SECRET_KEY')) {
      return NextResponse.json(
        { error: 'Payments are not configured on this deployment.', code: 'STRIPE_NOT_CONFIGURED' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: 'Could not start checkout.', code: 'STRIPE_ERROR' }, { status: 502 });
  }
}
