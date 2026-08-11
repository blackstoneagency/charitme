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

  // ── How much of this donation has ALREADY been refunded ────────────────────
  //
  // ⚠️ Without this the clamp is PER CALL, not cumulative. A partial refund
  // leaves the donation `completed` (there is no `partially_refunded` status),
  // so the guard above does not stop a second one — and each call was allowed up
  // to the full principal. Two $55 refunds on a $100 donation both succeed:
  // $110 refunded, $10 of it CharitMe's tip and processing revenue, and the
  // donation still reads `completed`.
  //
  // Stripe is only a backstop here, and a loose one: it rejects once cumulative
  // refunds exceed the CHARGE, and the charge is principal + tip + processing —
  // so there is headroom above the principal for exactly this to happen quietly.
  const { data: priorRefunds, error: priorError } = await supabaseAdmin
    .from('refunds')
    .select('amount_cents')
    .eq('donation_id', id);
  if (priorError) {
    // Fail CLOSED. An unknown refund history is not a zero refund history, and
    // guessing here refunds someone else's money.
    return NextResponse.json(
      { error: 'Could not read this donation\'s refund history. Nothing was refunded.', code: 'REFUND_HISTORY_UNAVAILABLE' },
      { status: 503 },
    );
  }
  const alreadyRefunded = (priorRefunds ?? []).reduce((sum, r) => sum + Number(r.amount_cents ?? 0), 0);
  const remainingCents = don.amount_cents - alreadyRefunded;

  if (remainingCents <= 0) {
    return NextResponse.json(
      {
        error: `This donation is fully refunded (${alreadyRefunded} of ${don.amount_cents} cents).`,
        code: 'ALREADY_REFUNDED',
      },
      { status: 400 },
    );
  }

  const rawAmount = body.amount_cents;
  const refundCents =
    typeof rawAmount === 'number'
      ? Math.min(Math.max(1, Math.round(rawAmount)), remainingCents)
      : remainingCents;

  const reason = typeof body.reason === 'string' && body.reason.trim()
    ? body.reason.trim()
    : 'Admin refund';

  const now = new Date().toISOString();
  // Full means the principal is now entirely refunded — counting what came
  // before, not just this call.
  const isFullRefund = alreadyRefunded + refundCents >= don.amount_cents;
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

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  // Insert refund record.
  //
  // The money has ALREADY moved at Stripe by this point, so a failed ledger write
  // must not turn into an error status: the admin would read it as "the refund
  // did not happen" and retry, issuing a second refund against the remaining
  // balance. Instead log enough detail to rebuild the row by hand and tell the
  // caller the ledger is incomplete. This matters most for a PARTIAL refund —
  // the donation stays `completed`, so this row is the only record that anything
  // was returned to the donor.
  const { error: ledgerErr } = await supabaseAdmin.from('refunds').insert({
    donation_id: id,
    amount_cents: refundCents,
    reason,
    notes: `Admin refund by ${admin.email}${isFullRefund ? '' : ' (partial)'}`,
    status: 'processed',
    requested_by: admin.id,
    stripe_refund_id: stripeRefundId,
    processed_at: now,
  });
  if (ledgerErr) {
    console.error('[admin/refund] refunds ledger insert failed', {
      donation_id: id,
      amount_cents: refundCents,
      stripe_refund_id: stripeRefundId,
      requested_by: admin.id,
      processed_at: now,
      message: ledgerErr.message,
    });
  }

  // Audit log
  const { error: auditErr } = await supabaseAdmin.from('audit_logs').insert({
    actor_id: admin.id,
    action: 'donation.refunded',
    target_type: 'donation',
    target_id: id,
    metadata: { amount_cents: refundCents, reason, stripe_refund_id: stripeRefundId },
    created_at: now,
  });
  if (auditErr) {
    console.error('[admin/refund] audit_logs insert failed', {
      donation_id: id,
      actor_id: admin.id,
      message: auditErr.message,
    });
  }

  return NextResponse.json({
    ok: true,
    donation: updated,
    stripe_refund_id: stripeRefundId,
    ledger_recorded: !ledgerErr,
    ...(ledgerErr
      ? {
          warning:
            'The refund was issued at Stripe but could not be written to the refunds ledger. Do not retry — record it manually before reconciling.',
        }
      : {}),
  });
}
