import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { canManageCampaign } from '../../../../../lib/auth';
import { createCheckoutSession } from '../../../../../lib/stripe';
import { getAppOrigin } from '../../../../../lib/auth-config';
import { resolveFeaturePriceCents } from '../../../../../lib/featured';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/campaigns/:id/feature
// Start a one-time Checkout to feature a campaign in the homepage rotator.
// The fee is a platform charge (no connected-account transfer). On success the
// Stripe webhook flips campaigns.featured = true (see stripe/webhook).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The admin-configured fee, in cents.
 *
 * Read on EVERY request rather than cached: the requirement is that the price can
 * be changed "at any moment" in the admin portal, and a cached figure would keep
 * charging the old amount — or, worse, quote one price in the UI and charge
 * another. It is one indexed single-row lookup.
 */
async function featurePriceCents(): Promise<number> {
  const { data: settingsRow } = await supabaseAdmin
    .from('platform_settings')
    .select('config')
    .eq('id', 1)
    .maybeSingle();
  const payment =
    settingsRow?.config && typeof settingsRow.config === 'object' && !Array.isArray(settingsRow.config)
      ? (settingsRow.config as Record<string, unknown>).payment
      : undefined;
  return resolveFeaturePriceCents(payment);
}

// GET /api/campaigns/:id/feature — the current price and whether this campaign is
// already featured. Exists so the campaign BUILDER (a client component) can show
// the live admin-configured price without hardcoding $5, which would silently
// misquote every time an admin changed it.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, user_id, featured')
    .eq('id', id)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  // Ownership checked even for a read: `featured` is not secret, but this route
  // would otherwise confirm the existence of any campaign id to any signed-in
  // user.
  if (!(await canManageCampaign(user, campaign.user_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ priceCents: await featurePriceCents(), featured: Boolean(campaign.featured) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Where to send the creator back to. The campaign BUILDER offers this at the
  // moment a campaign goes live, and dropping that person into the dashboard
  // would lose their share panel and the rest of the launch screen. Restricted
  // to a known set rather than accepting a URL — an open `returnTo` on a
  // payment route is a redirect gadget.
  const body = await request.json().catch(() => ({}));
  const returnTo = (body as { returnTo?: string })?.returnTo === 'create' ? 'create' : 'dashboard';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  // Load the campaign + verify the caller can manage it.
  const { data: campaign, error } = await supabaseAdmin
    .from('campaigns')
    .select('id, slug, title, user_id, featured, status')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (!(await canManageCampaign(user, campaign.user_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (campaign.featured) {
    return NextResponse.json({ error: 'This campaign is already featured.' }, { status: 400 });
  }

  const priceCents = await featurePriceCents();

  const origin = getAppOrigin();
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: priceCents,
          product_data: {
            name: 'Featured Campaign placement',
            description: `Feature "${campaign.title}" in the CharitMe homepage spotlight.`,
          },
        },
        quantity: 1,
      },
    ],
    success_url:
      returnTo === 'create'
        ? `${origin}/create?featured=1&campaign=${campaign.id}`
        : `${origin}/dashboard/campaigns/${campaign.id}?featured=1`,
    cancel_url:
      returnTo === 'create'
        ? `${origin}/create?featured=0&campaign=${campaign.id}`
        : `${origin}/dashboard/campaigns/${campaign.id}?featured=0`,
    metadata: {
      type: 'feature_campaign',
      campaignId: campaign.id,
      userId: user.id,
    },
  };

  try {
    const session = await createCheckoutSession(
      sessionParams,
      `feature_${campaign.id}_${user.id}`,
    );
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stripe error';
    console.error('[feature] Stripe error:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
