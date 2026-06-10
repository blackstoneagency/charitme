import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession, RECURRING_PAYMENT_METHOD_TYPES } from '../../../../lib/stripe';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { getAppOrigin } from '../../../../lib/auth-config';

const PRICE_MAP: Record<string, string | undefined> = {
  starter_monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
  starter_yearly:  process.env.STRIPE_STARTER_YEARLY_PRICE_ID,
  pro_monthly:     process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
  pro_yearly:      process.env.STRIPE_PRO_YEARLY_PRICE_ID,
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const plan: string = body?.plan ?? '';
  const billing: string = body?.billing === 'yearly' ? 'yearly' : 'monthly';

  if (!['starter', 'pro'].includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const key = `${plan}_${billing}`;
  const priceId = PRICE_MAP[key];

  if (!priceId) {
    return NextResponse.json(
      { error: `Stripe price not configured. Set STRIPE_${plan.toUpperCase()}_${billing.toUpperCase()}_PRICE_ID in env vars.` },
      { status: 400 },
    );
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  const origin = getAppOrigin();

  const session = await createCheckoutSession({
    mode: 'subscription',
    payment_method_types: RECURRING_PAYMENT_METHOD_TYPES,
    ...(profile?.stripe_customer_id
      ? { customer: profile.stripe_customer_id }
      : { customer_email: user.email }),
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/dashboard/settings?subscription=success&plan=${plan}`,
    cancel_url: `${origin}/pricing`,
    allow_promotion_codes: true,
    metadata: { userId: user.id, plan, billing },
    subscription_data: {
      metadata: { userId: user.id, plan, billing },
    },
  }, `platform_sub_${user.id}_${plan}_${billing}_${crypto.randomUUID()}`);

  return NextResponse.json({ url: session.url });
}
