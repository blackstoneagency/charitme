import 'server-only';
import { PageScaffold, type TableRow, type Metric } from '../../../components/KindFundShellServer';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Derive a human-readable category from a Stripe event type string. */
function eventCategory(eventType: string): string {
  if (eventType.startsWith('payment_intent')) return 'Payments';
  if (eventType.startsWith('charge')) return 'Charges';
  if (eventType.startsWith('customer')) return 'Customers';
  if (eventType.startsWith('checkout')) return 'Checkout';
  if (eventType.startsWith('payout')) return 'Payouts';
  if (eventType.startsWith('invoice')) return 'Invoices';
  if (eventType.startsWith('subscription')) return 'Subscriptions';
  return 'System';
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function AuditLogPage() {
  await requireAdmin();

  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const [
    { data: events, count: totalCount },
    { count: recentCount },
    { count: failedCount },
  ] = await Promise.all([
    supabaseAdmin
      .from('webhook_events')
      .select('id, event_type, stripe_event_id, processed_at, processing_error, created_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('webhook_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo.toISOString()),
    supabaseAdmin
      .from('webhook_events')
      .select('*', { count: 'exact', head: true })
      .not('processing_error', 'is', null),
  ]);

  type WebhookEvent = {
    id: string;
    event_type: string;
    stripe_event_id: string | null;
    processed_at: string | null;
    processing_error: string | null;
    created_at: string;
  };

  const eventList = (events ?? []) as WebhookEvent[];

  // Count unique event types for the "categories" metric
  const uniqueTypes = new Set(eventList.map(e => eventCategory(e.event_type))).size;

  const rows: TableRow[] = eventList.map(e => ({
    title: e.event_type,
    subtitle: e.stripe_event_id ?? 'Internal event',
    status: e.processing_error ? 'Failed' : (e.processed_at ? 'Processed' : 'Pending'),
    amount: eventCategory(e.event_type),
    meta: [fmtDate(e.created_at), fmtDateTime(e.created_at)],
  }));

  const metrics: Metric[] = [
    {
      label: 'Total Events',
      value: (totalCount ?? 0).toLocaleString(),
      change: 'all time',
      icon: 'audit',
      tone: 'violet',
    },
    {
      label: 'Last 24 Hours',
      value: (recentCount ?? 0).toLocaleString(),
      change: 'recent activity',
      icon: 'users',
      tone: 'green',
    },
    {
      label: 'Categories',
      value: String(uniqueTypes),
      change: 'event types',
      icon: 'stack',
      tone: 'blue',
    },
    {
      label: 'Failed',
      value: (failedCount ?? 0).toLocaleString(),
      change: 'processing errors',
      icon: 'doc',
      tone: 'orange',
    },
  ];

  return (
    <PageScaffold
      mode="admin"
      active="Audit Log"
      title="Audit Log"
      subtitle="Track, review and monitor Stripe webhook events and platform activity."
      metrics={metrics}
      rows={rows}
      tabs={[
        `All Events (${totalCount ?? 0})`,
        'Payments',
        'Payouts',
        `Failed (${failedCount ?? 0})`,
      ]}
    />
  );
}
