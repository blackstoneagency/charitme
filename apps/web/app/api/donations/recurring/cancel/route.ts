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
// Cancels a recurring donation subscription. Only the donor who created it
// (or an admin) may cancel.
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
