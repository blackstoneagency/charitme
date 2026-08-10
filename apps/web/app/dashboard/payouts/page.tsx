import Link from 'next/link';
import { CharitMeShell, TopBar, MetricGrid, KFIcon } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { createClient } from '../../../lib/supabase-server';
import { boundedQuery } from '../../../lib/query-timeout';
import { formatMoneyShort } from '@shared/currencies';
import RequestPayoutButton from './RequestPayoutButton';
import PayoutConciergeCard from './PayoutConciergeCard';
import FeeOptimizerCard from './FeeOptimizerCard';
import DegradedReadNotice from '../../../components/DegradedReadNotice';
import { decodeKeysetCursor, encodeKeysetCursor } from '../../../lib/keyset-cursor';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type PayoutStatus = 'requested' | 'approved' | 'paid' | 'failed' | 'frozen' | 'released';
type PayoutSpeed = 'standard' | 'same_day' | 'instant';

type PayoutRow = {
  id: string;
  campaign_id: string;
  amount_cents: number;
  fee_cents: number;
  payout_speed: PayoutSpeed;
  status: PayoutStatus;
  created_at: string;
  campaign_title: string;
};

type PayoutSummary = {
  paid_out_cents: number;
  pending_cents: number;
  month_cents: number;
  fee_cents: number;
  payout_count: number;
};

const PAGE_SIZE = 50;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtCents(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000)
    return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${dollars.toFixed(2)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const SPEED_LABELS: Record<PayoutSpeed, string> = {
  standard: '3–5 days',
  same_day: 'Same day',
  instant: 'Instant',
};

type PillTone = 'green' | 'orange' | 'red' | 'violet';

function statusTone(status: PayoutStatus): PillTone {
  if (status === 'paid') return 'green';
  if (status === 'requested' || status === 'approved') return 'orange';
  if (status === 'failed' || status === 'frozen') return 'red';
  return 'violet'; // released
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const userId = user.id;
  const requestedTab = (typeof params.tab === 'string' ? params.tab : 'all').toLowerCase();
  const activeTab = ['all', 'paid', 'pending', 'failed'].includes(requestedTab) ? requestedTab : 'all';
  const cursor = decodeKeysetCursor(params.cursor);
  const supabase = await createClient();

  // Fetch active campaigns with available balance for the request payout widget
  const [
    { data: activeCampaignData, error: activeCampaignError },
    { data: payoutData, error: payoutError },
    { data: payoutSummaryData, error: payoutSummaryError },
  ] = await Promise.all([
    boundedQuery(() =>
      supabase
        .from('campaigns')
        .select('id, title, raised_amount')
        .eq('user_id', userId)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('raised_amount', { ascending: false })
        .limit(20),
    ),
    boundedQuery(() =>
      supabase.rpc('organizer_payout_page', {
        p_user_id: userId,
        p_status_group: activeTab,
        p_before_created_at: cursor?.createdAt ?? null,
        p_before_id: cursor?.id ?? null,
        p_limit: PAGE_SIZE + 1,
      }),
    ),
    boundedQuery(() => supabase.rpc('organizer_payout_summary', { p_user_id: userId })),
  ]);
  const activeCampaignRows = (activeCampaignData ?? []) as Array<{
    id: string;
    title: string;
    raised_amount: number;
  }>;
  const payoutRows = (payoutData ?? []) as unknown as PayoutRow[];
  const hasMore = payoutRows.length > PAGE_SIZE;
  const payouts = payoutRows.slice(0, PAGE_SIZE);
  const payoutSummary = ((payoutSummaryData ?? []) as unknown as PayoutSummary[])[0] ?? null;
  const loadFailed = Boolean(payoutError || !payoutData || payoutSummaryError || !payoutSummaryData || !payoutSummary);
  let detailsFailed = Boolean(activeCampaignError || !activeCampaignData);
  const campaignIds = [...new Set([
    ...activeCampaignRows.map((campaign) => campaign.id),
    ...payouts.map((payout) => payout.campaign_id),
  ])];
  let campaignCurrencyMap = new Map<string, string | null>();
  if (campaignIds.length > 0) {
    const { data: currencyData, error: currencyError } = await boundedQuery(() =>
      supabase
        .from('campaign_launch_settings')
        .select('campaign_id,currency')
        .in('campaign_id', campaignIds),
    );
    if (currencyError || !currencyData) detailsFailed = true;
    campaignCurrencyMap = new Map(
      (currencyData ?? []).map((row) => [row.campaign_id, row.currency]),
    );
  }
  const activeCampaigns = activeCampaignRows.map((campaign) => ({
    ...campaign,
    currency: campaignCurrencyMap.get(campaign.id) ?? null,
  }));
  const campaignTitleMap = new Map(payouts.map((payout) => [payout.campaign_id, payout.campaign_title]));

  // Metrics
  const totalPaid = payoutSummary?.paid_out_cents ?? 0;
  const totalPending = payoutSummary?.pending_cents ?? 0;
  const thisMonth = payoutSummary?.month_cents ?? 0;
  const totalFees = payoutSummary?.fee_cents ?? 0;

  const metrics = [
    { label: 'Paid Out', value: loadFailed ? '—' : fmtCents(totalPaid), change: loadFailed ? 'unavailable' : 'all completed payouts', icon: 'wallet', tone: 'violet' as const },
    { label: 'Pending', value: loadFailed ? '—' : fmtCents(totalPending), change: loadFailed ? 'unavailable' : 'requested + approved', icon: 'gift', tone: 'orange' as const },
    { label: 'This Month', value: loadFailed ? '—' : fmtCents(thisMonth), change: loadFailed ? 'unavailable' : new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), icon: 'chart', tone: 'green' as const },
    { label: 'Fees Paid', value: loadFailed ? '—' : fmtCents(totalFees), change: loadFailed ? 'unavailable' : 'all payout fees', icon: 'doc', tone: 'blue' as const },
  ];

  // Tab filtering
  const PAID_STATUSES: PayoutStatus[] = ['paid'];
  const PENDING_STATUSES: PayoutStatus[] = ['requested', 'approved'];
  const FAILED_STATUSES: PayoutStatus[] = ['failed', 'frozen'];

  const filtered =
    activeTab === 'paid'
      ? payouts.filter((p) => PAID_STATUSES.includes(p.status))
      : activeTab === 'pending'
      ? payouts.filter((p) => PENDING_STATUSES.includes(p.status))
      : activeTab === 'failed'
      ? payouts.filter((p) => FAILED_STATUSES.includes(p.status))
      : payouts;

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'paid', label: 'Paid' },
    { key: 'pending', label: 'Pending' },
    { key: 'failed', label: 'Failed' },
  ];

  const lastPayout = payouts.at(-1);
  const nextCursor = hasMore && lastPayout
    ? encodeKeysetCursor({ createdAt: lastPayout.created_at, id: lastPayout.id })
    : null;

  return (
    <CharitMeShell active="Payouts">
      <TopBar
        title="Payouts"
        subtitle="Review and manage payouts to your beneficiaries."
        actions={<RequestPayoutButton campaigns={activeCampaigns} />}
      />

      <div className="kf-content-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
        {loadFailed ? (
          <DegradedReadNotice title="We couldn't load your payout history">
            This is a temporary problem on our side. Your balances and payout records are unaffected. Reload the page to try again.
          </DegradedReadNotice>
        ) : detailsFailed ? (
          <DegradedReadNotice title="Some payout details are temporarily unavailable">
            Payout amounts and statuses are current, but some campaign details or payout tools could not be loaded.
          </DegradedReadNotice>
        ) : null}
        <MetricGrid metrics={metrics} />

        <PayoutConciergeCard campaigns={activeCampaigns} />

        <FeeOptimizerCard campaigns={activeCampaigns} />

        <section className="kf-card kf-table-card">
          <div className="kf-card-head">
            <h2>Payout History</h2>
          </div>

          {/* Tabs */}
          <div className="kf-tabs">
            {tabs.map(({ key, label }) => (
              <Link
                key={key}
                href={`?tab=${key}`}
                className={activeTab === key ? 'active' : ''}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Rows */}
          {!loadFailed && filtered.length === 0 ? (
            <div
              style={{
                padding: '48px 32px',
                textAlign: 'center',
                color: 'var(--t3)',
              }}
            >
              <KFIcon name="wallet" className="kf-empty-icon" />
              <p style={{ marginTop: 12, fontWeight: 600 }}>
                No payouts yet. Connect Stripe to start receiving funds.
              </p>
              <Link
                href="/dashboard/settings"
                className="kf-primary"
                style={{ display: 'inline-block', marginTop: 16 }}
              >
                Connect Stripe
              </Link>
            </div>
          ) : filtered.length > 0 ? (
            <div className="kf-rows">
              {filtered.map((payout) => {
                const tone = statusTone(payout.status);
                const speedLabel = SPEED_LABELS[payout.payout_speed] ?? payout.payout_speed;
                const campaignTitle = campaignTitleMap.get(payout.campaign_id) ?? payout.campaign_title;
                const payoutCurrency = campaignCurrencyMap.get(payout.campaign_id) ?? 'usd';
                return (
                  <div key={payout.id} className="kf-row">
                    <div className="kf-square blue">
                      <KFIcon name="wallet" />
                    </div>
                    <div className="kf-row-main">
                      <div>
                        <strong>{campaignTitle}</strong>
                        <span className="kf-pill orange" style={{ marginLeft: 8 }}>
                          {speedLabel}
                        </span>
                      </div>
                      <small>{fmtDate(payout.created_at)}</small>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 90 }}>
                      <b style={{ color: 'var(--green-text)', display: 'block' }}>
                        {formatMoneyShort(payout.amount_cents, payoutCurrency)}
                      </b>
                      <small style={{ color: 'var(--t3)' }}>
                        fee: {formatMoneyShort(payout.fee_cents, payoutCurrency)}
                      </small>
                    </div>
                    <span className={`kf-pill ${tone}`}>
                      {capitalize(payout.status)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="kf-table-footer" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>
              {loadFailed
                ? 'Payout count unavailable'
                : `${filtered.length} shown of ${payoutSummary?.payout_count ?? filtered.length} total payouts`}
            </span>
            {!loadFailed && (
              <span style={{ display: 'flex', gap: 8 }}>
                {cursor && (
                  <Link href={`?tab=${activeTab}`} className="kf-outline" style={{ display: 'inline-flex', minHeight: 44, alignItems: 'center', textDecoration: 'none' }}>
                    First page
                  </Link>
                )}
                {nextCursor && (
                  <Link href={`?tab=${activeTab}&cursor=${encodeURIComponent(nextCursor)}`} className="kf-outline" style={{ display: 'inline-flex', minHeight: 44, alignItems: 'center', textDecoration: 'none' }}>
                    Next page
                  </Link>
                )}
              </span>
            )}
          </div>
        </section>
      </div>
    </CharitMeShell>
  );
}
