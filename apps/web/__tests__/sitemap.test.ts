import { describe, it, expect } from 'vitest';
import { safeDate } from '../app/sitemap';

describe('sitemap safeDate', () => {
  it('parses a valid ISO timestamp', () => {
    const d = safeDate('2026-01-02T03:04:05Z');
    expect(d.toISOString()).toBe('2026-01-02T03:04:05.000Z');
  });

  it('falls back to a valid Date for null/undefined (never Invalid Date)', () => {
    for (const v of [null, undefined, '', 'not-a-date', {}]) {
      const d = safeDate(v);
      expect(Number.isNaN(d.getTime())).toBe(false);
    }
  });

  it('accepts a Date instance', () => {
    const src = new Date('2025-05-05T00:00:00Z');
    expect(safeDate(src).getTime()).toBe(src.getTime());
  });
});
