import 'server-only';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import SettingsClient, { type SettingCategory, type PlatformSettings, type OverviewStats } from './_components/SettingsClient';

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
      ? ((adminEmailResult.data![0] as { email: string | null }).email ?? 'admin@CharitMe.com')
      : 'admin@CharitMe.com';

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

  const defaultSettings: PlatformSettings = {
    platformName: 'CharitMe',
    tagline: 'Fundraising that thinks for you.',
    supportEmail: adminEmail,
    supportPhone: '',
    timezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    currency: 'USD',
    itemsPerPage: 25,
    maintenanceMode: false,
    allowNewRegistrations: true,
    emailVerification: true,
    brandPrimaryColor: '#6c35ff',
    brandAccentColor: '#ec3fb4',
    logoUrl: '',
    emailFromName: 'CharitMe',
    emailFromAddress: adminEmail,
    donationFeePercent: 2.9,
    platformFeePercent: 5,
    stripeLiveMode: true,
    notifyAdminOnDonation: true,
    notifyCampaignApproval: true,
    requireMfaForAdmins: false,
    sessionTimeoutMinutes: 60,
    googleOAuthEnabled: true,
    stripeConnectEnabled: true,
    maxUploadMb: 10,
    auditRetentionDays: 365,
  };

  const { data: savedSettings } = await supabaseAdmin
    .from('platform_settings')
    .select('config')
    .eq('id', 1)
    .maybeSingle();

  const settings: PlatformSettings = {
    ...defaultSettings,
    ...((savedSettings?.config && typeof savedSettings.config === 'object') ? savedSettings.config : {}),
  };

  const overview: OverviewStats = {
    platformStatus: 'Online',
    categoriesCount: categories.length,
    configurations: Object.keys(settings).length,
    integrations,
  };

  return (
    <CharitMeShell active="Settings" mode="admin">
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
    </CharitMeShell>
  );
}
