import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isPlaceholderAeoEntry, dedupeAeoEntries, groupFaqsByTopic } from '../lib/aeo';
import { CURATED_FAQ_SECTIONS, getCuratedFaqs } from '../lib/faq-content';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const page = read('app/faq/page.tsx');
const accordion = read('app/faq/FaqAccordion.tsx');
const aeo = read('lib/aeo.ts');
const routeFaqs = read('lib/route-faqs.ts');

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

describe('seeder placeholders never reach a public surface', () => {
  it('recognises the generated rows by their (topic N) suffix', () => {
    // Measured against production: ALL 180 published /faq entries are
    // generated — 15 distinct questions repeated twelve times with round-robin
    // topics, each suffixed "(topic N)".
    expect(isPlaceholderAeoEntry({ question: 'Are my donations tax-deductible? (topic 1)' })).toBe(true);
    expect(isPlaceholderAeoEntry({ question: 'How fast are payouts? (topic 12)' })).toBe(true);
    expect(isPlaceholderAeoEntry({ question: 'How fast are payouts?  (TOPIC 3) ' })).toBe(true);
  });

  it('leaves a genuine question alone', () => {
    // Deliberately narrow: a real question does not end in "(topic <number>)".
    for (const real of [
      'How do I create a campaign?',
      'What is the platform fee?',
      'Which topics can I fundraise for?',
      'What happens at step 3 (topic covered below)?',
    ]) {
      expect(isPlaceholderAeoEntry({ question: real }), `"${real}" is genuine`).toBe(false);
    }
  });

  it('filters at the shared read path, so every consumer is covered at once', () => {
    // /faq, /how-it-works, /contact and the JSON-LD all read through here.
    // Publishing a schema full of "(topic 1)" questions is an SEO liability as
    // well as a visible defect.
    expect(aeo).toContain('isPlaceholderAeoEntry');
    expect(aeo).toMatch(/filter\(\(e\) => !isPlaceholderAeoEntry\(e\)\)/);
  });

  it('filters BEFORE dedupe, or all twelve copies survive', () => {
    // The copies differ only by the suffix, so deduping on question text keeps
    // every one of them.
    const rows = [1, 2, 3].map((n) => ({
      question: `How fast are payouts? (topic ${n})`,
      answer: `answer ${n}`,
      topic: 'Payouts',
      schema_type: 'FAQPage' as const,
      route: '/faq',
    }));
    expect(dedupeAeoEntries(rows)).toHaveLength(3);
    expect(rows.filter((r) => !isPlaceholderAeoEntry(r))).toHaveLength(0);
    const order = aeo.indexOf('!isPlaceholderAeoEntry');
    expect(order).toBeGreaterThan(0);
    expect(order).toBeLessThan(aeo.indexOf('return dedupeAeoEntries(rows)'));
  });
});

describe('the curated answers are the real content', () => {
  it('carries every topic the page used to show', () => {
    const titles = CURATED_FAQ_SECTIONS.map((s) => s.title);
    for (const topic of ['Getting started', 'Fees and pricing', 'Payouts', 'Trust and safety', 'AI tools', 'For donors']) {
      expect(titles, `topic "${topic}" must survive`).toContain(topic);
    }
    const total = CURATED_FAQ_SECTIONS.reduce((n, s) => n + s.items.length, 0);
    expect(total).toBeGreaterThanOrEqual(23);
  });

  it('keeps the anchors other pages link to', () => {
    // #payouts and #donors are inbound links. Renaming one silently breaks it.
    const ids = CURATED_FAQ_SECTIONS.map((s) => s.id).filter(Boolean);
    expect(ids).toContain('payouts');
    expect(ids).toContain('donors');
    expect(accordion).toContain('id={id}');
  });

  it('interpolates the shared fee copy rather than restating numbers', () => {
    // So a fee change cannot leave the FAQ disagreeing with checkout.
    const content = read('lib/faq-content.ts');
    expect(content).toContain('PLATFORM_FEE_COPY');
    expect(content).toContain('PROCESSING_FEE_COPY');
    expect(content).toContain('SUGGESTED_SUPPORT_COPY');
  });

  it('shapes into the same type the Supabase answers use', () => {
    const curated = getCuratedFaqs(3);
    expect(curated).toHaveLength(3);
    for (const entry of curated) {
      expect(entry.schema_type).toBe('FAQPage');
      expect(entry.question.length).toBeGreaterThan(5);
      expect(entry.answer.length).toBeGreaterThan(20);
      expect(isPlaceholderAeoEntry(entry)).toBe(false);
    }
  });

  it('never returns more than asked for', () => {
    expect(getCuratedFaqs(1)).toHaveLength(1);
    expect(getCuratedFaqs(0)).toHaveLength(0);
    expect(getCuratedFaqs(500).length).toBeGreaterThanOrEqual(23);
  });
});

describe('pages that borrow FAQs get real answers, not an empty block', () => {
  it('tops up from the curated set when the store cannot fill the block', () => {
    // Without this, filtering the placeholders leaves /how-it-works and
    // /contact rendering nothing — pages that had a working FAQ before their
    // content was pointed at the store.
    expect(routeFaqs).toContain('getCuratedFaqs');
    expect(routeFaqs).toContain('if (published.length >= limit) return published.slice(0, limit);');
  });

  it('puts genuinely published entries ahead of the fallback', () => {
    expect(routeFaqs).toContain('[...published, ...curated]');
  });
});

describe('the page renders on the shared design', () => {
  it('uses the shared hero and stat strip rather than hardcoded light classes', () => {
    // The old page was built from literal `bg-white` / `text-slate-950` /
    // `border-slate-200` utilities, which render as a light slab in dark mode —
    // the defect theme-tokens.test.ts exists to block.
    expect(page).toContain('IndexHero');
    expect(page).toContain('StatStrip');
    const src = stripComments(page);
    for (const cls of ['bg-white', 'text-slate-950', 'border-slate-200', 'bg-emerald-50', 'text-emerald-700']) {
      expect(src, `hardcoded light class "${cls}" must be gone`).not.toContain(cls);
    }
  });

  it('uses native details/summary rather than a hand-rolled control', () => {
    const rendered = stripComments(accordion);
    expect(rendered).toContain('<details');
    expect(rendered).toContain('<summary>');
    expect(rendered).not.toContain('aria-expanded');
    expect(rendered).not.toContain("'use client'");
  });

  it('renders no heading for a topic with nothing in it', () => {
    expect(accordion).toContain('if (items.length === 0) return null;');
    expect(groupFaqsByTopic([])).toEqual([]);
  });

  it('keeps the FAQPage schema matched to what is visible', () => {
    // The schema must never describe content a visitor cannot find on the page.
    expect(page).toContain('CURATED_FAQ_SECTIONS.flatMap');
    expect(page).toContain('...aeoFaqs.map');
    expect(page).toContain('JsonLd');
  });
});
