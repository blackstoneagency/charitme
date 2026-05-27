import 'server-only';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { KindFundShell, TopBar } from '../../../components/KindFundShellServer';
import SettingsClient, { type SettingCategory, type GeneralSettings, type OverviewStats } from './_components/SettingsClient';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  await requireAdmin();

  // Fetch real data
  const [
    integrationCountResult,
    adminEmailResult,
  ] = await Promise.all([
    supabaseAdmin.from('integration_connections').select('id', { count: 'exact', head: true }).eq('status', 'connected'),
    supabaseAdmin.from('profiles').select('email').not('roles', 'is', null).limit(1),
  ]);

  const integrations = integrationCountResult.count ?? 0;
  const adminEmail =
    (adminEmailResult.data ?? []).length > 0
      ? ((adminEmailResult.data![0] as { email: string | null }).email ?? 'admin@kindfund.com')
      : 'admin@kindfund.com';

  const categories: SettingCategory[] = [
    { key: 'general', label: 'General', icon: 'gear', description: 'Basic platform information' },
    { key: 'branding', label: 'Branding', icon: 'check', description: 'Logos, colors and brand assets' },
    { key: 'email', label: 'Email', icon: 'doc', description: 'Email templates and preferences' },
    { key: 'payment', label: 'Payment', icon: 'wallet', description: 'Payment gateways and fees' },
    { key: 'notifications', label: 'Notifications', icon: 'bell', description: 'In-app and push notifications' },
    { key: 'security', label: 'Security', icon: 'audit', description: 'Security and authentication' },
    { key: 'integrations', label: 'Integrations', icon: 'link', description: 'Third-party integrations' },
    { key: 'advanced', label: 'Advanced', icon: 'sliders', description: 'Advanced system configurations' },
  ];

  const settings: GeneralSettings = {
    platformName: 'KindFund',
    tagline: 'Fundraising that thinks for you.',
    supportEmail: adminEmail,
    supportPhone: '+1 (800) 555-KIND',
    timezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    currency: 'USD',
    itemsPerPage: 25,
    maintenanceMode: false,
    allowNewRegistrations: true,
    emailVerification: true,
  };

  const overview: OverviewStats = {
    platformStatus: 'Online',
    categoriesCount: categories.length,
    configurations: 45,
    integrations,
  };

  return (
    <KindFundShell active="Settings" mode="admin">
      <TopBar
        title="Settings"
        subtitle="Configure platform behavior, branding, email, payments, and integrations."
        actions={<></>}
      />
      <SettingsClient
        categories={categories}
        settings={settings}
        overview={overview}
      />
    </KindFundShell>
  );
}
