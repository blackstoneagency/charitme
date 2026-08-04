import type { Metadata } from 'next';
import Link from 'next/link';
import { formatMoneyShort } from '@shared/currencies';
import { PLATFORM_FEE_PERCENT, PROCESSING_FEE_PERCENT, PROCESSING_FEE_FIXED_CENTS } from '@shared/fees';
import JsonLd from '../../components/JsonLd';
import StayInformed from '../../components/StayInformed';
import { listPublishedImpactSummaries } from '../../lib/impact';
import { getImpactOverview, fallbackAreas, type ImpactArea } from '../../lib/impact-overview';
import { getCoverForCategory } from '../../lib/photo-catalog';
import { safeJsonLd } from '../../lib/json-ld';
import { CHARITME_ORIGIN } from '../../lib/public-routes';
import { seoMetadata } from '../../lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata('/impact', {
    title: 'Our Impact — Real People, Real Change',
    description:
      'Where CharitMe donations go, measured: money raised by cause, live campaigns, and published campaign impact reports.',
    alternates: { canonical: `${CHARITME_ORIGIN}/impact` },
    openGraph: {
      title: 'CharitMe — Real People. Real Change.',
      description: 'Money raised by cause, live campaigns, and published impact reports.',
      url: `${CHARITME_ORIGIN}/impact`,
      type: 'website',
    },
  });
}

export const dynamic = 'force-dynamic';

/** `null` renders an em-dash. A figure we could not read is never shown as 0. */
function Figure({ value }: { value: string | null }) {
  return <strong className="imp-stat-value">{value ?? '—'}</strong>;
}

const num = (n: number | null) => (n === null ? null : n.toLocaleString());
const money = (cents: number | null) => (cents === null ? null : formatMoneyShort(cents, 'USD'));

function AreaCard({ area }: { area: ImpactArea }) {
  const { cause, raisedCents } = area;
  return (
    <article className="imp-area">
      <Link href={`/causes/${cause.slug}`} className="imp-area-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={getCoverForCategory(cause.label)} alt="" loading="lazy" />
        <span className="imp-area-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1.1 1L12 21l7.7-7.7 1.1-1a5.5 5.5 0 0 0 0-7.8z" />
          </svg>
        </span>
      </Link>
      <div className="imp-area-body">
        <h3><Link href={`/causes/${cause.slug}`}>{cause.label}</Link></h3>
        {cause.blurb && <p>{cause.blurb}</p>}
        {/* No amount at all when unmeasured. "$0 raised" would read as a fact
            about the cause rather than about our data. */}
        {raisedCents !== null && raisedCents > 0 && (
          <p className="imp-area-raised">{formatMoneyShort(raisedCents, 'USD')} raised</p>
        )}
      </div>
    </article>
  );
}

export default async function ImpactPage() {
  const [overview, stories] = await Promise.all([
    getImpactOverview(),
    listPublishedImpactSummaries(3).catch(() => []),
  ]);

  const areas = overview.areas.length > 0 ? overview.areas : fallbackAreas();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'CharitMe impact',
    description: 'Money raised by cause, live campaigns, and published campaign impact reports.',
    url: `${CHARITME_ORIGIN}/impact`,
  };

  return (
    <>
      <JsonLd json={safeJsonLd(jsonLd)} />
      <div className="cb-page">
        <nav aria-label="Breadcrumb" className="cb-crumbs">
          <Link href="/">Home</Link>
          <span aria-hidden="true">&rsaquo;</span>
          <b aria-current="page">Impact</b>
        </nav>

        {/* ── Hero ──────────────────────────────────────────────────────────
            Paints its own surface. Dark mode's page background is flat black by
            request and a band that leaked a colour onto <body> is how that was
            broken before. */}
        <section className="imp-hero">
          <div className="imp-hero-copy">
            <h1>
              Real People.<br />Real Change.{' '}
              <span className="imp-hero-heart" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1.1 1L12 21l7.7-7.7 1.1-1a5.5 5.5 0 0 0 0-7.8z" />
                </svg>
              </span>
            </h1>
            <p>
              Every donation, every campaign, every act of kindness creates a ripple effect that
              transforms lives and builds stronger communities around the world.
            </p>
          </div>
          <div className="imp-hero-art" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getCoverForCategory('Community')} alt="" loading="eager" />
          </div>
        </section>

        {/* ── Stats strip ───────────────────────────────────────────────────
            The reference's five tiles are "People Helped", "Lives Transformed",
            "Programs Funded", "Countries Reached" and "98% Funds to Programs".
            The first two are NOT entities in this schema — nothing records a
            person helped or a life transformed, so printing them would invent a
            platform impact claim. This repo retracted one of those before.
            The shape is kept; every tile here is measured, and the last one is
            better than the mock: the platform fee is 0%, so 100% of a donation
            reaches the campaign. */}
        <section className="imp-stats" aria-label="Platform totals">
          <div className="imp-stat">
            <Figure value={money(overview.raisedTotalCents)} />
            <span>Raised for campaigns</span>
          </div>
          <div className="imp-stat">
            <Figure value={num(overview.gifts)} />
            <span>Donations made</span>
          </div>
          <div className="imp-stat">
            <Figure value={num(overview.activeCampaigns)} />
            <span>Live campaigns</span>
          </div>
          <div className="imp-stat">
            <Figure value={num(overview.countries)} />
            <span>Countries supported</span>
          </div>
          <div className="imp-stat">
            <Figure value={`${overview.toCampaignPercent}%`} />
            <span>Of your donation reaches the campaign</span>
          </div>
        </section>

        {/* ── Impact areas ──────────────────────────────────────────────── */}
        <section aria-labelledby="imp-areas">
          <div className="cb-section-head">
            <h2 id="imp-areas">Where Your Support Makes an Impact</h2>
            <Link href="/causes">View All Impact Areas <span aria-hidden="true">&rarr;</span></Link>
          </div>
          {/* Ranked by measured money, not an editorial order — the heading is a
              claim about where support lands, so data answers it. */}
          <div className="imp-area-grid">
            {areas.map((a) => <AreaCard key={a.cause.slug} area={a} />)}
          </div>
        </section>

        {/* ── Impact stories ────────────────────────────────────────────────
            The reference shows three stories with named beneficiaries — "the
            Rahman family", "Priya", "Arjun". Those people do not exist in any
            table, so the cards would be written by us and presented as real
            people's outcomes. That is fabricating a testimonial, which is the
            same call already made about the donor quote on /campaigns.
            What IS real: campaigns that have PUBLISHED an impact report, with a
            spending plan and a transparency score. Those are the stories. */}
        {stories.length > 0 && (
          <section aria-labelledby="imp-stories">
            <div className="cb-section-head">
              <h2 id="imp-stories">Impact Stories</h2>
              <Link href="/campaigns">View All Stories <span aria-hidden="true">&rarr;</span></Link>
            </div>
            <div className="imp-story-grid">
              {stories.map((s) => (
                <article key={s.campaign.id} className="imp-story">
                  <Link href={`/impact/${s.campaign.slug}`} className="imp-story-media">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getCoverForCategory(s.campaign.title)} alt="" loading="lazy" />
                    <span className="imp-story-badge">
                      {formatMoneyShort(s.campaign.raised_amount, s.campaign.currency)} raised
                    </span>
                  </Link>
                  <div className="imp-story-body">
                    <h3><Link href={`/impact/${s.campaign.slug}`}>{s.campaign.title}</Link></h3>
                    {s.plan.summary && <p>{s.plan.summary}</p>}
                    <Link href={`/impact/${s.campaign.slug}`} className="imp-story-cta">
                      Read the report <span aria-hidden="true">&rarr;</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ── Numbers ───────────────────────────────────────────────────── */}
        <section aria-labelledby="imp-numbers">
          <div className="cb-section-head">
            <h2 id="imp-numbers">Our Impact in Numbers</h2>
          </div>
          <div className="imp-numbers">
            {/* The reference puts a donut here reading "Programs & Services 82%,
                Fundraising 10%, Operations 6%, Other 2%". That is a statement
                about how CharitMe spends money, and no such accounting exists in
                this product — publishing it would be a fabricated financial
                disclosure, which is a different and worse thing than a made-up
                headline number.
                What IS knowable, exactly, is what happens to a donation, so the
                panel states that instead. Every figure below is read from
                @shared/fees rather than typed here. */}
            <div className="imp-panel">
              <h3>Where your money goes</h3>
              <ul className="imp-split">
                <li>
                  <span className="imp-split-key" data-tone="good" />
                  <span className="imp-split-label">To the campaign</span>
                  <b>{overview.toCampaignPercent}%</b>
                </li>
                <li>
                  <span className="imp-split-key" data-tone="zero" />
                  <span className="imp-split-label">CharitMe platform fee</span>
                  <b>{PLATFORM_FEE_PERCENT}%</b>
                </li>
                <li>
                  <span className="imp-split-key" data-tone="third" />
                  <span className="imp-split-label">Card processing (Stripe)</span>
                  <b>{PROCESSING_FEE_PERCENT}% + {PROCESSING_FEE_FIXED_CENTS}&cent;</b>
                </li>
              </ul>
              <p className="imp-panel-note">
                Card processing is charged by Stripe, not by CharitMe, and is shown separately at
                checkout. Supporting CharitMe with an optional tip is always a choice, never taken
                from your donation.
              </p>
            </div>

            <div className="imp-panel">
              <h3>Transparency you can trust</h3>
              {/* Each line is verifiable from something on this site, and links
                  to it. A trust list nobody can check is decoration. */}
              <ul className="imp-checks">
                <li><Link href="/fees">{overview.toCampaignPercent}% of your donation goes to the campaign</Link></li>
                <li><Link href="/trust-safety">Every campaign is reviewed before it can collect</Link></li>
                <li><Link href="/security">Payments are processed by Stripe — we never hold your card</Link></li>
                <li><Link href="/impact">Campaigns publish spending plans and progress reports</Link></li>
              </ul>
              <Link href="/transparency" className="imp-panel-link">
                Learn more about transparency <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>

            <div className="imp-panel imp-panel-cta">
              <span className="imp-cta-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1.1 1L12 21l7.7-7.7 1.1-1a5.5 5.5 0 0 0 0-7.8z" />
                </svg>
              </span>
              <h3>Together, We Can Change the World</h3>
              <p>Your support today creates a better tomorrow for millions.</p>
              <Link href="/campaigns" className="imp-cta-btn">
                Make an Impact <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Reuses the wired component from /causes rather than a second form —
            a subscribe box that posts nowhere is the classic "looks complete,
            is not connected" failure. */}
        <section className="imp-subscribe" aria-labelledby="imp-sub">
          <h2 id="imp-sub" className="sr-only">Stay connected</h2>
          <StayInformed />
        </section>
      </div>
    </>
  );
}
