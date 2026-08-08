// ─────────────────────────────────────────────────────────────────────────────
// Is this campaign seeded demo data?
//
// ⚠️ Roughly 500 seeded demo campaigns are live and NOTHING distinguishes them
// from real fundraisers. `20260808000000_demo_data_labeling` added `is_demo` to
// say so — and then nothing ever read it, so applying the migration would have
// changed exactly nothing on the site. This is the missing reader.
//
// There is a safety net today, but it is not a label: demo campaigns have no
// connected Stripe account, so the page renders "Donations open soon" instead of
// a donate form. That stops money moving; it does not tell a donor that the
// story they just read is fabricated.
//
// ── Why this is safe to ship before the migration is applied ────────────────
//
// The campaign detail page selects `*`, so `is_demo` simply arrives as
// `undefined` on a database where the column does not exist yet — no query
// changes, no error, no badge. Once the owner applies the migration AND runs the
// reviewed backfill, the badge appears on exactly the rows they marked.
//
// `isDemoCampaign` therefore treats ONLY an explicit `true` as demo. Every other
// value — false, undefined, null, absent column, a string from a loosely typed
// row — means "not known to be demo", which renders nothing. Guessing in the
// other direction would label a REAL fundraiser as fake, which the migration
// itself calls out as far worse than no label at all.
// ─────────────────────────────────────────────────────────────────────────────

export interface MaybeDemoRow {
  is_demo?: unknown;
}

/**
 * True only when the row is explicitly flagged as demo data.
 *
 * Deliberately strict. `is_demo` is a boolean column, but this reads rows that
 * have passed through `select('*')` and loose casts, so a stray `'false'` string
 * must not be truthy — that would mark a real campaign as fake.
 */
export function isDemoCampaign(row: MaybeDemoRow | null | undefined): boolean {
  if (!row) return false;
  return row.is_demo === true;
}

/** What the badge says. One place, so the page and its test cannot disagree. */
export const DEMO_BADGE_LABEL = 'Demo campaign';

export const DEMO_BADGE_EXPLANATION =
  'This is seeded example data, not a real fundraiser. It cannot accept donations.';
