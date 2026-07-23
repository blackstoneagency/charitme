import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import { supabaseAdmin } from '../../lib/supabase';
import { formatCents } from '../../lib/stripe';
import RecommendedCampaigns from './RecommendedCampaigns';
import SavedCampaigns from './SavedCampaigns';
import DonationHistoryList from './DonationHistoryList';
import TaxReportPanel from './TaxReportPanel';
import { buildTaxReportRecords, type TaxDonationSource } from '../../lib/tax-report';

export const dynamic = 'force-dynamic';

type DonationRow = {
  id: string;
  amount_cents: number;
  tip_cents: number;
  currency: string | null;
  status: string;
  anonymous: boolean;
  message: string | null;
  created_at: string;
  campaign_id: string;
};

type RecurringRow = {
  id: string;
  amount_cents: number;
  cadence: string;
  status: string;
  stripe_subscription_id: string | null;
  next_bill_at: string | null;
  created_at: string;
  campaign_id: string;
};

type CampaignRow = { id: string; title: string; slug: string; cover_image_url: string | null };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function cadenceLabel(c: string) {
  return c.charAt(0).toUpperCase() + c.slice(1);
}

export default async function DonorPortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/donor');

  const { data: donationData, count: donationCount } = await supabaseAdmin
    .from('donations')
    .select('id, amount_cents, tip_cents, currency, status, anonymous, message, created_at, campaign_id', { count: 'exact' })
    .eq('donor_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: recurringData } = await supabaseAdmin
    .from('recurring_donations')
    .select('id, amount_cents, cadence, status, stripe_subscription_id, next_bill_at, created_at, campaign_id')
    .eq('donor_id', user.id)
    .order('created_at', { ascending: false });

  const currentTaxYear = new Date().getUTCFullYear();
  const { data: taxDonationData } = await supabaseAdmin
    .from('donations')
    .select('id, amount_cents, tip_cents, processing_fee_cents, currency, status, created_at, campaign_id, campaigns(title, nonprofit_verified)')
    .eq('donor_id', user.id)
    .in('status', ['completed', 'refunded'])
    .gte('created_at', `${currentTaxYear}-01-01T00:00:00.000Z`)
    .lt('created_at', `${currentTaxYear + 1}-01-01T00:00:00.000Z`)
    .order('created_at', { ascending: false });

  const donations  = (donationData  ?? []) as DonationRow[];
  const recurring  = (recurringData ?? []) as RecurringRow[];
  const taxRecords = buildTaxReportRecords((taxDonationData ?? []) as unknown as TaxDonationSource[], []);
  const deductibleByCurrency = taxRecords.reduce<Record<string, number>>((totals, receipt) => {
    totals[receipt.currency] = (totals[receipt.currency] ?? 0) + receipt.tax_deductible_amount_cents;
    return totals;
  }, {});

  const cids = [...new Set([
    ...donations.map(d => d.campaign_id),
    ...recurring.map(r => r.campaign_id),
  ])].filter(Boolean);

  const campaignMap = new Map<string, CampaignRow>();
  if (cids.length > 0) {
    const { data: camps } = await supabaseAdmin
      .from('campaigns')
      .select('id, title, slug, cover_image_url')
      .in('id', cids);
    for (const c of (camps ?? []) as CampaignRow[]) campaignMap.set(c.id, c);
  }

  const currencyMap = new Map<string, string>();
  if (cids.length > 0) {
    const { data: launchSettings } = await supabaseAdmin
      .from('campaign_launch_settings')
      .select('campaign_id, currency')
      .in('campaign_id', cids);
    for (const ls of launchSettings ?? []) {
      if (ls.currency) currencyMap.set(ls.campaign_id, ls.currency);
    }
  }

  const totalGiven   = donations.filter(d => d.status === 'completed').reduce((s, d) => s + d.amount_cents, 0);
  const totalTips    = donations.filter(d => d.status === 'completed').reduce((s, d) => s + (d.tip_cents ?? 0), 0);
  const activeRecurring = recurring.filter(r => r.status === 'active');
  const monthlyTotal = activeRecurring.reduce((s, r) => s + (r.cadence === 'monthly' ? r.amount_cents : 0), 0);

  const cardStyle: React.CSSProperties = {
    background: 'var(--s1, #fff)', border: '1px solid var(--b1, #e8ecf4)', borderRadius: 14,
    padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
  };

  const statsColors = ['var(--violet)', 'var(--green)', '#f59e0b', 'var(--violet)'];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px' }}>Your Giving History</h1>
        <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>
          All your donations, receipts, and recurring giving in one place.
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Total Given',        value: formatCents(totalGiven),                color: statsColors[0] },
          { label: 'Platform Tips',      value: formatCents(totalTips),                 color: statsColors[1] },
          { label: 'Donations',          value: donations.length.toString(),            color: statsColors[2] },
          { label: 'Monthly Recurring',  value: monthlyTotal > 0 ? `${formatCents(monthlyTotal)}/mo` : '—', color: statsColors[3] },
        ].map(s => (
          <div key={s.label} style={{ ...cardStyle, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: 700 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <SavedCampaigns />
      <RecommendedCampaigns />

      <TaxReportPanel
        currentYear={currentTaxYear}
        receiptCount={taxRecords.length}
        deductibleByCurrency={deductibleByCurrency}
      />

      {/* Recurring donations */}
      {recurring.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 650, margin: '0 0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Recurring Donations
            <Link href="/dashboard/recurring" style={{ fontSize: 13, color: 'var(--violet, #6c35ff)', fontWeight: 700, textDecoration: 'none' }}>
              Manage →
            </Link>
          </h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {recurring.map(r => {
              const camp = campaignMap.get(r.campaign_id);
              return (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--b1, #f1f5f9)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {camp ? (
                        <Link href={`/campaigns/${camp.slug}`} style={{ color: 'var(--t1, #1a1a2e)', textDecoration: 'none' }}>{camp.title}</Link>
                      ) : 'Campaign'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t3, #64748b)', marginTop: 2 }}>
                      {cadenceLabel(r.cadence)} · {r.next_bill_at ? `Next: ${fmtDate(r.next_bill_at)}` : `Started ${fmtDate(r.created_at)}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <strong style={{ color: 'var(--violet, #6c35ff)' }}>{formatCents(r.amount_cents, currencyMap.get(r.campaign_id) ?? 'usd')}/{r.cadence === 'monthly' ? 'mo' : r.cadence}</strong>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: r.status === 'active' ? 'rgba(22,163,74,.10)' : 'rgba(190,18,60,.08)',
                      color: r.status === 'active' ? 'var(--green-dark, #065f46)' : 'var(--red, #be123c)',
                    }}>{r.status}</span>
                    {r.status === 'active' && r.stripe_subscription_id && (
                      <Link href={`/dashboard/recurring/cancel?sub=${r.stripe_subscription_id}`}
                        style={{ fontSize: 12, color: 'var(--t3, #94a3b8)', textDecoration: 'none', padding: '4px 10px', border: '1px solid var(--b2, #e2e8f0)', borderRadius: 8 }}>
                        Cancel
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Donation history */}
      <DonationHistoryList
        donations={donations}
        campaigns={Object.fromEntries(campaignMap)}
        hasMore={(donationCount ?? 0) > donations.length}
      />

      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--t3, #94a3b8)' }}>
        Need help with a donation? <Link href="/contact" style={{ color: 'var(--violet, #6c35ff)', fontWeight: 700 }}>Contact support</Link>
      </div>
    </div>
  );
}
