import { describe, it, expect, vi } from 'vitest';
import { withQueryTimeout, DEFAULT_QUERY_TIMEOUT_MS } from '../lib/query-timeout';

const later = <T>(value: T, ms: number) => new Promise<T>((r) => setTimeout(() => r(value), ms));

describe('withQueryTimeout', () => {
  it('returns real data when the query beats the deadline', async () => {
    const r = await withQueryTimeout(later(['row'], 5), [], 200);
    expect(r).toEqual({ data: ['row'], degraded: false });
  });

  it('returns the fallback and flags degraded when the deadline fires', async () => {
    const r = await withQueryTimeout(later(['row'], 500), ['fallback'], 20);
    expect(r).toEqual({ data: ['fallback'], degraded: true });
  });

  it('treats a rejection like a timeout rather than crashing the render', async () => {
    const r = await withQueryTimeout(Promise.reject(new Error('ECONNREFUSED')), [], 200);
    expect(r).toEqual({ data: [], degraded: true });
  });

  it('does not leak an unhandled rejection when the slow query later fails', async () => {
    const onUnhandled = vi.fn();
    process.on('unhandledRejection', onUnhandled);
    const doomed = new Promise((_, reject) => setTimeout(() => reject(new Error('late failure')), 30));
    const r = await withQueryTimeout(doomed, 'empty', 5);
    expect(r.degraded).toBe(true);
    await later(null, 80); // give the late rejection time to surface
    process.off('unhandledRejection', onUnhandled);
    expect(onUnhandled).not.toHaveBeenCalled();
  });

  it('preserves falsy and empty results as real data, not as degraded', async () => {
    expect(await withQueryTimeout(Promise.resolve(0), 99, 100)).toEqual({ data: 0, degraded: false });
    expect(await withQueryTimeout(Promise.resolve([]), ['fb'], 100)).toEqual({ data: [], degraded: false });
    expect(await withQueryTimeout(Promise.resolve(null), 'fb', 100)).toEqual({ data: null, degraded: false });
  });

  it('accepts a thenable, since supabase query builders are not real promises', async () => {
    const thenable = { then: (res: (v: string[]) => void) => res(['from-thenable']) };
    const r = await withQueryTimeout(thenable as PromiseLike<string[]>, [], 100);
    expect(r).toEqual({ data: ['from-thenable'], degraded: false });
  });

  it('has a default deadline well under the ~7s stall it exists to prevent', () => {
    expect(DEFAULT_QUERY_TIMEOUT_MS).toBeLessThan(7_000);
    expect(DEFAULT_QUERY_TIMEOUT_MS).toBeGreaterThan(500);
  });
});

describe('boundedQuery', () => {
  it('passes a successful query through untouched', async () => {
    const { boundedQuery } = await import('../lib/query-timeout');
    expect(await boundedQuery(() => Promise.resolve({ data: [{ id: 1 }], error: null })))
      .toEqual({ data: [{ id: 1 }], error: null });
  });

  it('synthesises the supabase failure shape on timeout so the existing error branch runs', async () => {
    const { boundedQuery } = await import('../lib/query-timeout');
    const result = await boundedQuery(
      () => new Promise((r) => setTimeout(() => r({ data: [1], error: null }), 500)),
      10,
    ) as { data: unknown; error: { code: string } };
    expect(result.data).toBeNull();
    expect(result.error.code).toBe('QUERY_TIMEOUT');
  });

  it('also synthesises the failure shape when the query rejects', async () => {
    const { boundedQuery } = await import('../lib/query-timeout');
    const result = await boundedQuery(() => Promise.reject(new Error('ECONNREFUSED')), 50) as { data: unknown; error: { code: string } };
    expect(result.data).toBeNull();
    expect(result.error.code).toBe('QUERY_TIMEOUT');
  });

  // ── The reason boundedQuery takes a thunk at all ──────────────────────────
  //
  // `supabaseAdmin` is a Proxy whose `get` trap throws when the service-role env
  // vars are missing, so `supabaseAdmin.from('x')` throws SYNCHRONOUSLY, while
  // the argument is being evaluated. Under the old signature that happened
  // before boundedQuery was entered: not a rejection, never `{ error }`, and a
  // 500 on every page that read the database — even though all 69 call sites
  // already had an error branch written and ready.
  it('catches a synchronous throw while BUILDING the query, not just a rejection', async () => {
    const { boundedQuery } = await import('../lib/query-timeout');
    const proxy = new Proxy({} as Record<string, unknown>, {
      get() { throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set'); },
    });
    const result = await boundedQuery(
      () => (proxy as { from: (t: string) => PromiseLike<unknown> }).from('campaigns'),
      50,
    ) as { data: unknown; error: { code: string; message: string } };
    expect(result.data).toBeNull();
    expect(result.error.code).toBe('QUERY_UNAVAILABLE');
    expect(result.error.message).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('distinguishes an unavailable client from a slow one', async () => {
    const { boundedQuery } = await import('../lib/query-timeout');
    const slow = await boundedQuery(() => new Promise(() => {}), 10) as { error: { code: string } };
    const dead = await boundedQuery(() => { throw new Error('no client'); }, 10) as { error: { code: string } };
    expect(slow.error.code).toBe('QUERY_TIMEOUT');
    expect(dead.error.code).toBe('QUERY_UNAVAILABLE');
  });
});
