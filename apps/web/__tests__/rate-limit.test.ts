import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, _rateLimitSize, _rateLimitReset } from '../lib/rate-limit';

describe('checkRateLimit (in-memory)', () => {
  beforeEach(() => { _rateLimitReset(); vi.useRealTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('allows up to the limit then denies within the window', () => {
    const key = 'k1';
    for (let i = 0; i < 5; i++) expect(checkRateLimit(key, 5, 60_000)).toBe(true);
    expect(checkRateLimit(key, 5, 60_000)).toBe(false);
  });

  it('resets after the window elapses', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    expect(checkRateLimit('k2', 1, 1_000)).toBe(true);
    expect(checkRateLimit('k2', 1, 1_000)).toBe(false);
    vi.advanceTimersByTime(1_500);
    expect(checkRateLimit('k2', 1, 1_000)).toBe(true);
  });

  it('tracks separate keys independently', () => {
    expect(checkRateLimit('a', 1, 60_000)).toBe(true);
    expect(checkRateLimit('b', 1, 60_000)).toBe(true);
    expect(checkRateLimit('a', 1, 60_000)).toBe(false);
  });

  it('evicts expired entries so the map does not grow unbounded', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    for (let i = 0; i < 50; i++) checkRateLimit(`ev-${i}`, 1, 1_000);
    expect(_rateLimitSize()).toBe(50);
    // Advance past the window + the sweep interval, then touch one key to
    // trigger the sweep. All 50 expired entries should be purged.
    vi.advanceTimersByTime(61_000);
    checkRateLimit('trigger', 1, 1_000);
    expect(_rateLimitSize()).toBe(1);
  });
});

describe('checkRateLimitDurable (Postgres-backed with fallback)', () => {
  beforeEach(() => { _rateLimitReset(); vi.resetModules(); });

  it('returns the RPC verdict when the durable store is available', async () => {
    vi.doMock('../lib/supabase', () => ({
      supabaseAdmin: { rpc: vi.fn().mockResolvedValue({ data: false, error: null }) },
    }));
    const { checkRateLimitDurable } = await import('../lib/rate-limit-durable');
    expect(await checkRateLimitDurable('k', 5, 60_000)).toBe(false);
  });

  it('falls back to the in-memory limiter when the RPC errors', async () => {
    vi.doMock('../lib/supabase', () => ({
      supabaseAdmin: { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'no such function' } }) },
    }));
    const { checkRateLimitDurable } = await import('../lib/rate-limit-durable');
    // limit of 1: first allowed via fallback, second denied via fallback.
    expect(await checkRateLimitDurable('fb', 1, 60_000)).toBe(true);
    expect(await checkRateLimitDurable('fb', 1, 60_000)).toBe(false);
  });

  it('falls back when the RPC throws', async () => {
    vi.doMock('../lib/supabase', () => ({
      supabaseAdmin: { rpc: vi.fn().mockRejectedValue(new Error('network')) },
    }));
    const { checkRateLimitDurable } = await import('../lib/rate-limit-durable');
    expect(await checkRateLimitDurable('t', 2, 60_000)).toBe(true);
  });
});
