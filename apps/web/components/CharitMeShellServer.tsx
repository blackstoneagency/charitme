import 'server-only';
import { supabaseAdmin } from '../lib/supabase';
import { loadShellSession } from '../lib/shell-session-server';
import {
  CharitMeShell as _CharitMeShell,
  type ShellProps,
  type SidebarCampaign,
} from './CharitMeApp';

// ─────────────────────────────────────────────
// Re-export everything from CharitMeApp verbatim.
// Pages only need to change their import path.
// ─────────────────────────────────────────────
export {
  TopBar,
  KFIcon,
  Avatar,
  Logo,
  MetricGrid,
  StatusPill,
  SmartImage,
  campaignRows,
  type Metric,
  type TableRow,
  type ShellVariant,
  type ShellProps,
  type SidebarCampaign,
} from './CharitMeApp';

// ─────────────────────────────────────────────
// User fetch helper
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// Sidebar campaign list — powers the "My Campaigns"
// expandable nav item so organizers can jump straight
// into a specific campaign's management page.
// ─────────────────────────────────────────────
const SIDEBAR_CAMPAIGN_LIMIT = 8;

async function fetchSidebarCampaigns(userId: string | null): Promise<{ campaigns: SidebarCampaign[]; hasMore: boolean }> {
  if (!userId) return { campaigns: [], hasMore: false };
  try {
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .select('id,title,status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(SIDEBAR_CAMPAIGN_LIMIT + 1);
    if (error || !data) return { campaigns: [], hasMore: false };
    const hasMore = data.length > SIDEBAR_CAMPAIGN_LIMIT;
    return { campaigns: (data as SidebarCampaign[]).slice(0, SIDEBAR_CAMPAIGN_LIMIT), hasMore };
  } catch {
    return { campaigns: [], hasMore: false };
  }
}

// ─────────────────────────────────────────────
// Async CharitMeShell — always uses live session
// data for user identity; ignores any user props
// that individual pages may have hard-coded.
// ─────────────────────────────────────────────
export async function CharitMeShell(props: ShellProps) {
  const session = await loadShellSession();
  const showCampaignsNav = (props.mode ?? 'dashboard') !== 'admin' && !props.guestMode && !props.hideSidebar;
  const { campaigns, hasMore } = showCampaignsNav
    ? await fetchSidebarCampaigns(session.id)
    : { campaigns: [], hasMore: false };
  return (
    <_CharitMeShell
      {...props}
      sidebarCampaigns={campaigns}
      sidebarCampaignsHasMore={hasMore}
      userName={session.userName ?? session.userEmail}
      userEmail={session.userEmail}
      userRole={session.userRole}
      navRole={session.navRole}
      userAvatarUrl={session.userAvatarUrl}
      hasAdminAccess={session.hasAdminAccess}
    />
  );
}

