import 'server-only';
import { PageScaffold, type Metric, type TableRow } from '../../../components/KindFundShellServer';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export default async function SystemSettingsPage() {
  await requireAdmin();

  const [
    { count: profiles },
    { count: campaigns },
    { count: donations },
    { count: pendingPayouts },
    { count: openReports },
    { count: openRiskFlags },
    { count: webhookErrors },
    { count: integrations },
    { count: activeApiKeys },
    { count: outboundWebhooks },
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('donations').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('payouts').select('id', { count: 'exact', head: true }).in('status', ['requested', 'approved']),
    supabaseAdmin.from('campaign_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabaseAdmin.from('risk_flags').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabaseAdmin.from('webhook_events').select('id', { count: 'exact', head: true }).not('processing_error', 'is', null),
    supabaseAdmin.from('integration_connections').select('id', { count: 'exact', head: true }).eq('status', 'connected'),
    supabaseAdmin.from('api_keys').select('id', { count: 'exact', head: true }).is('revoked_at', null),
    supabaseAdmin.from('outbound_webhook_endpoints').select('id', { count: 'exact', head: true }).eq('active', true),
  ]);

  const rows: TableRow[] = [
    { title: 'Supabase Profiles', subtitle: 'Registered user records', status: 'Live', amount: `${profiles ?? 0} users`, meta: ['profiles'] },
    { title: 'Campaign Data', subtitle: 'Campaign records available to the app', status: 'Live', amount: `${campaigns ?? 0} campaigns`, meta: ['campaigns'] },
    { title: 'Donation Pipeline', subtitle: 'Donation records loaded in Supabase', status: 'Live', amount: `${donations ?? 0} donations`, meta: ['donations'] },
    { title: 'Payout Queue', subtitle: 'Requested or approved payouts waiting on action', status: (pendingPayouts ?? 0) > 0 ? 'Review' : 'Clear', amount: `${pendingPayouts ?? 0} pending`, meta: ['payouts'] },
    { title: 'Trust Queue', subtitle: 'Open campaign reports and risk flags', status: (openReports ?? 0) + (openRiskFlags ?? 0) > 0 ? 'Review' : 'Clear', amount: `${(openReports ?? 0) + (openRiskFlags ?? 0)} open`, meta: ['campaign_reports', 'risk_flags'] },
    { title: 'Stripe Webhooks', subtitle: 'Webhook events with processing errors', status: (webhookErrors ?? 0) > 0 ? 'Action Needed' : 'Healthy', amount: `${webhookErrors ?? 0} errors`, meta: ['webhook_events'] },
    { title: 'Integrations', subtitle: 'Connected integrations, API keys, and outbound webhooks', status: 'Live', amount: `${(integrations ?? 0) + (activeApiKeys ?? 0) + (outboundWebhooks ?? 0)} active`, meta: ['integration_connections', 'api_keys'] },
  ];

  const metrics: Metric[] = [
    { label: 'Core Records', value: ((profiles ?? 0) + (campaigns ?? 0) + (donations ?? 0)).toLocaleString(), change: 'profiles + campaigns + donations', icon: 'stack', tone: 'violet' },
    { label: 'Trust Queue', value: ((openReports ?? 0) + (openRiskFlags ?? 0)).toLocaleString(), change: 'open items', icon: 'audit', tone: 'orange' },
    { label: 'Integrations', value: (integrations ?? 0).toLocaleString(), change: 'connected providers', icon: 'link', tone: 'blue' },
    { label: 'Webhook Errors', value: (webhookErrors ?? 0).toLocaleString(), change: 'processing failures', icon: (webhookErrors ?? 0) > 0 ? 'audit' : 'check', tone: (webhookErrors ?? 0) > 0 ? 'orange' : 'green' },
  ];

  return (
    <PageScaffold
      mode="admin"
      active="System Settings"
      title="System Settings"
      subtitle="Live system health and data readiness from Supabase."
      metrics={metrics}
      rows={rows}
      tabs={['All Systems', 'Data', 'Trust', 'Integrations']}
    />
  );
}
