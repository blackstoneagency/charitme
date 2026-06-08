import 'server-only';
import { requireAdmin } from './auth';
import { supabaseAdmin } from './supabase';
import { formatPaymentCents, summarizePaymentRows, type AdminPaymentRow, type PaymentFlowSummary } from './payment-flow';

export type PaymentFilters = {
  processor?: string;
  paymentStatus?: string;
  payoutStatus?: string;
  reconciliationStatus?: string;
  campaignId?: string;
  ownerId?: string;
  from?: string;
  to?: string;
};

export type PaymentAdminData = {
  rows: AdminPaymentRow[];
  summary: PaymentFlowSummary;
};

export type PaymentDetail = {
  payment: AdminPaymentRow | null;
  events: Array<{ id: string; event_type: string; event_status: string; amount: number; currency: string; occurred_at: string; processor_object_id: string | null; metadata: Record<string, unknown> }>;
  breakdowns: Array<{ id: string; gross_amount: number; tip_amount: number; processor_fee_amount: number; platform_fee_amount: number; owner_net_amount: number; currency: string; status: string; created_at: string }>;
  webhookEvents: Array<{ id: string; processor_event_id: string; event_type: string; status: string; created_at: string; processor_object_id: string | null }>;
  notes: Array<{ id: string; note: string; status: string; created_at: string }>;
};

export function money(cents: number, currency = 'usd'): string {
  return formatPaymentCents(cents, currency);
}

export function statusTone(status: string): string {
  if (['paid', 'succeeded', 'reconciled', 'processed', 'recorded', 'won', 'enabled'].includes(status)) return '#15803d';
  if (['failed', 'lost', 'mismatch', 'disputed', 'error'].includes(status)) return '#b91c1c';
  if (['pending', 'pending_data', 'requested', 'approved', 'needs_review', 'partially_refunded', 'opened'].includes(status)) return '#c2410c';
  return '#475569';
}

export async function getPaymentAdminData(filters: PaymentFilters = {}, limit = 100): Promise<PaymentAdminData> {
  await requireAdmin();
  let query = supabaseAdmin
    .from('campaign_payments')
    .select(`
      id,campaign_id,campaign_owner_id,processor,processor_charge_id,processor_payment_intent_id,processor_checkout_session_id,
      processor_transfer_id,processor_payout_id,gross_amount,tip_amount,platform_fee_amount,
      processor_fee_amount,campaign_owner_net_amount,refunded_amount,disputed_amount,currency,
      payment_status,transfer_status,payout_status,refund_status,dispute_status,settlement_status,
      reconciliation_status,reconciliation_reason,created_at,
      campaigns:campaign_id(title,slug)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (filters.processor) query = query.eq('processor', filters.processor);
  if (filters.paymentStatus) query = query.eq('payment_status', filters.paymentStatus);
  if (filters.payoutStatus) query = query.eq('payout_status', filters.payoutStatus);
  if (filters.reconciliationStatus) query = query.eq('reconciliation_status', filters.reconciliationStatus);
  if (filters.campaignId) query = query.eq('campaign_id', filters.campaignId);
  if (filters.ownerId) query = query.eq('campaign_owner_id', filters.ownerId);
  if (filters.from) query = query.gte('created_at', filters.from);
  if (filters.to) query = query.lte('created_at', filters.to);
  const { data } = await query;
  const rows = (data ?? []) as unknown as AdminPaymentRow[];
  return { rows, summary: summarizePaymentRows(rows) };
}

export async function getPaymentDetail(transactionId: string): Promise<PaymentDetail> {
  await requireAdmin();
  const [{ data: paymentData }, { data: events }, { data: breakdowns }, { data: webhookEvents }, { data: notes }] = await Promise.all([
    supabaseAdmin
      .from('campaign_payments')
      .select(`
        id,campaign_id,campaign_owner_id,processor,processor_charge_id,processor_payment_intent_id,processor_checkout_session_id,
        processor_transfer_id,processor_payout_id,gross_amount,tip_amount,platform_fee_amount,
        processor_fee_amount,campaign_owner_net_amount,refunded_amount,disputed_amount,currency,
        payment_status,transfer_status,payout_status,refund_status,dispute_status,settlement_status,
        reconciliation_status,reconciliation_reason,created_at,
        campaigns:campaign_id(title,slug)
      `)
      .eq('id', transactionId)
      .maybeSingle(),
    supabaseAdmin
      .from('campaign_payment_events')
      .select('id,event_type,event_status,amount,currency,occurred_at,processor_object_id,metadata')
      .eq('campaign_payment_id', transactionId)
      .order('occurred_at', { ascending: true }),
    supabaseAdmin
      .from('campaign_payment_breakdowns')
      .select('id,gross_amount,tip_amount,processor_fee_amount,platform_fee_amount,owner_net_amount,currency,status,created_at')
      .eq('campaign_payment_id', transactionId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('campaign_payment_webhook_events')
      .select('id,processor_event_id,event_type,status,created_at,processor_object_id')
      .eq('campaign_payment_id', transactionId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('campaign_payment_admin_notes')
      .select('id,note,status,created_at')
      .eq('campaign_payment_id', transactionId)
      .order('created_at', { ascending: false }),
  ]);

  return {
    payment: (paymentData ?? null) as unknown as AdminPaymentRow | null,
    events: (events ?? []) as PaymentDetail['events'],
    breakdowns: (breakdowns ?? []) as PaymentDetail['breakdowns'],
    webhookEvents: (webhookEvents ?? []) as PaymentDetail['webhookEvents'],
    notes: (notes ?? []) as PaymentDetail['notes'],
  };
}

export async function getCampaignOptions(): Promise<Array<{ id: string; title: string }>> {
  await requireAdmin();
  const { data } = await supabaseAdmin.from('campaigns').select('id,title').order('title', { ascending: true }).limit(300);
  return (data ?? []) as Array<{ id: string; title: string }>;
}

export async function getProcessorRows(): Promise<Array<{ processor: string; display_name: string; status: string; dashboard_url: string | null; metadata: Record<string, unknown> }>> {
  await requireAdmin();
  const { data } = await supabaseAdmin.from('payment_processors').select('processor,display_name,status,dashboard_url,metadata').order('display_name');
  return (data ?? []) as Array<{ processor: string; display_name: string; status: string; dashboard_url: string | null; metadata: Record<string, unknown> }>;
}
