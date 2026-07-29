import { describe, it, expect } from 'vitest';
import { queryRows, revalidate, safeDate } from '../app/sitemap';

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

describe('sitemap query resilience', () => {
  it('revalidates instead of forcing every crawler request through Supabase', () => {
    expect(revalidate).toBe(900);
  });

  it('returns rows from a successful query', async () => {
    const rows = [{ slug: 'campaign-one' }];
    await expect(queryRows(() => Promise.resolve({ data: rows, error: null }))).resolves.toEqual(rows);
  });

  it('degrades a PostgREST error to an empty content family', async () => {
    await expect(queryRows(() => Promise.resolve({
      data: null,
      error: { code: 'PGRST000' },
    }))).resolves.toEqual([]);
  });

  it('degrades synchronous and asynchronous transport failures', async () => {
    await expect(queryRows(() => {
      throw new Error('missing configuration');
    })).resolves.toEqual([]);
    await expect(queryRows(() => Promise.reject(new TypeError('fetch failed')))).resolves.toEqual([]);
  });
});
