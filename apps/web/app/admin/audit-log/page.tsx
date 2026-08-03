import { boundedQuery } from '../../../lib/query-timeout';
import 'server-only';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import AuditLogClient, { type AuditEvent, type DayPoint, type CategoryCount } from './_components/AuditLogClient';

export const dynamic = 'force-dynamic';

function actionCategory(action: string): string {
  if (action.startsWith('payment_intent') || action.startsWith('charge') || action.startsWith('checkout')) return 'Payments';
  if (action.startsWith('payout')) return 'Payouts';
  if (action.startsWith('campaign')) return 'Campaigns';
  if (action.startsWith('user') || action.startsWith('profile') || action.startsWith('auth')) return 'Users';
  if (action.startsWith('donation')) return 'Donations';
  if (action.startsWith('customer') || action.startsWith('subscription') || action.startsWith('invoice')) return 'Billing';
  if (action.startsWith('admin')) return 'Admin';
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

  // Fetch from audit_logs (real admin activity) + webhook_events (Stripe events) in parallel
  const [
    { data: auditData, count: auditTotal },
    { data: webhookData, count: webhookTotal },
    { count: failedWebhooks },
    { data: thirtyDayAudit },
    { data: thirtyDayWebhook },
  ] = await Promise.all([
    boundedQuery(() => supabaseAdmin
      .from('audit_logs')
      .select('id, actor_id, action, target_type, target_id, metadata, ip_address, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(150)),
    boundedQuery(() => supabaseAdmin
      .from('webhook_events')
      .select('id, event_type, stripe_event_id, processed_at, processing_error, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(50)),
    boundedQuery(() => supabaseAdmin
      .from('webhook_events')
      .select('id', { count: 'exact', head: true })
      .not('processing_error', 'is', null)),
    boundedQuery(() => supabaseAdmin
      .from('audit_logs')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true })),
    boundedQuery(() => supabaseAdmin
      .from('webhook_events')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())),
  ]);

  type AuditRow = {
    id: string;
    actor_id: string | null;
    action: string;
    target_type: string | null;
    target_id: string | null;
    metadata: Record<string, unknown>;
    ip_address: string | null;
    created_at: string;
  };

  type WebhookRow = {
    id: string;
    event_type: string;
    stripe_event_id: string | null;
    processed_at: string | null;
    processing_error: string | null;
    created_at: string;
  };

  const auditList = (auditData ?? []) as AuditRow[];
  const webhookList = (webhookData ?? []) as WebhookRow[];

  // Resolve actor names from profiles
  const actorIds = [...new Set(auditList.map(e => e.actor_id).filter(Boolean) as string[])];
  const actorMap = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await boundedQuery(() => supabaseAdmin
      .from('profiles').select('id, full_name').in('id', actorIds));
    for (const p of (profiles ?? []) as { id: string; full_name: string | null }[]) {
      if (p.full_name) actorMap.set(p.id, p.full_name);
    }
  }

  const totalEvents = (auditTotal ?? 0) + (webhookTotal ?? 0);
  const failedEvents = failedWebhooks ?? 0;

  // Unique users = distinct actor_ids from audit_logs
  const uniqueUsers = new Set(auditList.map(e => e.actor_id).filter(Boolean)).size;

  // Build audit events — audit_logs first, then webhook events
  const auditEvents: AuditEvent[] = [
    ...auditList.map(e => ({
      id: e.id,
      dateTime: fmtDateTime(e.created_at),
      user: e.actor_id ? (actorMap.get(e.actor_id) ?? e.actor_id.slice(0, 8)) : 'System',
      action: e.action,
      category: actionCategory(e.action),
      status: 'Processed' as const,
      eventType: e.action,
      stripeEventId: null,
      processingError: null,
      targetType: e.target_type ?? undefined,
      ipAddress: e.ip_address ?? undefined,
    })),
    ...webhookList.map(e => ({
      id: e.id,
      dateTime: fmtDateTime(e.created_at),
      user: 'Stripe',
      action: e.event_type,
      category: actionCategory(e.event_type),
      status: (e.processing_error ? 'Failed' : e.processed_at ? 'Processed' : 'Pending') as 'Failed' | 'Processed' | 'Pending',
      eventType: e.event_type,
      stripeEventId: e.stripe_event_id,
      processingError: e.processing_error,
    })),
  ].sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

  // Build category counts from combined events
  const catMap: Record<string, number> = {};
  for (const e of auditEvents) {
    catMap[e.category] = (catMap[e.category] ?? 0) + 1;
  }

  const COLORS: Record<string, string> = {
    Payments: 'var(--brand-text)',
    Payouts: 'var(--orange-text)',
    Campaigns: '#19b86a',
    Users: '#2f80ed',
    Donations: '#ec3fb4',
    Billing: '#8b5cf6',
    Admin: 'var(--red-text)',
    System: 'var(--t3)',
  };

  const categories: CategoryCount[] = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count, color: COLORS[label] ?? 'var(--t3)' }));

  // Build day points for last 30 days — combined from both sources
  const dayBuckets: Map<string, number> = new Map();
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayBuckets.set(dayKey(d.toISOString()), 0);
  }

  for (const e of [...(thirtyDayAudit ?? []), ...(thirtyDayWebhook ?? [])] as { created_at: string }[]) {
    const k = dayKey(e.created_at);
    if (dayBuckets.has(k)) dayBuckets.set(k, (dayBuckets.get(k) ?? 0) + 1);
  }

  const dayPoints: DayPoint[] = [...dayBuckets.entries()].map(([label, count]) => ({ label, count }));

  return (
    <CharitMeShell active="Audit Log" mode="admin">
      <TopBar
        title="Audit Log"
        subtitle="Admin actions from audit_logs + Stripe webhook events — all live from Supabase."
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
