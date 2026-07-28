import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyAdmin } from '../../../users/_auth';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { reconcileMoneyFlow } from '../../../../../../lib/payment-flow';

const actionSchema = z.object({
  action: z.enum(['add_note', 'mark_reviewed', 'retry_reconciliation']),
  note: z.string().max(2000).optional(),
});

type RouteContext = {
  params: Promise<{ transactionId: string }>;
};

// API routes must DENY, not redirect: `requireAdmin()` is the PAGE helper and
// calls redirect(), which hands a fetch caller HTML and makes res.json() throw.
// `verifyAdmin()` is the API-side equivalent and returns null. Same gate.
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { transactionId } = await context.params;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid action payload', code: 'INVALID_INPUT', details: parsed.error.flatten() }, { status: 400 });
  }

  const { data: payment } = await supabaseAdmin
    .from('campaign_payments')
    .select('id,campaign_id,campaign_owner_id,donor_id,processor,processor_account_id,gross_amount,tip_amount,platform_fee_amount,processor_fee_amount,campaign_owner_net_amount,refunded_amount,disputed_amount,currency,payment_status,transfer_status,payout_status,refund_status,dispute_status,settlement_status,reconciliation_status')
    .eq('id', transactionId)
    .maybeSingle();

  if (!payment) {
    return NextResponse.json({ error: 'Payment not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  if (parsed.data.action === 'add_note') {
    if (!parsed.data.note) {
      return NextResponse.json({ error: 'Note is required', code: 'INVALID_INPUT' }, { status: 400 });
    }
    await supabaseAdmin.from('campaign_payment_admin_notes').insert({
      campaign_payment_id: transactionId,
      campaign_id: payment.campaign_id,
      campaign_owner_id: payment.campaign_owner_id,
      donor_id: payment.donor_id,
      processor: payment.processor,
      processor_account_id: payment.processor_account_id,
      note: parsed.data.note,
      status: 'active',
      created_by: admin.id,
    });
  }

  if (parsed.data.action === 'mark_reviewed') {
    await supabaseAdmin.from('campaign_payment_reconciliation').update({
      status: 'ignored',
      updated_by: admin.id,
      updated_at: new Date().toISOString(),
    }).eq('campaign_payment_id', transactionId);
    await supabaseAdmin.from('campaign_payments').update({
      reconciliation_status: 'ignored',
      reconciliation_reason: 'admin_reviewed',
      updated_at: new Date().toISOString(),
    }).eq('id', transactionId);
  }

  if (parsed.data.action === 'retry_reconciliation') {
    const result = reconcileMoneyFlow({
      grossAmount: payment.gross_amount,
      tipAmount: payment.tip_amount,
      platformFeeAmount: payment.platform_fee_amount,
      processorFeeAmount: payment.processor_fee_amount,
      ownerNetAmount: payment.campaign_owner_net_amount,
      refundedAmount: payment.refunded_amount,
      disputedAmount: payment.disputed_amount,
      paymentStatus: payment.payment_status,
      transferStatus: payment.transfer_status,
      payoutStatus: payment.payout_status,
      refundStatus: payment.refund_status,
      disputeStatus: payment.dispute_status,
      settlementStatus: payment.settlement_status,
    });
    const reason = result.issues.join(', ');
    await supabaseAdmin.from('campaign_payment_reconciliation').upsert({
      campaign_payment_id: transactionId,
      campaign_id: payment.campaign_id,
      campaign_owner_id: payment.campaign_owner_id,
      donor_id: payment.donor_id,
      processor: payment.processor,
      processor_account_id: payment.processor_account_id,
      gross_amount: payment.gross_amount,
      processor_fee_amount: payment.processor_fee_amount,
      platform_fee_amount: payment.platform_fee_amount,
      owner_net_amount: payment.campaign_owner_net_amount,
      currency: payment.currency,
      status: result.status,
      issues: result.issues,
      checked_at: new Date().toISOString(),
    }, { onConflict: 'campaign_payment_id', ignoreDuplicates: false });
    await supabaseAdmin.from('campaign_payments').update({
      reconciliation_status: result.status,
      reconciliation_reason: reason,
      updated_at: new Date().toISOString(),
    }).eq('id', transactionId);
  }

  await supabaseAdmin.from('campaign_payment_audit_logs').insert({
    campaign_payment_id: transactionId,
    campaign_id: payment.campaign_id,
    campaign_owner_id: payment.campaign_owner_id,
    donor_id: payment.donor_id,
    processor: payment.processor,
    processor_account_id: payment.processor_account_id,
    action: parsed.data.action,
    actor_id: admin.id,
    metadata: { note_added: parsed.data.action === 'add_note' },
  });

  return NextResponse.json({ ok: true });
}
