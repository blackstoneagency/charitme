import 'server-only';
import Link from 'next/link';
import { KindFundShell, TopBar, MetricGrid, KFIcon, type Metric } from '../../../components/KindFundShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type DonorAggregate = {
  key: string;
  donorId: string | null;
  name: string;
  email: string;
  totalCents: number;
  donationCount: number;
  lastDonation: string;
  isAnonymous: boolean;
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtCents(cents: number): string {
  const dollars = cents / 100;
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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map(n => n[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ─────────────────────────────────────────────
// Data fetch
// ─────────────────────────────────────────────
async function fetchDonorData(userId: string): Promise<{
  donors: DonorAggregate[];
  totalCents: number;
  totalUnique: number;
  newLast30: number;
  avgDonationCents: number;
}> {
  const empty = { donors: [], totalCents: 0, totalUnique: 0, newLast30: 0, avgDonationCents: 0 };

  try {
    // Step 1: get user's campaign IDs
    const { data: campData, error: campError } = await supabaseAdmin
      .from('campaigns')
      .select('id')
      .eq('user_id', userId);

    if (campError || !campData || campData.length === 0) return empty;

    const campaignIds = (campData as { id: string }[]).map(c => c.id);

    // Step 2: get all completed donations for those campaigns
    const { data: donData, error: donError } = await supabaseAdmin
      .from('donations')
      .select('id, donor_id, amount_cents, anonymous, created_at')
      .in('campaign_id', campaignIds)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (donError || !donData || donData.length === 0) return empty;

    type RawDon = {
      id: string;
      donor_id: string | null;
      amount_cents: number;
      anonymous: boolean;
      created_at: string;
    };
    const donations = donData as RawDon[];

    // Step 3: fetch donor profiles
    const knownDonorIds = [
      ...new Set(
        donations
          .filter(d => d.donor_id && !d.anonymous)
          .map(d => d.donor_id as string),
      ),
    ];

    const profileMap = new Map<string, { name: string; email: string }>();
    if (knownDonorIds.length > 0) {
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', knownDonorIds);
      for (const p of (profileData ?? []) as {
        id: string;
        full_name: string | null;
        email: string | null;
      }[]) {
        profileMap.set(p.id, {
          name: p.full_name ?? 'Donor',
          email: p.email ?? '',
        });
      }
    }

    // Step 4: aggregate by donor key (first entry per key is most recent donation)
    const aggMap = new Map<string, DonorAggregate>();
    let totalDonationInstances = 0;

    for (const d of donations) {
      const isAnon = d.anonymous || !d.donor_id;
      const key = isAnon ? `anon-${d.id}` : d.donor_id!;
      const profile = d.donor_id ? (profileMap.get(d.donor_id) ?? null) : null;
      totalDonationInstances++;

      const existing = aggMap.get(key);
      if (existing) {
        existing.totalCents += d.amount_cents;
        existing.donationCount += 1;
        // lastDonation is already the most recent (sorted desc)
      } else {
        aggMap.set(key, {
          key,
          donorId: d.donor_id,
          name: isAnon ? 'Anonymous' : (profile?.name ?? 'Donor'),
          email: isAnon ? '' : (profile?.email ?? ''),
          totalCents: d.amount_cents,
          donationCount: 1,
          lastDonation: d.created_at,
          isAnonymous: isAnon,
        });
      }
    }

    const donors = [...aggMap.values()].sort((a, b) => b.totalCents - a.totalCents);
    const totalCents = donations.reduce((s, d) => s + d.amount_cents, 0);
    const totalUnique = donors.length;
    const avgDonationCents =
      totalDonationInstances > 0 ? Math.round(totalCents / totalDonationInstances) : 0;

    // New donors: first donation within last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newLast30 = donors.filter(
      d => new Date(d.lastDonation) >= thirtyDaysAgo && d.donationCount === 1,
    ).length;

    return { donors, totalCents, totalUnique, newLast30, avgDonationCents };
  } catch {
    return empty;
  }
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function DonorsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  const [{ donors, totalCents, totalUnique, newLast30, avgDonationCents }, params] =
    await Promise.all([fetchDonorData(user.id), searchParams]);

  const activeTab = String(params.tab ?? 'all').toLowerCase();

  const metrics: Metric[] = [
    {
      label: 'Total Donors',
      value: totalUnique.toLocaleString(),
      change: 'all time',
      icon: 'users',
      tone: 'violet',
    },
    {
      label: 'New Donors',
      value: newLast30.toLocaleString(),
      change: 'last 30 days',
      icon: 'team',
      tone: 'green',
    },
    {
      label: 'Total Donated',
      value: fmtCents(totalCents),
      change: 'all campaigns',
      icon: 'gift',
      tone: 'blue',
    },
    {
      label: 'Avg. Donation',
      value: fmtCents(avgDonationCents),
      change: 'per transaction',
      icon: 'chart',
      tone: 'orange',
    },
  ];

  // Tab counts
  const topDonors = donors.filter(d => d.totalCents >= 10000); // $100+
  const recurringDonors = donors.filter(d => d.donationCount > 1);
  const newDonors = donors.filter(d => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return new Date(d.lastDonation) >= thirtyDaysAgo && d.donationCount === 1;
  });

  // Tab-based filtering
  const filtered =
    activeTab === 'new'
      ? newDonors
      : activeTab === 'top-donors'
      ? topDonors
      : activeTab === 'recurring'
      ? recurringDonors
      : donors;

  return (
    <KindFundShell active="Donors">
      <TopBar title="Donors" subtitle="Build stronger relationships with your supporters." />

      <div className="kf-content-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="kf-content-main">
          <MetricGrid metrics={metrics} />

          <section className="kf-card" style={{ overflow: 'hidden' }}>
            {/* Card header + tab strip */}
            <div className="kf-card-head">
              <h2>All Donors</h2>
              <span style={{ fontSize: 13, color: 'var(--t3)' }}>
                {totalUnique.toLocaleString()} donor{totalUnique !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="kf-tabs">
              <Link href="?tab=all" className={activeTab === 'all' ? 'active' : ''} style={{ textDecoration: 'none' }}>
                All ({totalUnique})
              </Link>
              <Link href="?tab=new" className={activeTab === 'new' ? 'active' : ''} style={{ textDecoration: 'none' }}>
                New ({newLast30})
              </Link>
              <Link href="?tab=top-donors" className={activeTab === 'top-donors' ? 'active' : ''} style={{ textDecoration: 'none' }}>
                Top Donors ({topDonors.length})
              </Link>
              <Link href="?tab=recurring" className={activeTab === 'recurring' ? 'active' : ''} style={{ textDecoration: 'none' }}>
                Recurring ({recurringDonors.length})
              </Link>
            </div>

            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px 120px 100px',
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
              <span>Gifts</span>
              <span>Last Gift</span>
              <span style={{ textAlign: 'right' }}>Total Given</span>
            </div>

            {/* Rows or empty state */}
            {filtered.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--t3)' }}>
                <KFIcon name="users" />
                <p style={{ marginTop: 12, fontWeight: 600 }}>
                  {donors.length === 0 ? 'No donors yet.' : `No ${activeTab === 'all' ? '' : activeTab + ' '}donors found.`}
                </p>
                <p style={{ fontSize: 13, marginTop: 4 }}>
                  {donors.length === 0
                    ? 'Donors will appear here once your campaigns receive contributions.'
                    : 'Try a different filter tab.'}
                </p>
              </div>
            ) : (
              <div className="kf-rows">
                {filtered.map((donor, i) => (
                  <div
                    key={donor.key}
                    className="kf-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 100px 120px 100px',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
                    {/* Donor identity */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {initials(donor.name)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong
                          style={{
                            fontSize: 14,
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {donor.name}
                        </strong>
                        {donor.email ? (
                          <span
                            style={{
                              fontSize: 12,
                              color: 'var(--t3)',
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {donor.email}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Gift count */}
                    <div style={{ fontSize: 14, color: 'var(--t2)' }}>
                      {donor.donationCount} gift{donor.donationCount !== 1 ? 's' : ''}
                    </div>

                    {/* Last donation date */}
                    <div style={{ fontSize: 13, color: 'var(--t3)' }}>
                      {fmtDate(donor.lastDonation)}
                    </div>

                    {/* Total given */}
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: 15, color: 'var(--green)', fontWeight: 700 }}>
                        {fmtCents(donor.totalCents)}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {filtered.length > 0 && (
              <div
                className="kf-table-footer"
                style={{ padding: '12px 20px', fontSize: 13, color: 'var(--t3)' }}
              >
                Showing {filtered.length.toLocaleString()} of {donors.length.toLocaleString()} donor{donors.length !== 1 ? 's' : ''}
              </div>
            )}
          </section>
        </div>
      </div>
    </KindFundShell>
  );
}
