import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { boundedQuery } from '../../../lib/query-timeout';
import { campaignColumns, applyLiveFilters, applyNotExpired } from '../../../lib/campaign-visibility';
import { CAUSES, getCause, causeBrowseHref, type Cause } from '../../../lib/causes';
import { type CampaignCardData } from '../../../components/CampaignCard';
import CauseCampaignList from './CauseCampaignList';
import { EmptyState } from '../../../components/ui';
import { getTranslator } from '../../../lib/locale-server';
import { getCauseStats, getCauseStories, getAuthoredStats } from '../../../lib/cause-landing';
import CampaignImage from '../../../components/CampaignImage';
import { getCoverForCategory, getPhotosForCategory } from '../../../lib/photo-catalog';
import { formatMoneyCompact } from '@shared/currencies';
import CauseLanding, { CauseCtaBand } from './CauseLanding';
import HelpGlyph from '../../../components/HelpGlyph';
import JsonLd from '../../../components/JsonLd';
import { safeJsonLd } from '../../../lib/json-ld';
import { getPublishedAeoEntries } from '../../../lib/aeo';

// Six per page, matching the reference design: a 3x2 grid, then the button.
// The query asks for ONE MORE than it renders — that extra row is how the page
// knows whether a next page exists without paying for a count(*).
const PAGE_SIZE = 6;

export function generateStaticParams() {
  return CAUSES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cause = getCause(slug);
  if (!cause) return { title: 'Cause not found' };

  const canonical = `https://www.charitme.com/causes/${cause.slug}`;
  const image = getCoverForCategory(cause.categories[0]);
  const title = `${cause.label} Fundraisers`;

  return {
    title,
    description: cause.blurb,
    keywords: [cause.label, `${cause.label} fundraising`, `${cause.label} donations`, 'CharitMe causes'],
    alternates: { canonical },
    openGraph: {
      title,
      description: cause.blurb,
      url: canonical,
      siteName: 'CharitMe',
      type: 'website',
      images: [{ url: image, width: 1200, height: 630, alt: `${cause.label} fundraisers on CharitMe` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: cause.blurb,
      images: [image],
    },
    robots: { index: true, follow: true },
  };
}

/**
 * `null` means the query failed; `[]` means the cause genuinely has no live
 * campaigns. The page renders different copy for each — conflating them would
 * tell a visitor a cause is empty because our database was down.
 */
/**
 * Headline numbers for a cause — every one MEASURED, none invented.
 *
 * The design for this page shows figures like "125K+ Youth Impacted" and
 * "68K+ Athletes Supported". Nothing in the schema records either, and this repo
 * has a standing rule against presenting a number it has not measured, so those
 * are not reproduced. What IS renderable from real rows is shown instead, with
 * labels that say exactly what was counted.
 *
 * `null` means the read failed. That renders as an em dash, never as 0 — "no
 * fundraisers yet" and "we could not count them" are opposite claims.
 */
// NOTE (merge takeover of #196): a local `CauseStats` + `getCauseStats` lived
// here and duplicated `lib/cause-landing.ts`, which master added with the causes
// landing design. Two implementations of the same statistic is how two surfaces
// end up quoting different numbers for the same cause, so the local copy is
// gone and the shared one is imported.
//
// The shared version is also the STRICTER of the two. It reports
// `countries` from `supported_countries` — where CharitMe can actually operate
// — whereas the local copy derived `communities` by counting distinct
// `location` strings, which is free text ("Nashville, TN"), so "Nashville" and
// "nashville, tn" counted twice and neither is a country.

async function getCampaigns(cause: Cause): Promise<CampaignCardData[] | null> {
  try {
    const cols = await campaignColumns();
    // Bounded, like every other discovery read. A timeout returns
    // `{ data: null, error }`, which takes the `null` branch below — and the page
    // already renders that as "we could not load these", not as "none exist".
    const { data, error } = await boundedQuery(() =>
      applyNotExpired(
        applyLiveFilters(
          supabaseAdmin
            .from('campaigns')
            .select(
              'id, slug, title, tagline, cover_image_url, goal_amount, raised_amount, backer_count, deadline, category, status, trust_status, nonprofit_verified, location, campaign_health_score, featured, is_demo',
            ),
          cols,
        ),
      )
        // `.in()` is why multi-category causes have their own page: /campaigns
        // filters on a single category and would silently drop the rest.
        .in('category', [...cause.categories])
        // Featured first, then by raised. This is what puts a featured campaign
        // INSIDE the top six rather than hoping it happens to have raised the
        // most — a cause's featured campaign is usually the newest one, which is
        // precisely the one a raised-amount sort buries. The card marks them, so
        // the ordering and the badge tell the same story.
        //
        // `/api/campaigns` must be asked for the SAME ordering (`featured_first`
        // below in CauseCampaignList) — two different sorts across a page
        // boundary duplicate some rows and skip others.
        .order('featured', { ascending: false })
        .order('raised_amount', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .limit(PAGE_SIZE + 1),
    );

    if (error) return null;
    return (data ?? []) as CampaignCardData[];
  } catch {
    return null;
  }
}

type CauseFaq = { question: string; answer: string };

async function getCauseFaqs(cause: Cause): Promise<readonly CauseFaq[]> {
  const published = await getPublishedAeoEntries(`/causes/${cause.slug}`, 'FAQPage', 5);
  if (published.length > 0) {
    return published.map(({ question, answer }) => ({ question, answer }));
  }
  return cause.faqs ?? [];
}

export default async function CausePage({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getTranslator();
  const { slug } = await params;
  const cause = getCause(slug);
  if (!cause) notFound();

  // Stats are fetched alongside the campaigns rather than after them: they are
  // independent queries and this page is a common entry point from a share.
  const [campaigns, stats, stories, authoredStats, faqs] = await Promise.all([
    getCampaigns(cause),
    getCauseStats(cause),
    getCauseStories(cause),
    getAuthoredStats(cause),
    getCauseFaqs(cause),
  ]);

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com';
  const canonical = `${origin}/causes/${cause.slug}`;
  const visibleCampaigns = campaigns?.slice(0, PAGE_SIZE) ?? [];
  const indexableCampaigns = visibleCampaigns.filter((campaign) => campaign.is_demo !== true);
  const hasExampleCatalog = ['health-wellness', 'education', 'faith-belief'].includes(cause.slug)
    || visibleCampaigns.some((campaign) => campaign.is_demo === true);
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${canonical}#page`,
        url: canonical,
        name: `${cause.label} Fundraisers`,
        description: cause.blurb,
        isPartOf: { '@id': `${origin}/#website` },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: indexableCampaigns.length,
          itemListElement: indexableCampaigns.map((campaign, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: campaign.title,
            url: `${origin}/campaigns/${campaign.slug}`,
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: origin },
          { '@type': 'ListItem', position: 2, name: 'Causes', item: `${origin}/causes` },
          { '@type': 'ListItem', position: 3, name: cause.label, item: canonical },
        ],
      },
      ...(faqs.length > 0
        ? [{
            '@type': 'FAQPage',
            mainEntity: faqs.map((faq) => ({
              '@type': 'Question',
              name: faq.question,
              acceptedAnswer: { '@type': 'Answer', text: faq.answer },
            })),
          }]
        : []),
    ],
  };

  return (
    <div className="cause-landing">
      <JsonLd json={safeJsonLd(structuredData)} />
      <CauseLanding cause={cause} stats={stats} authoredStats={authoredStats} />

      <div className="container" style={{ padding: '8px 0 72px' }}>
      {/* ── Order, and why ────────────────────────────────────────────────────
          Reference order is: stats band → hub tabs → campaign grid → how your
          support helps → stories → closing band. The grid used to sit BELOW the
          two explainer blocks, which put ~1.5 screens of editorial copy between
          a visitor and the thing they came to do. It is now the first thing
          under the stats, and the explainers follow it.

          The grid's heading is visually hidden rather than deleted: the design
          runs the tabs straight into the cards with no "Featured campaigns"
          title, but the section still needs an accessible name — `aria-labelledby`
          pointing at nothing is worse than the heading it replaced. */}
      <h2 id="cause-campaigns" className="cl-visually-hidden">
        {t('cl.featured')}
      </h2>

      <div>
        {cause.narrower && (
          <p
            style={{
              fontSize: '13px',
              color: 'var(--t3)',
              lineHeight: 1.55,
              margin: '0 0 24px',
              padding: '12px 14px',
              background: 'var(--s2)',
              border: '1px solid var(--b1)',
              borderRadius: 'var(--r)',
            }}
          >
            {t('cause.narrower_prefix')}{' '}
            <strong style={{ color: 'var(--t1)', fontWeight: 700 }}>
              {cause.categories.join(' and ')}
            </strong>{' '}
            {cause.categories.length === 1 ? t('cause.narrower_one_suffix') : t('cause.narrower_many_suffix')}
          </p>
        )}
      </div>

      {/* ── The cause hub ─────────────────────────────────────────────────────
          Each link is an EXISTING page narrowed by `?cause=`, not a new per-cause
          page — twenty causes times six pages would be 120 routes that drift.

          ⚠️ `scoped` is not decoration. An earlier comment here claimed
          "campaigns and volunteering already accepted a cause"; measured against
          the routes, NEITHER did. /campaigns took only `?category=` and dropped
          `?cause=` on the floor, so "All campaigns" rendered the entire
          unfiltered list under a label naming one cause; /volunteer reads no
          search params at all. /campaigns has since been taught the param (it
          maps the slug to the cause's categories and uses `.in()`), and
          /volunteer is now marked unscoped instead of pretending.

          The rule this restores: a link may be site-wide, but it must SAY so.
          That is what the deleted `cause-ways-core` `scoped` flag was for, and
          removing it is how two false filters went unnoticed. */}
      <nav aria-label={`More in ${cause.label}`} className="cl-tabs">
        {[
          { href: `/campaigns?cause=${cause.slug}`, label: 'All campaigns', scoped: true },
          { href: `/events?cause=${cause.slug}`, label: 'Events', scoped: true },
          { href: `/teams?cause=${cause.slug}`, label: 'Teams & clubs', scoped: true },
          { href: '/volunteer', label: 'Volunteer', scoped: false },
          { href: '/success-stories', label: 'Stories', scoped: false },
          { href: '/impact', label: 'Impact reports', scoped: false },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="cl-tab">
            {l.label}
            {!l.scoped && <span className="cl-tab-scope"> · all causes</span>}
          </Link>
        ))}
      </nav>

      {hasExampleCatalog && (
        <p className="cl-catalog-note">
          Explore 50 CharitMe campaign examples alongside live fundraisers. Example cards are clearly labeled and cannot accept donations.
        </p>
      )}

      {campaigns === null ? (
        <EmptyState
          icon="⚠️"
          title={t('cause.load_failed_title')}
          body={t('cause.load_failed_body')}
          action={
            <Link href={`/causes/${cause.slug}`} style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>
              {t('action.retry')}
            </Link>
          }
        />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon="🌱"
          title={t('cause.empty_title', { cause: t(`nav.cause.${cause.slug}`) })}
          body={t('cause.empty_body')}
          action={
            <Link href="/campaigns" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>
              {t('cause.browse_all')}
            </Link>
          }
        />
      ) : (
        <>
          <div id="cause-campaign-grid">
            <CauseCampaignList
              initial={campaigns.slice(0, PAGE_SIZE)}
              categories={cause.categories}
              hasMore={campaigns.length > PAGE_SIZE}
              seeMoreLabel={t('cause.see_more')}
            />
          </div>
        </>
      )}

      {/* ── How your support helps ───────────────────────────────────────────
          Editorial, not measured: it says what a gift BUYS, which is a claim
          about the cause rather than a count of it. The four measured figures
          live in CauseLanding's stats sheet, where the design puts them —
          rendering them here as well put two sets of the same numbers on one
          page. */}
      {cause.helps && cause.helps.length > 0 && (
        <section
          className={`cl-helps${cause.helpsAlign === 'start' ? ' cl-helps--start' : ''}`}
          aria-labelledby="how-support-helps"
        >
          <h2 id="how-support-helps" className="cl-helps-title">
            {cause.helpsTitle ?? 'How Your Support Helps'}
          </h2>
          <ul className="cl-helps-grid">
            {cause.helps.map((h, i) => (
              <li className="cl-helps-card" key={h.title}>
                <div className="cl-helps-media" aria-hidden="true">
                  <CampaignImage
                    src={getPhotosForCategory(cause.categories[0], cause.helps!.length)[i] ?? null}
                    category={cause.categories[0]}
                    campaignKey={`${cause.slug}-help-${i}`}
                    alt=""
                    width={320}
                    height={200}
                  />
                </div>
                {/* aria-hidden here, not inside HelpGlyph: the <h3> below already
                    names the card, so announcing the icon would only repeat it. */}
                <span
                  className={`cl-helps-ic cl-helps-ic--${h.icon ?? i % 5}`}
                  aria-hidden="true"
                >
                  <HelpGlyph icon={h.icon} />
                </span>
                <h3>{h.title}</h3>
                <p>{h.body}</p>
                {/* One destination for all four, which is what the label means:
                    `helps` are editorial groupings and nothing in the schema
                    tags a campaign as "shelter" rather than "food", so a
                    per-card filter would promise a narrowing that is not there.
                    The accessible name carries the card's title so a list of
                    four identical "Help now" links is still distinguishable. */}
                {cause.helpsCta && (
                  <Link
                    // `causeBrowseHref` now resolves to exactly this, for every
                    // cause. It used to return the CAUSE PAGE for a
                    // multi-category one — which is why this href was written
                    // out by hand here — and that branch has been removed
                    // precisely because it also broke the two "Donate now"
                    // buttons, which nobody had hardcoded around.
                    href={causeBrowseHref(cause)}
                    className="cl-helps-cta"
                    aria-label={`${cause.helpsCta}: ${h.title}`}
                  >
                    {cause.helpsCta} →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Stories from the field ────────────────────────────────────────────
          ⚠️ The reference draws these as video cards with a start-media control
          over each photo. Nothing here can be started: every `campaign_media`
          row of type `video` points at a reserved `.example` host that cannot
          resolve. A control that opens a campaign page instead of starting media
          is a fake affordance, so it is not rendered. These are the cause's
          genuinely COMPLETED campaigns, linking to the campaign and labelled as
          reading, not watching. */}
      {stories !== null && stories.length > 0 && (
        <section className="cl-stories" aria-labelledby="cause-stories">
          <header className="cl-stories-head">
            <h2 id="cause-stories">Stories from the Field</h2>
            <Link href="/success-stories" className="cl-stories-all">View all stories →</Link>
          </header>
          <ul className="cl-stories-grid">
            {stories.map((story, i) => {
              // The play control and "Watch Story" appear only for a story that
              // actually carries a video. The design draws them on every card;
              // rendering one over a campaign link would be a control that plays
              // nothing. `cause_stories.video_url` is what makes it real.
              const chip = story.chipLabel ?? story.category;
              const accent = story.chipLabel ? story.chipAccent : i % 3;
              const href = story.videoUrl ?? (story.slug ? `/campaigns/${story.slug}` : null);
              if (!href) return null;
              return (
              <li key={story.id}>
                <Link
                  href={href}
                  className="cl-story"
                  {...(story.videoUrl ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  <span className="cl-story-media">
                    <CampaignImage
                      src={story.cover}
                      category={story.category}
                      campaignKey={story.slug ?? story.id}
                      alt=""
                      width={420}
                      height={260}
                    />
                    {chip && <span className={`cl-story-chip cl-story-chip--${accent}`}>{chip}</span>}
                    {story.videoUrl && (
                      <span className="cl-story-play" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.6v12.8L19 12 8 5.6Z" /></svg>
                      </span>
                    )}
                  </span>
                  <span className="cl-story-body">
                    <strong>{story.title}</strong>
                    {story.blurb && <span className="cl-story-blurb">{story.blurb}</span>}
                    {!story.videoUrl && (
                      <span className="cl-story-meta">
                        Funded — {formatMoneyCompact(story.raisedCents, 'usd')} from {story.backers.toLocaleString()}{' '}
                        {story.backers === 1 ? 'supporter' : 'supporters'}
                      </span>
                    )}
                    <span className="cl-story-cta">
                      {story.videoUrl ? 'Watch Story →' : 'Read the story →'}
                    </span>
                  </span>
                </Link>
              </li>
              );
            })}
          </ul>
        </section>
      )}

      {faqs.length > 0 && (
        <section className="cl-faq" aria-labelledby="cause-faq-title">
          <header className="cl-faq-head">
            <p>{cause.label}</p>
            <h2 id="cause-faq-title">Frequently Asked Questions</h2>
          </header>
          <div className="cl-faq-list">
            {faqs.map((faq, index) => (
              <details key={faq.question} open={index === 0}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
          <p className="cl-faq-more">
            Need another answer? <Link href="/help">Visit the Help Center</Link> or{' '}
            <Link href="/contact">contact support</Link>.
          </p>
        </section>
      )}
      </div>

      <CauseCtaBand cause={cause} />
    </div>
  );
}
