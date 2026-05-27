import Link from 'next/link';
import { KindFundShell, TopBar, MetricGrid, Avatar, KFIcon } from '../../../components/KindFundShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

const PAGE_TIME = Date.now();

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Campaign = {
  id: string;
  title: string;
};

type TeamMember = {
  id: string;
  campaign_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtDate(iso: string): string {
  const ms = new Date(iso).getTime();
  const diff = Math.floor((PAGE_TIME - ms) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type RoleColor = 'violet' | 'blue' | 'green' | 'orange';
const ROLE_COLOR: Record<string, RoleColor> = {
  owner: 'violet',
  admin: 'blue',
  member: 'green',
  viewer: 'orange',
};

// ─────────────────────────────────────────────
// Data fetch
// ─────────────────────────────────────────────
async function fetchData(userId: string): Promise<{
  campaigns: Campaign[];
  members: TeamMember[];
  profiles: Profile[];
}> {
  try {
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id,title')
      .eq('user_id', userId);

    const cids = ((campaigns ?? []) as Campaign[]).map((c) => c.id);
    if (cids.length === 0) {
      return { campaigns: [], members: [], profiles: [] };
    }

    const { data: members } = await supabaseAdmin
      .from('team_members')
      .select('id,campaign_id,user_id,role,created_at')
      .in('campaign_id', cids)
      .order('created_at', { ascending: false });

    const memberList = (members ?? []) as TeamMember[];
    const memberUserIds = [...new Set(memberList.map((m) => m.user_id))];

    let profiles: Profile[] = [];
    if (memberUserIds.length > 0) {
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('id,full_name')
        .in('id', memberUserIds);
      profiles = (profileData ?? []) as Profile[];
    }

    return {
      campaigns: (campaigns ?? []) as Campaign[],
      members: memberList,
      profiles,
    };
  } catch {
    return { campaigns: [], members: [], profiles: [] };
  }
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const { campaigns, members, profiles } = await fetchData(user.id);

  const profileMap = new Map(profiles.map((p) => [p.id, p.full_name ?? 'Unknown']));
  const campaignMap = new Map(campaigns.map((c) => [c.id, c.title]));

  const activeTab = String(params.tab ?? 'all').toLowerCase();

  const totalMembers = members.length;
  const adminsCount = members.filter((m) => m.role === 'admin').length;
  const membersCount = members.filter((m) => m.role === 'member').length;
  const viewersCount = members.filter((m) => m.role === 'viewer').length;

  const metrics = [
    { label: 'Total Members', value: String(totalMembers), icon: 'users', tone: 'violet' as const },
    { label: 'Admins', value: String(adminsCount), icon: 'crown', tone: 'blue' as const },
    { label: 'Members', value: String(membersCount), icon: 'team', tone: 'green' as const },
    { label: 'Viewers', value: String(viewersCount), icon: 'chart', tone: 'orange' as const },
  ];

  const tabDefs = [
    { key: 'all', label: 'All Members', count: totalMembers },
    { key: 'admin', label: 'Admins', count: adminsCount },
    { key: 'member', label: 'Members', count: membersCount },
    { key: 'viewer', label: 'Viewers', count: viewersCount },
  ];

  const filtered =
    activeTab === 'all' ? members : members.filter((m) => m.role === activeTab);

  return (
    <KindFundShell active="Team">
      <TopBar
        title="Team"
        subtitle="Manage your team members and permissions."
        actions={
          <button className="kf-primary">
            <KFIcon name="plus" /> Invite Member
          </button>
        }
      />
      <div className="kf-content-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="kf-content-main">
          <MetricGrid metrics={metrics} />

          <section className="kf-card" style={{ overflow: 'hidden' }}>
            <div className="kf-card-head">
              <h2>Team Members</h2>
              <div className="kf-card-tools">
                <button>Sort by: Newest First</button>
              </div>
            </div>

            {/* Tabs */}
            <div className="kf-tabs">
              {tabDefs.map(({ key, label, count }) => (
                <Link
                  key={key}
                  href={`?tab=${key}`}
                  className={activeTab === key ? 'active' : ''}
                  style={{ textDecoration: 'none' }}
                >
                  {label}
                  {count > 0 && (
                    <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 600, opacity: 0.65 }}>
                      ({count})
                    </span>
                  )}
                </Link>
              ))}
            </div>

            {/* Column headers */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '48px 1fr 160px 120px 120px 100px',
                gap: 12,
                padding: '8px 20px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--t3)',
                borderBottom: '1px solid var(--b1)',
              }}
            >
              <span />
              <span>Member</span>
              <span>Campaign</span>
              <span>Role</span>
              <span>Joined</span>
              <span />
            </div>

            {/* Rows */}
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  color: 'var(--t3)',
                }}
              >
                <KFIcon name="team" />
                <p style={{ marginTop: 12, fontWeight: 600, color: 'var(--t2)' }}>
                  {totalMembers === 0
                    ? 'Invite team members to collaborate on your campaigns.'
                    : `No ${activeTab} members.`}
                </p>
              </div>
            ) : (
              <div className="kf-rows">
                {filtered.map((m) => {
                  const name = profileMap.get(m.user_id) ?? 'Unknown';
                  const campaignTitle = campaignMap.get(m.campaign_id) ?? 'Unknown campaign';
                  const roleColor = ROLE_COLOR[m.role] ?? 'violet';
                  return (
                    <div
                      key={m.id}
                      className="kf-row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '48px 1fr 160px 120px 120px 100px',
                        gap: 12,
                        alignItems: 'center',
                      }}
                    >
                      <Avatar name={name} />
                      <div className="kf-row-main">
                        <strong style={{ fontSize: 14 }}>{name}</strong>
                        <p
                          style={{
                            fontSize: 12,
                            color: 'var(--t3)',
                            margin: '2px 0 0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {campaignTitle}
                        </p>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--t3)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {campaignTitle}
                      </div>
                      <div>
                        <span className={`kf-pill ${roleColor}`} style={{ fontSize: 11 }}>
                          {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                        {fmtDate(m.created_at)}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--t3)',
                            background: 'none',
                            border: '1px solid var(--b2)',
                            borderRadius: 'var(--r)',
                            padding: '4px 10px',
                            cursor: 'pointer',
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filtered.length > 0 && (
              <div
                className="kf-table-footer"
                style={{ padding: '12px 20px', fontSize: 13, color: 'var(--t3)' }}
              >
                Showing {filtered.length} of {totalMembers} members
              </div>
            )}
          </section>
        </div>
      </div>
    </KindFundShell>
  );
}
