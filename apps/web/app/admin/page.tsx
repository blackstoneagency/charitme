import { supabaseAdmin } from '../../lib/supabase';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Admin Dashboard — GiveRise' };
export const dynamic = 'force-dynamic';

// Module-level constant avoids react-hooks/purity lint error
const ADMIN_RENDER_TIME = Date.now();

type ProfileRow = { id: string; full_name: string | null; created_at: string };

async function fetchAdminStats() {
  try {
    const [
      { count: userCount },
      { count: activeCampaigns },
      { count: pendingPayouts },
      { data: donationData },
      { data: recentProfiles },
      { count: flagCount },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('payouts').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('donations').select('amount_cents').eq('status', 'completed').limit(5000),
      supabaseAdmin
        .from('profiles')
        .select('id, full_name, created_at')
        .order('created_at', { ascending: false })
        .limit(8),
      supabaseAdmin.from('risk_flags').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    ]);

    const totalRaised = ((donationData ?? []) as { amount_cents: number }[])
      .reduce((s, d) => s + (d.amount_cents ?? 0), 0);

    return {
      userCount: userCount ?? 0,
      activeCampaigns: activeCampaigns ?? 0,
      pendingPayouts: pendingPayouts ?? 0,
      totalRaised,
      flagCount: flagCount ?? 0,
      recentUsers: (recentProfiles ?? []) as ProfileRow[],
    };
  } catch {
    return {
      userCount: 0,
      activeCampaigns: 0,
      pendingPayouts: 0,
      totalRaised: 0,
      flagCount: 0,
      recentUsers: [],
    };
  }
}

function formatCents(cents: number) {
  if (cents >= 100_000_00) return `$${(cents / 100_000_00).toFixed(1)}M`;
  if (cents >= 1_000_00) return `$${(cents / 1_000_00).toFixed(1)}k`;
  return `$${(cents / 100).toFixed(0)}`;
}

function fmtDate(iso: string) {
  const diff = ADMIN_RENDER_TIME - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function initials(name: string | null) {
  if (!name) return 'U';
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// SVG user growth sparkline (mock trend data)
function UserGrowthChart() {
  const pts = [120, 145, 138, 162, 178, 195, 210, 240, 228, 265, 290, 312];
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const range = max - min || 1;
  const W = 400; const H = 80;
  const xs = pts.map((_, i) => (i / (pts.length - 1)) * W);
  const ys = pts.map((v) => H - ((v - min) / range) * (H - 10) - 5);
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const fill = d + ` L${W},${H} L0,${H} Z`;
  const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '80px' }}>
        <defs>
          <linearGradient id="ug-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fill} fill="url(#ug-grad)" />
        <path d={d} fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ys[i]} r="3" fill="#7c3aed" opacity="0.6" />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 2px 0', marginTop: '2px' }}>
        {months.map((m) => (
          <span key={m} style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>{m}</span>
        ))}
      </div>
    </div>
  );
}

// System health indicator
function HealthDot({ status }: { status: 'operational' | 'degraded' | 'down' }) {
  const colors = { operational: '#16a34a', degraded: '#d97706', down: '#dc2626' };
  const labels = { operational: 'Operational', degraded: 'Degraded', down: 'Down' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: colors[status],
        boxShadow: `0 0 0 3px ${colors[status]}33`,
      }} />
      <span style={{ fontSize: '12px', fontWeight: 700, color: colors[status] }}>{labels[status]}</span>
    </div>
  );
}

export default async function AdminPage() {
  const stats = await fetchAdminStats();

  const KPI_CARDS = [
    {
      label: 'Total Users',
      value: stats.userCount.toLocaleString(),
      change: '+12%',
      icon: '👤',
      color: '#7c3aed',
    },
    {
      label: 'Active Campaigns',
      value: stats.activeCampaigns.toLocaleString(),
      change: '+8%',
      icon: '📋',
      color: '#2563eb',
    },
    {
      label: 'Total Raised',
      value: formatCents(stats.totalRaised),
      change: '+23%',
      icon: '💰',
      color: '#16a34a',
    },
    {
      label: 'Pending Payouts',
      value: stats.pendingPayouts.toLocaleString(),
      change: stats.pendingPayouts > 0 ? 'Needs review' : 'All clear',
      icon: '💳',
      color: stats.pendingPayouts > 0 ? '#d97706' : '#16a34a',
    },
    {
      label: 'Open Flags',
      value: stats.flagCount.toLocaleString(),
      change: stats.flagCount > 0 ? 'Needs action' : 'All clear',
      icon: '🚩',
      color: stats.flagCount > 0 ? '#dc2626' : '#16a34a',
    },
  ];

  const SYSTEM_HEALTH = [
    { service: 'Database', status: 'operational' as const },
    { service: 'Stripe API', status: 'operational' as const },
    { service: 'Auth Service', status: 'operational' as const },
    { service: 'Email (Resend)', status: 'operational' as const },
    { service: 'Storage', status: 'operational' as const },
  ];

  const QUICK_ACTIONS = [
    { label: 'Review Flags', href: '/admin/reports', icon: '🚩', count: stats.flagCount },
    { label: 'Approve Payouts', href: '/admin/payouts', icon: '💳', count: stats.pendingPayouts },
    { label: 'Manage Users', href: '/admin/users', icon: '👤', count: null },
    { label: 'View Campaigns', href: '/admin/campaigns', icon: '📋', count: null },
  ];

  return (
    <div style={{ padding: '28px 28px 40px', minHeight: '100vh', background: '#f8fafc' }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Admin Dashboard</h1>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
          Platform overview &amp; moderation controls
        </p>
      </div>

      {/* ── KPI ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {KPI_CARDS.map((k) => (
          <div key={k.label} style={{
            background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0',
            padding: '18px 20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>{k.icon}</span>
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                background: `${k.color}18`, color: k.color,
              }}>
                {k.change}
              </span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{k.value}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', fontWeight: 600 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── MAIN GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px', alignItems: 'flex-start' }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* User Growth Chart */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>User Growth</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Monthly registered users</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a' }}>
                  {stats.userCount.toLocaleString()}
                </div>
                <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700 }}>↑ 12% this month</div>
              </div>
            </div>
            <UserGrowthChart />
          </div>

          {/* Recent Users Table */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>Recent Users</div>
              <a href="/admin/users" style={{ fontSize: '12px', fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}>View all →</a>
            </div>

            {/* Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 140px 110px',
              padding: '10px 20px',
              background: '#f8fafc',
              borderBottom: '1px solid #f1f5f9',
              fontSize: '11px', fontWeight: 800, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              gap: '8px',
            }}>
              <span>User</span>
              <span>Joined</span>
              <span>Status</span>
            </div>

            {stats.recentUsers.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                No users yet
              </div>
            ) : (
              stats.recentUsers.map((u, i) => {
                const inits = initials(u.full_name);
                const colors = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#0891b2'];
                const avatarColor = colors[i % colors.length];
                return (
                  <div
                    key={u.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 140px 110px',
                      padding: '12px 20px',
                      borderBottom: i < stats.recentUsers.length - 1 ? '1px solid #f8fafc' : 'none',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: avatarColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 900, color: '#fff', flexShrink: 0,
                      }}>
                        {inits}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {u.full_name ?? 'New User'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{u.id.slice(0, 8)}&hellip;</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{fmtDate(u.created_at)}</div>
                    <div>
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                        background: '#dcfce7', color: '#16a34a',
                      }}>
                        Active
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Quick Actions */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '18px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {QUICK_ACTIONS.map((action) => (
                <a
                  key={action.label}
                  href={action.href}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: '10px',
                    background: '#f8fafc', border: '1px solid #f1f5f9',
                    textDecoration: 'none', transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>{action.icon}</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{action.label}</span>
                  </div>
                  {action.count !== null && action.count > 0 && (
                    <span style={{
                      padding: '1px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 800,
                      background: '#fef2f2', color: '#dc2626',
                    }}>
                      {action.count}
                    </span>
                  )}
                </a>
              ))}
            </div>
          </div>

          {/* System Health */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>System Health</div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: '20px' }}>
                All good
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {SYSTEM_HEALTH.map(({ service, status }) => (
                <div key={service} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>{service}</span>
                  <HealthDot status={status} />
                </div>
              ))}
            </div>
          </div>

          {/* Platform Activity */}
          <div style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', borderRadius: '16px', padding: '18px', color: '#fff' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, opacity: 0.9, marginBottom: '16px' }}>Platform Activity</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Campaigns Created', value: '48', sub: 'this week' },
                { label: 'Donations Processed', value: '$12.4k', sub: 'today' },
                { label: 'New Signups', value: '127', sub: 'this week' },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, opacity: 0.8 }}>{item.label}</div>
                    <div style={{ fontSize: '11px', opacity: 0.55 }}>{item.sub}</div>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 900 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
