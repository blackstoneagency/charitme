import Link from 'next/link';
import type { Metadata } from 'next';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import { formatCents } from '../../lib/stripe';
import { listCurrentNeeds, URGENCY_LABEL, type Need } from '../../lib/needs';
import { EmptyState } from '../../components/ui';

export const metadata: Metadata = {
  title: 'Current Needs',
  description:
    'What communities still need funding for right now — measured from live campaign shortfalls, ordered by urgency.',
  alternates: { canonical: 'https://www.charitme.com/needs' },
};

export const revalidate = 300;

interface Props {
  searchParams: Promise<{ category?: string }>;
}

function UrgencyPill({ need }: { need: Need }) {
  const tone =
    need.urgency === 'urgent'
      ? { fg: 'var(--red-text)', bg: 'color-mix(in srgb, var(--red) 12%, transparent)' }
      : need.urgency === 'high'
        ? { fg: 'var(--orange-text)', bg: 'color-mix(in srgb, #f59e0b 14%, transparent)' }
        : { fg: 'var(--t3)', bg: 'var(--s3)' };
  return (
    <span
      style={{
        flex: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: '24px',
        padding: '0 10px',
        borderRadius: '999px',
        background: tone.bg,
        color: tone.fg,
        fontSize: '12px',
        fontWeight: 800,
      }}
    >
      {URGENCY_LABEL[need.urgency]}
    </span>
  );
}

export default async function NeedsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const category =
    sp.category && (CAMPAIGN_CATEGORIES as readonly string[]).includes(sp.category) ? sp.category : undefined;

  const needs = await listCurrentNeeds({ category });

  const href = (c?: string) => (c ? `/needs?category=${encodeURIComponent(c)}` : '/needs');

  return (
    <div className="cb-page">
      <nav aria-label="Breadcrumb" className="cb-crumbs">
        <Link href="/">Home</Link>
        <span aria-hidden="true">›</span>
        <Link href="/campaigns">Campaigns</Link>
        <span aria-hidden="true">›</span>
        <b aria-current="page">Current needs</b>
      </nav>

      <header className="cb-hero">
        <h1>What&rsquo;s needed right now</h1>
        <p>
          Every figure here is a live campaign&rsquo;s remaining shortfall — its goal minus what it has
          raised. Urgency comes from how little time is left and how much of the goal is still open,
          not from an editorial judgement.
        </p>
      </header>

      <nav aria-label="Filter by category" className="cb-chips">
        <Link href={href()} className={`cb-chip${!category ? ' is-active' : ''}`}>All needs</Link>
        {CAMPAIGN_CATEGORIES.map((c) => (
          <Link key={c} href={href(c)} className={`cb-chip${category === c ? ' is-active' : ''}`}>
            {c}
          </Link>
        ))}
      </nav>

      {needs === null ? (
        <EmptyState
          icon="⚠️"
          title="We couldn't load current needs"
          body="This is a problem on our side, not a sign that everything is funded. Please try again in a moment."
          action={<Link href="/needs" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Try again</Link>}
        />
      ) : needs.length === 0 ? (
        <EmptyState
          icon="🎉"
          title={category ? 'Nothing outstanding in this category' : 'Nothing outstanding right now'}
          body="Every live campaign here has met its goal. That is a real result, not a loading state."
          action={<Link href="/campaigns" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Browse all campaigns</Link>}
        />
      ) : (
        <ul className="needs-list">
          {needs.map((need) => (
            <li key={need.id} className="needs-row">
              <div className="needs-copy">
                <div className="needs-head">
                  <Link href={`/campaigns/${need.slug}`} className="needs-title">{need.title}</Link>
                  <UrgencyPill need={need} />
                </div>
                <p className="needs-meta">
                  {need.location ? <>{need.location} · </> : null}
                  {need.category ?? 'Uncategorised'}
                  {need.daysLeft !== null ? <> · {need.timeLabel}</> : null}
                </p>
                <div className="needs-bar" aria-hidden="true">
                  <span style={{ width: `${need.fundedPct}%` }} />
                </div>
                <p className="needs-progress">
                  {formatCents(need.raisedCents, 'usd')} raised of {formatCents(need.goalCents, 'usd')} · {need.fundedPct}% funded
                </p>
              </div>
              <div className="needs-amount">
                <strong>{formatCents(need.gapCents, 'usd')}</strong>
                <span>still needed</span>
                <Link href={`/campaigns/${need.slug}`} className="cta-primary needs-cta">Donate</Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p style={{ marginTop: '26px', fontSize: '13px', color: 'var(--t4)', maxWidth: '720px', lineHeight: 1.6 }}>
        These are campaign-level shortfalls, not itemised supply lists. CharitMe records what a
        campaign is raising toward and how much it still needs — it does not record what the money
        buys, so nothing here claims to.
      </p>
    </div>
  );
}
