import Link from 'next/link';
import { KindFundShell, TopBar, MetricGrid, KFIcon } from '../../../components/KindFundApp';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type CampaignRef = {
  id: string;
  title: string;
};

type Donation = {
  id: string;
  amount_cents: number;
  status: string;
  created_at: string;
  anonymous: boolean;
  donor_id: string | null;
  campaign_id: string;
};

type Profile = {
  id: string;
  full_name: string | null;
};

// Enriched for display
type EnrichedDonation = Donation & {
  donorName: string;
  campaignTitle: string;
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtCents(cents: number): string {
  const dollars = Math.round(cents / 100);
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000)
    return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const AVATAR_COLORS = ['#6c35ff', '#19b86a', '#2f80ed', '#ec3fb4', '#f59e0b'];

function avatarStyle(index: number): React.CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: AVATAR_COLORS[index % AVATAR_COLORS.length],
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ─────────────────────────────────────────────
// Data fetch
// ─────────────────────────────────────────────
async function fetchDonationsData(userId: string): Promise<{
  donations: EnrichedDonation[];
  campaignMap: Map<string, string>;
}> {
  try {
    // Step 1: get user's campaigns
    const { data: campData, error: campError } = await supabaseAdmin
      .from('campaigns')
      .select('id,title')
      .eq('user_id', userId);

    if (campError || !campData || campData.length === 0) {
      return { donations: [], campaignMap: new Map() };
    }

    const campaigns = campData as CampaignRef[];
    const campaignMap = new Map<string, string>(
      campaigns.map((c) => [c.id, c.title]),
    );
    const campaignIds = campaigns.map((c) => c.id);

    // Step 2: get completed donations
    const { data: donData, error: donError } = await supabaseAdmin
      .from('donations')
      .select('id,amount_cents,status,created_at,anonymous,donor_id,campaign_id')
      .in('campaign_id', campaignIds)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(200);

    if (donError || !donData) {
      return { donations: [], campaignMap };
    }

    const rawDonations = donData as Donation[];

    // Step 3: fetch donor profiles
    const uniqueDonorIds = [
      ...new Set(
        rawDonations
          .map((d) => d.donor_id)
          .filter((id): id is string => id !== null && !rawDonations.find((d) => d.donor_id === id && d.anonymous)),
      ),
    ];

    const profileMap = new Map<string, string>();

    if (uniqueDonorIds.length > 0) {
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('id,full_name')
        .in('id', uniqueDonorIds);

      for (const p of (profileData ?? []) as Profile[]) {
        if (p.full_name) profileMap.set(p.id, p.full_name);
      }
    }

    const donations: EnrichedDonation[] = rawDonations.map((d) => ({
      ...d,
      donorName:
        d.anonymous || !d.donor_id
          ? 'Anonymous'
          : (profileMap.get(d.donor_id) ?? 'Anonymous'),
      campaignTitle: campaignMap.get(d.campaign_id) ?? 'Unknown Campaign',
    }));

    return { donations, campaignMap };
  } catch {
    return { donations: [], campaignMap: new Map() };
  }
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function DonationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  const [{ donations }, params] = await Promise.all([
    fetchDonationsData(user.id),
    searchParams,
  ]);

  const activeTab = String(params.tab ?? 'all').toLowerCase();

  // Metrics
  const totalRaised = donations.reduce((s, d) => s + d.amount_cents, 0);
  const donationCount = donations.length;
  const uniqueDonors = new Set(
    donations.filter((d) => d.donor_id !== null && d.donorName !== 'Anonymous').map((d) => d.donor_id),
  ).size;
  const avgDonation = donationCount > 0 ? Math.round(totalRaised / donationCount) : 0;

  const metrics = [
    {
      label: 'Total Raised',
      value: fmtCents(totalRaised),
      change: 'all time',
      icon: 'gift',
      tone: 'violet' as const,
    },
    {
      label: 'Donations',
      value: donationCount.toLocaleString(),
      change: 'completed',
      icon: 'stack',
      tone: 'green' as const,
    },
    {
      label: 'Unique Donors',
      value: uniqueDonors.toLocaleString(),
      change: 'identified donors',
      icon: 'users',
      tone: 'blue' as const,
    },
    {
      label: 'Avg. Donation',
      value: fmtCents(avgDonation),
      change: 'per transaction',
      icon: 'chart',
      tone: 'orange' as const,
    },
  ];

  // Tab logic
  const tabDefs = [
    { key: 'all', label: 'All' },
    { key: 'one-time', label: 'One-time' },
    { key: 'top-donors', label: 'Top Donors' },
  ];

  // Build per-donor donation totals for "one-time" (donors who donated only once)
  const donorDonationCount = new Map<string, number>();
  for (const d of donations) {
    const key = d.donor_id ?? `anon-${d.id}`;
    donorDonationCount.set(key, (donorDonationCount.get(key) ?? 0) + 1);
  }

  let filtered: EnrichedDonation[];
  if (activeTab === 'one-time') {
    filtered = donations.filter((d) => {
      const key = d.donor_id ?? `anon-${d.id}`;
      return (donorDonationCount.get(key) ?? 0) === 1;
    });
  } else if (activeTab === 'top-donors') {
    // Aggregate by donor, sort desc, keep top 20
    const donorTotals = new Map<string, { total: number; name: string; latestDonation: EnrichedDonation }>();
    for (const d of donations) {
      const key = d.donorName + '|' + (d.donor_id ?? d.id);
      const existing = donorTotals.get(key);
      if (existing) {
        existing.total += d.amount_cents;
      } else {
        donorTotals.set(key, { total: d.amount_cents, name: d.donorName, latestDonation: d });
      }
    }
    filtered = [...donorTotals.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)
      .map(({ latestDonation, total }) => ({ ...latestDonation, amount_cents: total }));
  } else {
    filtered = donations;
  }

  return (
    <KindFundShell active="Donations">
      <TopBar
        title="Donations"
        subtitle="Track every donation across all your campaigns."
        actions={
          <button className="kf-outline" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <KFIcon name="upload" /> Export
          </button>
        }
      />

      <div className="kf-content-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="kf-content-main">
          <MetricGrid metrics={metrics} />

          <section className="kf-card" style={{ overflow: 'hidden' }}>
            {/* Card header */}
            <div className="kf-card-head">
              <h2>Donation History</h2>
              <div className="kf-card-tools">
                <button>Sort by: Newest First</button>
              </div>
            </div>

            {/* Tab bar */}
            <div className="kf-tabs">
              {tabDefs.map(({ key, label }) => {
                let count = 0;
                if (key === 'all') count = donations.length;
                else if (key === 'one-time')
                  count = donations.filter((d) => {
                    const k = d.donor_id ?? `anon-${d.id}`;
                    return (donorDonationCount.get(k) ?? 0) === 1;
                  }).length;
                else if (key === 'top-donors') count = Math.min(20, uniqueDonors);

                return (
                  <Link
                    key={key}
                    href={`?tab=${key}`}
                    className={activeTab === key ? 'active' : ''}
                    style={{ textDecoration: 'none' }}
                  >
                    {label}
                    {count > 0 && (
                      <span
                        style={{
                          marginLeft: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          opacity: 0.65,
                        }}
                      >
                        ({count})
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 120px 100px 90px',
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
              <span>Donor</span>
              <span>Campaign</span>
              <span>Date</span>
              <span style={{ textAlign: 'right' }}>Amount</span>
              <span>Status</span>
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
                <KFIcon name="gift" />
                <p style={{ marginTop: 12, fontWeight: 600 }}>No donations yet.</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>
                  Donations will appear here once your campaigns receive contributions.
                </p>
              </div>
            ) : (
              <div className="kf-rows">
                {filtered.map((d, i) => (
                  <div
                    key={d.id}
                    className="kf-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 120px 100px 90px',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
                    {/* Donor */}
                    <div
                      className="kf-row-main"
                      style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                    >
                      <div style={avatarStyle(i)}>
                        {initials(d.donorName)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong
                          style={{
                            fontSize: 14,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block',
                          }}
                        >
                          {d.donorName}
                        </strong>
                      </div>
                    </div>

                    {/* Campaign */}
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--t2)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {d.campaignTitle}
                    </div>

                    {/* Date */}
                    <div style={{ fontSize: 13, color: 'var(--t3)' }}>{fmtDate(d.created_at)}</div>

                    {/* Amount */}
                    <div style={{ textAlign: 'right' }}>
                      <strong
                        style={{
                          fontSize: 15,
                          color: 'var(--green)',
                          fontWeight: 700,
                        }}
                      >
                        {fmtCents(d.amount_cents)}
                      </strong>
                    </div>

                    {/* Status pill */}
                    <div>
                      <span className="kf-pill green" style={{ fontSize: 11 }}>
                        Completed
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            {filtered.length > 0 && (
              <div
                className="kf-table-footer"
                style={{ padding: '12px 20px', fontSize: 13, color: 'var(--t3)' }}
              >
                Showing {filtered.length}{' '}
                {activeTab === 'top-donors'
                  ? 'top donors'
                  : `of ${donations.length} donations`}
              </div>
            )}
          </section>
        </div>
      </div>
    </KindFundShell>
  );
}
