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
 * `withQueryTimeout` needs an explicit fallback, which is verbose at the ~69
 * list-read call sites that already handle `{ data, error }`. This returns the
 * query's own resolved type, synthesising the same `{ data: null, error }` shape
 * supabase-js produces on failure — so a failure takes the call site's existing
 * error branch and no downstream code has to change.
 *
 * ⚠️ **Pass a thunk, not a query.** The argument is a FUNCTION that builds the
 * query, and that is the whole point:
 *
 *   ✅ await boundedQuery(() => supabaseAdmin.from('campaigns').select())
 *   ❌ await boundedQuery(supabaseAdmin.from('campaigns').select())
 *
 * `supabaseAdmin` is a Proxy whose `get` trap THROWS when the service-role env
 * vars are missing. In the ✗ form that throw happens while evaluating the
 * argument — *before this function is entered* — so it is never a rejection,
 * never becomes `{ error }`, and crashes the page render instead of taking the
 * error branch the call site already wrote. All 69 call sites were in the ✗
 * form, which is why a degraded database produced 500s on ~39 pages rather than
 * the empty states those pages already had code for.
 *
 * The thunk moves construction inside the try, so a synchronous throw resolves
 * to `{ data: null, error }` exactly like a timeout does.
 * `__tests__/bounded-query-thunk.test.ts` refuses the ✗ form.
 *
 * For reads only, and only where the existing error branch degrades sensibly.
 */
export async function boundedQuery<Q extends PromiseLike<unknown>>(
  build: () => Q,
  timeoutMs: number = DEFAULT_QUERY_TIMEOUT_MS,
): Promise<Awaited<Q>> {
  const failure = (message: string, code: string) =>
    ({ data: null, error: { message, code } }) as unknown as Awaited<Q>;

  let query: Q;
  try {
    query = build();
  } catch (err) {
    // The client itself is unavailable (missing env, unconstructable client).
    // Distinct code from a timeout so logs can tell "misconfigured" from "slow".
    return failure(err instanceof Error ? err.message : 'query unavailable', 'QUERY_UNAVAILABLE');
  }

  const { data } = await withQueryTimeout(
    query as PromiseLike<Awaited<Q>>,
    failure('query timeout', 'QUERY_TIMEOUT'),
    timeoutMs,
  );
  return data;
}
