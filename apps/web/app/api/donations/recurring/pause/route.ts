import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '../../../../../lib/stripe';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';

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

  if (action === 'pause') {
    if (row.status !== 'active') {
      return NextResponse.json({ error: 'Only active subscriptions can be paused' }, { status: 400 });
    }
    await stripe.subscriptions.update(subscriptionId, { pause_collection: { behavior: 'mark_uncollectible' } });
    await supabaseAdmin
      .from('recurring_donations')
      .update({ status: 'paused', updated_at: new Date().toISOString() })
      .eq('id', row.id);
    return NextResponse.json({ ok: true, status: 'paused' });
  }

  if (row.status !== 'paused') {
    return NextResponse.json({ error: 'Only paused subscriptions can be resumed' }, { status: 400 });
  }
  await stripe.subscriptions.update(subscriptionId, { pause_collection: '' });
  await supabaseAdmin
    .from('recurring_donations')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', row.id);
  return NextResponse.json({ ok: true, status: 'active' });
}
