import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { stripe } from '../../../../../../lib/stripe';
import { verifyAdmin } from '../../../users/_auth';

const RefundRequestSchema = z.object({
  amount_cents: z.number().int().positive(),
  reason: z.string().trim().min(1).max(200).default('Admin refund'),
}).strict();

const ReservationSchema = z.object({
  refund_id: z.string().uuid(),
  refund_cents: z.coerce.number().int().positive(),
  donation_cents: z.coerce.number().int().positive(),
  already_refunded_cents: z.coerce.number().int().nonnegative(),
  is_full_refund: z.boolean(),
  stripe_payment_intent_id: z.string().min(1).nullable(),
  campaign_id: z.string().uuid(),
});

type Reservation = z.infer<typeof ReservationSchema>;

async function markReservationFailed(refundId: string, reason: string): Promise<void> {
  const { error: reservationFailureError } = await supabaseAdmin
    .from('refunds')
    .update({ status: 'failed', notes: reason })
    .eq('id', refundId);
  if (reservationFailureError) throw new Error('Refund reservation failure could not be recorded.');
}

function refundError(code: string, status: number, error: string): NextResponse {
  return NextResponse.json({ error, code }, { status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const admin = await verifyAdmin();
  if (!admin) return refundError('UNAUTHORIZED', 401, 'Unauthorized');

  const { id } = await params;
  const idResult = z.string().uuid().safeParse(id);
  if (!idResult.success) return refundError('INVALID_DONATION_ID', 400, 'Invalid donation ID');

  let input: z.infer<typeof RefundRequestSchema>;
  try {
    const parsed = RefundRequestSchema.safeParse(await request.json());
    if (!parsed.success) return refundError('INVALID_REFUND_REQUEST', 400, 'Enter a valid refund amount and reason');
    input = parsed.data;
  } catch {
    return refundError('INVALID_JSON', 400, 'Invalid JSON body');
  }

  const { data: reservedRows, error: reserveError } = await supabaseAdmin.rpc(
    'reserve_admin_donation_refund',
    {
      p_donation_id: idResult.data,
      p_requested_cents: input.amount_cents,
      p_reason: input.reason,
      p_requested_by: admin.id,
    },
  );

  if (reserveError) {
    if (reserveError.message.includes('DONATION_NOT_FOUND')) {
      return refundError('DONATION_NOT_FOUND', 404, 'Donation not found');
    }
    if (reserveError.message.includes('ALREADY_REFUNDED')) {
      return refundError('ALREADY_REFUNDED', 409, 'Donation already refunded');
    }
    return refundError('REFUND_RESERVATION_FAILED', 503, 'Could not reserve this refund. Nothing was refunded.');
  }

  const reservationResult = ReservationSchema.safeParse(Array.isArray(reservedRows) ? reservedRows[0] : null);
  if (!reservationResult.success) {
    return refundError('REFUND_RESERVATION_INVALID', 503, 'Could not reserve this refund. Nothing was refunded.');
  }
  const reservation: Reservation = reservationResult.data;

  if (!reservation.stripe_payment_intent_id) {
    await markReservationFailed(reservation.refund_id, 'No Stripe payment reference is available');
    return refundError('PAYMENT_REFERENCE_MISSING', 409, 'This donation has no refundable Stripe payment');
  }

  let charge: Stripe.Charge;
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(
      reservation.stripe_payment_intent_id,
      { expand: ['latest_charge'] },
    );
    if (!paymentIntent.latest_charge) throw new Error('missing_charge');
    charge = typeof paymentIntent.latest_charge === 'string'
      ? await stripe.charges.retrieve(paymentIntent.latest_charge)
      : paymentIntent.latest_charge;
  } catch {
    await markReservationFailed(reservation.refund_id, 'Stripe charge could not be read');
    return refundError('STRIPE_CHARGE_UNAVAILABLE', 502, 'The Stripe charge could not be read. Nothing was refunded.');
  }

  const chargeRemainingCents = charge.amount - charge.amount_refunded;
  if (chargeRemainingCents <= 0) {
    await markReservationFailed(reservation.refund_id, 'Stripe charge is already fully refunded');
    return refundError('STRIPE_ALREADY_REFUNDED', 409, 'The Stripe charge is already fully refunded');
  }

  const proportionalGrossCents = Math.max(
    1,
    Math.round((reservation.refund_cents * charge.amount) / reservation.donation_cents),
  );
  const stripeRefundCents = reservation.is_full_refund
    ? chargeRemainingCents
    : Math.min(proportionalGrossCents, chargeRemainingCents);
  const transferId = typeof charge.transfer === 'string' ? charge.transfer : charge.transfer?.id ?? null;
  const applicationFeeId = typeof charge.application_fee === 'string'
    ? charge.application_fee
    : charge.application_fee?.id ?? null;

  const refundParams: Stripe.RefundCreateParams = {
    charge: charge.id,
    amount: stripeRefundCents,
    reason: 'requested_by_customer',
    metadata: {
      admin_id: admin.id,
      donation_id: idResult.data,
      refund_reservation_id: reservation.refund_id,
      donation_principal_cents: String(reservation.refund_cents),
      reason: input.reason,
    },
    ...(transferId ? { reverse_transfer: true } : {}),
    ...(applicationFeeId ? { refund_application_fee: true } : {}),
  };

  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create(
      refundParams,
      { idempotencyKey: `admin-donation-refund-${reservation.refund_id}` },
    );
  } catch {
    await markReservationFailed(reservation.refund_id, 'Stripe rejected the refund');
    return refundError('STRIPE_REFUND_FAILED', 502, 'Stripe could not process this refund. Nothing was refunded.');
  }

  const now = new Date().toISOString();
  const { error: refundWriteError } = await supabaseAdmin.from('refunds').update({
    gross_amount_cents: stripeRefundCents,
    status: 'processed',
    stripe_refund_id: refund.id,
    processed_at: now,
    notes: reservation.is_full_refund ? 'Full admin refund' : 'Partial admin refund',
  }).eq('id', reservation.refund_id);

  const { error: donationWriteError } = await supabaseAdmin.from('donations').update({
    ...(reservation.is_full_refund ? { status: 'refunded', refunded_at: now } : {}),
    refund_reason: input.reason,
    updated_at: now,
  }).eq('id', idResult.data);

  const { error: auditWriteError } = await supabaseAdmin.from('audit_logs').insert({
    actor_id: admin.id,
    action: 'donation.refunded',
    target_type: 'donation',
    target_id: idResult.data,
    metadata: {
      refund_id: reservation.refund_id,
      stripe_refund_id: refund.id,
      principal_amount_cents: reservation.refund_cents,
      gross_amount_cents: stripeRefundCents,
      reason: input.reason,
      reverse_transfer: Boolean(transferId),
      refund_application_fee: Boolean(applicationFeeId),
    },
    created_at: now,
  });

  const persistenceError = refundWriteError ?? donationWriteError;
  const ledgerRecorded = !persistenceError;
  if (!ledgerRecorded || auditWriteError) {
    console.error('[admin/refund] Stripe refund succeeded but persistence needs reconciliation', {
      donation_id: idResult.data,
      refund_id: reservation.refund_id,
      stripe_refund_id: refund.id,
      refund_write_failed: Boolean(refundWriteError),
      donation_write_failed: Boolean(donationWriteError),
      audit_write_failed: Boolean(auditWriteError),
    });
  }

  return NextResponse.json({
    ok: true,
    refund_id: reservation.refund_id,
    stripe_refund_id: refund.id,
    principal_amount_cents: reservation.refund_cents,
    gross_amount_cents: stripeRefundCents,
    ledger_recorded: !persistenceError,
    ...(ledgerRecorded
      ? {}
      : { warning: 'Stripe issued the refund, but it could not be written to the refunds ledger. Reconciliation is pending. Do not retry this refund.' }),
  });
}
