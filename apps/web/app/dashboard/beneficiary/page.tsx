import Link from 'next/link';
import type { Metadata } from 'next';
import { CharitMeShell, TopBar, MetricGrid } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { getBeneficiarySummary } from '../../../lib/beneficiary-data';
import CampaignImage from '../../../components/CampaignImage';
import { ProgressBar, Badge, EmptyState } from '../../../components/ui';

export const metadata: Metadata = { title: 'Campaigns for you' };

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/**
 * The beneficiary portal.
 *
 * `beneficiary` is a first-class role with its own invite flow, but nothing read
 * `campaigns.beneficiary_profile_id` — so accepting an invite used to drop the
 * user on /dashboard/payouts, which scopes by user_id (the OWNER) and therefore
 * showed them an empty dashboard.
 *
 * These campaigns belong to someone else, so this view is deliberately read-only:
 * it answers "how is the fundraiser for me doing, and has any money actually
 * reached me?" — without owner-only controls the beneficiary can't use.
 */
export default async function BeneficiaryPage() {
  const user = await requireUser();
  const summary = await getBeneficiarySummary(user.id);

  const metrics = [
    { label: 'Raised for you', value: fmt(summary.totalRaisedCents), change: 'across all campaigns', icon: 'chart', tone: 'violet' as const },
    { label: 'Paid out', value: fmt(summary.totalPaidOutCents), change: 'funds already sent', icon: 'wallet', tone: 'green' as const },
    { label: 'On the way', value: fmt(summary.totalPendingPayoutCents), change: 'requested or approved', icon: 'gift', tone: 'orange' as const },
    { label: 'Active campaigns', value: String(summary.activeCount), change: `${summary.campaigns.length} total`, icon: 'doc', tone: 'blue' as const },
  ];

  return (
    <CharitMeShell active="Campaigns for you">
      <TopBar
        title="Campaigns for you"
        subtitle="Fundraisers where you are the named beneficiary."
      />

      <div className="kf-content-grid" style={{ gridTemplateColumns: '1fr' }}>
        <MetricGrid metrics={metrics} />

        <section className="kf-card">
          <div className="kf-card-head">
            <h2>Your campaigns</h2>
          </div>

          {summary.campaigns.length === 0 ? (
            <EmptyState
              icon="🎁"
              title="No campaigns yet"
              body="When an organizer names you as the beneficiary of a fundraiser, it will appear here — with what has been raised and whether funds have been paid out."
            />
          ) : (
            <div style={{ display: 'grid', gap: 14, padding: '4px 0 8px' }}>
              {summary.campaigns.map((c) => {
                return (
                  <article
                    key={c.id}
                    style={{
                      display: 'grid', gridTemplateColumns: 'minmax(0, 84px) minmax(0, 1fr)', gap: 16,
                      alignItems: 'center', padding: 14, borderRadius: 14,
                      border: '1px solid var(--b1)', background: 'var(--s1)',
                    }}
                  >
                    <div style={{ width: 84, height: 64, borderRadius: 10, overflow: 'hidden', background: 'var(--s2)' }}>
                      {/* CampaignImage resolves its own fallback from category + key. */}
                      <CampaignImage
                        src={c.coverImageUrl}
                        category={c.category}
                        campaignKey={c.slug}
                        alt={c.title}
                        width={84}
                        height={64}
                      />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <Link
                          href={`/campaigns/${c.slug}`}
                          style={{ fontWeight: 800, color: 'var(--t1)', textDecoration: 'none', fontSize: 15 }}
                        >
                          {c.title}
                        </Link>
                        <Badge color={c.status === 'active' ? 'green' : 'gray'}>{c.status}</Badge>
                      </div>

                      <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--t3)' }}>
                        Organized by {c.organizerName} · {c.backerCount} {c.backerCount === 1 ? 'supporter' : 'supporters'}
                      </p>

                      <ProgressBar value={c.raisedCents} max={Math.max(1, c.goalCents)} />

                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8, fontSize: 12.5 }}>
                        <span style={{ color: 'var(--t2)' }}>
                          <strong style={{ color: 'var(--t1)' }}>{fmt(c.raisedCents)}</strong> raised
                          {c.goalCents > 0 && <> of {fmt(c.goalCents)}</>}
                        </span>
                        {c.paidOutCents > 0 && (
                          <span style={{ color: 'var(--green-text)' }}>{fmt(c.paidOutCents)} paid out</span>
                        )}
                        {c.pendingPayoutCents > 0 && (
                          <span style={{ color: 'var(--t3)' }}>{fmt(c.pendingPayoutCents)} on the way</span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="kf-card">
          <div className="kf-card-head">
            <h2>How payouts reach you</h2>
          </div>
          <p style={{ margin: '0 0 10px', fontSize: 13.5, lineHeight: 1.7, color: 'var(--t2)' }}>
            The organizer running each fundraiser requests payouts, and CharitMe sends the funds to the
            payout account set up for the campaign. <strong>Paid out</strong> means the money has already
            been sent; <strong>on the way</strong> means a payout has been requested or approved but has not
            settled yet.
          </p>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: 'var(--t2)' }}>
            Questions about a specific campaign are best raised with its organizer. If something looks wrong,{' '}
            <Link href="/contact" style={{ color: 'var(--violet-ink)', fontWeight: 700 }}>contact our team</Link>.
          </p>
        </section>
      </div>
    </CharitMeShell>
  );
}
