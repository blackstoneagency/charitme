import type { Metadata } from 'next';
import Link from 'next/link';
import { formatMoneyShort } from '@shared/currencies';
import { PLATFORM_FEE_PERCENT, PROCESSING_FEE_PERCENT, PROCESSING_FEE_FIXED_CENTS } from '@shared/fees';
import JsonLd from '../../components/JsonLd';
import StayInformed from '../../components/StayInformed';
import { getImpactOverview, fallbackAreas, type ImpactArea } from '../../lib/impact-overview';
import { StatStrip, statValue, moneyValue } from '../../components/IndexHero';
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

/* The local `Figure` component and its `num`/`money` helpers are gone with the
   band they served. `statValue`/`moneyValue` on the shared strip carry the same
   rule — an em dash for a figure we could not read, never a zero — and carrying
   it in one place is the point of the swap. */

function AreaCard({ area }: { area: ImpactArea }) {
  const { cause, raisedCents } = area;
  return (
    <article className="imp-area">
      {/* ⚠️ Decorative for assistive tech, on purpose — axe reported `link-name`
          (serious) ×6 here because this link wraps only an `alt=""` image and so
          had NO accessible name.
          Naming it would fix the violation and leave a worse page: the <h3>
          below links to the SAME href with the cause as its text, so a screen
          reader and a keyboard user would meet two adjacent stops for one
          destination. Hiding the duplicate is the better answer.
          `tabIndex={-1}` is required alongside `aria-hidden` — an aria-hidden
          subtree must not contain a focusable element, which is its own axe
          rule (`aria-hidden-focus`). The image stays clickable for a mouse. */}
      <Link href={`/causes/${cause.slug}`} className="imp-area-media" aria-hidden="true" tabIndex={-1}>
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
  // The published-report read went with the Impact Stories row it fed. Left as
  // a single await rather than a one-element Promise.all so nothing suggests a
  // second fetch is still expected here.
  const overview = await getImpactOverview();

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
        {/* ── The measured figures ──────────────────────────────────────────
            The SAME `StatStrip` /causes, /campaigns, /donate and all 20
            /causes/<slug> pages render.

            The numbers were already right: `getImpactOverview` delegates to
            `getCausesIndexData`, so this page could never have disagreed with
            the others about a total. What it had was its own BAND — a local
            `Figure` component with its own em-dash rule, and its own markup.
            Four implementations of "render a measured figure or an em dash" is
            four places for that rule to drift; there is now one.

            The labels are harmonised too. This page said "Raised for
            campaigns", "Donations made" and "Live campaigns" for figures that
            are literally the same values the other pages call "Raised on
            CharitMe", "Gifts given" and "Active campaigns". Same number, same
            words — different wording invites a reader to think they are
            different measures.

            The fifth tile stays and is unique to this page: the share of a
            donation that reaches the campaign, DERIVED from
            `PLATFORM_FEE_PERCENT` rather than typed in, so it follows the fee
            instead of continuing to claim 100% if one is ever introduced. */}
        <StatStrip
          label="Platform totals"
          tiles={[
            { value: statValue(overview.activeCampaigns), label: 'Active campaigns' },
            { value: moneyValue(overview.raisedTotalCents), label: 'Raised on CharitMe' },
            { value: statValue(overview.gifts), label: 'Gifts given' },
            { value: statValue(overview.countries), label: 'Countries supported' },
            { value: `${overview.toCampaignPercent}%`, label: 'Of your donation reaches the campaign' },
          ]}
        />

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

        {/* ── Impact stories: REMOVED ───────────────────────────────────────
            The "Impact Stories" row (heading, "View All Stories →" and the
            published-report cards) was removed on request.

            Kept as a note rather than a silent deletion because the section was
            not decorative: it was the only public surface that linked to
            `/impact/<slug>` report pages. Those pages, `lib/impact.ts` and the
            whole `/impact/manage` authoring flow are all still live — a
            fundraiser can still publish a report and it is still readable at its
            own URL. What is gone is the discovery row on this page.

            Re-adding it means restoring `listPublishedImpactSummaries(3)` to the
            `Promise.all` in ImpactPage and this block; nothing else was touched. */}

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
