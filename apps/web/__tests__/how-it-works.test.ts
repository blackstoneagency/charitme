import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const page = read('app/how-it-works/page.tsx');
const faqUi = read('app/how-it-works/HowItWorksFaq.tsx');
const loader = read('lib/how-it-works.ts');
// The dedupe/top-up logic moved to the shared loader when /contact needed it
// too; the assertions below follow it there rather than being deleted.
const sharedFaqLoader = read('lib/route-faqs.ts');
const icons = read('components/PublicIcon.tsx');

// Comments are stripped before the fabricated-figure check: a comment that
// explains WHY a mock figure is not used must not itself fail the guard, or the
// next author deletes the explanation instead of the figure.
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

describe('no fabricated statistics', () => {
  it('hardcodes none of the reference figures', () => {
    // The reference asserts a seven-figure "people helped", a five-figure "lives
    // transformed", a four-figure programme count and a three-figure country
    // count. None is an entity in this schema — campaigns and donations are.
    const src = stripComments(page);
    for (const fake of ['2.3M', '68K', '1,250+', '120+']) {
      expect(src, `mock figure "${fake}" must not be hardcoded`).not.toContain(fake);
    }
  });

  it('reads its figures from the shared measured loader', () => {
    expect(page).toContain('getCausesIndexData');
    expect(page).toContain('statValue(platform.activeCampaigns)');
    expect(page).toContain('moneyValue(platform.raisedTotalCents)');
  });
});

describe('the FAQ is real Supabase content', () => {
  it('reads aeo_entries rather than JSX-authored copy', () => {
    // The same table /faq renders, so an answer edited in the admin console
    // changes both surfaces instead of the two drifting apart.
    expect(sharedFaqLoader).toContain('getPublishedAeoEntries');
    expect(page).toContain('getHowItWorksFaqs');
  });

  it('tops up from /faq because this route has too few of its own', () => {
    // The built-in fallback maps a dynamic DETAIL route to its parent
    // collection; /how-it-works is not one, so it never fires here.
    expect(sharedFaqLoader).toContain("getPublishedAeoEntries('/faq'");
    expect(sharedFaqLoader).toContain('seen.has');
    expect(loader).toContain("getRouteFaqs('/how-it-works'");
  });

  it('renders no accordion at all when there is nothing to show', () => {
    // A disclosure control with nothing behind it is worse than the absence of
    // the block.
    expect(faqUi).toContain('if (faqs.length === 0) return null;');
  });

  it('uses native details/summary rather than a hand-rolled control', () => {
    // Keyboard operation, screen-reader semantics and toggling come for free,
    // with no client bundle and nowhere to get focus handling wrong.
    //
    // Comments stripped for the negative assertions, for the fourth time this
    // session: the doc comment explains why a hand-rolled `aria-expanded`
    // control was NOT used, and the guard cannot tell prose from markup.
    // Punishing the explanation teaches the next author to delete it.
    const rendered = stripComments(faqUi);
    expect(rendered).toContain('<details');
    expect(rendered).toContain('<summary>');
    expect(rendered).not.toContain('aria-expanded');
    expect(rendered).not.toContain("'use client'");
  });
});

describe('icons resolve to real glyphs', () => {
  it('every PublicIcon name used on the page exists in the icon map', () => {
    // PublicIcon falls back to the sparkle for an unknown name WITHOUT
    // erroring, so a typo ships the wrong glyph silently — 'community' and
    // 'gift' both did exactly that on the first pass.
    const known = new Set(
      [...icons.matchAll(/^\s{4}([a-z]+):/gm)].map((m) => m[1]),
    );
    expect(known.size).toBeGreaterThan(10);
    const used = [...stripComments(page).matchAll(/PublicIcon name=\{?['"]?([a-z]+)['"]/g)]
      .map((m) => m[1]);
    const ternary = [...stripComments(page).matchAll(/\?\s*'([a-z]+)'\s*:/g)].map((m) => m[1]);
    const literals = [...stripComments(page).matchAll(/:\s*'([a-z]+)'\s*\}\s*\/>/g)].map((m) => m[1]);
    const all = [...new Set([...used, ...ternary, ...literals])];
    expect(all.length).toBeGreaterThan(3);
    for (const name of all) {
      expect(known.has(name), `icon "${name}" is not in PublicIcon`).toBe(true);
    }
  });
});

describe('the page carries only the sections the reference has', () => {
  it('does not reinstate the fundraiser/donor step-by-step flows', () => {
    // They were removed to match the design. Nothing was lost: every product
    // fact they stated is on the page that owns it (asserted below). If a
    // future change wants them back, change the design first.
    const src = stripComments(page);
    expect(src).not.toContain('FUNDRAISER_STEPS');
    expect(src).not.toContain('DONOR_STEPS');
    expect(src).not.toContain('hw-flow');
  });

  it('the payout facts they carried are still stated on their owning pages', () => {
    // The reason removing them is safe, pinned so it stays true. If someone
    // strips the fees off /fast-payouts, this fails here rather than leaving
    // the site with the facts nowhere at all.
    const payouts = read('app/fast-payouts/page.tsx');
    expect(payouts).toMatch(/Same-day payouts \(1% fee\)/);
    expect(payouts).toMatch(/Instant payouts \(1\.5% fee\)/);
    expect(payouts).toContain('2 business days');

    const faq = read('app/faq/page.tsx');
    expect(faq).toMatch(/1% fee and instant payouts have a 1\.5% fee/);
  });

  it('every one of the four reference steps links somewhere real', () => {
    // A step describing an action the visitor cannot then take is a dead button
    // in prose form.
    for (const href of ['/causes', '/campaigns', '/verification', '/impact']) {
      expect(page, `step must link to ${href}`).toContain(`href: '${href}'`);
    }
  });
});
