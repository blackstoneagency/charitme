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

/**
 * Real organizations the ORIGINAL seed attributed fabricated grant programs to,
 * mapped to the fictional funders the seed uses now.
 *
 * The seed was fixed (#70) so future runs invent names, but rows already inserted
 * keep the real ones: production still serves ~52 listings crediting "Ford
 * Foundation" and ~44 crediting "City of Austin", each attached to an invented
 * "Seed Grant N" program, and `/grants` is in sitemap.ts so they are indexed.
 *
 * Publishing a fabricated funding program under a real foundation's or a real
 * city's name is a different risk class from ordinary demo data — it is a claim
 * about a third party who never made it. Deleting the rows needs the owner; the
 * displayed name does not, so demo rows are re-labelled on read.
 *
 * Indexes align with the seed's own `(g % 4)` rotation, so a demo grant keeps a
 * coherent funder type (foundation → foundation, city → city).
 */
const DEMO_FUNDER_REPLACEMENTS: Record<string, string> = {
  'Ford Foundation':  'Cedar Grove Foundation',
  'Gates Foundation': 'Northwind Charitable Trust',
  'City of Austin':   'City of Springfield',
};

type MaybeDemoFunder = MaybeDemoRow & { funder_name?: string | null };

/**
 * Replaces a real organization's name on a DEMO row with its fictional stand-in.
 *
 * Real rows are never touched — a genuine Ford Foundation grant must keep its
 * name, so the demo marker is checked first.
 */
export function sanitizeDemoFunder<T extends MaybeDemoFunder>(row: T): T {
  if (!isDemoRow(row) || !row.funder_name) return row;
  const replacement = DEMO_FUNDER_REPLACEMENTS[row.funder_name];
  return replacement ? { ...row, funder_name: replacement } : row;
}

/** Both demo protections in one pass: fabricated badge + real-org attribution. */
export function sanitizeDemoRow<T extends MaybeDemoFunder>(row: T): T {
  return sanitizeDemoFunder(suppressDemoTrust(row));
}

/** Array form, for list endpoints. */
export function sanitizeDemoRowAll<T extends MaybeDemoFunder>(rows: T[]): T[] {
  return rows.map(sanitizeDemoRow);
}
