import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { stripe } from '../../../../../../lib/stripe';
import { verifyAdmin } from '../../../users/_auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Fetch current donation
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('donations')
    .select('id, amount_cents, status, stripe_payment_intent_id, campaign_id')
    .eq('id', id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Donation not found' }, { status: 404 });
  }

  const don = existing as {
    id: string;
    amount_cents: number;
    status: string;
    stripe_payment_intent_id: string | null;
    campaign_id: string;
  };

  if (don.status === 'refunded') {
    return NextResponse.json({ error: 'Donation already refunded' }, { status: 400 });
  }

  const rawAmount = body.amount_cents;
  const refundCents =
    typeof rawAmount === 'number'
      ? Math.min(Math.max(1, Math.round(rawAmount)), don.amount_cents)
      : don.amount_cents;

  const reason = typeof body.reason === 'string' && body.reason.trim()
    ? body.reason.trim()
    : 'Admin refund';

  const now = new Date().toISOString();
  let stripeRefundId: string | null = null;

  // Issue Stripe refund if we have a payment intent
  if (don.stripe_payment_intent_id) {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: don.stripe_payment_intent_id,
        amount: refundCents,
        reason: 'requested_by_customer',
        metadata: { admin_id: admin.id, donation_id: id, reason },
      });
      stripeRefundId = refund.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Stripe refund failed';
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  // Update donation status
  const { data: updated, error } = await supabaseAdmin
    .from('donations')
    .update({
      status: 'refunded',
      refunded_at: now,
      refund_reason: reason,
      updated_at: now,
    })
    .eq('id', id)
    .select('id, status, refunded_at, refund_reason, amount_cents')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert refund record
  await supabaseAdmin.from('refunds').insert({
    donation_id: id,
    amount_cents: refundCents,
    reason,
    notes: `Admin refund by ${admin.email}`,
    status: 'processed',
    requested_by: admin.id,
    stripe_refund_id: stripeRefundId,
    processed_at: now,
  });

  // Reverse campaign stats (best-effort)
  try {
    await supabaseAdmin.rpc('decrement_campaign_stats', {
      p_campaign_id: don.campaign_id,
      p_amount_cents: don.amount_cents,
    });
  } catch { /* non-fatal */ }

  // Audit log
  await supabaseAdmin.from('audit_logs').insert({
    actor_id: admin.id,
    action: 'donation.refunded',
    target_type: 'donation',
    target_id: id,
    metadata: { amount_cents: refundCents, reason, stripe_refund_id: stripeRefundId },
    created_at: now,
  });

  return NextResponse.json({ ok: true, donation: updated, stripe_refund_id: stripeRefundId });
}
