import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '../../../../../lib/stripe';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';

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
  const { data: record } = await supabaseAdmin
    .from('recurring_donations')
    .select('id, donor_id, status')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

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

  await supabaseAdmin
    .from('recurring_donations')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', row.id);

  return NextResponse.json({ ok: true });
}
