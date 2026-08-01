import 'server-only';
import { unstable_cache } from 'next/cache';
import { supabaseAdmin } from './supabase';
import { resolveMaintenanceStatus, type MaintenanceStatus } from './maintenance-mode';

const fetchMaintenanceStatus = unstable_cache(
  async (): Promise<MaintenanceStatus> => {
    try {
      const { data, error } = await supabaseAdmin
        .from('platform_settings')
        .select('config')
        .eq('id', 1)
        .maybeSingle();
      if (error) return resolveMaintenanceStatus(null);
      return resolveMaintenanceStatus(data?.config);
    } catch {
      return resolveMaintenanceStatus(null);
    }
  },
  ['maintenance-mode'],
  { revalidate: 30, tags: ['platform-settings'] },
);

export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  return fetchMaintenanceStatus();
}
