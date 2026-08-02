import Link from 'next/link';
import type { Metadata } from 'next';
import { CharitMeShell, TopBar, MetricGrid } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { getNonprofitSummary, type VerificationStatus } from '../../../lib/nonprofit-data';
import { Badge, BtnLink, EmptyState, ProgressBar } from '../../../components/ui';

export const metadata: Metadata = { title: 'Your organization' };

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

const STATUS_COPY: Record<VerificationStatus, { label: string; color: 'green' | 'blue' | 'red' | 'gray'; blurb: string }> = {
  verified:   { label: 'Verified',    color: 'green', blurb: 'Your 501(c)(3) status is confirmed.' },
  pending:    { label: 'In review',   color: 'blue',  blurb: 'We are reviewing your documents — no action needed right now.' },
  rejected:   { label: 'Needs work',  color: 'red',   blurb: 'We could not confirm your status from the documents provided.' },
  unverified: { label: 'Not started', color: 'gray',  blurb: 'Verification confirms your nonprofit status to donors.' },
};

/**
 * The nonprofit organization portal.
 *
 * `nonprofit_profiles` was read by the admin console, the Stripe webhook and
 * tax-server — but by no user-facing page, so the organization that owns the
 * record could not see it. Most consequentially, tax-server issues donors
 * deductible receipts only when the org is verified AND has receipts enabled,
 * and the nonprofit had no way to know whether that was happening.
 */
export default async function NonprofitPage() {
  const user = await requireUser();
  const { profile, campaigns, totalRaisedCents, activeCount, totalSupporters, fundedCount } = await getNonprofitSummary(user.id);

  if (!profile) {
    return (
      <CharitMeShell active="Your organization">
        <TopBar title="Your organization" subtitle="Nonprofit profile, verification, and tax receipts." />
        <div className="kf-content-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <section className="kf-card">
            <EmptyState
              icon="🏛️"
              title="No organization on your account"
              body="This page shows your nonprofit profile, verification status, and whether your donors are receiving tax-deductible receipts. Contact us to have an organization added to your account."
              action={<BtnLink href="/contact">Contact our nonprofit team</BtnLink>}
            />
          </section>
        </div>
      </CharitMeShell>
    );
  }

  const status = STATUS_COPY[profile.verificationStatus];

  const metrics = [
    { label: 'Raised',           value: fmt(totalRaisedCents), change: 'across your campaigns', icon: 'chart',  tone: 'violet' as const },
    { label: 'Active campaigns', value: String(activeCount),   change: `${campaigns.length} total`, icon: 'doc', tone: 'blue' as const },
    // ⚠️ "Supporters", not "donors". This sums each campaign's `backer_count`,
    // so someone who gave to two of your campaigns is counted twice. The
    // reference artwork labels the equivalent tile "Total Donors"; using that
    // wording over this number would overstate reach, and reach is the figure a
    // nonprofit is most likely to quote publicly.
    { label: 'Supporters', value: totalSupporters.toLocaleString(), change: 'across campaigns, not deduplicated', icon: 'team', tone: 'green' as const },
    { label: 'Fully funded', value: String(fundedCount), change: fundedCount === 1 ? 'campaign reached its goal' : 'campaigns reached their goal', icon: 'crown', tone: 'green' as const },
    { label: 'Verification',     value: status.label,          change: profile.taxId ? `EIN ${profile.taxId}` : 'no EIN on file', icon: 'check', tone: profile.isVerified ? 'green' as const : 'orange' as const },
    { label: 'Donor tax receipts', value: profile.donorsGetTaxReceipts ? 'On' : 'Off', change: profile.donorsGetTaxReceipts ? 'issued automatically' : 'not being issued', icon: 'wallet', tone: profile.donorsGetTaxReceipts ? 'green' as const : 'orange' as const },
  ];

  return (
    <CharitMeShell active="Your organization">
      <TopBar title={profile.name} subtitle="Nonprofit profile, verification, and tax receipts." />

      <div className="kf-content-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <MetricGrid metrics={metrics} />

        {/* The single question a nonprofit most needs answered, stated plainly.
            Mirrors tax-server's rule: verified AND receipts enabled. */}
        <section className="kf-card">
          <div className="kf-card-head"><h2>Are your donors getting tax receipts?</h2></div>
          <p style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 800, color: profile.donorsGetTaxReceipts ? 'var(--green-text)' : 'var(--t1)' }}>
            {profile.donorsGetTaxReceipts
              ? 'Yes — official tax receipts are issued automatically.'
              : 'Not yet — donations are not receiving official tax receipts.'}
          </p>
          {!profile.donorsGetTaxReceipts && (
            <ul style={{ margin: '0 0 12px', paddingLeft: 20, fontSize: 13.5, lineHeight: 1.8, color: 'var(--t2)' }}>
              {!profile.isVerified && (
                <li><strong>Verification is incomplete.</strong> {status.blurb}</li>
              )}
              {!profile.taxReceiptEnabled && (
                <li><strong>Tax receipts are switched off</strong> for your organization.</li>
              )}
            </ul>
          )}
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--t3)' }}>
            Both verification and the receipts setting are required before CharitMe issues a
            deductible receipt for a donation.{' '}
            <Link href="/contact" style={{ color: 'var(--violet-ink)', fontWeight: 700 }}>Contact our team</Link>{' '}
            to change either.
          </p>
        </section>

        <section className="kf-card">
          <div className="kf-card-head"><h2>Organization details</h2></div>
          <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 180px) minmax(0, 1fr)', gap: '10px 16px', margin: 0, fontSize: 13.5 }}>
            <dt style={{ color: 'var(--t3)' }}>Legal name</dt>
            <dd style={{ margin: 0, color: 'var(--t1)', fontWeight: 700 }}>{profile.name}</dd>

            <dt style={{ color: 'var(--t3)' }}>Verification</dt>
            <dd style={{ margin: 0 }}>
              <Badge color={status.color}>{status.label}</Badge>
              <span style={{ marginLeft: 8, color: 'var(--t2)' }}>{status.blurb}</span>
            </dd>

            <dt style={{ color: 'var(--t3)' }}>EIN / tax ID</dt>
            <dd style={{ margin: 0, color: 'var(--t1)' }}>{profile.taxId ?? <span style={{ color: 'var(--t3)' }}>Not on file</span>}</dd>

            <dt style={{ color: 'var(--t3)' }}>Country</dt>
            <dd style={{ margin: 0, color: 'var(--t1)' }}>{profile.country}</dd>

            {profile.address && (<>
              <dt style={{ color: 'var(--t3)' }}>Address</dt>
              <dd style={{ margin: 0, color: 'var(--t1)' }}>{profile.address}</dd>
            </>)}

            {profile.websiteUrl && (<>
              <dt style={{ color: 'var(--t3)' }}>Website</dt>
              <dd style={{ margin: 0 }}>
                <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--violet-ink)', fontWeight: 700 }}>
                  {profile.websiteUrl}
                </a>
              </dd>
            </>)}

            {profile.mission && (<>
              <dt style={{ color: 'var(--t3)' }}>Mission</dt>
              <dd style={{ margin: 0, color: 'var(--t2)', lineHeight: 1.7 }}>{profile.mission}</dd>
            </>)}
          </dl>
        </section>

        <section className="kf-card">
          <div className="kf-card-head"><h2>Your campaigns</h2></div>
          {campaigns.length === 0 ? (
            <EmptyState
              icon="✨"
              title="No campaigns yet"
              body="Start a fundraiser to begin accepting donations for your organization."
              action={<BtnLink href="/create">Start a campaign</BtnLink>}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, padding: '4px 0 8px' }}>
              {campaigns.map((c) => (
                <div key={c.id} style={{ padding: 12, borderRadius: 12, border: '1px solid var(--b1)', background: 'var(--s1)' }}>
                  <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <Link href={`/campaigns/${c.slug}`} style={{ fontWeight: 800, color: 'var(--t1)', textDecoration: 'none', fontSize: 14.5 }}>
                      {c.title}
                    </Link>
                    <Badge color={c.status === 'active' ? 'green' : 'gray'}>{c.status}</Badge>
                  </div>
                  <ProgressBar value={c.raisedCents} max={Math.max(1, c.goalCents)} />
                  <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--t2)' }}>
                    <strong style={{ color: 'var(--t1)' }}>{fmt(c.raisedCents)}</strong> raised
                    {c.goalCents > 0 && <> of {fmt(c.goalCents)}</>} · {c.backerCount} {c.backerCount === 1 ? 'donor' : 'donors'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </CharitMeShell>
  );
}
