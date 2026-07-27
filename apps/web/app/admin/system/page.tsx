import 'server-only';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import SystemClient, {
  type SystemCategory,
  type RecentActivity,
  type SystemOverview,
  type ResourceUsage,
  type AllSettings,
} from './_components/SystemClient';
import { DEFAULTS } from '../../../lib/settings-defaults';

export const dynamic = 'force-dynamic';

const HEALTH_LOOKBACK_HOURS = 24;
const HEALTH_ERROR_THRESHOLD_PCT = 5;

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

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function currentTimestamp(): number {
  return Date.now();
}

function mergeCategory(raw: unknown, defaults: Record<string, unknown>): Record<string, unknown> {
  const stored = (raw && typeof raw === 'object' && !Array.isArray(raw))
    ? (raw as Record<string, unknown>)
    : {};
  return { ...defaults, ...stored };
}

// `null` means the count could not be read, which is NOT the same statement as 0.
// supabase-js resolves rather than throws on a query error, so a bare `count` is
// null on failure and `?? 0` would report a healthy-looking zero for an
// unreadable table. On a system-health page zero errors is the *favourable*
// answer, so it has to be measured.
function countOf(result: { count: number | null; error?: unknown }): number | null {
  if (result.error) return null;
  return result.count;
}

/** Sum that stays unknown if any part is unknown. */
function sumOrNull(...values: (number | null)[]): number | null {
  if (values.some((v) => v === null)) return null;
  return (values as number[]).reduce((a, b) => a + b, 0);
}

/** Display helper: unknown renders as an em dash, never as 0. */
function showCount(value: number | null): string {
  return value === null ? '—' : value.toLocaleString();
}

function querySucceeded(result: { error: unknown }): boolean {
  return !result.error;
}

function formatErrorRate(errorCount: number | null, totalCount: number | null): string {
  // An unread numerator or denominator is unknown. Returning '0%' here is what
  // painted a green check mark on the KPI tile during a database failure.
  if (errorCount === null || totalCount === null) return '—';
  if (totalCount <= 0 || errorCount <= 0) return '0%';
  const value = (errorCount / totalCount) * 100;
  return value < 1 ? `${value.toFixed(2)}%` : `${value.toFixed(1)}%`;
}

function percentage(numerator: number, denominator: number, emptyValue = 100): number {
  if (denominator <= 0) return emptyValue;
  return Math.max(0, Math.min(100, Math.round((numerator / denominator) * 100)));
}

function normalizeResourceUsage(rows: ResourceUsage[]): ResourceUsage[] {
  return rows
    .filter(row => typeof row.label === 'string' && Number.isFinite(row.value) && typeof row.color === 'string')
    .map(row => ({
      label: row.label,
      value: Math.max(0, Math.min(100, Math.round(row.value))),
      color: row.color,
    }))
    .slice(0, 3);
}

export default async function SystemSettingsPage() {
  await requireAdmin();

  const now = currentTimestamp();
  const healthSince = new Date(now - (HEALTH_LOOKBACK_HOURS * 60 * 60 * 1000)).toISOString();

  const [
    webhookEventsResult,
    webhookHealthTotalResult,
    webhookHealthErrorResult,
    integrationConnectedResult,
    integrationErrorResult,
    outboundWebhookResult,
    scheduledUpdatesResult,
    scheduledEmailResult,
    scheduledSmsResult,
    auditLogsResult,
    resourceUsageResult,
    settingsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from('webhook_events')
      .select('id, event_type, processing_error, created_at, processed_at')
      .order('created_at', { ascending: false })
      .limit(20),
    supabaseAdmin
      .from('webhook_events')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', healthSince),
    supabaseAdmin
      .from('webhook_events')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', healthSince)
      .not('processing_error', 'is', null),
    supabaseAdmin
      .from('integration_connections')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'connected'),
    supabaseAdmin
      .from('integration_connections')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'error'),
    supabaseAdmin
      .from('outbound_webhook_endpoints')
      .select('id', { count: 'exact', head: true })
      .eq('active', true),
    supabaseAdmin
      .from('campaign_updates')
      .select('id', { count: 'exact', head: true })
      .not('scheduled_at', 'is', null)
      .is('published_at', null),
    supabaseAdmin
      .from('email_campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'scheduled'),
    supabaseAdmin
      .from('sms_campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'scheduled'),
    supabaseAdmin
      .from('audit_logs')
      .select('id, action, target_type, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    supabaseAdmin.rpc('get_admin_system_resource_usage'),
    supabaseAdmin
      .from('platform_settings')
      .select('config')
      .eq('id', 1)
      .maybeSingle(),
  ]);

  type WebhookEvent = {
    id: string;
    event_type: string;
    processing_error: string | null;
    created_at: string;
    processed_at: string | null;
  };

  type AuditLog = {
    id: string;
    action: string;
    target_type: string | null;
    created_at: string;
  };

  const events = (webhookEventsResult.data ?? []) as WebhookEvent[];
  const auditLogs = (auditLogsResult.data ?? []) as AuditLog[];
  const totalHealthEvents = countOf(webhookHealthTotalResult);
  const webhookErrors = countOf(webhookHealthErrorResult);
  const integrationsActive = sumOrNull(countOf(integrationConnectedResult), countOf(outboundWebhookResult));
  const integrationErrors = countOf(integrationErrorResult);
  const scheduledJobs = sumOrNull(
    countOf(scheduledUpdatesResult),
    countOf(scheduledEmailResult),
    countOf(scheduledSmsResult),
  );
  // An unknown error rate must not read as 0 — `healthStatus` below already goes
  // Degraded when any monitored read fails, and this keeps the KPI tile agreeing
  // with it instead of showing a green 0%.
  const errorRateValue =
    webhookErrors !== null && totalHealthEvents !== null && totalHealthEvents > 0
      ? (webhookErrors / totalHealthEvents) * 100
      : 0;
  const errorRate = formatErrorRate(webhookErrors, totalHealthEvents);

  const recentActivity: RecentActivity[] = [
    ...events.map(e => ({
      sortAt: e.created_at,
      activity: {
        id: `webhook-${e.id}`,
        action: e.event_type,
        category: eventCategory(e.event_type),
        time: relativeTime(e.created_at),
        status: e.processing_error ? 'Failed' : (e.processed_at ? 'Processed' : 'Pending'),
      },
    })),
    ...auditLogs.map(e => ({
      sortAt: e.created_at,
      activity: {
        id: `audit-${e.id}`,
        action: e.action,
        category: e.target_type ? `Audit: ${e.target_type}` : 'Audit Log',
        time: relativeTime(e.created_at),
        status: 'Recorded',
      },
    })),
  ]
    .sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime())
    .slice(0, 20)
    .map(row => row.activity);

  const categories: SystemCategory[] = [
    { key: 'general', label: 'General', icon: 'gear', description: 'Basic platform config' },
    { key: 'security', label: 'Security', icon: 'audit', description: 'Policies and authentication' },
    { key: 'email', label: 'Email', icon: 'doc', description: 'Email server and templates' },
    { key: 'payment', label: 'Payment', icon: 'wallet', description: 'Payment gateways and fees' },
    { key: 'integrations', label: 'Integrations', icon: 'link', description: 'Third-party services and webhooks' },
    { key: 'notifications', label: 'Notifications', icon: 'bell', description: 'In-app and push notification settings' },
    { key: 'storage', label: 'Storage', icon: 'upload', description: 'File storage and CDN settings' },
    { key: 'maintenance', label: 'System Maintenance', icon: 'sliders', description: 'Backups, logs and maintenance' },
    { key: 'flags', label: 'Feature Flags', icon: 'check', description: 'Manage platform features' },
    { key: 'advanced', label: 'Advanced', icon: 'filter', description: 'Advanced system configurations' },
  ];

  // Merge stored config with defaults per category
  const rawConfig = (settingsResult.data?.config && typeof settingsResult.data.config === 'object' && !Array.isArray(settingsResult.data.config))
    ? (settingsResult.data.config as Record<string, unknown>)
    : {};

  const monitoredChecks = [
    webhookEventsResult,
    webhookHealthTotalResult,
    webhookHealthErrorResult,
    integrationConnectedResult,
    scheduledUpdatesResult,
    auditLogsResult,
    settingsResult,
    resourceUsageResult,
  ];
  const servicesOnline = monitoredChecks.filter(querySucceeded).length;
  const allMonitoredServicesOnline = servicesOnline === monitoredChecks.length;
  const healthStatus = allMonitoredServicesOnline && errorRateValue <= HEALTH_ERROR_THRESHOLD_PCT ? 'Healthy' : 'Degraded';

  // The computed fallback bars are only shown when their inputs were actually
  // read. `percentage()` returns its `emptyValue` of 100 for an empty
  // denominator, so an all-failed read used to render "Webhook Success 100%" and
  // "Integration Health 100%" — inventing the most reassuring possible number
  // from no data, on the page an operator opens during an incident.
  const rpcResourceUsage = normalizeResourceUsage((resourceUsageResult.data ?? []) as ResourceUsage[]);
  const computedResourceUsage: ResourceUsage[] = [];
  if (totalHealthEvents !== null && webhookErrors !== null && totalHealthEvents > 0) {
    computedResourceUsage.push({
      label: 'Webhook Success',
      value: percentage(totalHealthEvents - webhookErrors, totalHealthEvents),
      color: '#6c35ff',
    });
  }
  if (integrationsActive !== null && integrationErrors !== null && integrationsActive + integrationErrors > 0) {
    computedResourceUsage.push({
      label: 'Integration Health',
      value: percentage(integrationsActive, integrationsActive + integrationErrors),
      color: '#19b86a',
    });
  }
  if (scheduledJobs !== null) {
    computedResourceUsage.push({
      label: 'Scheduled Queue Clear',
      value: percentage(Math.max(50 - scheduledJobs, 0), 50),
      color: '#2f80ed',
    });
  }
  const resourceUsage = rpcResourceUsage.length > 0 ? rpcResourceUsage : computedResourceUsage;

  const overview: SystemOverview = {
    healthStatus,
    servicesOnline,
    integrationsActive: showCount(integrationsActive),
    scheduledJobs: showCount(scheduledJobs),
    errorRate,
  };

  const initialSettings: AllSettings = {
    general: mergeCategory(rawConfig.general, DEFAULTS.general),
    security: mergeCategory(rawConfig.security, DEFAULTS.security),
    email: mergeCategory(rawConfig.email, DEFAULTS.email),
    payment: mergeCategory(rawConfig.payment, DEFAULTS.payment),
    integrations: mergeCategory(rawConfig.integrations, DEFAULTS.integrations),
    notifications: mergeCategory(rawConfig.notifications, DEFAULTS.notifications),
    storage: mergeCategory(rawConfig.storage, DEFAULTS.storage),
    maintenance: mergeCategory(rawConfig.maintenance, DEFAULTS.maintenance),
    flags: mergeCategory(rawConfig.flags, DEFAULTS.flags),
    advanced: mergeCategory(rawConfig.advanced, DEFAULTS.advanced),
  };

  return (
    <CharitMeShell active="System Settings" mode="admin">
      <TopBar
        title="System Settings"
        subtitle="Live system health and configuration. All data from Supabase."
        actions={<></>}
      />
      <SystemClient
        categories={categories}
        overview={overview}
        recentActivity={recentActivity}
        resourceUsage={resourceUsage}
        initialSettings={initialSettings}
      />
    </CharitMeShell>
  );
}
