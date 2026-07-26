import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import { supabaseAdmin } from '../../lib/supabase';
import { formatCents } from '../../lib/stripe';
import RecommendedCampaigns from './RecommendedCampaigns';
import SavedCampaigns from './SavedCampaigns';
import DonationHistoryList from './DonationHistoryList';

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

  // Independent queries — run in parallel (avoids a serial round-trip waterfall).
  const [donationRes, totalsRes, recurringRes] = await Promise.all([
    supabaseAdmin
      .from('donations')
      .select('id, amount_cents, tip_cents, currency, status, anonymous, message, created_at, campaign_id', { count: 'exact' })
      .eq('donor_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100),
    // Separate narrow query for the money tiles. The list above is capped at 100
    // for rendering, and summing THAT array understated a long-time donor's
    // lifetime "Total Given" — their own giving record, quietly wrong. Only two
    // small ints per row, so this stays cheap. The explicit high limit matters:
    // PostgREST caps unbounded selects (commonly 1000), so omitting it would
    // silently reintroduce the same bug at a different threshold.
    supabaseAdmin
      .from('donations')
      .select('amount_cents, tip_cents')
      .eq('donor_id', user.id)
      .eq('status', 'completed')
      .limit(10_000),
    supabaseAdmin
      .from('recurring_donations')
      .select('id, amount_cents, cadence, status, stripe_subscription_id, next_bill_at, created_at, campaign_id')
      .eq('donor_id', user.id)
      .order('created_at', { ascending: false }),
  ]);
  const { data: donationData, count: donationCount } = donationRes;
  const { data: recurringData } = recurringRes;

  const donations  = (donationData  ?? []) as DonationRow[];
  const recurring  = (recurringData ?? []) as RecurringRow[];

  const cids = [...new Set([
    ...donations.map(d => d.campaign_id),
    ...recurring.map(r => r.campaign_id),
  ])].filter(Boolean);

  const campaignMap = new Map<string, CampaignRow>();
  const currencyMap = new Map<string, string>();
  if (cids.length > 0) {
    // Both keyed off the same campaign-id set but independent of each other.
    const [campsRes, launchRes] = await Promise.all([
      supabaseAdmin.from('campaigns').select('id, title, slug, cover_image_url').in('id', cids),
      supabaseAdmin.from('campaign_launch_settings').select('campaign_id, currency').in('campaign_id', cids),
    ]);
    for (const c of (campsRes.data ?? []) as CampaignRow[]) campaignMap.set(c.id, c);
    for (const ls of launchRes.data ?? []) {
      if (ls.currency) currencyMap.set(ls.campaign_id, ls.currency);
    }
  }

  // Computed from the UNCAPPED totals query, not the 100-row display list.
  const allCompleted = (totalsRes.data ?? []) as { amount_cents: number; tip_cents: number | null }[];
  const totalGiven   = allCompleted.reduce((s, d) => s + d.amount_cents, 0);
  const totalTips    = allCompleted.reduce((s, d) => s + (d.tip_cents ?? 0), 0);
  // The query already asked for `count: 'exact'`; the tile just wasn't using it,
  // so a donor with 250 gifts saw "100".
  const donationsCount = donationRes.count ?? donations.length;
  const currentYear  = new Date().getUTCFullYear();
  const taxYears = [...new Set(
    donations
      .filter(d => d.status === 'completed')
      .map(d => new Date(d.created_at).getUTCFullYear()),
  )].sort((a, b) => b - a);
  // Always offer the current tax year even before the first gift lands.
  if (!taxYears.includes(currentYear)) taxYears.unshift(currentYear);
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
          { label: 'Donations',          value: donationsCount.toString(),              color: statsColors[2] },
          { label: 'Monthly Recurring',  value: monthlyTotal > 0 ? `${formatCents(monthlyTotal)}/mo` : '—', color: statsColors[3] },
        ].map(s => (
          <div key={s.label} style={{ ...cardStyle, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: 700 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tax statements — consolidated annual giving statements for filing */}
      <div style={{ ...cardStyle, marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 16, fontWeight: 650, margin: 0 }}>Tax Statements</h2>
        </div>
        <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 14px' }}>
          Download a consolidated annual giving statement for your records, with a clear
          tax-deductible vs. non-deductible breakdown.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {taxYears.map(y => (
            <div key={y} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--b1, #e8ecf4)', borderRadius: 'var(--r, 10px)', padding: '8px 12px' }}>
              <Link href={`/donor/tax-statement/${y}`} style={{ fontSize: 13, fontWeight: 700, color: 'var(--violet, #6c35ff)', textDecoration: 'none' }}>
                {y} statement
              </Link>
              <a
                href={`/api/donor/tax-statement?year=${y}&format=csv`}
                aria-label={`Download ${y} giving statement as CSV`}
                style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3, #64748b)', textDecoration: 'none' }}
              >
                CSV ↓
              </a>
            </div>
          ))}
        </div>
      </div>

      <SavedCampaigns />
      <RecommendedCampaigns />

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
