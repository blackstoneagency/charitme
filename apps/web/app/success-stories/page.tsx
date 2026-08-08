import Link from 'next/link';
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { supabaseAdmin } from '../../lib/supabase';
import { boundedQuery } from '../../lib/query-timeout';
import { campaignColumns, applyVisibilityFilters } from '../../lib/campaign-visibility';
import { getCause, type Cause, type HelpIcon } from '../../lib/causes';
import HelpGlyph from '../../components/HelpGlyph';
import { getCoverForCampaign } from '../../lib/photo-catalog';
import { optimizedCoverUrl } from '../../lib/img-optimize';
import { formatMoneyStat, formatStat } from '../../lib/cause-landing';
import { StatStrip } from '../../components/IndexHero';
import { resolveImpactTiles } from '../../lib/impact-stats';
import StayInformed from '../../components/StayInformed';
import SortSelect from './SortSelect';
import { SORT_ORDER, isSortValue, type SortValue } from '../../lib/story-sort';
import { PROMOTABLE_TRUST_TIERS } from '../../lib/trust-tiers';

export const metadata: Metadata = {
  title: 'Stories of Hope',
  description:
    'Real stories from real people whose lives have been changed through the power of compassion and community.',
  alternates: { canonical: 'https://www.charitme.com/success-stories' },
};

/**
 * ── Where this page departs from the reference, and why ─────────────────────
 *
 * 1. **The five impact figures are MEASURED.** The mock asserts 2.3M+ People
 *    Helped, 68K+ Lives Transformed, 1,250+ Programs Funded, 120+ Countries
 *    Reached and 98% Funds to Programs. Not one is an entity in this schema —
 *    "people helped" and "lives transformed" are not recorded anywhere, and the
 *    120+ country claim is already logged in docs/ as a fabricated statistic
 *    this repo shipped once and had to retract. The tiles below count real rows
 *    and say exactly what was counted.
 *
 *    The one figure kept verbatim is the LAST, and only because it is true and
 *    checkable: `PLATFORM_FEE_PERCENT = 0`, so the platform's cut is 0% — and
 *    the tile says "platform fee", not "funds to programs", because processing
 *    fees are real and "100% to programs" would overclaim.
 *
 * 2. **The category chips are the REAL taxonomy.** The mock labels them
 *    "Children & Youth", "Shelter & Housing", "Health & Care". The nearest real
 *    causes are Youth Development, People in Need and Health & Wellness, and
 *    each chip is labelled with the cause it actually filters to. A chip reading
 *    "Shelter & Housing" that returns People in Need campaigns is the same
 *    defect as a link that looks filtered and is not.
 *
 * 3. **No donor avatars.** The mock stacks three faces beside "Donations from
 *    2,346 people". `donations.anonymous` exists precisely so a donor can give
 *    without being shown, and there is no per-campaign public-donor-face read
 *    that honours it here. The count is real; the faces would have to be either
 *    invented or a privacy leak, so the row is a count with a decorative icon.
 *
 * 4. **Tokens, not the mock's literal dark palette.** The reference is drawn in
 *    dark mode. Hardcoding those colours ships a dark slab into the light theme
 *    — the exact defect `theme-tokens.test.ts` exists to block, and the way a
 *    2.56:1 light-mode failure reached production before. Dark mode gets a true
 *    black canvas from `--bg` either way.
 */

/**
 * The chips, in the reference's order, mapped to causes that really exist —
 * each with the glyph the mock draws above its label.
 */
const STORY_CAUSES: readonly (readonly [string, HelpIcon])[] = [
  ['youth-development', 'community'],
  ['education', 'learn'],
  ['health-wellness', 'health'],
  ['people-in-need', 'home'],
  ['food-hunger', 'food'],
  ['environment', 'leaf'],
  ['community-relief', 'hope'],
] as const;

function storyCauses(): { cause: Cause; icon: HelpIcon }[] {
  // `getCause` rather than a second hand-written list: if a slug is ever
  // renamed, the chip disappears instead of linking to a 404.
  return STORY_CAUSES.flatMap(([slug, icon]) => {
    const cause = getCause(slug);
    return cause ? [{ cause, icon }] : [];
  });
}

type Story = {
  id: string;
  slug: string;
  title: string;
  blurb: string | null;
  category: string | null;
  cover: string | null;
  backers: number;
};

type StoryData = {
  stories: Story[];
  campaigns: number | null;
  supporters: number | null;
  raisedCents: number | null;
  countries: number | null;
};

/** Everything unreadable. `null` renders as "—", never as 0. */
const UNMEASURED: StoryData = {
  stories: [],
  campaigns: null,
  supporters: null,
  raisedCents: null,
  countries: null,
};

const SCAN_LIMIT = 2000;

async function readStories(cause: Cause | undefined, sort: SortValue): Promise<StoryData> {
  try {
    const cols = await campaignColumns();

    // A "story" is a campaign the public can see that has actually run. Both
    // `active` and `completed` qualify — restricting to `completed` would empty
    // the page on a young platform, and the mock's cards are plainly live ones.
    const base = () =>
      applyVisibilityFilters(
        supabaseAdmin
          .from('campaigns')
          .select('id, slug, title, tagline, description, category, cover_image_url, raised_amount, backer_count'),
        cols,
      ).in('status', ['active', 'completed']);

    // ── Trust tier gate ──────────────────────────────────────────────────────
    // Applied to the STORY LIST and deliberately NOT to `totals` below.
    //
    // The cards present campaigns as exemplars under a "Featured Stories"
    // heading, so they must clear the platform's own trust bar — this page was
    // promoting a campaign titled "Support my medical expenses — Bitches!"
    // (`Needs More Info`, health score 0, no backers) as its second card.
    //
    // The totals underneath are a different claim: "N campaigns, N supporters,
    // $N raised" is a statement about the whole platform. Filtering those by
    // trust tier would understate real money that real donors really gave, which
    // is a worse error than the one being fixed. Two queries, two rules, on
    // purpose — `base()` is shared, so the filter goes here rather than in it.
    let listQuery = base()
      .in('trust_status', [...PROMOTABLE_TRUST_TIERS])
      .order(SORT_ORDER[sort].column, { ascending: SORT_ORDER[sort].ascending })
      .limit(8);
    if (cause) listQuery = listQuery.in('category', [...cause.categories]);

    const [list, totals, countries] = await Promise.all([
      // Bounded like every other discovery read: a stalled database must render
      // "—" rather than holding the page open.
      boundedQuery(() => listQuery),
      boundedQuery(() => base().select('raised_amount, backer_count').limit(SCAN_LIMIT)),
      boundedQuery(() =>
        supabaseAdmin
          .from('supported_countries')
          .select('id', { count: 'exact', head: true })
          .eq('active', true)
          .eq('can_donate', true),
      ),
    ]);

    const stories: Story[] = (list.error ? [] : list.data ?? []).map((c) => ({
      id: c.id as string,
      slug: c.slug as string,
      title: c.title as string,
      blurb: ((c.tagline as string | null) ?? (c.description as string | null) ?? null),
      category: (c.category as string | null) ?? null,
      cover: (c.cover_image_url as string | null) ?? null,
      backers: Number(c.backer_count ?? 0),
    }));

    const rows = totals.error ? null : totals.data ?? [];
    return {
      stories,
      campaigns: rows === null ? null : rows.length,
      supporters: rows === null ? null : rows.reduce((n, r) => n + Number(r.backer_count ?? 0), 0),
      raisedCents: rows === null ? null : rows.reduce((n, r) => n + Number(r.raised_amount ?? 0), 0),
      countries: countries.error ? null : countries.count ?? 0,
    };
  } catch {
    // `supabaseAdmin` throws on property access when the env is missing, before
    // any query runs — which no `error` check can see, and which 500'd this
    // page outright on a cold build.
    return UNMEASURED;
  }
}

/**
 * Public, non-personalised aggregate data, so it is cached — but keyed on the
 * filter and sort, or every visitor would be served the first combination that
 * happened to be requested.
 */
const getStoryData = (cause: string, sort: SortValue) =>
  unstable_cache(
    () => readStories(cause ? getCause(cause) : undefined, sort),
    ['success-stories', cause, sort],
    { revalidate: 60, tags: ['success-stories'] },
  )();

export default async function SuccessStoriesPage({
  searchParams,
}: {
  searchParams?: Promise<{ cause?: string; sort?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const sort: SortValue = isSortValue(sp.sort) ? sp.sort : 'recent';
  // An unknown slug falls through to unfiltered rather than 404ing: a bad query
  // string should not take the page away.
  const activeCause = typeof sp.cause === 'string' ? getCause(sp.cause) : undefined;
  const { stories, campaigns, supporters, raisedCents, countries } = await getStoryData(
    activeCause?.slug ?? '',
    sort,
  );

  // The measured five, which the owner's configured tiles override wholesale.
  const measuredImpact = [
    { value: formatStat(campaigns), label: 'Stories shared' },
    { value: formatStat(supporters), label: 'Supporters' },
    { value: formatMoneyStat(raisedCents), label: 'Raised together' },
    { value: formatStat(countries), label: 'Countries reached' },
    // Kept because it is true and checkable: PLATFORM_FEE_PERCENT = 0.
    // Labelled "platform fee" rather than the reference's "funds to programs" —
    // processing fees are real, so the stronger claim would overstate it.
    { value: '0%', label: 'Platform fee' },
  ];
  const impactTiles = await resolveImpactTiles(measuredImpact);
  // The footnote describes how the MEASURED figures are counted, so it must not
  // sit under numbers an administrator typed in.
  const ownerSetImpact = impactTiles !== measuredImpact;

  const featured = stories.slice(0, 3);
  const more = stories.slice(3, 8);
  const href = (causeSlug?: string) => {
    const p = new URLSearchParams();
    if (causeSlug) p.set('cause', causeSlug);
    if (sort !== 'recent') p.set('sort', sort);
    const qs = p.toString();
    return `/success-stories${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="ss-page">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="ss-hero" aria-labelledby="ss-hero-title">
        <div className="ss-hero-photo" aria-hidden="true">
          {/* Decorative: the H1 beside it carries the message, so a screen
              reader announcing the photo would only add noise. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={optimizedCoverUrl(getCoverForCampaign('Community', 'stories-of-hope'), 900)} alt="" />
        </div>

        <div className="ss-hero-inner">
          <nav aria-label="Breadcrumb" className="ss-crumbs">
            <ol>
              <li><Link href="/">Home</Link></li>
              <li aria-hidden="true">›</li>
              <li aria-current="page">Stories</li>
            </ol>
          </nav>

          <div className="ss-hero-copy">
            <h1 id="ss-hero-title">
              Stories of Hope. Lives Transformed.
              <span className="ss-heart" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
                </svg>
              </span>
            </h1>
            <p className="ss-lede">
              Discover real stories from real people whose lives have been changed through the
              power of compassion and community.
            </p>
            <div className="ss-hero-actions">
              {/* Both point at pages that exist. Sharing a story IS starting a
                  campaign here — there is no separate story-submission route,
                  and inventing one would be a link to a 404. */}
              <Link href="/create" className="cta-primary" style={{ display: 'inline-flex' }}>
                Share Your Story
              </Link>
              <Link href="/campaigns" className="ss-btn-secondary">
                Browse All Stories
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Category filter + sort ───────────────────────────────────────── */}
      <section className="ss-filters" aria-label="Filter stories">
        <nav className="ss-chips" aria-label="Story categories">
          <Link href={href()} className="ss-chip" aria-current={activeCause ? undefined : 'page'}>
            {/* aria-hidden on the wrapper, not inside HelpGlyph: the label beside
                it already names the chip. */}
            <span className="ss-chip-ic" aria-hidden="true"><HelpGlyph icon="all" /></span>
            All Stories
          </Link>
          {storyCauses().map(({ cause: c, icon }) => (
            <Link
              key={c.slug}
              href={href(c.slug)}
              className="ss-chip"
              aria-current={activeCause?.slug === c.slug ? 'page' : undefined}
            >
              <span className="ss-chip-ic" aria-hidden="true"><HelpGlyph icon={icon} /></span>
              {c.label}
            </Link>
          ))}
        </nav>
        <SortSelect value={sort} />
      </section>

      <div className="container ss-body">
        {stories.length === 0 ? (
          <p className="ss-empty">
            {activeCause
              ? `No stories in ${activeCause.label} yet. `
              : 'No stories to show yet. '}
            <Link href="/create">Be the first to share one.</Link>
          </p>
        ) : (
          <>
            {/* ── Featured Stories ─────────────────────────────────────── */}
            <section aria-labelledby="ss-featured-title">
              <header className="ss-sec-head">
                <h2 id="ss-featured-title">Featured Stories</h2>
                <Link href="/campaigns" className="ss-sec-all">View All Stories →</Link>
              </header>
              <ul className="ss-feat-grid">
                {featured.map((s) => (
                  <li key={s.id}>
                    <Link href={`/campaigns/${s.slug}`} className="ss-feat">
                      <span className="ss-feat-media">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={optimizedCoverUrl(s.cover || getCoverForCampaign(s.category, s.slug), 700)}
                          alt=""
                        />
                        {s.category && <span className="ss-feat-chip">{s.category}</span>}
                      </span>
                      <span className="ss-feat-body">
                        <strong>{s.title}</strong>
                        {s.blurb && <span className="ss-feat-blurb">{s.blurb}</span>}
                        <span className="ss-feat-foot">
                          <span className="ss-donors">
                            <span className="ss-donors-ic" aria-hidden="true">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9" />
                              </svg>
                            </span>
                            {/* Real count. The mock's donor FACES are not
                                reproduced — `donations.anonymous` exists so a
                                donor can give without being shown. */}
                            Donations from {s.backers.toLocaleString('en-US')}{' '}
                            {s.backers === 1 ? 'person' : 'people'}
                          </span>
                          <span className="ss-feat-cta">Read Their Story →</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {/* ── More Stories ─────────────────────────────────────────── */}
            {more.length > 0 && (
              <section aria-labelledby="ss-more-title">
                <header className="ss-sec-head">
                  <h2 id="ss-more-title">More Stories</h2>
                  <Link href="/campaigns" className="ss-sec-all">View All Stories →</Link>
                </header>
                <ul className="ss-more-grid">
                  {more.map((s) => (
                    <li key={s.id}>
                      <Link href={`/campaigns/${s.slug}`} className="ss-more-card">
                        <span className="ss-more-media">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={optimizedCoverUrl(s.cover || getCoverForCampaign(s.category, s.slug), 420)}
                            alt=""
                          />
                          {s.category && <span className="ss-feat-chip">{s.category}</span>}
                        </span>
                        <span className="ss-more-body">
                          <strong>{s.title}</strong>
                          <span className="ss-feat-cta">Read Story →</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {/* ── Our Impact in Numbers ──────────────────────────────────────── */}
        <section className="ss-impact" aria-labelledby="ss-impact-title">
          <h2 id="ss-impact-title">Our Impact in Numbers</h2>
          {/* The SAME `StatStrip` /causes, /campaigns, /donate, /impact and all
              20 /causes/<slug> pages render.

              ⚠️ The FIGURES stay this page's own, and the labels are NOT
              harmonised with the other surfaces — unlike /impact, where they
              were the same numbers under different words. These count only
              COMPLETED campaigns: "Stories shared" is not "Active campaigns",
              and "Raised together" is the total behind finished stories, not
              the platform total. Relabelling them to match would state
              something false. The note below says so, and stays for that
              reason where the cause pages dropped theirs.

              What the swap fixes is presentation: this band drew the SAME heart
              glyph on all five tiles, and carried its own copy of the em-dash
              rule. The strip gives five distinct icons and one rule. */}
          {/* Owner-editable, shared with /about-us so the two pages cannot quote
              different numbers for the same claim. Falls back to the measured
              figures below when nothing is configured — see lib/impact-stats.ts
              for why the reference's five numbers are not hardcoded. */}
          <StatStrip label="Our impact in numbers" tiles={impactTiles} />
          {!ownerSetImpact && (
            <p className="ss-impact-note">
              Counted live from published campaigns and the countries CharitMe can take a donation
              in. A dash means the figure could not be read, never that it is zero.
            </p>
          )}
        </section>

        {/* ── Share-your-story band ──────────────────────────────────────── */}
        <section className="ss-cta" aria-labelledby="ss-cta-title">
          <span className="ss-cta-ic" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </span>
          <div>
            <h2 id="ss-cta-title">Every story has the power to inspire.</h2>
            <p>Share your story and inspire others to make a difference.</p>
          </div>
          <Link href="/create" className="cta-primary" style={{ display: 'inline-flex' }}>
            Share Your Story
          </Link>
        </section>
      </div>

      <StayInformed />
    </div>
  );
}
