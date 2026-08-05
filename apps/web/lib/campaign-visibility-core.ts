// ─────────────────────────────────────────────────────────────────────────────
// Pure decision logic for the schema probe in `campaign-visibility.ts`.
//
// Split out so it can be tested without a database — the bug this guards against
// is a *decision* bug, not a query bug.
//
// The probe asks "does `campaigns.visibility` exist?" by selecting it. The
// original code treated ANY error as "column absent", and cached that answer for
// the lifetime of the process. So a single transient failure — a timeout, a blip,
// a rate limit — on the first call after a cold start would make every public
// listing skip `visibility = 'public'` and `deleted_at IS NULL` until that
// serverless instance was recycled: private and soft-deleted campaigns listed
// publicly.
//
// A genuinely missing column is distinguishable: PostgREST surfaces Postgres
// `42703 undefined_column`. Everything else is treated as UNKNOWN, which must
// fail toward privacy (apply the filter) and must not be cached.
// ─────────────────────────────────────────────────────────────────────────────

/** Postgres `undefined_column`. The only error that proves a column is absent. */
export const UNDEFINED_COLUMN = '42703';

export type ColumnPresence = 'present' | 'absent' | 'unknown';

export interface ProbeError {
  code?: string | null;
  message?: string | null;
}

/**
 * What a probe result tells us about a column.
 *
 * `absent` requires proof. Anything ambiguous is `unknown`, never `absent`.
 */
export function columnPresence(error: ProbeError | null | undefined): ColumnPresence {
  if (!error) return 'present';
  if (error.code === UNDEFINED_COLUMN) return 'absent';
  // Some stacks omit the code and only carry the message.
  if (typeof error.message === 'string' && /does not exist/i.test(error.message)) return 'absent';
  return 'unknown';
}

/**
 * Whether to apply the privacy filter for a column.
 *
 * Only skipped when the column is *proven* absent. `unknown` applies it: a
 * listing that errors and renders empty is a visible, self-correcting failure;
 * a listing that quietly includes private campaigns is not.
 */
export function shouldFilter(presence: ColumnPresence): boolean {
  return presence !== 'absent';
}

/**
 * Whether a probe result may be cached for the process lifetime.
 *
 * `unknown` must not be — otherwise one transient blip disables the filter until
 * the instance recycles, which is exactly the original defect.
 */
export function isCacheable(presence: ColumnPresence): boolean {
  return presence !== 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// "Not expired" — the second half of what a visitor means by an active campaign.
//
// `status = 'active'` is NOT enough on its own. Nothing in this schema moves a
// campaign out of `active` when its deadline passes; `lib/campaign-lifecycle.ts`
// derives that at render time, which is why a card can say "Ended" while its row
// still says active. A discovery grid that filters on status alone therefore
// lists finished campaigns — the card is honest about it, but the campaign is
// still occupying one of six slots that a live campaign should have.
//
// So the same rule the lifecycle applies in TypeScript is applied in SQL:
//
//     campaignLifecycle(): status !== 'active'      → ended
//                          daysLeft !== null && <= 0 → ended
//
// A NULL deadline runs indefinitely and stays. Matching the two matters more
// than either one being clever: if SQL pruned rows the card would have shown as
// live, the grid would be short for no visible reason.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The PostgREST `.or()` argument for "this campaign has not run out of time".
 *
 * Kept here, as a pure string builder, so the rule can be asserted in a test
 * without a database — and so the four surfaces that need it cannot drift into
 * four slightly different comparisons.
 *
 * `gt`, not `gte`: a deadline of today is a date that has already arrived, which
 * is exactly what `campaignDaysLeft` reports as 0 and the lifecycle calls
 * `ended`. Using `gte` would keep such a campaign in the grid while its own card
 * rendered "Ended".
 */
export function notExpiredFilter(now: Date = new Date()): string {
  return `deadline.is.null,deadline.gt.${now.toISOString()}`;
}
