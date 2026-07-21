import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
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
  const isFullRefund = refundCents >= don.amount_cents;
  let stripeRefundId: string | null = null;

  // Issue Stripe refund if we have a payment intent.
  //
  // CharitMe charges are Stripe Connect DESTINATION charges: the donation
  // principal was transferred to the recipient's connected account and only the
  // application fee (tip + processing) stayed on the platform. A plain refund
  // would come out of the PLATFORM balance while the charity keeps the funds —
  // so we MUST `reverse_transfer` (pull the refunded amount back from the
  // connected account) and `refund_application_fee` (return the proportional
  // platform fee). This mirrors scripts/verify-money-flow.mjs. If the charge has
  // no associated transfer (legacy/non-destination), retry without those flags.
  if (don.stripe_payment_intent_id) {
    const base: Stripe.RefundCreateParams = {
      payment_intent: don.stripe_payment_intent_id,
      amount: refundCents,
      reason: 'requested_by_customer',
      metadata: { admin_id: admin.id, donation_id: id, reason },
    };
    try {
      const refund = await stripe.refunds.create({
        ...base,
        reverse_transfer: true,
        refund_application_fee: true,
      });
      stripeRefundId = refund.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Stripe refund failed';
      // Fall back to a plain refund only when the failure is specifically that
      // there is no transfer / application fee to reverse (non-destination
      // charge). Any other error is surfaced.
      if (/transfer|application fee|no such/i.test(msg)) {
        try {
          const refund = await stripe.refunds.create(base);
          stripeRefundId = refund.id;
        } catch (err2) {
          const msg2 = err2 instanceof Error ? err2.message : 'Stripe refund failed';
          return NextResponse.json({ error: msg2 }, { status: 502 });
        }
      } else {
        return NextResponse.json({ error: msg }, { status: 502 });
      }
    }
  }

  // Update donation status. Only a FULL refund flips the donation to `refunded`
  // (the status enum has no `partially_refunded`); a partial refund leaves the
  // donation `completed` and is tracked in the `refunds` table + ledger. Campaign
  // stat reversal is owned exclusively by the idempotent `charge.refunded`
  // webhook (`decrement_campaign_stats` there), so we do NOT decrement here —
  // doing both double-counted the reversal.
  const donationUpdate: Record<string, unknown> = { updated_at: now, refund_reason: reason };
  if (isFullRefund) {
    donationUpdate.status = 'refunded';
    donationUpdate.refunded_at = now;
  }
  const { data: updated, error } = await supabaseAdmin
    .from('donations')
    .update(donationUpdate)
    .eq('id', id)
    .select('id, status, refunded_at, refund_reason, amount_cents')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert refund record
  await supabaseAdmin.from('refunds').insert({
    donation_id: id,
    amount_cents: refundCents,
    reason,
    notes: `Admin refund by ${admin.email}${isFullRefund ? '' : ' (partial)'}`,
    status: 'processed',
    requested_by: admin.id,
    stripe_refund_id: stripeRefundId,
    processed_at: now,
  });

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
