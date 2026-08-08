// ─────────────────────────────────────────────────────────────────────────────
// Optional-column tolerance for the campaign insert.
//
// ⚠️ **Migrations in this repo are applied by the owner, not by deploy.** So a
// column added in a migration does NOT exist in production the moment the code
// that writes it ships. Inserting it unconditionally would fail EVERY campaign
// creation until someone ran the SQL — the single most expensive outage this
// codebase could produce, since it breaks the funnel that makes the site work.
//
// The route already handled this for `image_urls` with a hand-rolled retry. That
// worked for one column and does not compose: with two independently-missing
// columns you need four branches, with three you need eight. This drops whichever
// column the error names and retries, so N optional columns cost N retries in the
// worst case and none in the normal one.
//
// The normal case matters: when both columns exist — which is every environment
// after the migration is applied — there is exactly ONE insert and no retry.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Columns that may legitimately not exist yet, newest last.
 *
 * A column belongs here only while its migration may be unapplied somewhere. Once
 * it is applied everywhere it can be removed, and the insert becomes strict again.
 */
export const OPTIONAL_CAMPAIGN_COLUMNS = ['image_urls', 'campaign_path'] as const;

export type OptionalCampaignColumn = (typeof OPTIONAL_CAMPAIGN_COLUMNS)[number];

export interface PostgrestErrorish {
  code?: string;
  message?: string;
}

/**
 * Which optional column an insert error is complaining about, if any.
 *
 * `PGRST204` is PostgREST's schema-cache miss; `42703` is PostgreSQL's
 * undefined_column. Anything else is a real failure and must NOT be retried —
 * returning null for those is what stops this masking a genuine error (a
 * constraint violation, an RLS refusal) by silently dropping data and inserting
 * anyway.
 */
export function missingOptionalColumn(
  error: PostgrestErrorish | null | undefined,
  columns: readonly string[] = OPTIONAL_CAMPAIGN_COLUMNS,
): string | null {
  if (!error) return null;
  if (error.code !== 'PGRST204' && error.code !== '42703') return null;
  const message = error.message ?? '';
  // Longest name first, so `campaign_path` is not shadowed by a shorter column
  // name that happens to be a substring of it.
  const byLength = [...columns].sort((a, b) => b.length - a.length);
  return byLength.find((column) => message.includes(column)) ?? null;
}

/**
 * A copy of `payload` without `column`.
 *
 * Returns a new object rather than mutating, so a caller retrying in a loop
 * cannot corrupt the payload it is about to send.
 */
export function withoutColumn<T extends Record<string, unknown>>(
  payload: T,
  column: string,
): T {
  const { [column]: _removed, ...rest } = payload;
  return rest as T;
}

/**
 * Insert, retrying without any optional column the database says it lacks.
 *
 * Bounded by the number of optional columns, so a persistently-failing insert
 * cannot loop: each retry strips one column, and a column is never re-added.
 */
export async function insertTolerantOfMissingColumns<
  T extends Record<string, unknown>,
  R extends { error?: PostgrestErrorish | null },
>(
  payload: T,
  insert: (payload: T) => Promise<R>,
  columns: readonly string[] = OPTIONAL_CAMPAIGN_COLUMNS,
): Promise<{ result: R; dropped: string[] }> {
  let current = payload;
  const dropped: string[] = [];

  let result = await insert(current);
  for (let attempt = 0; attempt < columns.length; attempt++) {
    const missing = missingOptionalColumn(result.error, columns);
    // Guard against a database that names a column we already removed, which
    // would otherwise spin without making progress.
    if (!missing || dropped.includes(missing)) break;
    dropped.push(missing);
    current = withoutColumn(current, missing);
    result = await insert(current);
  }

  return { result, dropped };
}
