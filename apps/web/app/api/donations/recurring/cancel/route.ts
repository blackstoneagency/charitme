import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '../../../../../lib/stripe';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { boundedQuery } from '../../../../../lib/query-timeout';

const Schema = z.object({
  subscriptionId: z.string().min(1),
});

// POST /api/donations/recurring/cancel
// Cancels a recurring donation subscription.
//
// ONLY the donor who created it may cancel — the sole check below is
// `row.donor_id !== user.id → 403`. This comment previously read "(or an
// admin)", which no code implements: support staff cannot cancel on a donor's
// behalf, and assuming otherwise would mean telling a donor their subscription
// was handled when it was not.
//
// Adding that capability is a permissions decision, not a doc fix, so the
// comment now matches the code rather than the other way round.
//
// Ordering below is deliberate and fail-safe: Stripe is updated FIRST, so if it
// throws, the row is never marked cancelled. The reverse would show "cancelled"
// while charges continued.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'subscriptionId is required' }, { status: 400 });
  }

  const { subscriptionId } = parsed.data;

  // Verify ownership: the recurring_donation row must belong to this user
  // ⚠️ `.single()` reports ZERO ROWS AS AN ERROR, and this dropped `error`. So a
  // missing subscription and an unreadable database both produced `record =
  // null`, and both answered 404 "Subscription not found" — to a donor trying to
  // stop a recurring charge. They either give up and keep being charged, or
  // dispute it with their bank. `.maybeSingle()` separates the two.
  const { data: record, error: recordError } = await boundedQuery(() =>
    supabaseAdmin
      .from('recurring_donations')
      .select('id, donor_id, status')
      .eq('stripe_subscription_id', subscriptionId)
      .maybeSingle(),
  );

  if (recordError) {
    return NextResponse.json(
      { error: 'Subscription lookup unavailable, please try again', code: 'SUBSCRIPTION_LOOKUP_UNAVAILABLE' },
      { status: 503 },
    );
  }

  if (!record) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  const row = record as { id: string; donor_id: string | null; status: string };

  if (row.donor_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (row.status === 'cancelled') {
    return NextResponse.json({ error: 'Already cancelled' }, { status: 400 });
  }

  // Cancel at period end so donor still gets their paid period
  await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });

  // Stripe is authoritative for whether the donor is charged again, and it has
  // already accepted the cancellation — so this is not reported as a failure to
  // cancel. `customer.subscription.deleted` does rewrite this row, but only when
  // the period actually ends, so until then our record would silently disagree.
  const { error: cancelWriteError } = await supabaseAdmin
    .from('recurring_donations')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', row.id);
  if (cancelWriteError) {
    console.error('[recurring cancel] stripe cancelled but local write failed:', cancelWriteError.message);
    return NextResponse.json(
      {
        ok: true,
        stripeCancelled: true,
        recordUpdated: false,
        warning: 'Your recurring donation is cancelled with the payment processor. Our records may take a moment to catch up.',
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true });
}
