import 'server-only';
import { KindFundShell, TopBar } from '../../../components/KindFundShellServer';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import AdminUsersClient, {
  type AdminUser,
  type AdminUserActivity,
  type UserRoleSummary,
} from './_components/AdminUsersClient';

export const dynamic = 'force-dynamic';

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
  updated_at: string;
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

function parseRoleList(roles: unknown): string[] {
  return Array.isArray(roles) ? roles.map(String) : ['donor'];
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
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
}

export default async function AdminUsersPage() {
  await requireAdmin();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    { data: profiles, count: totalCount },
    { count: newUsersCount },
    { data: campaigns },
    { data: donations },
  ] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, avatar_url, roles, identity_verified, plan, timezone, currency, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(500),
    supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString()),
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

  for (const campaign of campaignRows) {
    campaignByUser.set(campaign.user_id, [...(campaignByUser.get(campaign.user_id) ?? []), campaign]);
  }
  for (const donation of donationRows) {
    if (!donation.donor_id) continue;
    donationByUser.set(donation.donor_id, [...(donationByUser.get(donation.donor_id) ?? []), donation]);
  }

  const users: AdminUser[] = ((profiles ?? []) as ProfileRow[]).map((profile) => {
    const roles = parseRoleList(profile.roles);
    const userCampaigns = campaignByUser.get(profile.id) ?? [];
    const userDonations = donationByUser.get(profile.id) ?? [];
    const donationTotal = userDonations.reduce((sum, donation) => sum + donation.amount_cents, 0);
    const campaignTotal = userCampaigns.reduce((sum, campaign) => sum + campaign.raised_amount, 0);

    return {
      id: profile.id,
      name: profile.full_name ?? 'Unnamed User',
      email: profile.email ?? '',
      avatarUrl: profile.avatar_url,
      roles,
      role: primaryRole(roles),
      status: userStatus(roles),
      plan: profile.plan ?? 'free',
      identityVerified: Boolean(profile.identity_verified),
      timezone: profile.timezone ?? 'America/New_York',
      currency: profile.currency ?? 'usd',
      joinedAt: profile.created_at,
      updatedAt: profile.updated_at,
      campaignsCount: userCampaigns.length,
      donationsCount: userDonations.length,
      totalRaisedCents: campaignTotal,
      totalDonatedCents: donationTotal,
      lastActivityAt: [profile.updated_at, userCampaigns[0]?.created_at, userDonations[0]?.created_at].filter(Boolean).sort().reverse()[0] ?? profile.created_at,
    };
  });

  const activities: AdminUserActivity[] = [];
  for (const campaign of campaignRows.slice(0, 80)) {
    const user = users.find((item) => item.id === campaign.user_id);
    activities.push({
      id: `campaign-${campaign.id}`,
      userId: campaign.user_id,
      userName: user?.name ?? 'Unknown user',
      type: 'Campaign',
      title: `Campaign ${campaign.status}`,
      detail: campaign.title,
      amount: fmtMoney(campaign.raised_amount),
      createdAt: campaign.created_at,
    });
  }
  for (const donation of donationRows.slice(0, 80)) {
    if (!donation.donor_id) continue;
    const user = users.find((item) => item.id === donation.donor_id);
    activities.push({
      id: `donation-${donation.id}`,
      userId: donation.donor_id,
      userName: user?.name ?? 'Anonymous donor',
      type: 'Donation',
      title: `Donation ${donation.status}`,
      detail: 'Donation activity recorded',
      amount: fmtMoney(donation.amount_cents),
      createdAt: donation.created_at,
    });
  }
  activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const roleSummaries: UserRoleSummary[] = [
    { role: 'Super Admin', key: 'admin', description: 'Full access to platform settings, users, content, and system tools.', count: users.filter((u) => u.roles.includes('admin')).length, system: true },
    { role: 'Organizer', key: 'organizer', description: 'Create and manage campaigns, updates, teams, payouts, and donor engagement.', count: users.filter((u) => u.roles.includes('organizer')).length, system: false },
    { role: 'Nonprofit', key: 'nonprofit', description: 'Manage nonprofit campaigns, forms, donor CRM, teams, and reports.', count: users.filter((u) => u.roles.includes('nonprofit')).length, system: false },
    { role: 'Donor', key: 'donor', description: 'Donate, follow campaigns, manage receipts, and maintain a profile.', count: users.filter((u) => u.roles.includes('donor')).length, system: true },
  ];

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
          total: totalCount ?? users.length,
          newUsers: newUsersCount ?? 0,
          active: users.filter((u) => u.status === 'Active').length,
          suspended: users.filter((u) => u.status === 'Suspended').length,
        }}
      />
    </KindFundShell>
  );
}
