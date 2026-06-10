import 'server-only';
import Link from 'next/link';
import { CharitMeShell, TopBar, MetricGrid, KFIcon, type Metric } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { getReferralStats, getReferralTier, REFERRAL_TIERS } from '../../../lib/referrals';
import { formatCents } from '../../../lib/stripe';

export const dynamic = 'force-dynamic';

export default async function ReferralsPage() {
  const user = await requireUser();
  const stats = await getReferralStats(user.id);
  const tierProgress = getReferralTier(stats.totalConversions);

  const metrics: Metric[] = [
    {
      label: 'Successful Referrals',
      value: stats.totalConversions.toLocaleString(),
      change: 'completed donations',
      icon: 'gift',
      tone: 'green',
    },
    {
      label: 'Raised via Referrals',
      value: formatCents(stats.totalRaisedCents),
      change: 'all time',
      icon: 'wallet',
      tone: 'violet',
    },
    {
      label: 'Referral Attempts',
      value: stats.totalAttempts.toLocaleString(),
      change: 'donations started',
      icon: 'send',
      tone: 'blue',
    },
    {
      label: 'Current Tier',
      value: `${tierProgress.current.icon} ${tierProgress.current.name}`,
      change: tierProgress.next ? `${tierProgress.remaining} more to ${tierProgress.next.name}` : 'Top tier reached!',
      icon: 'crown',
      tone: 'orange',
    },
  ];

  return (
    <CharitMeShell active="Referrals">
      <TopBar
        title="Referral Rewards"
        subtitle="Share your personal links and earn recognition for every donation you inspire."
      />

      <div className="kf-content-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="kf-content-main">
          <MetricGrid metrics={metrics} />

          {/* How it works */}
          <section className="kf-card">
            <div className="kf-card-head">
              <h2>How referral rewards work</h2>
            </div>
            <div style={{ padding: '0 20px 20px', fontSize: 14, color: 'var(--t2)', lineHeight: 1.65 }}>
              <p style={{ margin: '0 0 10px' }}>
                Every campaign page has a personal referral link just for you — look for the
                {' '}<b>&ldquo;Earn rewards by sharing&rdquo;</b> box near the donate form.
              </p>
              <p style={{ margin: '0 0 14px' }}>
                When someone donates after clicking your link, it counts as a <b>successful referral</b> —
                helping you climb the reward tiers below. There&apos;s no limit to how much you can earn.
              </p>
              <Link
                href="/campaigns"
                style={{ display: 'inline-block', padding: '10px 18px', borderRadius: 10, background: 'var(--violet)', color: '#fff', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}
              >
                Browse campaigns to refer →
              </Link>
            </div>
          </section>

          {/* Tiers */}
          <section className="kf-card">
            <div className="kf-card-head">
              <h2>Reward tiers</h2>
              <span style={{ fontSize: 13, color: 'var(--t3)' }}>
                {stats.totalConversions} successful referral{stats.totalConversions !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="kf-rows">
              {REFERRAL_TIERS.map((tier) => {
                const earned = stats.totalConversions >= tier.minConversions;
                return (
                  <div
                    key={tier.name}
                    className="kf-row"
                    style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: earned ? 1 : 0.5 }}
                  >
                    <span style={{ fontSize: 28 }}>{tier.icon}</span>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: 15 }}>{tier.name}</strong>
                      <div style={{ fontSize: 13, color: 'var(--t3)' }}>{tier.description}</div>
                    </div>
                    {earned && (
                      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--green)' }}>Unlocked</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Per-campaign breakdown */}
          <section className="kf-card" style={{ overflow: 'hidden' }}>
            <div className="kf-card-head">
              <h2>Your referrals by campaign</h2>
            </div>

            {stats.campaigns.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--t3)' }}>
                <KFIcon name="send" />
                <p style={{ marginTop: 12, fontWeight: 600 }}>No referrals yet.</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>
                  Copy your personal link from any campaign page to start earning rewards.
                </p>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 110px 110px 120px',
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
                  <span>Campaign</span>
                  <span>Attempts</span>
                  <span>Converted</span>
                  <span style={{ textAlign: 'right' }}>Raised</span>
                </div>
                <div className="kf-rows">
                  {stats.campaigns.map((c) => (
                    <div
                      key={c.campaignId}
                      className="kf-row"
                      style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 120px', gap: 12, alignItems: 'center' }}
                    >
                      <Link
                        href={`/campaigns/${c.slug}`}
                        style={{ fontWeight: 700, color: 'var(--t1)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {c.title}
                      </Link>
                      <span style={{ fontSize: 13, color: 'var(--t2)' }}>{c.attempts}</span>
                      <span style={{ fontSize: 13, color: 'var(--t2)' }}>{c.conversions}</span>
                      <strong style={{ textAlign: 'right', fontSize: 15, color: 'var(--green)' }}>
                        {formatCents(c.raisedCents)}
                      </strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </CharitMeShell>
  );
}
