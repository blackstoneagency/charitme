import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { formatCents } from '../../../lib/stripe';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Donors — GiveRise' };
export const dynamic = 'force-dynamic';

type DonorSummary = {
  donor_id: string;
  display_name: string;
  total_cents: number;
  count: number;
  last_at: string;
  first_at: string;
  type: 'recurring' | 'one-time';
  engagement: 'high' | 'medium' | 'low';
};

type DonorStats = {
  totalDonors: number;
  newDonors: number;
  totalDonated: number;
  avgDonation: number;
  recurringDonors: number;
  oneDonors: number;
};

async function getDonorData(userId: string): Promise<{ donors: DonorSummary[]; stats: DonorStats | null }> {
  try {
    const { data: campaignData } = await supabaseAdmin
      .from('campaigns')
      .select('id')
      .eq('organizer_id', userId);

    const campaignIds = (campaignData ?? []).map((c: { id: string }) => c.id);
    if (!campaignIds.length) return { donors: [], stats: null };

    const { data: donationData } = await supabaseAdmin
      .from('donations')
      .select('id, amount_cents, donor_id, created_at')
      .in('campaign_id', campaignIds)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    const donations = (donationData ?? []) as {
      id: string;
      amount_cents: number;
      donor_id: string;
      created_at: string;
    }[];

    // Group by donor_id
    const donorMap = new Map<string, { total_cents: number; count: number; dates: string[] }>();
    for (const d of donations) {
      if (!d.donor_id) continue;
      const ex = donorMap.get(d.donor_id);
      if (ex) {
        ex.total_cents += d.amount_cents;
        ex.count += 1;
        ex.dates.push(d.created_at);
      } else {
        donorMap.set(d.donor_id, { total_cents: d.amount_cents, count: 1, dates: [d.created_at] });
      }
    }

    const donorIds = [...donorMap.keys()];
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .in('id', donorIds);

    const profileMap = new Map<string, string>();
    for (const p of (profileData ?? []) as { id: string; full_name: string | null }[]) {
      profileMap.set(p.id, p.full_name ?? 'Anonymous');
    }

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const donors: DonorSummary[] = donorIds.map((did) => {
      const d = donorMap.get(did)!;
      const sorted = [...d.dates].sort();
      const first_at = sorted[0];
      const last_at = sorted[sorted.length - 1];
      const type: 'recurring' | 'one-time' = d.count > 1 ? 'recurring' : 'one-time';
      const engagement: 'high' | 'medium' | 'low' =
        d.count >= 5 ? 'high' : d.count >= 2 ? 'medium' : 'low';
      return {
        donor_id: did,
        display_name: profileMap.get(did) ?? 'Donor',
        total_cents: d.total_cents,
        count: d.count,
        last_at,
        first_at,
        type,
        engagement,
      };
    }).sort((a, b) => b.total_cents - a.total_cents);

    const newDonors = donors.filter((d) => new Date(d.first_at).getTime() > thirtyDaysAgo).length;
    const totalDonated = donors.reduce((s, d) => s + d.total_cents, 0);
    const totalTxns = donors.reduce((s, d) => s + d.count, 0);
    const avgDonation = totalTxns > 0 ? Math.round(totalDonated / totalTxns) : 0;
    const recurringDonors = donors.filter((d) => d.type === 'recurring').length;
    const oneDonors = donors.filter((d) => d.type === 'one-time').length;

    return {
      donors,
      stats: {
        totalDonors: donors.length,
        newDonors,
        totalDonated,
        avgDonation,
        recurringDonors,
        oneDonors,
      },
    };
  } catch {
    return { donors: [], stats: null };
  }
}

const ENGAGEMENT_CONFIG = {
  high: { color: '#16a34a', bg: '#dcfce7', label: 'High' },
  medium: { color: '#d97706', bg: '#fef3c7', label: 'Mid' },
  low: { color: '#9ca3af', bg: '#f1f5f9', label: 'Low' },
};

function initials(name: string) {
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// SVG Retention line chart (mini, 80×40)
function RetentionChart() {
  const pts = [30, 45, 38, 52, 48, 60, 55, 68, 72, 65, 78, 82];
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const range = max - min || 1;
  const w = 200; const h = 50;
  const xs = pts.map((_, i) => (i / (pts.length - 1)) * w);
  const ys = pts.map((v) => h - ((v - min) / range) * (h - 6) - 3);
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ');
  const fill = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ') +
    ` L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '50px' }}>
      <defs>
        <linearGradient id="ret-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#ret-grad)" />
      <path d={d} fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// SVG Donut for donor type
function DonorTypeDonut({ recurring, oneTime }: { recurring: number; oneTime: number }) {
  const total = recurring + oneTime || 1;
  const pct = recurring / total;
  const r = 30; const cx = 40; const cy = 40;
  const circ = 2 * Math.PI * r;
  const recurringDash = pct * circ;
  const oneTimeDash = (1 - pct) * circ;
  return (
    <svg viewBox="0 0 80 80" style={{ width: '80px', height: '80px' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
      {recurring > 0 && (
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="#7c3aed" strokeWidth="10"
          strokeDasharray={`${recurringDash} ${circ}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
        />
      )}
      {oneTime > 0 && (
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="#a78bfa" strokeWidth="10"
          strokeDasharray={`${oneTimeDash} ${circ}`}
          strokeDashoffset={circ * 0.25 - recurringDash}
          strokeLinecap="round"
        />
      )}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '11px', fontWeight: 800, fill: '#0f172a' }}>
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DonorsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tab = typeof sp.tab === 'string' ? sp.tab : 'all';
  const user = await requireUser();
  const { donors, stats } = await getDonorData(user.id);

  // Filter donors by tab
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const filtered =
    tab === 'new'
      ? donors.filter((d) => new Date(d.first_at).getTime() > thirtyDaysAgo)
      : tab === 'top'
      ? [...donors].sort((a, b) => b.total_cents - a.total_cents).slice(0, 20)
      : tab === 'recurring'
      ? donors.filter((d) => d.type === 'recurring')
      : donors;

  const topDonor = donors[0] ?? null;

  const STATS = stats
    ? [
        { label: 'Total Donors', value: stats.totalDonors.toLocaleString(), change: '+12%', up: true },
        { label: 'New Donors', value: stats.newDonors.toLocaleString(), change: '+8%', up: true },
        { label: 'Total Donated', value: formatCents(stats.totalDonated), change: '+23%', up: true },
        {
          label: 'Avg. Donation',
          value: formatCents(stats.avgDonation),
          change: '+5%',
          up: true,
        },
      ]
    : [];

  const TABS = [
    { key: 'all', label: 'All Donors', count: donors.length },
    { key: 'new', label: 'New', count: stats?.newDonors ?? 0 },
    { key: 'top', label: 'Top Donors', count: Math.min(donors.length, 20) },
    { key: 'recurring', label: 'Recurring', count: stats?.recurringDonors ?? 0 },
  ];

  return (
    <div style={{ padding: '28px 28px 40px', minHeight: '100vh', background: '#f8fafc' }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Donors</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Manage and understand your donor community</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={{
            padding: '8px 16px', borderRadius: '10px', border: '1px solid #e2e8f0',
            background: '#fff', fontSize: '13px', fontWeight: 700, color: '#475569', cursor: 'pointer',
          }}>
            Export CSV
          </button>
          <Link href="/campaigns" style={{
            padding: '8px 16px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            fontSize: '13px', fontWeight: 800, color: '#fff', textDecoration: 'none',
          }}>
            + Add Donor
          </Link>
        </div>
      </div>

      {/* ── STATS ROW ── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          {STATS.map((s) => (
            <div key={s.label} style={{
              background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0',
              padding: '18px 20px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{s.label}</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: s.up ? '#16a34a' : '#dc2626' }}>{s.change}</span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>vs last month</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MAIN CONTENT AREA ── */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>

        {/* ── LEFT: DONOR TABLE ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', padding: '0 20px' }}>
              {TABS.map((t) => (
                <Link
                  key={t.key}
                  href={`/dashboard/donor?tab=${t.key}`}
                  style={{
                    padding: '14px 16px',
                    fontSize: '13px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    borderBottom: tab === t.key ? '2px solid #7c3aed' : '2px solid transparent',
                    color: tab === t.key ? '#7c3aed' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '-1px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                  <span style={{
                    padding: '1px 7px', borderRadius: '20px', fontSize: '11px', fontWeight: 800,
                    background: tab === t.key ? 'rgba(124,58,237,0.1)' : '#f1f5f9',
                    color: tab === t.key ? '#7c3aed' : '#94a3b8',
                  }}>
                    {t.count}
                  </span>
                </Link>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>👥</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                  {donors.length === 0 ? 'No donors yet' : 'No donors in this filter'}
                </div>
                <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '340px', margin: '0 auto 20px' }}>
                  {donors.length === 0
                    ? 'Once people donate to your campaigns, you’ll manage them here.'
                    : 'Try a different filter or date range.'}
                </p>
                {donors.length === 0 && (
                  <Link href="/campaigns" style={{
                    padding: '9px 20px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                    fontSize: '13px', fontWeight: 800, color: '#fff', textDecoration: 'none',
                  }}>
                    View Campaigns
                  </Link>
                )}
              </div>
            ) : (
              <>
                {/* Table header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 130px 110px 70px 110px 80px 60px',
                  padding: '10px 20px',
                  background: '#f8fafc',
                  borderBottom: '1px solid #f1f5f9',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  gap: '8px',
                }}>
                  <span>Donor</span>
                  <span>Last Donation</span>
                  <span>Total Donated</span>
                  <span>Count</span>
                  <span>Type</span>
                  <span>Engagement</span>
                  <span>Actions</span>
                </div>

                {/* Rows */}
                {filtered.map((donor, i) => {
                  const eng = ENGAGEMENT_CONFIG[donor.engagement];
                  const inits = initials(donor.display_name);
                  const colors = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626'];
                  const avatarColor = colors[i % colors.length];
                  return (
                    <div
                      key={donor.donor_id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 130px 110px 70px 110px 80px 60px',
                        padding: '14px 20px',
                        borderBottom: i < filtered.length - 1 ? '1px solid #f8fafc' : 'none',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      {/* Donor */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          background: avatarColor,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '12px', fontWeight: 900, color: '#fff', flexShrink: 0,
                        }}>
                          {inits}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {donor.display_name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {donor.donor_id.slice(0, 8)}&hellip;
                          </div>
                        </div>
                      </div>

                      {/* Last donation */}
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{fmtDate(donor.last_at)}</div>

                      {/* Total donated */}
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#16a34a' }}>
                        {formatCents(donor.total_cents)}
                      </div>

                      {/* Count */}
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                        {donor.count}
                      </div>

                      {/* Type badge */}
                      <div>
                        <span style={{
                          padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                          background: donor.type === 'recurring' ? 'rgba(124,58,237,0.1)' : '#f1f5f9',
                          color: donor.type === 'recurring' ? '#7c3aed' : '#64748b',
                        }}>
                          {donor.type === 'recurring' ? 'Recurring' : 'One-time'}
                        </span>
                      </div>

                      {/* Engagement */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: eng.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', fontWeight: 700, color: eng.color }}>{eng.label}</span>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button title="View" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '2px' }}>👁</button>
                        <button title="Message" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '2px' }}>✉️</button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Donor Insights */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '18px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '14px' }}>Donor Insights</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>New donors (30d)</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{stats?.newDonors ?? 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Recurring donors</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#7c3aed' }}>
                  {stats ? `${Math.round((stats.recurringDonors / Math.max(stats.totalDonors, 1)) * 100)}%` : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Top donor type</span>
                <span style={{ fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>
                  {stats && stats.recurringDonors > stats.oneDonors ? 'Recurring' : 'One-time'}
                </span>
              </div>
            </div>
          </div>

          {/* Retention chart */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Donor Retention</div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a' }}>+14%</span>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px' }}>Last 12 months</div>
            <RetentionChart />
          </div>

          {/* Donor type donut */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '18px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '14px' }}>Donations by Type</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <DonorTypeDonut recurring={stats?.recurringDonors ?? 0} oneTime={stats?.oneDonors ?? 0} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#7c3aed', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>Recurring</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{stats?.recurringDonors ?? 0} donors</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#a78bfa', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>One-time</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{stats?.oneDonors ?? 0} donors</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Donor */}
          {topDonor && (
            <div style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', borderRadius: '16px', padding: '18px', color: '#fff' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8, marginBottom: '12px' }}>
                ⭐ Top Donor
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: 900,
                }}>
                  {initials(topDonor.display_name)}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800 }}>{topDonor.display_name}</div>
                  <div style={{ fontSize: '11px', opacity: 0.75 }}>{topDonor.count} donation{topDonor.count !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <div style={{ fontSize: '22px', fontWeight: 900 }}>{formatCents(topDonor.total_cents)}</div>
              <div style={{ fontSize: '11px', opacity: 0.75, marginTop: '2px' }}>Total contributed</div>
            </div>
          )}

          {!topDonor && (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '18px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>💜</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>No donors yet</div>
              <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>Share your campaign to attract your first supporter.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
