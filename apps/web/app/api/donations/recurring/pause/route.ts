import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '../../../../../lib/stripe';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { boundedQuery } from '../../../../../lib/query-timeout';

const Schema = z.object({
  subscriptionId: z.string().min(1),
  action: z.enum(['pause', 'resume']),
});

// POST /api/donations/recurring/pause
// Pauses or resumes payment collection on a recurring donation. Only the
// donor who created it may pause/resume.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'subscriptionId and action are required' }, { status: 400 });
  }

  const { subscriptionId, action } = parsed.data;

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

  if (action === 'pause') {
    if (row.status !== 'active') {
      return NextResponse.json({ error: 'Only active subscriptions can be paused' }, { status: 400 });
    }
    await stripe.subscriptions.update(subscriptionId, { pause_collection: { behavior: 'mark_uncollectible' } });
  // The Stripe side already applied, and it is authoritative for whether the
  // donor gets charged — so this cannot be undone and must not be reported as a
  // total failure. But `customer.subscription.updated` does NOT touch
  // `recurring_donations` (only memberships and plans), so unlike a cancellation
  // this divergence is never self-healed by a webhook: CharitMe would show
  // "paused" while the donor is actually being charged again, which is the
  // version a donor disputes. Surfacing it lets the client retry, which is safe —
  // the Stripe call is idempotent and the retry re-attempts this write.
    const { error: pauseWriteError } = await supabaseAdmin
      .from('recurring_donations')
      .update({ status: 'paused', updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (pauseWriteError) {
      console.error('[recurring pause] stripe paused but local write failed:', pauseWriteError.message);
      return NextResponse.json(
        { error: 'Paused with the payment processor, but our record did not update. Please retry.', code: 'RECURRING_STATE_DIVERGED' },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, status: 'paused' });
  }

  if (row.status !== 'paused') {
    return NextResponse.json({ error: 'Only paused subscriptions can be resumed' }, { status: 400 });
  }
  await stripe.subscriptions.update(subscriptionId, { pause_collection: '' });
  const { error: resumeWriteError } = await supabaseAdmin
    .from('recurring_donations')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', row.id);
  if (resumeWriteError) {
    // The dangerous direction: collection is ON again at Stripe while our record
    // still says "paused", so the donor sees charges they believe they stopped.
    console.error('[recurring resume] stripe resumed but local write failed:', resumeWriteError.message);
    return NextResponse.json(
      { error: 'Resumed with the payment processor, but our record did not update. Please retry.', code: 'RECURRING_STATE_DIVERGED' },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, status: 'active' });
}
