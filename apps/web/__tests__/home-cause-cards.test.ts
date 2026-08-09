import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAUSES, getCause } from '../lib/causes';

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(here, '..', 'app', 'page.tsx'), 'utf8');
/** Comments name the old wrong links to explain them; absence checks must not read them. */
const code = raw
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/** The slugs the six homepage cards link to, read from the source list. */
function cardSlugs(): string[] {
  const block = code.slice(code.indexOf('const CAUSE_CARDS = ['), code.indexOf('] as const;', code.indexOf('const CAUSE_CARDS = [')));
  return [...block.matchAll(/slug: '([a-z0-9-]+)'/g)].map((m) => m[1]!);
}

// ─────────────────────────────────────────────────────────────────────────────
// The "Causes That Change Lives" cards must land on the cause they name.
//
// ⚠️ MEASURED ON PRODUCTION before this fix. Each card linked to
// `/campaigns?category=<ONE category>`, and a cause spans several — so four of
// the six were narrower than the cause they named, and one was simply wrong:
//
//   Sports & Youth      → dropped Competition
//   Community & Relief  → dropped Emergency
//   Animals & Planet    → dropped Environment
//   People in Need      → linked to Emergency, which is NOT one of its
//                         categories (Family + Wishes + Memorial). "Help Now"
//                         showed a different set of campaigns from the card.
//
// That is the "links that looked filtered and were not" defect this repo has
// already been caught by once.
// ─────────────────────────────────────────────────────────────────────────────

describe('every card links to the cause page it names', () => {
  it('links to /causes/<slug>, not a single-category filter', () => {
    expect(code).toMatch(/href=\{`\/causes\/\$\{cause\.slug\}`\}/);
    expect(code, 'a ?category= link can only express ONE of a cause\'s categories')
      .not.toMatch(/\/campaigns\?category=\$\{encodeURIComponent\(cause\.category\)\}/);
  });

  it('names six slugs that all resolve to real causes', () => {
    const slugs = cardSlugs();
    expect(slugs).toHaveLength(6);
    for (const slug of slugs) {
      expect(getCause(slug), `"${slug}" is not a cause in lib/causes.ts`).toBeTruthy();
    }
  });

  it('drops a card whose slug stops resolving, rather than linking to a 404', () => {
    expect(code).toMatch(/const cause = getCause\(card\.slug\);\s*if \(!cause\) return null;/);
  });

  it('keeps no local copy of the cause taxonomy', () => {
    // The old list carried `category:` per card — a seventh hand-maintained
    // taxonomy, and the thing that let the mapping drift out of agreement with
    // lib/causes.ts without anything failing.
    const block = code.slice(code.indexOf('const CAUSE_CARDS = ['), code.indexOf('] as const;', code.indexOf('const CAUSE_CARDS = [')));
    expect(block, 'a card must not carry its own category').not.toMatch(/category:/);
    expect(block, 'the title comes from the cause, not a local copy').not.toMatch(/title:/);
  });

  it('takes the label and blurb from the cause definition', () => {
    expect(code).toMatch(/<h3>\{cause\.label\}<\/h3>/);
    expect(code).toMatch(/<p>\{cause\.blurb\}<\/p>/);
  });
});

describe('the specific mis-links that shipped are gone', () => {
  // Regression-locked one by one, because each was wrong in a different way and
  // a single "links to a cause" assertion would not distinguish them.
  const cases: [string, string, string[]][] = [
    ['sports-youth', 'Sports & Youth', ['Sports', 'Competition']],
    ['people-in-need', 'People in Need', ['Family', 'Wishes', 'Memorial']],
    ['community-relief', 'Community & Relief', ['Community', 'Emergency']],
    ['health-wellness', 'Health & Wellness', ['Medical']],
    ['education', 'Education', ['Education']],
    ['animals-planet', 'Animals & Planet', ['Animal', 'Environment']],
  ];

  it('every card slug is present and in the design order', () => {
    expect(cardSlugs()).toEqual(cases.map(([slug]) => slug));
  });

  it('each destination covers the whole cause, not one category of it', () => {
    for (const [slug, label, cats] of cases) {
      const cause = getCause(slug)!;
      expect(cause.label, `${slug} label`).toBe(label);
      expect([...cause.categories].sort(), `${slug} categories`).toEqual([...cats].sort());
    }
  });

  it('"People in Need" no longer points at Emergency', () => {
    // The worst of the six: Emergency is not among its categories at all.
    const cause = getCause('people-in-need')!;
    expect(cause.categories as readonly string[]).not.toContain('Emergency');
  });
});

describe('the supporter counts match where the card now goes', () => {
  it('sums across every category of the cause', () => {
    // Reading one category's row understated every multi-category cause, and the
    // number sits directly above a link to a page where the visitor can count.
    expect(code).toMatch(/cause\.categories\.reduce\(/);
    expect(code, 'a single-category lookup is what was wrong')
      .not.toMatch(/categoryStats\.get\(cause\.category\)/);
  });

  it('renders nothing rather than a fabricated zero when unmeasured', () => {
    // `0 active campaigns` on a cause that has plenty is worse than no line.
    // Matched loosely on the type annotation: `reduce` needs one and `some`
    // infers it, so pinning the exact signature would fail on correct code.
    expect(code).toMatch(/const measured = cause\.categories\.some\(\(cat[^)]*\) => categoryStats\.has\(cat\)\)/);
    expect(code).toMatch(/\{measured \? <small>/);
  });

  it('says "campaigns", which is what it counts', () => {
    // The old copy read "N active causes" while counting CAMPAIGNS, on a card
    // that is itself a cause — so "22 active causes" sat under one cause.
    expect(code).toMatch(/active campaigns · /);
    expect(code).not.toMatch(/active causes · /);
  });
});

describe('the cause pages these now point at are real', () => {
  it('all six are among the twenty causes with their own route', () => {
    const all = new Set(CAUSES.map((c) => c.slug));
    for (const slug of cardSlugs()) expect(all.has(slug), slug).toBe(true);
  });
});
