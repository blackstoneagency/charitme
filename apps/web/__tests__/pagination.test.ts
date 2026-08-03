import { describe, it, expect } from 'vitest';
import { totalPages, pageWindow } from '../lib/pagination';

describe('totalPages', () => {
  it('computes ceil(total / limit)', () => {
    expect(totalPages(60, 24)).toBe(3); // 60/24 = 2.5 → 3
    expect(totalPages(48, 24)).toBe(2); // exact multiple
    expect(totalPages(1, 24)).toBe(1);
  });

  it('returns at least 1 for an empty result set', () => {
    expect(totalPages(0, 24)).toBe(1);
  });

  it('never returns NaN or Infinity for a zero/negative limit', () => {
    expect(totalPages(100, 0)).toBe(1);
    expect(totalPages(100, -5)).toBe(1);
  });

  it('clamps a negative total to an empty list', () => {
    expect(totalPages(-10, 24)).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// `pageWindow` — the numbered pager on /campaigns (1 2 3 … 21).
//
// The two halves it merges overlap: for a small page count the endpoints ARE the
// window, so a naive concatenation prints "1 1 2 3 3". A pager that repeats a
// number gets reported as a data bug, so dedup is the property worth pinning.
// ─────────────────────────────────────────────────────────────────────────────
describe('pageWindow', () => {
  it('never repeats a page number', () => {
    for (let total = 1; total <= 30; total++) {
      for (let page = 1; page <= total; page++) {
        const nums = pageWindow(page, total).filter((n): n is number => n !== null);
        expect(new Set(nums).size, `page ${page} of ${total} repeated a number`).toBe(nums.length);
      }
    }
  });

  it('always offers the first and last page', () => {
    for (const [page, total] of [[1, 1], [1, 21], [11, 21], [21, 21], [4, 9]] as const) {
      const nums = pageWindow(page, total).filter((n): n is number => n !== null);
      expect(nums, `page ${page} of ${total}`).toContain(1);
      expect(nums, `page ${page} of ${total}`).toContain(total);
    }
  });

  it('keeps the current page and its neighbours', () => {
    const nums = pageWindow(11, 21).filter((n): n is number => n !== null);
    expect(nums).toEqual(expect.arrayContaining([10, 11, 12]));
  });

  it("renders the design's 1 2 3 … 21 shape on the first pages", () => {
    expect(pageWindow(1, 21)).toEqual([1, 2, null, 21]);
    expect(pageWindow(2, 21)).toEqual([1, 2, 3, null, 21]);
  });

  it('only ellipsises a REAL gap', () => {
    // "1 … 2" would claim hidden pages that do not exist.
    for (let total = 1; total <= 12; total++) {
      for (let page = 1; page <= total; page++) {
        const win = pageWindow(page, total);
        for (let i = 1; i < win.length - 1; i++) {
          if (win[i] === null) {
            const before = win[i - 1] as number;
            const after = win[i + 1] as number;
            expect(after - before, `page ${page}/${total}: ellipsis between adjacent pages`).toBeGreaterThan(1);
          }
        }
      }
    }
  });

  it('never emits a page outside 1..total, and is empty below 1', () => {
    for (const [page, total] of [[1, 5], [5, 5], [3, 5]] as const) {
      for (const n of pageWindow(page, total)) {
        if (n !== null) {
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(total);
        }
      }
    }
    expect(pageWindow(1, 0)).toEqual([]);
  });

  it('stays a single page when there is only one', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
  });
});
