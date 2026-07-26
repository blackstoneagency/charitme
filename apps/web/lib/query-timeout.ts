// ─────────────────────────────────────────────────────────────────────────────
// Bounded Supabase reads for server components.
//
// Measured on a production build against an unreachable Supabase host: pages with
// no database access returned in 73–726ms, while DB-backed pages (/faq, /grants)
// took ~7.1s each — supabase-js waits out its own retry/connect budget. There is
// no ceiling, so a degraded Supabase degrades every DB-backed page without bound
// instead of falling back to an empty state, and the cost compounds across pages.
//
// This gives a read an explicit deadline and an explicit fallback. It is for
// READS that have a sensible empty state (a carousel, a leaderboard, a list) —
// never for writes, and never where silently returning "nothing" would be
// mistaken for a real answer (money totals, receipts, auth decisions).
// ─────────────────────────────────────────────────────────────────────────────

/** Default deadline. Comfortably above a healthy query, far below a stalled one. */
export const DEFAULT_QUERY_TIMEOUT_MS = 2_500;

export interface QueryTimeoutResult<T> {
  data: T;
  /** True when the deadline fired (or the query threw) and `data` is the fallback. */
  degraded: boolean;
}

/**
 * Resolve `work` within `timeoutMs`, otherwise resolve `fallback`.
 *
 * A rejection is treated the same as a timeout: the caller wanted data with a
 * usable empty state, and an unreachable database is not an exceptional case
 * worth crashing a page render over.
 *
 * The pending promise is deliberately not cancelled — Supabase queries are not
 * abortable once issued, and letting it settle in the background is harmless.
 * Its rejection is swallowed so it cannot surface as an unhandled rejection.
 */
export async function withQueryTimeout<T>(
  work: PromiseLike<T>,
  fallback: T,
  timeoutMs: number = DEFAULT_QUERY_TIMEOUT_MS,
): Promise<QueryTimeoutResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const guarded = Promise.resolve(work).then(
    (data) => ({ data, degraded: false }),
    () => ({ data: fallback, degraded: true }),
  );

  const deadline = new Promise<QueryTimeoutResult<T>>((resolve) => {
    timer = setTimeout(() => resolve({ data: fallback, degraded: true }), timeoutMs);
  });

  try {
    return await Promise.race([guarded, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Give a Supabase query builder a deadline while keeping its exact result shape.
 *
 * `withQueryTimeout` needs an explicit fallback, which is verbose at the ~15
 * list-read call sites that already handle `{ data, error }`. This returns the
 * query's own resolved type, synthesising the same `{ data: null, error }` shape
 * supabase-js produces on failure — so a timeout takes the call site's existing
 * error branch and no downstream code has to change:
 *
 *   const { data, error } = await boundedQuery(supabaseAdmin.from('x').select());
 *
 * For reads only, and only where the existing error branch degrades sensibly.
 */
export async function boundedQuery<Q extends PromiseLike<unknown>>(
  query: Q,
  timeoutMs: number = DEFAULT_QUERY_TIMEOUT_MS,
): Promise<Awaited<Q>> {
  const fallback = {
    data: null,
    error: { message: 'query timeout', code: 'QUERY_TIMEOUT' },
  } as unknown as Awaited<Q>;
  const { data } = await withQueryTimeout(query as PromiseLike<Awaited<Q>>, fallback, timeoutMs);
  return data;
}
