import 'server-only';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { KindFundShell, TopBar } from '../../../components/KindFundShellServer';
import SystemClient, { type SystemCategory, type RecentActivity, type SystemOverview, type AllSettings } from './_components/SystemClient';
import { DEFAULTS } from '../../../lib/settings-defaults';

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

function mergeCategory(raw: unknown, defaults: Record<string, unknown>): Record<string, unknown> {
  const stored = (raw && typeof raw === 'object' && !Array.isArray(raw))
    ? (raw as Record<string, unknown>)
    : {};
  return { ...defaults, ...stored };
}

export default async function SystemSettingsPage() {
  await requireAdmin();

  const [
    webhookEventsResult,
    webhookErrorsResult,
    integrationCountResult,
    settingsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from('webhook_events')
      .select('id, event_type, processing_error, created_at, processed_at')
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('webhook_events')
      .select('id', { count: 'exact', head: true })
      .not('processing_error', 'is', null),
    supabaseAdmin
      .from('integration_connections')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'connected'),
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

  const events = (webhookEventsResult.data ?? []) as WebhookEvent[];
  const totalEvents = events.length;
  const webhookErrors = webhookErrorsResult.count ?? 0;
  const integrationsActive = integrationCountResult.count ?? 0;
  const scheduledJobs = events.filter(e => !e.processing_error && e.processed_at).length;
  const errorRate = totalEvents > 0 ? `${((webhookErrors / totalEvents) * 100).toFixed(1)}%` : '0%';

  const recentActivity: RecentActivity[] = events.slice(0, 20).map(e => ({
    id: e.id,
    action: e.event_type,
    category: eventCategory(e.event_type),
    time: relativeTime(e.created_at),
    status: e.processing_error ? 'Failed' : (e.processed_at ? 'Processed' : 'Pending'),
  }));

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

  const overview: SystemOverview = {
    healthStatus: webhookErrors === 0 ? 'Healthy' : 'Degraded',
    servicesOnline: categories.length, // number of configured system modules
    integrationsActive,
    scheduledJobs,
    errorRate,
  };

  // Merge stored config with defaults per category
  const rawConfig = (settingsResult.data?.config && typeof settingsResult.data.config === 'object' && !Array.isArray(settingsResult.data.config))
    ? (settingsResult.data.config as Record<string, unknown>)
    : {};

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
    <KindFundShell active="System Settings" mode="admin">
      <TopBar
        title="System Settings"
        subtitle="Live system health and configuration. All data from Supabase."
        actions={<></>}
      />
      <SystemClient
        categories={categories}
        overview={overview}
        recentActivity={recentActivity}
        initialSettings={initialSettings}
      />
    </KindFundShell>
  );
}
