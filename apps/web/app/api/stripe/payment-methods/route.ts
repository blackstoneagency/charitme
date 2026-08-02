import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { stripe } from '../../../../lib/stripe';

/**
 * DELETE — detach a saved card from the signed-in user's Stripe customer.
 *
 * ⚠️ The ownership check is the whole point of this route.
 *
 * `stripe.paymentMethods.detach(id)` takes only a PaymentMethod id, and those
 * ids are not secret — they travel in client payloads and appear in logs. A
 * route that detached whatever id it was handed would let any signed-in account
 * delete any other account's card, which is an IDOR with a real-world effect:
 * someone else's recurring donation starts failing.
 *
 * So the method is retrieved FIRST and its `customer` compared against the
 * caller's own `stripe_customer_id`. A mismatch returns 404, not 403 — a 403
 * would confirm that the id exists and belongs to somebody.
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let paymentMethodId: unknown;
  try {
    ({ paymentMethodId } = (await request.json()) as { paymentMethodId?: unknown });
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  if (typeof paymentMethodId !== 'string' || !paymentMethodId.startsWith('pm_')) {
    return NextResponse.json({ error: 'Invalid payment method.' }, { status: 400 });
  }

  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'We could not verify your account. Please try again.' }, { status: 503 });
    }

    const customerId = profile?.stripe_customer_id as string | undefined;
    if (!customerId) return NextResponse.json({ error: 'Payment method not found.' }, { status: 404 });

    const method = await stripe.paymentMethods.retrieve(paymentMethodId);
    const owner = typeof method.customer === 'string' ? method.customer : method.customer?.id ?? null;

    // Not yours, or attached to nobody. Same answer either way, on purpose.
    if (!owner || owner !== customerId) {
      return NextResponse.json({ error: 'Payment method not found.' }, { status: 404 });
    }

    await stripe.paymentMethods.detach(paymentMethodId);
    return NextResponse.json({ ok: true });
  } catch {
    // Never surface Stripe's raw error: it can echo ids and account details.
    return NextResponse.json(
      { error: 'We could not remove that card. Please try again in a moment.' },
      { status: 502 },
    );
  }
}
