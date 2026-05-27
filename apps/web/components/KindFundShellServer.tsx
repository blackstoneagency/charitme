import 'server-only';
import { createClient } from '../lib/supabase-server';
import { supabaseAdmin } from '../lib/supabase';
import {
  KindFundShell as _KindFundShell,
  PageScaffold as _PageScaffold,
  type ShellProps,
  type Metric,
  type TableRow,
} from './KindFundApp';

// ─────────────────────────────────────────────
// Re-export everything from KindFundApp verbatim.
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
} from './KindFundApp';

// ─────────────────────────────────────────────
// User fetch helper
// ─────────────────────────────────────────────
type ShellUser = {
  name: string | null;
  email: string;
  role: string;
  avatarUrl: string | null;
};

async function fetchShellUser(): Promise<ShellUser> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { name: null, email: '', role: 'Organizer', avatarUrl: null };

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, avatar_url, roles')
      .eq('id', user.id)
      .single();

    const roles: string[] = Array.isArray(profile?.roles) ? profile.roles : [];
    const role = roles.includes('admin') ? 'Admin'
      : roles.includes('moderator') ? 'Moderator'
      : 'Organizer';

    return {
      name: profile?.full_name ?? null,
      email: user.email ?? '',
      role,
      avatarUrl: profile?.avatar_url ?? null,
    };
  } catch {
    return { name: null, email: '', role: 'Organizer', avatarUrl: null };
  }
}

// ─────────────────────────────────────────────
// Async KindFundShell — always uses live session
// data for user identity; ignores any user props
// that individual pages may have hard-coded.
// ─────────────────────────────────────────────
export async function KindFundShell(props: ShellProps) {
  const user = await fetchShellUser();
  return (
    <_KindFundShell
      {...props}
      userName={user.name ?? user.email}
      userEmail={user.email}
      userRole={user.role}
      userAvatarUrl={user.avatarUrl}
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
