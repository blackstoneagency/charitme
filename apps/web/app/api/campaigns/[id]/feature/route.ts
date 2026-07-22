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
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  // Load the campaign + verify the caller can manage it.
  const { data: campaign, error } = await supabaseAdmin
    .from('campaigns')
    .select('id, slug, title, user_id, featured, status')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[feature] Campaign lookup failed:', error.message);
    return NextResponse.json({ error: 'Could not load campaign' }, { status: 500 });
  }
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (!(await canManageCampaign(user, campaign.user_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (campaign.featured) {
    return NextResponse.json({ error: 'This campaign is already featured.' }, { status: 400 });
  }

  // Resolve the admin-configured fee from platform settings (default $5).
  const { data: settingsRow } = await supabaseAdmin
    .from('platform_settings')
    .select('config')
    .eq('id', 1)
    .maybeSingle();
  const payment =
    settingsRow?.config && typeof settingsRow.config === 'object' && !Array.isArray(settingsRow.config)
      ? (settingsRow.config as Record<string, unknown>).payment
      : undefined;
  const priceCents = resolveFeaturePriceCents(payment);

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
    success_url: `${origin}/dashboard/campaigns/${campaign.id}?featured=1`,
    cancel_url: `${origin}/dashboard/campaigns/${campaign.id}?featured=0`,
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
    if (!session.url) {
      return NextResponse.json({ error: 'Could not start checkout' }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stripe error';
    console.error('[feature] Stripe error:', msg);
    return NextResponse.json({ error: 'Could not start checkout' }, { status: 502 });
  }
}
