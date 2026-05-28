import 'server-only';
import { KindFundShell, TopBar } from '../../../components/KindFundShellServer';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import AdminUsersClient, {
  type AdminUser,
  type AdminUserActivity,
  type UserRoleSummary,
  type GrowthPoint,
} from './_components/AdminUsersClient';

export const dynamic = 'force-dynamic';

// ─── Row types ────────────────────────────────────────────────────────────────

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  roles: unknown;
  identity_verified: boolean | null;
  plan: string | null;
  timezone: string | null;
  currency: string | null;
  created_at: string;
  updated_at: string | null;
};

type CampaignRow = {
  id: string;
  user_id: string;
  title: string;
  status: string;
  raised_amount: number;
  backer_count: number;
  created_at: string;
};

type DonationRow = {
  id: string;
  donor_id: string | null;
  amount_cents: number;
  status: string;
  created_at: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseRoleList(roles: unknown): string[] {
  if (Array.isArray(roles)) return roles.map(String).filter(Boolean);
  if (typeof roles === 'string') {
    try { return JSON.parse(roles) as string[]; } catch { return [roles]; }
  }
  return ['donor'];
}

function primaryRole(roles: string[]): string {
  if (roles.includes('admin')) return 'Admin';
  if (roles.includes('nonprofit')) return 'Nonprofit';
  if (roles.includes('organizer')) return 'Organizer';
  if (roles.includes('beneficiary')) return 'Beneficiary';
  return 'Donor';
}

function userStatus(roles: string[]): AdminUser['status'] {
  if (roles.includes('suspended')) return 'Suspended';
  if (roles.includes('inactive')) return 'Inactive';
  return 'Active';
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(cents / 100);
}

function buildWeeklyGrowth(createdAts: string[]): GrowthPoint[] {
  const now = new Date();
  return Array.from({ length: 8 }, (_, weekOffset) => {
    const end = new Date(now);
    end.setDate(end.getDate() - weekOffset * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    const count = createdAts.filter((ts) => {
      const d = new Date(ts);
      return d >= start && d < end;
    }).length;
    return {
      label: end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count,
    };
  }).reverse();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminUsersPage() {
  await requireAdmin();

  // ── 1. Fetch ALL auth users (source of truth) ─────────────────────────────
  const { data: authData, error: authListError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (authListError) {
    console.error('[AdminUsersPage] listUsers error:', authListError.message);
  }

  const authUsers = authData?.users ?? [];
  const authIds = authUsers.map((u) => u.id);

  // ── 2. Fetch existing profiles ────────────────────────────────────────────
  const profileMap = new Map<string, ProfileRow>();

  if (authIds.length > 0) {
    const { data: existingProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, avatar_url, roles, identity_verified, plan, timezone, currency, created_at, updated_at')
      .in('id', authIds);

    for (const p of (existingProfiles ?? []) as ProfileRow[]) {
      profileMap.set(p.id, p);
    }
  }

  // ── 3. Auto-create missing profiles so all auth users are editable ────────
  const missingAuthUsers = authUsers.filter((u) => !profileMap.has(u.id));
  if (missingAuthUsers.length > 0) {
    const rows = missingAuthUsers.map((u) => {
      const metaName = u.user_metadata?.full_name as string | null | undefined;
      const derivedName = metaName?.trim() || u.email?.split('@')[0] || 'User';
      const metaRoles = Array.isArray(u.user_metadata?.roles)
        ? (u.user_metadata.roles as string[])
        : ['donor'];
      return {
        id: u.id,
        email: u.email ?? '',
        full_name: derivedName,
        roles: metaRoles,
        identity_verified: Boolean(u.email_confirmed_at),
        plan: 'free',
        timezone: 'America/New_York',
        currency: 'usd',
        created_at: u.created_at,
        updated_at: u.updated_at ?? u.created_at,
      };
    });

    const { data: created } = await supabaseAdmin
      .from('profiles')
      .upsert(rows, { onConflict: 'id' })
      .select('id, full_name, email, avatar_url, roles, identity_verified, plan, timezone, currency, created_at, updated_at');

    for (const p of (created ?? []) as ProfileRow[]) {
      profileMap.set(p.id, p);
    }

    // If upsert returned nothing (can happen with RLS), build minimal entries
    for (const row of rows) {
      if (!profileMap.has(row.id)) {
        profileMap.set(row.id, {
          id: row.id,
          email: row.email,
          full_name: row.full_name,
          avatar_url: null,
          roles: row.roles,
          identity_verified: row.identity_verified,
          plan: row.plan,
          timezone: row.timezone,
          currency: row.currency,
          created_at: row.created_at,
          updated_at: row.updated_at,
        });
      }
    }
  }

  // ── 4. Campaigns & donations (stats) ─────────────────────────────────────
  const [{ data: campaigns }, { data: donations }] = await Promise.all([
    supabaseAdmin
      .from('campaigns')
      .select('id, user_id, title, status, raised_amount, backer_count, created_at')
      .order('created_at', { ascending: false })
      .limit(1000),
    supabaseAdmin
      .from('donations')
      .select('id, donor_id, amount_cents, status, created_at')
      .order('created_at', { ascending: false })
      .limit(1000),
  ]);

  const campaignRows = (campaigns ?? []) as CampaignRow[];
  const donationRows = (donations ?? []) as DonationRow[];

  const campaignByUser = new Map<string, CampaignRow[]>();
  const donationByUser = new Map<string, DonationRow[]>();

  for (const c of campaignRows) {
    campaignByUser.set(c.user_id, [...(campaignByUser.get(c.user_id) ?? []), c]);
  }
  for (const d of donationRows) {
    if (!d.donor_id) continue;
    donationByUser.set(d.donor_id, [...(donationByUser.get(d.donor_id) ?? []), d]);
  }

  // ── 5. Build AdminUser records (auth-first merge) ─────────────────────────
  const users: AdminUser[] = authUsers.map((authUser) => {
    const profile = profileMap.get(authUser.id);

    // Email: profile wins, then auth
    const email = profile?.email || authUser.email || '';

    // Name: profile wins, then auth metadata, then email-based fallback
    const metaName = authUser.user_metadata?.full_name as string | null | undefined;
    const fullName = profile?.full_name || metaName?.trim() || email.split('@')[0] || 'Unnamed User';

    // Roles: profile wins, then auth metadata
    const rawRoles = profile?.roles ?? authUser.user_metadata?.roles;
    const roles = parseRoleList(rawRoles);

    const createdAt = profile?.created_at ?? authUser.created_at;
    const updatedAt = profile?.updated_at ?? authUser.updated_at ?? createdAt;

    const userCampaigns = campaignByUser.get(authUser.id) ?? [];
    const userDonations = donationByUser.get(authUser.id) ?? [];

    return {
      id: authUser.id,
      name: fullName,
      email,
      avatarUrl: profile?.avatar_url ?? null,
      roles,
      role: primaryRole(roles),
      status: userStatus(roles),
      plan: profile?.plan ?? 'free',
      identityVerified: Boolean(profile?.identity_verified ?? authUser.email_confirmed_at),
      timezone: profile?.timezone ?? 'America/New_York',
      currency: (profile?.currency ?? 'usd').toUpperCase(),
      joinedAt: createdAt,
      updatedAt,
      campaignsCount: userCampaigns.length,
      donationsCount: userDonations.length,
      totalRaisedCents: userCampaigns.reduce((s, c) => s + (c.raised_amount ?? 0), 0),
      totalDonatedCents: userDonations.reduce((s, d) => s + (d.amount_cents ?? 0), 0),
      lastActivityAt:
        [updatedAt, userCampaigns[0]?.created_at, userDonations[0]?.created_at]
          .filter(Boolean)
          .sort()
          .reverse()[0] ?? createdAt,
    };
  });

  // ── 6. Counts ─────────────────────────────────────────────────────────────
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const totalCount = (authData as { total?: number } | null)?.total ?? users.length;
  const newUsersCount = users.filter(
    (u) => new Date(u.joinedAt) >= thirtyDaysAgo,
  ).length;

  // ── 7. Activities ─────────────────────────────────────────────────────────
  const activities: AdminUserActivity[] = [];
  for (const c of campaignRows.slice(0, 80)) {
    const user = users.find((u) => u.id === c.user_id);
    activities.push({
      id: `campaign-${c.id}`,
      userId: c.user_id,
      userName: user?.name ?? 'Unknown',
      type: 'Campaign',
      title: `Campaign ${c.status}`,
      detail: c.title,
      amount: fmtMoney(c.raised_amount),
      createdAt: c.created_at,
    });
  }
  for (const d of donationRows.slice(0, 80)) {
    if (!d.donor_id) continue;
    const user = users.find((u) => u.id === d.donor_id);
    activities.push({
      id: `donation-${d.id}`,
      userId: d.donor_id,
      userName: user?.name ?? 'Anonymous',
      type: 'Donation',
      title: `Donation ${d.status}`,
      detail: 'Donation recorded',
      amount: fmtMoney(d.amount_cents),
      createdAt: d.created_at,
    });
  }
  activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // ── 8. Role summaries ─────────────────────────────────────────────────────
  const roleSummaries: UserRoleSummary[] = [
    { role: 'Super Admin', key: 'admin', description: 'Full platform access.', count: users.filter((u) => u.roles.includes('admin')).length, system: true },
    { role: 'Organizer', key: 'organizer', description: 'Create and manage campaigns.', count: users.filter((u) => u.roles.includes('organizer')).length, system: false },
    { role: 'Nonprofit', key: 'nonprofit', description: 'Manage nonprofit campaigns.', count: users.filter((u) => u.roles.includes('nonprofit')).length, system: false },
    { role: 'Donor', key: 'donor', description: 'Donate and manage profile.', count: users.filter((u) => u.roles.includes('donor')).length, system: true },
  ];

  const weeklyGrowth = buildWeeklyGrowth(users.map((u) => u.joinedAt));
  const recentUsers = [...users].sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()).slice(0, 5);

  return (
    <KindFundShell active="Users" mode="admin">
      <TopBar
        title="Users"
        subtitle="Manage platform users, roles, permissions, and account status."
        actions={<></>}
      />
      <AdminUsersClient
        users={users}
        activities={activities}
        roles={roleSummaries}
        totals={{
          total: totalCount,
          newUsers: newUsersCount,
          active: users.filter((u) => u.status === 'Active').length,
          suspended: users.filter((u) => u.status === 'Suspended').length,
        }}
        weeklyGrowth={weeklyGrowth}
        recentUsers={recentUsers}
      />
    </KindFundShell>
  );
}
