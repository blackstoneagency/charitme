import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatStat, formatMoneyStat } from '../lib/cause-landing';
import { CAUSES } from '../lib/causes';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const landing = read('app/causes/[slug]/CauseLanding.tsx');
const page = read('app/causes/[slug]/page.tsx');
const helper = read('lib/cause-landing.ts');

describe('stat formatting', () => {
  it('renders a failed count as an em-dash, never as 0', () => {
    // On this page 0 is a real, publishable answer ("no live campaigns in this
    // cause yet"). If a failed query also rendered 0, the visitor could not tell
    // an empty cause from a broken one — and neither could we.
    expect(formatStat(null)).toBe('—');
    expect(formatMoneyStat(null)).toBe('—');
    expect(formatStat(0)).toBe('0');
    expect(formatMoneyStat(0)).toBe('$0');
  });

  it('states small numbers exactly rather than rounding them away', () => {
    expect(formatStat(69)).toBe('69');
    expect(formatStat(350)).toBe('350');
    expect(formatStat(9_999)).toBe('9,999');
  });

  it('abbreviates only once the numbers are genuinely large', () => {
    expect(formatStat(10_000)).toBe('10K');
    expect(formatStat(2_300_000)).toBe('2.3M');
    expect(formatMoneyStat(1_234_500)).toBe('$12,345'); // exact below a million
  });
});

describe('no fabricated statistics', () => {
  // The reference design asserts inflated totals for people helped, lives
  // transformed, programmes funded and countries reached, plus a star rating
  // from a five-figure supporter count. None of it is backed by this database,
  // and the country claim specifically is already recorded in docs/ as a
  // fabricated statistic this repo has been caught by before.
  //
  // Comments are STRIPPED before checking, so this measures what renders rather
  // than what is explained. Without that the guard punishes its own subject
  // matter: a comment in page.tsx documenting *why* the mock's "68K+ Athletes
  // Supported" is not used made this fail, which would push the next author to
  // delete the explanation instead of the figure — exactly backwards.
  //
  // It loses no teeth. A fabricated figure has to REACH THE PAGE to matter, and
  // anything that renders (JSX text, a string literal, an attribute) survives
  // comment-stripping untouched.
  const stripComments = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  const source = `${stripComments(landing)} ${stripComments(page)}`;

  it('hardcodes none of the mock figures', () => {
    for (const fake of ['2.3M', '68K', '1,250+', '120+', '25,000+', '4.9']) {
      expect(source, `mock figure "${fake}" must not be hardcoded`).not.toContain(fake);
    }
  });

  it('renders no star rating, because there is no ratings table', () => {
    expect(source).not.toMatch(/★|⭐|star-rating|aria-label="[^"]*stars/i);
  });

  it('reads the country count from supported_countries rather than asserting one', () => {
    expect(helper).toContain("from('supported_countries')");
    // …and only countries we can actually take a donation in, which is the
    // claim the tile makes.
    expect(helper).toContain("eq('can_donate', true)");
  });

  it('never coerces a FAILED count to zero', () => {
    // Precision matters in the guard as much as in the code. A bare ban on
    // `?? 0` would be wrong: when the query SUCCEEDED, PostgREST can still hand
    // back a null count, and 0 is then the true answer. What must never happen
    // is reaching that coercion without checking `error` first.
    expect(helper).toContain('countries.error ? null : countries.count ?? 0');
    // …and the same for the campaign aggregates, which stay null on failure.
    expect(helper).toMatch(/let liveCampaigns: number \| null = null/);
    expect(helper).toContain('if (rows.error)');
    // The rendering layer must not undo it.
    expect(landing).not.toMatch(/\?\?\s*0/);
  });
});

describe('the page keeps what already worked', () => {
  it('still distinguishes a failed campaign query from an empty cause', () => {
    expect(page).toContain('cause.load_failed_title');
    expect(page).toContain('cause.empty_title');
  });

  it('still renders the narrower-cause disclosure', () => {
    // Documented as must-never-be-silently-dropped: without it, Mental Health
    // and Medical Research show identical lists while each implies it narrowed
    // something.
    expect(page).toContain('cause.narrower');
    expect(page).toContain('cause.narrower_prefix');
  });

  it('still links onward when the grid is full', () => {
    expect(page).toContain('cause.see_more');
  });
});

describe('the landing is wired to real destinations', () => {
  it('does not render a cross-sell row of other causes', () => {
    // Removed on request. Asserted rather than merely deleted so a later
    // copy-paste cannot quietly bring the section back.
    expect(landing).not.toContain('cl-ways');
    expect(landing).not.toContain('otherCauses');
  });

  it('renders neither the per-category count row nor the "Ways to help" grid', () => {
    // Both sat between the stats band and the campaigns, and neither appears in
    // the reference for any cause. Same reasoning as the cross-sell row above:
    // asserted so a copy-paste cannot bring them back.
    //
    // No destination was lost. /campaigns, /events and /volunteer are in the hub
    // tab strip; /create is in the hero and the closing band; /partner is in the
    // main nav's Resources group. The per-category counts counted the campaigns
    // the grid underneath already lists.
    expect(landing).not.toContain('cl-programs');
    expect(landing).not.toContain('cl-help-grid');
    expect(landing).not.toContain('causeWays');
  });

  it('still reaches every destination the removed grid carried', () => {
    // The point of the previous assertion is that the links moved, not that
    // they vanished. Checked against the files that now carry them.
    expect(page).toContain('/campaigns?cause=');
    expect(page).toContain('/events?cause=');
    expect(page).toContain('/volunteer?cause=');
    expect(landing).toContain('href="/create"');
    expect(read('lib/main-nav.ts')).toContain("href: '/partner'");
  });

  it('leaves no orphaned translation keys behind', () => {
    // A key nobody renders is still a string every translator maintains.
    const en = read('lib/locales/en.ts');
    for (const dead of ["'cl.other_ways'", "'cl.help_now'", "'cl.hero_title'"]) {
      expect(en, `${dead} is no longer rendered`).not.toContain(dead);
    }
  });

  it('the H1 is the cause name, not a slogan shared by all 20 pages', () => {
    // The first draft put "Hope changes everything." in every cause's H1, which
    // made twenty pages compete for the same heading in search results.
    expect(landing).toContain('{cause.label}');
    expect(landing).toContain("id=\"cl-hero-title\"");
  });

  it('treats the hero photo as decorative, since the H1 beside it names the cause', () => {
    expect(landing).toContain('alt=""');
    expect(landing).toContain('aria-hidden="true"');
  });

  it('every cause has authored hero copy — no page falls back to a blank', () => {
    for (const c of CAUSES) {
      expect(c.tagline, `${c.slug} needs a tagline`).toBeTruthy();
      expect(c.intro, `${c.slug} needs an intro`).toBeTruthy();
      expect(c.intro!.length, `${c.slug} intro is too short to fill the hero`).toBeGreaterThan(80);
    }
  });

  it('no two causes share a tagline', () => {
    // A shared tagline is the same duplicate-heading problem in a smaller font.
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const c of CAUSES) {
      const prior = seen.get(c.tagline!);
      if (prior) dupes.push(`${c.slug} repeats ${prior}`);
      seen.set(c.tagline!, c.slug);
    }
    expect(dupes).toEqual([]);
  });
});

describe('the fuller Sports & Youth layout', () => {
  const causesSrc = read('lib/causes.ts');
  const css = read('app/globals.css');

  it('every cause has an authored impact heading, not one line repeated 20 times', () => {
    for (const c of CAUSES) {
      expect(c.impactTitle, `${c.slug} needs an impactTitle`).toBeTruthy();
      expect(c.impactBlurb, `${c.slug} needs an impactBlurb`).toBeTruthy();
    }
    const titles = new Set(CAUSES.map((c) => c.impactTitle));
    expect(titles.size, 'impact headings must be distinct per cause').toBe(CAUSES.length);
  });

  it('the impact band shows measured figures, not the mock’s', () => {
    // The reference asserts a six-figure "youth impacted", a five-figure
    // "athletes supported", a four-figure programme count and a three-figure
    // community count. None is an entity in this schema.
    const src = `${landing} ${causesSrc}`;
    for (const fake of ['125K', '68K', '1,250+', '250+', '578K']) {
      expect(src, `mock figure "${fake}" must not be hardcoded`).not.toContain(fake);
    }
    expect(landing).toContain('formatStat(stats.liveCampaigns)');
    expect(landing).toContain('formatMoneyStat(stats.raisedCents)');
  });

  it('stories link to a campaign and carry NO play button', () => {
    // Every campaign_media row of type `video` points at a reserved .example
    // host that cannot resolve, so there is nothing to play. A play button that
    // opens a campaign page instead is a fake affordance.
    const page = read('app/causes/[slug]/page.tsx');
    expect(page).toContain('cl-story');
    expect(page).toContain('Read the story');
    expect(page).not.toMatch(/Watch Story/i);
    expect(page).not.toContain('cl-story-play');
  });

  it('stories come from genuinely completed campaigns', () => {
    const helper = read('lib/cause-landing.ts');
    expect(helper).toContain("eq('status', 'completed')");
    expect(helper).toContain("is('deleted_at', null)");
    // `null` on failure so "we could not load these" stays distinct from "none".
    expect(helper).toContain('return null;');
  });

  it('the hub row is links, not ARIA tabs', () => {
    // Each navigates to a different page, so role="tab" would promise in-page
    // panel switching that never happens.
    const page = read('app/causes/[slug]/page.tsx');
    expect(page).toContain('className="cl-tabs"');
    expect(page).not.toContain('role="tab"');
  });

  it('puts the campaigns above the editorial blocks, as the reference does', () => {
    // The grid used to sit BELOW "how your support helps" and "stories from the
    // field", which put roughly a screen and a half of copy between a visitor
    // and the thing they came to do. Order is asserted by position rather than
    // presence: every one of these strings survived the reshuffle, so a check
    // that they merely EXIST would have passed against the old order too.
    const grid = page.indexOf('<CampaignGrid>');
    const tabs = page.indexOf('className="cl-tabs"');
    const helps = page.indexOf('className="cl-helps"');
    const stories = page.indexOf('className="cl-stories"');
    for (const [name, at] of Object.entries({ grid, tabs, helps, stories })) {
      expect(at, `${name} is not rendered at all`).toBeGreaterThan(-1);
    }
    expect(tabs, 'the hub tabs come before the grid').toBeLessThan(grid);
    expect(grid, 'the grid comes before "how your support helps"').toBeLessThan(helps);
    expect(helps, '"how your support helps" comes before the stories').toBeLessThan(stories);
  });

  it('keeps an accessible name for the campaign grid after dropping its visible title', () => {
    // The reference runs the tabs straight into the cards with no heading. The
    // <h2> is hidden rather than deleted — a section labelled by an id that
    // points at nothing is worse than the heading it replaced.
    expect(page).toContain('id="cause-campaigns"');
    expect(page).toContain('cl-visually-hidden');
  });

  it('gives each "how your support helps" card its own glyph', () => {
    // Five identical hearts differing only in colour told a reader nothing about
    // which card was which, and told a reader who does not perceive the colour
    // nothing at all.
    const glyphs = read('app/causes/[slug]/HelpGlyph.tsx');
    const sports = CAUSES.find((c) => c.slug === 'sports-youth')!;
    expect(sports.helps!.every((h) => h.icon), 'every Sports & Youth card names an icon').toBe(true);
    const icons = new Set(sports.helps!.map((h) => h.icon));
    expect(icons.size, 'the five cards must not share one glyph').toBe(sports.helps!.length);
    for (const icon of icons) expect(glyphs, `HelpGlyph is missing "${icon}"`).toContain(`${icon}:`);
    // The badge, not the glyph, carries aria-hidden — one place makes the call.
    expect(page).toContain('<HelpGlyph icon={h.icon} />');
  });

  it('dark mode paints a black page background', () => {
    // `--bg` alone was not enough: the body painted a three-stop navy radial
    // gradient that ignored the token entirely, so changing the token left the
    // page navy.
    expect(css).toContain('--bg: #000000;');
    const darkBody = css.slice(css.indexOf('[data-theme="dark"] body {'));
    expect(darkBody.slice(0, 1200)).toContain('background: #000000;');
    expect(darkBody.slice(0, 1200)).not.toContain('radial-gradient');
  });
});
