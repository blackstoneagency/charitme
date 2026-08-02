import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatStat, formatMoneyStat } from '../lib/cause-landing';
import { POPULAR_CAUSES, getCause } from '../lib/causes';

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
  // The literals live in this array ONLY — spelling them in prose would make the
  // guard fail on its own explanation.
  const source = `${landing} ${page}`;

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
  it('links programme rows to a real filtered campaign list', () => {
    expect(landing).toContain('/campaigns?category=');
  });

  it('links every other-cause card to a cause that exists', () => {
    // The cards are generated from POPULAR_CAUSES, so this checks the source
    // list rather than parsing JSX — a card can only point where the data does.
    for (const c of POPULAR_CAUSES) {
      expect(getCause(c.slug), `${c.slug} must resolve`).toBeTruthy();
    }
    expect(landing).toContain('/causes/${other.slug}');
  });

  it('excludes the current cause from "other ways to help"', () => {
    // Otherwise the page offers the visitor a link back to the page they are on.
    expect(landing).toContain('c.slug !== cause.slug');
  });

  it('decorative card images carry empty alt, the hero image does not', () => {
    // The card's text already names the cause; repeating it in alt makes a
    // screen reader say it twice. The hero photo is the page's only image with
    // independent meaning.
    expect(landing).toContain('alt=""');
    expect(landing).toContain('alt={`Photograph representing ${cause.label}');
  });
});
