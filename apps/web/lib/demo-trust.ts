/**
 * Suppress fabricated trust signals on demo/seed rows at the READ layer.
 *
 * Why this exists, and why it is not redundant with the seed fix:
 *
 * `supabase/seeds/02_marketplaces.sql` used to set `verified = (g % 2 = 0)` on
 * seeded grants, volunteer opportunities and nonprofit profiles — so roughly half
 * of every demo dataset wore a public "Verified" badge it had not earned. The seed
 * file now hardcodes `verified = false`, but seeds only govern *future* runs: rows
 * already inserted keep their fabricated badge. Production currently serves ~48
 * "Verified" badges on seeded `/grants` listings, and `/grants` is in `sitemap.ts`,
 * so they are being indexed.
 *
 * Deleting those rows needs database access and is the owner's call (ADR-0003).
 * This is the part that does not: `verified` is only ever *displayed* from a read,
 * so forcing it to `false` for `source === 'seed'` removes the false claim on the
 * next deploy, with no writes and no schema change.
 *
 * A "Verified" badge is a claim a donor may rely on when deciding to give. Demo
 * data may invent names, amounts and deadlines; it must never invent trust.
 */

/** Anything read from a table that carries a demo marker and a trust flag. */
type MaybeDemoRow = { source?: string | null; slug?: string | null; verified?: boolean | null };

/**
 * True when the row came from the demo seed suite rather than a real submission.
 *
 * Checks BOTH markers deliberately. `grants.source` exists (added in
 * `catch_up.sql`) and the seed sets it to 'seed', but `volunteer_opportunities`
 * has **no source column at all** — so a source-only check would silently no-op
 * for volunteers, i.e. look like a fix while changing nothing. Every seeded row
 * across grants, volunteer opportunities and nonprofit profiles is inserted with
 * a `seed-…` slug prefix (`seed-grant-`, `seed-vol-`, `seed-nonprofit-`), which
 * is the one marker common to all three.
 */
export function isDemoRow(row: MaybeDemoRow): boolean {
  if (!row) return false;
  if (row.source === 'seed') return true;
  return typeof row.slug === 'string' && row.slug.startsWith('seed-');
}

/**
 * Returns the row with any fabricated `verified` badge cleared.
 *
 * Real rows pass through untouched — this must never downgrade a genuinely
 * verified organization, only demo rows that were never verified by anyone.
 */
export function suppressDemoTrust<T extends MaybeDemoRow>(row: T): T {
  if (!isDemoRow(row) || !row.verified) return row;
  return { ...row, verified: false };
}

/** Array form, for list endpoints. */
export function suppressDemoTrustAll<T extends MaybeDemoRow>(rows: T[]): T[] {
  return rows.map(suppressDemoTrust);
}
