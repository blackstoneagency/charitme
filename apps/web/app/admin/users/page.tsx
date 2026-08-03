import { boundedQuery } from '../../../lib/query-timeout';
import 'server-only';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../lib/auth';
import { parseRoles } from '../../../lib/roles';
import { ROLE_DEFINITIONS, ROLE_ORDER } from '../../../lib/role-capabilities';
import DegradedReadNotice from '../../../components/DegradedReadNotice';
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

/**
 * Display label for the highest-privilege role held, via the shared catalog.
 *
 * The hand-rolled version this replaces had two defects. It had **no
 * `super_admin` case**, so an account granted only `super_admin` — which the
 * super-admin roles console can do, and which `isSuperAdmin()` alone honours —
 * rendered in the user list as **"Donor"**, the exact inverse of its power. (Not
 * yet live: today's single super admin also holds `admin`, so it resolved to
 * "Admin" by luck.) It also ranked `nonprofit` above `organizer` and offered a
 * phantom `'user'` label that is not in ASSIGNABLE_ROLES.
 */
function primaryRole(roles: string[]): string {
  for (let i = ROLE_ORDER.length - 1; i >= 0; i--) {
    const role = ROLE_ORDER[i];
    if (roles.includes(role)) return ROLE_DEFINITIONS[role].label;
  }
  return ROLE_DEFINITIONS.donor.label;
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
    boundedQuery(() => supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, avatar_url, roles, identity_verified, plan, timezone, currency, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(2000)),
    // Exact total — never capped
    boundedQuery(() => supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })),
    // New users in last 30 days — exact count
    boundedQuery(() => supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysIso)),
  ]);

  const profileError  = profileDataResult.error;
  const profileData   = profileDataResult.data;
  // `null` means unread, which is not 0. "Total users 0" on the admin user
  // directory reads as catastrophic data loss during a database incident.
  const totalUnknown  = Boolean(countResult.error) || countResult.count == null;
  const new30dUnknown = Boolean(newUsersCountResult.error) || newUsersCountResult.count == null;
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

  // The count query and the row read are separate failure modes, and a failed
  // COUNT alone is enough to make the total unknown.
  //
  // This used to require both to fail (`&& Boolean(profileError)`), on the
  // reasoning that `users.length` is "a real (page-limited) number". It is real,
  // but it is LABELLED "total users" — and the row query is capped at 2000. So a
  // count failure on a site with more than 2000 profiles would confidently
  // report exactly "2,000 total users", forever, with no notice shown. Latent
  // rather than live today: production holds 1,133 profiles, so the substitution
  // currently happens to equal the true total.
  const totalsUnreliable = totalUnknown || new30dUnknown;

  const totals = {
    // null, not a substitute — an unknown total renders as an em dash.
    total:     totalUnknown ? null : exactTotal,
    active:    users.filter(u => u.status === 'Active').length, // from fetched rows (good enough for ≤2000)
    newUsers:  new30dUnknown ? null : exactNew30d,
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
  // Derived from the shared role catalog (lib/role-capabilities.ts) so it cannot
  // drift from what the roles actually mean. The hand-written list this replaces
  // had drifted badly: it labelled the `admin` row **"Super Admin"** — conflating
  // trust-and-safety staff with the one account that can grant roles and change
  // platform settings — gave `super_admin` and `beneficiary` no row at all, and
  // counted a phantom `'user'` role that is not in ASSIGNABLE_ROLES and so can
  // never be held by anyone (a live census of all 1,133 profiles: donor 1132,
  // organizer 58, admin 5, super_admin 1, everything else 0).
  const roleSummaries: UserRoleSummary[] = ROLE_ORDER.map((role) => {
    const def = ROLE_DEFINITIONS[role];
    return {
      role: def.label,
      key: role,
      description: def.description,
      count: users.filter((u) => u.roles.includes(role)).length,
      // "system" = granted automatically or reserved for staff, i.e. not a label
      // an operator hands out to describe what someone does on the platform.
      system: def.isDefault || def.privileged,
    };
  });

  const weeklyGrowth  = buildWeeklyGrowth(users.map(u => u.joinedAt));
  const recentUsers   = [...users]
    .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
    .slice(0, 5);

  return (
    <CharitMeShell active="Users" mode="admin">
      <TopBar
        title="Users"
        subtitle={
          totalsUnreliable
            ? 'User count unavailable · public.profiles'
            : `${exactTotal.toLocaleString()} total users · public.profiles`
        }
        actions={<></>}
      />
      {totalsUnreliable && (
        <div style={{ padding: '0 4px' }}>
          <DegradedReadNotice title="We couldn't load the user counts">
            The counts below are unknown, not zero — the count query failed. The user list
            itself may still be showing (capped at 2,000 rows), so do not read its length as
            the total. Reload to try again.
          </DegradedReadNotice>
        </div>
      )}
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
