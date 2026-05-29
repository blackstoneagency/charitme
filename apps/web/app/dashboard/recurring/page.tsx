import Link from 'next/link';
import { KindFundShell, TopBar, KFIcon } from '../../../components/KindFundShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

type RecurringRow = {
  id: string;
  campaign_id: string;
  amount_cents: number;
  cadence: string;
  status: string;
  stripe_subscription_id: string | null;
  next_bill_at: string | null;
  created_at: string;
};

type CampaignRef = { id: string; title: string; slug: string };

function fmtCents(c: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c / 100);
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusColor(status: string): string {
  if (status === 'active') return 'green';
  if (status === 'past_due') return 'red';
  return 'orange';
}

export default async function RecurringPage() {
  const user = await requireUser();

  const { data: subs } = await supabaseAdmin
    .from('recurring_donations')
    .select('id, campaign_id, amount_cents, cadence, status, stripe_subscription_id, next_bill_at, created_at')
    .eq('donor_id', user.id)
    .order('created_at', { ascending: false });

  const recurringList = (subs ?? []) as RecurringRow[];

  // Resolve campaign titles
  const campaignIds = [...new Set(recurringList.map(r => r.campaign_id))];
  const campaignMap = new Map<string, CampaignRef>();
  if (campaignIds.length > 0) {
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id, title, slug')
      .in('id', campaignIds);
    for (const c of (campaigns ?? []) as CampaignRef[]) {
      campaignMap.set(c.id, c);
    }
  }

  const active = recurringList.filter(r => r.status === 'active');
  const totalMonthly = active.reduce((sum, r) => sum + (r.cadence === 'monthly' ? r.amount_cents : 0), 0);

  return (
    <KindFundShell active="Recurring">
      <TopBar
        title="Recurring Donations"
        subtitle="Manage your monthly and recurring giving commitments."
      />

      <div style={{ padding: '0 32px 40px', display: 'grid', gap: 20 }}>

        {/* Stats row */}
        {recurringList.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            {[
              { label: 'Active subscriptions', value: active.length.toString(), icon: 'check', tone: 'green' as const },
              { label: 'Monthly total', value: fmtCents(totalMonthly), icon: 'gift', tone: 'violet' as const },
              { label: 'Campaigns supported', value: campaignIds.length.toString(), icon: 'stack', tone: 'blue' as const },
            ].map(m => (
              <article key={m.label} className="kf-card kf-metric">
                <div className={`kf-square ${m.tone}`}><KFIcon name={m.icon} /></div>
                <div><span>{m.label}</span><strong>{m.value}</strong></div>
              </article>
            ))}
          </div>
        )}

        {/* 0% fee badge */}
        <div style={{ padding: '14px 18px', background: '#f0fff8', border: '1px solid #bbf7d0', borderRadius: 12, fontSize: 13, color: '#065f46', fontWeight: 600 }}>
          💚 KindFund charges <strong>0%</strong> on all recurring donations. GoFundMe charges 5%. You&apos;re maximizing impact.
        </div>

        {/* Subscription list */}
        <section className="kf-card" style={{ overflow: 'hidden' }}>
          <div className="kf-card-head">
            <h2>Your Recurring Commitments</h2>
          </div>

          {recurringList.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--t3)' }}>
              <KFIcon name="gift" className="kf-empty-icon" />
              <p style={{ marginTop: 12, fontWeight: 600 }}>No recurring donations yet.</p>
              <p style={{ fontSize: 13, marginTop: 6 }}>
                Support campaigns with monthly giving — cancel any time.
              </p>
              <Link href="/campaigns" className="kf-primary" style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }}>
                Browse Campaigns
              </Link>
            </div>
          ) : (
            <div className="kf-rows">
              {recurringList.map(sub => {
                const camp = campaignMap.get(sub.campaign_id);
                return (
                  <div key={sub.id} className="kf-row">
                    <div className={`kf-square ${statusColor(sub.status)}`}>
                      <KFIcon name="gift" />
                    </div>
                    <div className="kf-row-main">
                      <div>
                        <strong>
                          {camp ? (
                            <Link href={`/campaigns/${camp.slug}`} style={{ color: 'var(--t1)', textDecoration: 'none' }}>
                              {camp.title}
                            </Link>
                          ) : 'Unknown Campaign'}
                        </strong>
                        <span className={`kf-pill ${statusColor(sub.status)}`} style={{ marginLeft: 10, fontSize: 10 }}>
                          {sub.status}
                        </span>
                      </div>
                      <small>
                        {fmtCents(sub.amount_cents)}/{sub.cadence} ·
                        {sub.status === 'active' && sub.next_bill_at
                          ? ` Next billing: ${fmtDate(sub.next_bill_at)}`
                          : ` Started ${fmtDate(sub.created_at)}`}
                      </small>
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--green)', flexShrink: 0 }}>
                      {fmtCents(sub.amount_cents)}
                    </div>
                    {sub.status === 'active' && sub.stripe_subscription_id && (
                      <CancelButton subscriptionId={sub.stripe_subscription_id} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.6 }}>
          Cancellations take effect at the end of the current billing period. You will not be charged again after cancellation.
          For questions, <Link href="/contact" style={{ color: 'var(--green)' }}>contact support</Link>.
        </p>
      </div>
    </KindFundShell>
  );
}

function CancelButton({ subscriptionId }: { subscriptionId: string }) {
  // This is a server component page — render a client-friendly form for cancel action
  return (
    <form action={`/api/donations/recurring/cancel`} method="POST" style={{ display: 'inline' }}>
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <CancelButtonClient subscriptionId={subscriptionId} />
    </form>
  );
}

// Inline client cancel button component
function CancelButtonClient({ subscriptionId }: { subscriptionId: string }) {
  // We'll make this a simple link to a confirmation action
  // Full client interactivity is handled by the confirmation modal approach below
  return (
    <Link
      href={`/dashboard/recurring/cancel?sub=${subscriptionId}`}
      style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', padding: '6px 14px', border: '1px solid var(--b2)', borderRadius: 8, textDecoration: 'none', background: '#fff', flexShrink: 0 }}>
      Cancel
    </Link>
  );
}
