import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { boundedQuery } from '../../../lib/query-timeout';
import { campaignColumns, applyLiveFilters } from '../../../lib/campaign-visibility';
import { CAUSES, getCause, type Cause } from '../../../lib/causes';
import { CampaignCard, CampaignGrid, type CampaignCardData } from '../../../components/CampaignCard';
import { EmptyState } from '../../../components/ui';
import { getTranslator } from '../../../lib/locale-server';
import { getCauseStats, getCauseStories } from '../../../lib/cause-landing';
import CampaignImage from '../../../components/CampaignImage';
import { getPhotosForCategory } from '../../../lib/photo-catalog';
import { formatMoneyCompact } from '@shared/currencies';
import CauseLanding, { CauseCtaBand } from './CauseLanding';

const PAGE_SIZE = 24;

export function generateStaticParams() {
  return CAUSES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cause = getCause(slug);
  if (!cause) return { title: 'Cause not found' };

  return {
    title: `${cause.label} Fundraisers`,
    description: cause.blurb,
    alternates: { canonical: `https://www.charitme.com/causes/${cause.slug}` },
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
      applyLiveFilters(
        supabaseAdmin
          .from('campaigns')
          .select(
            'id, slug, title, tagline, cover_image_url, goal_amount, raised_amount, backer_count, deadline, category, status, trust_status, nonprofit_verified, location, campaign_health_score',
          ),
        cols,
      )
        // `.in()` is why multi-category causes have their own page: /campaigns
        // filters on a single category and would silently drop the rest.
        .in('category', [...cause.categories])
        .order('raised_amount', { ascending: false })
        .limit(PAGE_SIZE),
    );

    if (error) return null;
    return (data ?? []) as CampaignCardData[];
  } catch {
    return null;
  }
}

export default async function CausePage({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getTranslator();
  const { slug } = await params;
  const cause = getCause(slug);
  if (!cause) notFound();

  // Stats are fetched alongside the campaigns rather than after them: they are
  // independent queries and this page is a common entry point from a share.
  const [campaigns, stats, stories] = await Promise.all([
    getCampaigns(cause),
    getCauseStats(cause),
    getCauseStories(cause),
  ]);

  return (
    <div className="cause-landing">
      <CauseLanding cause={cause} stats={stats} />

      <div className="container" style={{ padding: '8px 0 72px' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 id="cause-campaigns" style={{ fontSize: 'var(--fs-h2)', fontWeight: 800, color: 'var(--t1)', lineHeight: 1.15, letterSpacing: '-.02em', margin: 0 }}>
          {t('cl.featured')}
        </h2>
        <Link
          href={cause.categories.length === 1 ? `/campaigns?category=${encodeURIComponent(cause.categories[0])}` : `/campaigns?cause=${cause.slug}`}
          style={{ display: 'inline-flex', alignItems: 'center', minHeight: '24px', fontSize: '14px', fontWeight: 700, color: 'var(--brand-text)', textDecoration: 'none' }}
        >
          {t('cl.view_all')}
        </Link>
      </header>

      <div style={{ marginBottom: '28px' }}>
        {cause.narrower && (
          <p
            style={{
              fontSize: '13px',
              color: 'var(--t3)',
              lineHeight: 1.55,
              marginTop: '16px',
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

      {/* The four measured figures moved into CauseLanding's stats sheet, which
          is where the design puts them. Rendering them here as well meant two
          sets of the same numbers on one page. */}
      {cause.helps && cause.helps.length > 0 && (
        <section className="cl-helps" aria-labelledby="how-support-helps">
          <h2 id="how-support-helps" className="cl-helps-title">How your support helps</h2>
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
                <span className={`cl-helps-ic cl-helps-ic--${i % 5}`} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
                  </svg>
                </span>
                <h3>{h.title}</h3>
                <p>{h.body}</p>
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
            <h2 id="cause-stories">Stories from the field</h2>
            <Link href="/success-stories" className="cl-stories-all">View all stories →</Link>
          </header>
          <ul className="cl-stories-grid">
            {stories.map((story) => (
              <li key={story.id}>
                <Link href={`/campaigns/${story.slug}`} className="cl-story">
                  <span className="cl-story-media">
                    <CampaignImage
                      src={story.cover}
                      category={story.category}
                      campaignKey={story.slug}
                      alt=""
                      width={420}
                      height={260}
                    />
                    {story.category && <span className="cl-story-chip">{story.category}</span>}
                  </span>
                  <span className="cl-story-body">
                    <strong>{story.title}</strong>
                    {story.blurb && <span className="cl-story-blurb">{story.blurb}</span>}
                    <span className="cl-story-meta">
                      Funded — {formatMoneyCompact(story.raisedCents, 'usd')} from {story.backers.toLocaleString()}{' '}
                      {story.backers === 1 ? 'supporter' : 'supporters'}
                    </span>
                    <span className="cl-story-cta">Read the story →</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The cause hub. Each link is the EXISTING page scoped by `?cause=`, not a
          new per-cause page — twenty causes times six pages would be 120 routes
          that drift apart. Campaigns and volunteering already accepted a cause;
          events and teams gained it in this change. */}
      <nav aria-label={`More in ${cause.label}`} className="cl-tabs">
        {[
          { href: `/campaigns?cause=${cause.slug}`, label: 'All campaigns' },
          { href: `/events?cause=${cause.slug}`, label: 'Events' },
          { href: `/teams?cause=${cause.slug}`, label: 'Teams & clubs' },
          { href: `/volunteer?cause=${cause.slug}`, label: 'Volunteer' },
          { href: '/success-stories', label: 'Stories' },
          { href: '/impact', label: 'Impact reports' },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="cl-tab">{l.label}</Link>
        ))}
      </nav>

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
          <CampaignGrid>
            {campaigns.map((c) => <CampaignCard key={c.id} campaign={c} variant="feature" />)}
          </CampaignGrid>

          {campaigns.length === PAGE_SIZE && (
            <div style={{ textAlign: 'center', marginTop: '36px' }}>
              <Link
                href={
                  cause.categories.length === 1
                    ? `/campaigns?category=${encodeURIComponent(cause.categories[0])}`
                    : '/campaigns'
                }
                style={{ padding: '11px 22px', borderRadius: 'var(--r)', border: '1px solid var(--b2)', color: 'var(--t1)', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}
              >
                {t('cause.see_more')}
              </Link>
            </div>
          )}
        </>
      )}
      </div>

      <CauseCtaBand cause={cause} />
    </div>
  );
}
