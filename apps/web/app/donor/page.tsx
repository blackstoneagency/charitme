import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import { supabaseAdmin } from '../../lib/supabase';
import { formatCents } from '../../lib/stripe';

export const dynamic = 'force-dynamic';

type DonationRow = {
  id: string;
  amount_cents: number;
  tip_cents: number;
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

  // Fetch this donor's donations
  const { data: donationData } = await supabaseAdmin
    .from('donations')
    .select('id, amount_cents, tip_cents, status, anonymous, message, created_at, campaign_id')
    .eq('donor_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  // Fetch recurring donations
  const { data: recurringData } = await supabaseAdmin
    .from('recurring_donations')
    .select('id, amount_cents, cadence, status, stripe_subscription_id, next_bill_at, created_at, campaign_id')
    .eq('donor_id', user.id)
    .order('created_at', { ascending: false });

  const donations  = (donationData  ?? []) as DonationRow[];
  const recurring  = (recurringData ?? []) as RecurringRow[];

  // Resolve campaign titles
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

  const totalGiven   = donations.filter(d => d.status === 'completed').reduce((s, d) => s + d.amount_cents, 0);
  const totalTips    = donations.filter(d => d.status === 'completed').reduce((s, d) => s + (d.tip_cents ?? 0), 0);
  const activeRecurring = recurring.filter(r => r.status === 'active');
  const monthlyTotal = activeRecurring.reduce((s, r) => s + (r.cadence === 'monthly' ? r.amount_cents : 0), 0);

  const cardStyle: React.CSSProperties = {
    background: '#fff', border: '1px solid #e8ecf4', borderRadius: 14,
    padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 4px' }}>Your Giving History</h1>
        <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>
          All your donations, receipts, and recurring giving in one place.
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Total Given',        value: formatCents(totalGiven),                color: '#6c35ff' },
          { label: 'Platform Tips',      value: formatCents(totalTips),                 color: '#19b86a' },
          { label: 'Donations',          value: donations.length.toString(),            color: '#f59e0b' },
          { label: 'Monthly Recurring',  value: monthlyTotal > 0 ? `${formatCents(monthlyTotal)}/mo` : '—', color: '#ec3fb4' },
        ].map(s => (
          <div key={s.label} style={{ ...cardStyle, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: 700 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recurring donations */}
      {recurring.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Recurring Donations
            <Link href="/dashboard/recurring" style={{ fontSize: 13, color: '#6c35ff', fontWeight: 700, textDecoration: 'none' }}>
              Manage →
            </Link>
          </h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {recurring.map(r => {
              const camp = campaignMap.get(r.campaign_id);
              return (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {camp ? (
                        <Link href={`/campaigns/${camp.slug}`} style={{ color: '#1a1a2e', textDecoration: 'none' }}>{camp.title}</Link>
                      ) : 'Campaign'}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {cadenceLabel(r.cadence)} · {r.next_bill_at ? `Next: ${fmtDate(r.next_bill_at)}` : `Started ${fmtDate(r.created_at)}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <strong style={{ color: '#6c35ff' }}>{formatCents(r.amount_cents)}/{r.cadence === 'monthly' ? 'mo' : r.cadence}</strong>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: r.status === 'active' ? '#f0fff8' : '#fef2f2',
                      color: r.status === 'active' ? '#065f46' : '#be123c',
                    }}>{r.status}</span>
                    {r.status === 'active' && r.stripe_subscription_id && (
                      <Link href={`/dashboard/recurring/cancel?sub=${r.stripe_subscription_id}`}
                        style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'none', padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: 8 }}>
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
      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Donation History
          {donations.length > 0 && (
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{donations.length} total</span>
          )}
        </h2>

        {donations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💚</div>
            <p style={{ fontWeight: 700, margin: '0 0 4px' }}>No donations yet.</p>
            <p style={{ fontSize: 13 }}>Find a campaign to support below.</p>
            <Link href="/campaigns" style={{ display: 'inline-block', marginTop: 12, padding: '10px 24px', background: '#6c35ff', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              Browse Campaigns
            </Link>
          </div>
        ) : (
          <div>
            {donations.map(d => {
              const camp = campaignMap.get(d.campaign_id);
              return (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                      {camp ? (
                        <Link href={`/campaigns/${camp.slug}`} style={{ color: '#1a1a2e', textDecoration: 'none' }}>{camp.title}</Link>
                      ) : 'Campaign'}
                    </div>
                    {d.message && (
                      <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', margin: '2px 0' }}>
                        &ldquo;{d.message.slice(0, 80)}{d.message.length > 80 ? '…' : ''}&rdquo;
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                      {fmtDate(d.created_at)}
                      {d.anonymous && ' · Anonymous'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 16 }}>
                    <strong style={{ fontSize: 15, color: d.status === 'refunded' ? '#94a3b8' : '#6c35ff', textDecoration: d.status === 'refunded' ? 'line-through' : 'none' }}>
                      {formatCents(d.amount_cents)}
                    </strong>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: d.status === 'completed' ? '#f0fff8' : d.status === 'refunded' ? '#f1f5f9' : '#fef2f2',
                      color: d.status === 'completed' ? '#065f46' : d.status === 'refunded' ? '#64748b' : '#be123c',
                    }}>{d.status}</span>
                    {d.status === 'completed' && (
                      <Link href={`/dashboard/refund?donation_id=${d.id}`}
                        style={{ fontSize: 11, color: '#94a3b8', textDecoration: 'none' }}>
                        Refund?
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
        Need help with a donation? <Link href="/contact" style={{ color: '#6c35ff', fontWeight: 700 }}>Contact support</Link>
      </div>
    </div>
  );
}
