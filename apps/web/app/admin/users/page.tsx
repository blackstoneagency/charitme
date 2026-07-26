import 'server-only';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../lib/auth';
import { parseRoles } from '../../../lib/roles';
import { supabaseAdmin } from '../../../lib/supabase';
import AdminUsersClient, {
  type AdminUser,
  type AdminUserActivity,
  type UserRoleSummary,
  type GrowthPoint,
} from './_components/AdminUsersClient';

export const dynamic = 'force-dynamic';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  roles: unknown;            // jsonb — could be array, string, or null
  status: string | null;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse roles jsonb → string[].  Handles arrays, stringified arrays, plain strings. */
/**
 * Every string stored in `profiles.roles`, unfiltered.
 *
 * This is NOT role parsing — use the shared `parseRoles` from lib/roles for that,
 * which whitelists against ASSIGNABLE_ROLES. This exists only because
 * `deriveStatus` below still reads legacy 'suspended'/'inactive' markers out of
 * the roles array, and the shared whitelist strips them. Previously this function
 * was *named* `parseRoles` and shadowed the shared one, so the same profile could
 * resolve to different roles depending on which file read it: given the JSON
 * string '["admin"]' this returned ['admin'] while the shared version returned
 * ['donor'], meaning such a user rendered as Admin in the console while isAdmin()
 * denied them.
 *
 * Status should move to `profiles.status` (which `deriveStatus` already prefers),
 * at which point this can go.
 */
function rawRoleStrings(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
      return [raw];
    } catch {
      return [raw];
    }
  }
  return ['donor'];
}

/** First display-friendly role from the roles array. */
function primaryRole(roles: string[]): string {
  if (roles.includes('admin'))       return 'Admin';
  if (roles.includes('nonprofit'))   return 'Nonprofit';
  if (roles.includes('organizer'))   return 'Organizer';
  if (roles.includes('beneficiary')) return 'Beneficiary';
  if (roles.includes('user'))        return 'User';
  return 'Donor';
}

/** Derive status from roles array (suspended/inactive override) or profile.status column. */
function deriveStatus(roles: string[], profileStatus: string | null): AdminUser['status'] {
  if (roles.includes('suspended'))   return 'Suspended';
  if (roles.includes('inactive'))    return 'Inactive';
  if (profileStatus === 'suspended') return 'Suspended';
  if (profileStatus === 'inactive')  return 'Inactive';
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
    const end   = new Date(now);
    end.setDate(end.getDate() - weekOffset * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    const count = createdAts.filter(ts => {
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

  // ── 1. PRIMARY SOURCE: public.profiles ───────────────────────────────────
  //    Fetch in parallel: exact total count + paginated rows (up to 2000).
  //    PostgREST default cap is 1000 rows per query — we must use a separate
  //    count query to get the real total (e.g. 1,005 not 1,000).
  const _thirtyDaysAgo = new Date();
  _thirtyDaysAgo.setDate(_thirtyDaysAgo.getDate() - 30);
  const thirtyDaysIso = _thirtyDaysAgo.toISOString();
  const [profileDataResult, countResult, newUsersCountResult] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, avatar_url, roles, identity_verified, plan, timezone, currency, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(2000),
    // Exact total — never capped
    supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true }),
    // New users in last 30 days — exact count
    supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysIso),
  ]);

  const profileError  = profileDataResult.error;
  const profileData   = profileDataResult.data;
  const exactTotal    = countResult.count ?? 0;       // real total — never capped at 1000
  const exactNew30d   = newUsersCountResult.count ?? 0; // new in last 30 days

  if (profileError) {
    console.error('[AdminUsersPage] profiles query error:', profileError.code, profileError.message);
  }

  const profiles = (profileData ?? []) as ProfileRow[];

  // ── 2. SUPPLEMENTAL: campaigns & donations for stats ─────────────────────
  //    Wrapped in try/catch — page works even if these tables are empty.
  let campaignRows: CampaignRow[] = [];
  let donationRows: DonationRow[] = [];

  try {
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
    campaignRows = (campaigns ?? []) as CampaignRow[];
    donationRows = (donations ?? []) as DonationRow[];
  } catch (e) {
    console.warn('[AdminUsersPage] campaigns/donations fetch failed (non-fatal):', e);
  }

  const campaignByUser = new Map<string, CampaignRow[]>();
  const donationByUser = new Map<string, DonationRow[]>();
  for (const c of campaignRows) {
    campaignByUser.set(c.user_id, [...(campaignByUser.get(c.user_id) ?? []), c]);
  }
  for (const d of donationRows) {
    if (!d.donor_id) continue;
    donationByUser.set(d.donor_id, [...(donationByUser.get(d.donor_id) ?? []), d]);
  }

  // ── 3. Build AdminUser records directly from profiles ────────────────────
  const users: AdminUser[] = profiles.map((profile) => {
    // Roles go through the SHARED whitelist so badges and filters agree with
    // isAdmin(); status still reads the raw strings for the legacy markers.
    const roles         = parseRoles(profile.roles);
    const status        = deriveStatus(rawRoleStrings(profile.roles), profile.status ?? null);
    const userCampaigns = campaignByUser.get(profile.id) ?? [];
    const userDonations = donationByUser.get(profile.id) ?? [];
    const updatedAt     = profile.updated_at ?? profile.created_at;

    return {
      id:               profile.id,
      name:             profile.full_name || profile.email?.split('@')[0] || 'User',
      email:            profile.email || '',
      avatarUrl:        profile.avatar_url ?? null,
      roles,
      role:             primaryRole(roles),
      status,
      plan:             profile.plan ?? 'free',
      identityVerified: Boolean(profile.identity_verified),
      timezone:         profile.timezone ?? 'America/New_York',
      currency:         (profile.currency ?? 'usd').toUpperCase(),
      joinedAt:         profile.created_at,
      updatedAt,
      campaignsCount:   userCampaigns.length,
      donationsCount:   userDonations.length,
      totalRaisedCents: userCampaigns.reduce((s, c) => s + (c.raised_amount ?? 0), 0),
      totalDonatedCents:userDonations.reduce((s, d) => s + (d.amount_cents ?? 0), 0),
      lastActivityAt:
        [updatedAt, userCampaigns[0]?.created_at, userDonations[0]?.created_at]
          .filter(Boolean)
          .sort()
          .reverse()[0] ?? profile.created_at,
    };
  });


  // ── 4. Metrics ────────────────────────────────────────────────────────────
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const totals = {
    total:     exactTotal > 0 ? exactTotal : users.length, // exact from DB count query
    active:    users.filter(u => u.status === 'Active').length, // from fetched rows (good enough for ≤2000)
    newUsers:  exactNew30d > 0 ? exactNew30d : users.filter(u => new Date(u.joinedAt) >= thirtyDaysAgo).length,
    suspended: users.filter(u => u.status === 'Suspended').length,
  };

  // ── 5. Activity feed ──────────────────────────────────────────────────────
  const activities: AdminUserActivity[] = [];
  for (const c of campaignRows.slice(0, 80)) {
    const user = users.find(u => u.id === c.user_id);
    activities.push({
      id:        `campaign-${c.id}`,
      userId:    c.user_id,
      userName:  user?.name ?? 'Unknown',
      type:      'Campaign',
      title:     `Campaign ${c.status}`,
      detail:    c.title,
      amount:    fmtMoney(c.raised_amount),
      createdAt: c.created_at,
    });
  }
  for (const d of donationRows.slice(0, 80)) {
    if (!d.donor_id) continue;
    const user = users.find(u => u.id === d.donor_id);
    activities.push({
      id:        `donation-${d.id}`,
      userId:    d.donor_id,
      userName:  user?.name ?? 'Anonymous',
      type:      'Donation',
      title:     `Donation ${d.status}`,
      detail:    'Donation recorded',
      amount:    fmtMoney(d.amount_cents),
      createdAt: d.created_at,
    });
  }
  activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // ── 6. Role summaries ─────────────────────────────────────────────────────
  const roleSummaries: UserRoleSummary[] = [
    { role: 'Super Admin', key: 'admin',       description: 'Full platform access.',         count: users.filter(u => u.roles.includes('admin')).length,       system: true  },
    { role: 'Organizer',   key: 'organizer',   description: 'Create and manage campaigns.',  count: users.filter(u => u.roles.includes('organizer')).length,   system: false },
    { role: 'Nonprofit',   key: 'nonprofit',   description: 'Manage nonprofit campaigns.',   count: users.filter(u => u.roles.includes('nonprofit')).length,   system: false },
    { role: 'Donor',       key: 'donor',       description: 'Donate and manage profile.',    count: users.filter(u => u.roles.includes('donor')).length,       system: true  },
    { role: 'User',        key: 'user',        description: 'Standard platform user.',       count: users.filter(u => u.roles.includes('user')).length,        system: true  },
  ];

  const weeklyGrowth  = buildWeeklyGrowth(users.map(u => u.joinedAt));
  const recentUsers   = [...users]
    .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
    .slice(0, 5);

  return (
    <CharitMeShell active="Users" mode="admin">
      <TopBar
        title="Users"
        subtitle={`${(exactTotal > 0 ? exactTotal : users.length).toLocaleString()} total users · public.profiles`}
        actions={<></>}
      />
      <AdminUsersClient
        users={users}
        activities={activities}
        roles={roleSummaries}
        totals={totals}
        weeklyGrowth={weeklyGrowth}
        recentUsers={recentUsers}
      />
    </CharitMeShell>
  );
}
