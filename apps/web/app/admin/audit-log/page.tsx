import 'server-only';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import AuditLogClient, { type AuditEvent, type DayPoint, type CategoryCount } from './_components/AuditLogClient';

export const dynamic = 'force-dynamic';

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

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default async function AuditLogPage() {
  await requireAdmin();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    { data: events, count: totalCount },
    { count: failedCount },
    { data: thirtyDayEvents },
    donorCountResult,
  ] = await Promise.all([
    supabaseAdmin
      .from('webhook_events')
      .select('id, event_type, stripe_event_id, processed_at, processing_error, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('webhook_events')
      .select('id', { count: 'exact', head: true })
      .not('processing_error', 'is', null),
    supabaseAdmin
      .from('webhook_events')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true }),
    supabaseAdmin.from('donations').select('donor_id'),
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
  const totalEvents = totalCount ?? 0;
  const failedEvents = failedCount ?? 0;

  // Unique donors
  const donorRows = (donorCountResult.data ?? []) as { donor_id: string }[];
  const uniqueUsers = new Set(donorRows.map(d => d.donor_id)).size;

  // Build audit events
  const auditEvents: AuditEvent[] = eventList.map(e => ({
    id: e.id,
    dateTime: fmtDateTime(e.created_at),
    user: 'System',
    action: e.event_type,
    category: eventCategory(e.event_type),
    status: e.processing_error ? 'Failed' : (e.processed_at ? 'Processed' : 'Pending'),
    eventType: e.event_type,
    stripeEventId: e.stripe_event_id,
    processingError: e.processing_error,
  }));

  // Build category counts
  const catMap: Record<string, number> = {};
  for (const e of eventList) {
    const cat = eventCategory(e.event_type);
    catMap[cat] = (catMap[cat] ?? 0) + 1;
  }

  const COLORS: Record<string, string> = {
    Payments: '#6c35ff',
    Charges: '#ec3fb4',
    Customers: '#2f80ed',
    Checkout: '#19b86a',
    Payouts: '#f59e0b',
    Invoices: '#ff3b5f',
    Subscriptions: '#8b5cf6',
    System: '#67718e',
  };

  const categories: CategoryCount[] = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count, color: COLORS[label] ?? '#8c95b2' }));

  // Build day points for last 30 days
  const dayBuckets: Map<string, number> = new Map();
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayBuckets.set(dayKey(d.toISOString()), 0);
  }

  for (const e of (thirtyDayEvents ?? []) as { created_at: string }[]) {
    const k = dayKey(e.created_at);
    if (dayBuckets.has(k)) {
      dayBuckets.set(k, (dayBuckets.get(k) ?? 0) + 1);
    }
  }

  const dayPoints: DayPoint[] = [...dayBuckets.entries()].map(([label, count]) => ({ label, count }));

  return (
    <CharitMeShell active="Audit Log" mode="admin">
      <TopBar
        title="Audit Log"
        subtitle="Track, review and monitor Stripe webhook events and platform activity."
        actions={<></>}
      />
      <AuditLogClient
        events={auditEvents}
        totalEvents={totalEvents}
        uniqueUsers={uniqueUsers}
        categories={categories}
        failedCount={failedEvents}
        dayPoints={dayPoints}
      />
    </CharitMeShell>
  );
}
