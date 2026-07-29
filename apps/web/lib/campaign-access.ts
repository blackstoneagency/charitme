import 'server-only';
import { supabaseAdmin } from './supabase';
import { isAdmin } from './roles';

const ANALYTICS_ROLES = new Set(['owner', 'admin', 'member']);

export async function canViewCampaignAnalytics(
  user: { id: string; email?: string | null },
  campaignId: string,
  campaignOwnerId: string,
): Promise<boolean> {
  if (campaignOwnerId === user.id || await isAdmin(user.id, user.email)) return true;

  const { data } = await supabaseAdmin
    .from('team_members')
    .select('role')
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)
    .maybeSingle();

  return Boolean(data?.role && ANALYTICS_ROLES.has(data.role));
}
