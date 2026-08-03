import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { urgencyFor, URGENCY_LABEL } from '../lib/needs';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

describe('need urgency is derived, not asserted', () => {
  it('calls a campaign urgent only when a deadline is close AND the goal is unmet', () => {
    expect(urgencyFor(40, 3)).toBe('urgent');
    expect(urgencyFor(99, 1)).toBe('urgent');
    // Funded — the deadline no longer matters, there is nothing outstanding.
    expect(urgencyFor(100, 1)).not.toBe('urgent');
  });

  it('never calls an open-ended campaign urgent', () => {
    // `null` days left means NO deadline, not "due today". A campaign with no
    // end date cannot be time-critical, and labelling it "Urgent" would make the
    // badge meaningless everywhere else on the page.
    expect(urgencyFor(5, null)).not.toBe('urgent');
    expect(urgencyFor(0, null)).not.toBe('urgent');
  });

  it('treats a large shortfall as high even with no deadline', () => {
    expect(urgencyFor(10, null)).toBe('high');
    expect(urgencyFor(24, null)).toBe('high');
    expect(urgencyFor(25, null)).toBe('medium');
  });

  it('escalates as the deadline approaches', () => {
    expect(urgencyFor(50, 60)).toBe('medium');
    expect(urgencyFor(50, 30)).toBe('high');
    expect(urgencyFor(50, 7)).toBe('urgent');
  });

  it('labels every level', () => {
    for (const level of ['urgent', 'high', 'medium'] as const) {
      expect(URGENCY_LABEL[level]).toBeTruthy();
    }
  });
});

describe('no invented needs data', () => {
  // The reference design lists supply lines — "Clean Water Filters $23,450",
  // "Food Supplies $15,200", "Shelter Materials $32,800", "Medical Supplies
  // $18,600", "School Supplies $9,750". There is no needs table and no
  // line-item data in this schema, so every one of those would be a made-up
  // claim about what a community has asked for.
  //
  // Comments are stripped first, for the same reason as the cause-landing
  // guard: documenting why a figure is excluded must not be what trips it.
  const stripComments = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  const source = stripComments(read('app/needs/page.tsx')) + stripComments(read('lib/needs.ts'));

  it('hardcodes none of the mock supply figures', () => {
    for (const fake of ['23,450', '15,200', '32,800', '18,600', '9,750']) {
      expect(source, `mock figure "${fake}" must not be hardcoded`).not.toContain(fake);
    }
  });

  it('names none of the mock supply lines', () => {
    for (const fake of ['Clean Water Filters', 'Food Supplies', 'Shelter Materials', 'School Supplies']) {
      expect(source, `mock line item "${fake}" must not be hardcoded`).not.toContain(fake);
    }
  });

  it('computes the shortfall rather than storing one', () => {
    // The number this page publishes has to come from goal minus raised, so it
    // moves the moment a donation lands.
    expect(read('lib/needs.ts')).toContain('goalCents - raisedCents');
  });
});
