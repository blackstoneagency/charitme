import 'server-only';
import { PageScaffold, type TableRow, type Metric } from '../../../components/KindFundShellServer';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function deriveRole(roles: unknown): string {
  const arr: string[] = Array.isArray(roles) ? (roles as string[]) : [];
  if (arr.includes('admin')) return 'Admin';
  if (arr.includes('moderator')) return 'Moderator';
  return 'Organizer';
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function AdminUsersPage() {
  await requireAdmin();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

  const [
    { data: allUsers, count: totalCount },
    { count: newUsersCount },
    { count: verifiedCount },
    { data: withCampaigns },
  ] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, roles, created_at, plan, identity_verified', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgoStr),
    supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('identity_verified', true),
    supabaseAdmin
      .from('campaigns')
      .select('user_id')
      .not('user_id', 'is', null),
  ]);

  // Count distinct organizers (users who have campaigns)
  const organizerIds = new Set(
    (withCampaigns ?? []).map((c: { user_id: string }) => c.user_id),
  ).size;

  type UserRow = {
    id: string;
    full_name: string | null;
    email: string | null;
    roles: unknown;
    created_at: string;
    plan: string | null;
    identity_verified: boolean | null;
  };

  const rows: TableRow[] = (allUsers ?? []).map((u: unknown) => {
    const user = u as UserRow;
    const role = deriveRole(user.roles);
    return {
      title: user.full_name ?? 'Unnamed User',
      subtitle: user.email ?? '',
      status: role,
      amount: user.plan ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1) : 'Free',
      meta: [
        `Joined ${fmtDate(user.created_at)}`,
        user.identity_verified ? 'Verified' : 'Unverified',
      ],
    };
  });

  const metrics: Metric[] = [
    {
      label: 'Total Users',
      value: (totalCount ?? 0).toLocaleString(),
      change: 'all accounts',
      icon: 'users',
      tone: 'violet',
    },
    {
      label: 'New (30 days)',
      value: (newUsersCount ?? 0).toLocaleString(),
      change: 'recent sign-ups',
      icon: 'team',
      tone: 'green',
    },
    {
      label: 'Organizers',
      value: organizerIds.toLocaleString(),
      change: 'with campaigns',
      icon: 'check',
      tone: 'blue',
    },
    {
      label: 'Verified',
      value: (verifiedCount ?? 0).toLocaleString(),
      change: 'identity verified',
      icon: 'audit',
      tone: 'orange',
    },
  ];

  return (
    <PageScaffold
      mode="admin"
      active="Users"
      title="Users"
      subtitle="Manage platform users, roles, permissions, and account status."
      metrics={metrics}
      rows={rows}
      tabs={[
        `All (${totalCount ?? 0})`,
        `New (${newUsersCount ?? 0})`,
        `Organizers (${organizerIds})`,
        `Verified (${verifiedCount ?? 0})`,
      ]}
    />
  );
}
