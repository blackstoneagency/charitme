import 'server-only';
import { createClient } from '../lib/supabase-server';
import { supabaseAdmin } from '../lib/supabase';
import { isAdmin } from '../lib/roles';
import {
  CharitMeShell as _CharitMeShell,
  PageScaffold as _PageScaffold,
  type ShellProps,
  type Metric,
  type TableRow,
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
  DataTable,
  LineChart,
  DonutCard,
  SidePanel,
  StatusPill,
  SmartImage,
  FlowPage,
  Journey,
  sampleImages,
  campaignRows,
  baseMetrics,
  type Metric,
  type TableRow,
  type ShellVariant,
  type ShellProps,
  type SidebarCampaign,
} from './CharitMeApp';

// ─────────────────────────────────────────────
// User fetch helper
// ─────────────────────────────────────────────
type ShellUser = {
  id: string | null;
  name: string | null;
  email: string;
  role: string;
  avatarUrl: string | null;
  hasAdminAccess: boolean;
};

async function fetchShellUser(): Promise<ShellUser> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { id: null, name: null, email: '', role: 'Organizer', avatarUrl: null, hasAdminAccess: false };

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, avatar_url, roles')
      .eq('id', user.id)
      .single();

    const roles: string[] = Array.isArray(profile?.roles) ? profile.roles : [];
    const hasAdminAccess = await isAdmin(user.id, user.email);
    const role = hasAdminAccess ? 'Admin'
      : roles.includes('moderator') ? 'Moderator'
      : 'Organizer';

    // Fall back to the auth session's user_metadata (as the public AppShell
    // header does) so the signed-in name/avatar are consistent everywhere.
    const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string; picture?: string };

    return {
      id: user.id,
      name: profile?.full_name ?? meta.full_name ?? meta.name ?? null,
      email: user.email ?? '',
      role,
      avatarUrl: profile?.avatar_url ?? meta.avatar_url ?? meta.picture ?? null,
      hasAdminAccess,
    };
  } catch {
    return { id: null, name: null, email: '', role: 'Organizer', avatarUrl: null, hasAdminAccess: false };
  }
}

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
  const user = await fetchShellUser();
  const showCampaignsNav = (props.mode ?? 'dashboard') !== 'admin' && !props.guestMode && !props.hideSidebar;
  const { campaigns, hasMore } = showCampaignsNav
    ? await fetchSidebarCampaigns(user.id)
    : { campaigns: [], hasMore: false };
  return (
    <_CharitMeShell
      {...props}
      sidebarCampaigns={campaigns}
      sidebarCampaignsHasMore={hasMore}
      userName={user.name ?? user.email}
      userEmail={user.email}
      userRole={user.role}
      userAvatarUrl={user.avatarUrl}
      hasAdminAccess={user.hasAdminAccess}
    />
  );
}

// ─────────────────────────────────────────────
// Async PageScaffold — same override behaviour.
// Used by admin pages that call PageScaffold directly.
// ─────────────────────────────────────────────
type PageScaffoldProps = {
  active: string;
  title: string;
  subtitle: string;
  metrics: Metric[];
  rows: TableRow[];
  tabs?: string[];
  side?: boolean;
  mode?: 'dashboard' | 'admin';
  children?: React.ReactNode;
};

export async function PageScaffold(props: PageScaffoldProps) {
  const user = await fetchShellUser();
  return (
    <_PageScaffold
      {...props}
      userName={user.name ?? user.email}
      userEmail={user.email}
    />
  );
}
