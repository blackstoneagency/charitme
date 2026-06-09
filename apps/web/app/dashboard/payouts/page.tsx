import Link from 'next/link';
import { CharitMeShell, TopBar, MetricGrid, KFIcon } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import RequestPayoutButton from './RequestPayoutButton';

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
};

type CampaignIdTitle = {
  id: string;
  title: string;
};

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

function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
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
  const activeTab = (typeof params.tab === 'string' ? params.tab : 'all').toLowerCase();

  // Fetch active campaigns with available balance for the request payout widget
  const { data: activeCampaigns } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, raised_amount')
    .eq('user_id', userId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('raised_amount', { ascending: false })
    .limit(20);

  // Step 1: fetch payouts for this user
  const { data: payoutData } = await supabaseAdmin
    .from('payouts')
    .select('id,campaign_id,amount_cents,fee_cents,payout_speed,status,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  const payouts = (payoutData ?? []) as PayoutRow[];

  // Step 2: fetch campaign titles for all payout campaign IDs
  const campaignIds = [...new Set(payouts.map((p) => p.campaign_id))];
  let campaignTitleMap = new Map<string, string>();
  if (campaignIds.length > 0) {
    const { data: campaignData } = await supabaseAdmin
      .from('campaigns')
      .select('id,title')
      .in('id', campaignIds);
    const campaigns = (campaignData ?? []) as CampaignIdTitle[];
    campaignTitleMap = new Map(campaigns.map((c) => [c.id, c.title]));
  }

  // Metrics
  const monthStart = startOfMonth();
  const totalPaid = payouts
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount_cents, 0);
  const totalPending = payouts
    .filter((p) => p.status === 'requested' || p.status === 'approved')
    .reduce((sum, p) => sum + p.amount_cents, 0);
  const thisMonth = payouts
    .filter((p) => p.created_at >= monthStart)
    .reduce((sum, p) => sum + p.amount_cents, 0);
  const totalFees = payouts.reduce((sum, p) => sum + p.fee_cents, 0);

  const metrics = [
    { label: 'Total Paid Out', value: fmtCents(totalPaid), change: 'lifetime', icon: 'wallet', tone: 'violet' as const },
    { label: 'Pending', value: fmtCents(totalPending), change: 'requested + approved', icon: 'gift', tone: 'orange' as const },
    { label: 'This Month', value: fmtCents(thisMonth), change: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), icon: 'chart', tone: 'green' as const },
    { label: 'Fees Paid', value: fmtCents(totalFees), change: 'all time', icon: 'doc', tone: 'blue' as const },
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

  return (
    <CharitMeShell active="Payouts">
      <TopBar
        title="Payouts"
        subtitle="Review and manage payouts to your beneficiaries."
        actions={<RequestPayoutButton campaigns={(activeCampaigns ?? []) as { id: string; title: string; raised_amount: number }[]} />}
      />

      <div className="kf-content-grid" style={{ gridTemplateColumns: '1fr' }}>
        <MetricGrid metrics={metrics} />

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
          {filtered.length === 0 ? (
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
          ) : (
            <div className="kf-rows">
              {filtered.map((payout) => {
                const tone = statusTone(payout.status);
                const speedLabel = SPEED_LABELS[payout.payout_speed] ?? payout.payout_speed;
                const campaignTitle = campaignTitleMap.get(payout.campaign_id) ?? 'Unknown Campaign';
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
                      <b style={{ color: 'var(--green)', display: 'block' }}>
                        {fmtCents(payout.amount_cents)}
                      </b>
                      <small style={{ color: 'var(--t3)' }}>
                        fee: {fmtCents(payout.fee_cents)}
                      </small>
                    </div>
                    <span className={`kf-pill ${tone}`}>
                      {capitalize(payout.status)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="kf-table-footer">
            {filtered.length} payout{filtered.length !== 1 ? 's' : ''}
          </div>
        </section>
      </div>
    </CharitMeShell>
  );
}
