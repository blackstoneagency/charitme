import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth';
import { getPaymentAdminData, type PaymentFilters } from '../../../../../lib/payment-admin-data';

export async function GET(request: NextRequest): Promise<NextResponse> {
  await requireAdmin();
  const params = request.nextUrl.searchParams;
  const filters: PaymentFilters = {
    processor: param(params, 'processor'),
    paymentStatus: param(params, 'paymentStatus'),
    payoutStatus: param(params, 'payoutStatus'),
    reconciliationStatus: param(params, 'reconciliationStatus'),
    campaignId: param(params, 'campaignId'),
    ownerId: param(params, 'ownerId'),
    from: param(params, 'from'),
    to: param(params, 'to'),
  };
  const type = param(params, 'type') ?? 'campaign-ledger';
  const data = await getPaymentAdminData(filters, 5_000);
  const rows = data.rows.map(row => [
    row.id,
    row.created_at,
    row.campaign_id ?? '',
    row.campaigns?.title ?? '',
    row.campaign_owner_id ?? '',
    row.processor,
    row.processor_payment_intent_id ?? '',
    row.processor_checkout_session_id ?? '',
    row.processor_transfer_id ?? '',
    row.processor_payout_id ?? '',
    row.currency,
    row.gross_amount,
    row.processor_fee_amount,
    row.platform_fee_amount,
    row.campaign_owner_net_amount,
    row.refunded_amount,
    row.disputed_amount,
    row.payment_status,
    row.transfer_status,
    row.payout_status,
    row.refund_status,
    row.dispute_status,
    row.settlement_status,
    row.reconciliation_status,
    row.reconciliation_reason ?? '',
  ]);
  const csv = toCsv([
    [
      'payment_id',
      'created_at',
      'campaign_id',
      'campaign_title',
      'campaign_owner_id',
      'processor',
      'payment_intent_id',
      'checkout_session_id',
      'transfer_id',
      'payout_id',
      'currency',
      'gross_amount_cents',
      'processor_fee_amount_cents',
      'platform_fee_amount_cents',
      'campaign_owner_net_amount_cents',
      'refunded_amount_cents',
      'disputed_amount_cents',
      'payment_status',
      'transfer_status',
      'payout_status',
      'refund_status',
      'dispute_status',
      'settlement_status',
      'reconciliation_status',
      'reconciliation_reason',
    ],
    ...rows,
  ]);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${type}.csv"`,
    },
  });
}

function param(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key);
  return value && value.trim().length > 0 ? value : undefined;
}

function toCsv(rows: Array<Array<string | number>>): string {
  return rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
}
