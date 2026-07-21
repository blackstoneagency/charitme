import 'server-only';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { requireSuperAdmin } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import SettingsClient, { type PlatformConfig } from './SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SuperAdminSettingsPage() {
  await requireSuperAdmin();
  const { data } = await supabaseAdmin.from('platform_settings').select('config').eq('id', 1).maybeSingle();
  const config = ((data?.config as PlatformConfig | null) ?? {}) as PlatformConfig;
  return (
    <CharitMeShell active="Platform Settings" mode="admin">
      <TopBar title="Platform Settings" subtitle="Global configuration · platform_settings" />
      <SettingsClient config={config} />
    </CharitMeShell>
  );
}
