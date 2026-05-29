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
} from './CharitMeApp';

// ─────────────────────────────────────────────
// User fetch helper
// ─────────────────────────────────────────────
type ShellUser = {
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
    if (!user) return { name: null, email: '', role: 'Organizer', avatarUrl: null, hasAdminAccess: false };

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

    return {
      name: profile?.full_name ?? null,
      email: user.email ?? '',
      role,
      avatarUrl: profile?.avatar_url ?? null,
      hasAdminAccess,
    };
  } catch {
    return { name: null, email: '', role: 'Organizer', avatarUrl: null, hasAdminAccess: false };
  }
}

// ─────────────────────────────────────────────
// Async CharitMeShell — always uses live session
// data for user identity; ignores any user props
// that individual pages may have hard-coded.
// ─────────────────────────────────────────────
export async function CharitMeShell(props: ShellProps) {
  const user = await fetchShellUser();
  return (
    <_CharitMeShell
      {...props}
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
