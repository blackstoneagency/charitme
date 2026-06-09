import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { stripe } from '../../../lib/stripe';

export const dynamic = 'force-dynamic';

const RequestSchema = z.object({
  campaignId:   z.string().uuid(),
  payoutSpeed:  z.enum(['standard', 'same_day', 'instant']).default('standard'),
  note:         z.string().max(500).optional(),
});

// ── POST /api/payouts ─────────────────────────────────────────────────────────
// Request a payout for a campaign. Checks available balance, creates a payout
// record, and initiates a Stripe payout to the organizer's connected account.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { campaignId, payoutSpeed, note } = parsed.data;

  // Verify campaign ownership
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, user_id, raised_amount, payout_frozen')
    .eq('id', campaignId)
    .eq('user_id', user.id)
    .single();

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if ((campaign as { payout_frozen?: boolean }).payout_frozen) {
    return NextResponse.json({ error: 'Payouts are frozen for this campaign', code: 'PAYOUT_FROZEN' }, { status: 403 });
  }

  // Verify Stripe Connect account is active
  const { data: connectedAccount } = await supabaseAdmin
    .from('connected_accounts')
    .select('stripe_account_id, payouts_enabled, details_submitted')
    .eq('user_id', user.id)
    .eq('verification_status', 'verified')
    .maybeSingle();

  if (!connectedAccount?.payouts_enabled || !connectedAccount.details_submitted) {
    return NextResponse.json({
      error: 'Stripe Connect account is not fully set up. Complete onboarding before requesting a payout.',
      code: 'CONNECT_INCOMPLETE',
    }, { status: 400 });
  }

  // Calculate available balance: raised minus already-paid-out
  const { data: existingPayouts } = await supabaseAdmin
    .from('payouts')
    .select('amount_cents')
    .eq('campaign_id', campaignId)
    .in('status', ['requested', 'approved', 'paid']);

  const alreadyPaidOrPending = (existingPayouts ?? []).reduce((s, p) => s + p.amount_cents, 0);
  const availableCents = (campaign.raised_amount ?? 0) - alreadyPaidOrPending;

  if (availableCents <= 0) {
    return NextResponse.json({ error: 'No available balance to pay out', code: 'INSUFFICIENT_BALANCE' }, { status: 400 });
  }

  // Fee for expedited payouts
  const speedFees: Record<string, number> = {
    standard: 0,
    same_day: Math.round(availableCents * 0.005),  // 0.5%
    instant:  Math.round(availableCents * 0.015),  // 1.5%
  };
  const feeCents = speedFees[payoutSpeed] ?? 0;
  const netCents = availableCents - feeCents;

  // Create payout record
  const { data: payoutRow, error: insertErr } = await supabaseAdmin
    .from('payouts')
    .insert({
      user_id:      user.id,
      campaign_id:  campaignId,
      amount_cents: availableCents,
      fee_cents:    feeCents,
      payout_speed: payoutSpeed,
      status:       'requested',
      note:         note ?? null,
    })
    .select('id')
    .single();

  if (insertErr || !payoutRow) {
    return NextResponse.json({ error: insertErr?.message ?? 'Failed to create payout' }, { status: 500 });
  }

  // Initiate Stripe transfer to connected account
  try {
    const transfer = await stripe.transfers.create({
      amount:      netCents,
      currency:    'usd',
      destination: connectedAccount.stripe_account_id,
      metadata: {
        payoutId:   payoutRow.id,
        campaignId,
        userId:     user.id,
        speed:      payoutSpeed,
      },
    });

    await supabaseAdmin
      .from('payouts')
      .update({ stripe_transfer_id: transfer.id, status: 'approved' })
      .eq('id', payoutRow.id);

    void supabaseAdmin.from('audit_logs').insert({
      actor_id:    user.id,
      action:      'payout.requested',
      target_type: 'payout',
      target_id:   payoutRow.id,
      metadata:    { campaignId, amountCents: availableCents, feeCents, payoutSpeed },
    });

    return NextResponse.json({
      ok:         true,
      payoutId:   payoutRow.id,
      amountCents: availableCents,
      netCents,
      feeCents,
      payoutSpeed,
      stripeTransferId: transfer.id,
    }, { status: 201 });

  } catch (err) {
    // Roll back payout record status to failed
    await supabaseAdmin.from('payouts').update({ status: 'failed' }).eq('id', payoutRow.id);
    const message = err instanceof Error ? err.message : 'Stripe transfer failed';
    return NextResponse.json({ error: message, code: 'STRIPE_ERROR' }, { status: 502 });
  }
}
