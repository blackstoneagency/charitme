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
