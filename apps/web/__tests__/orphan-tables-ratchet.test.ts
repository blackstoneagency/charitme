import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const WEB_ROOT = join(__dirname, '..');
const SCHEMA = join(WEB_ROOT, '..', '..', 'supabase', 'schema.sql');

// ─────────────────────────────────────────────────────────────────────────────
// A table with no reader and no writer is this repo's most reliable finding.
// `donation_forms`, `outbound_webhook_endpoints`, `giving_days`, `donor_segments`
// and `embedded_buttons` all had the same signature — RLS, indexes, foreign keys,
// and nothing on either side of them — and each became a real feature.
//
// `orphan-table-hazards` and `superseded-tables` already pin SPECIFIC known
// cases. What neither does is bound the SET, so a new orphan can arrive silently
// — which is how the five above sat unread for months.
//
// This is that bound, and it ratchets in both directions:
//   • a table that stops being referenced must be added here, with a reason;
//   • an entry that GAINS a reader must be removed, so the list cannot rot into
//     a list of things that used to be true.
//
// ⚠️ Adding a name here is not a fix. It is a statement that the table is
// deliberately unread, with the reason written down. An orphan table is equally
// good evidence for DELETING the table as for building a page on it.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tables with no `.from()` call site, and why.
 *
 * Measured 2026-08-02 against 162 tables in the schema mirror.
 */
const DELIBERATELY_UNREAD: Readonly<Record<string, string>> = {
  // Reached by SQL rather than PostgREST — correctly absent from `.from()`.
  rate_limit_hits: 'written by the check_rate_limit RPC, not by the client',

  // Deliberate, and pinned in detail by orphan-table-hazards.test.ts.
  trust_scores: 'stale rows; the live computation is used instead',

  // Code-complete but inert: nothing in `app/`, `lib/` or `components/` reads
  // any of the three.
  //
  // ⚠️ The reason here USED to read "migration unapplied in production". That is
  // not something this repo can know. `20260807000000_organizations_multitenancy`
  // is one of the migrations `scripts/probe-production-migrations.mjs` lists with
  // NO public signal — precisely because these tables have no reader, so there is
  // no route whose success or failure would reveal the answer. The script's own
  // governing rule is that APPLIED is proof and "no proof" is NOT evidence of
  // pending; the old wording broke that rule in a comment, which is where nobody
  // was checking it. The absence of a reader is a CODE fact and is verified right
  // here; the migration's state in production is not, so it is no longer claimed.
  // ── organizations / organization_members / brands: REMOVED from this list.
  // They gained real readers in `lib/organizations-server.ts`, which is exactly
  // what this ratchet is for — an entry that stops being true has to come out,
  // or the list slowly becomes a record of what USED to be unread. The comment
  // above still applies to the entries that remain.

  // Payment observability. Three of the four tables from 20260608020000 have no
  // code on either side; the fourth (campaign_payment_disputes) does.
  campaign_payment_exports: 'payment observability, never wired',
  campaign_payment_settings: 'payment observability, never wired',
  processor_accounts: 'payment observability, never wired',

  // Creator-economy tables from 20260525002000. `creator_tips` additionally
  // carries a Stripe payment intent id, which is why its RLS was tightened.
  creator_tips: 'creator economy, never wired; RLS locked to owner/admin',
  digital_products: 'creator economy, never wired',
  product_orders: 'creator economy, never wired',
  commission_requests: 'creator economy, never wired',
  livestreams: 'creator economy, never wired',

  // Remaining unwired features.
  admin_settings: 'runtime config; supplement creates it, nothing reads it',
  marketing_referrals: 'marketing engine, never wired',
  donor_tips: 'superseded by the tip fields on donations',
  direct_messages: 'superseded by donor_messages / message_thread_state',
  campaign_analytics_events: 'superseded by campaign_builder_events',
  // ⚠️ Two guards named DIFFERENT successors for this one table — here
  // `campaign_payments`, and `superseded-tables.test.ts` `ledger_entries`. Both
  // are real and both are read, so neither was wrong, but for a MONEY table
  // "where is the fee actually recorded" must have one answer, not two that a
  // reader has to reconcile. Stated together, in the order a fee moves:
  platform_fees:
    'superseded twice over — campaign_payments.platform_fee_amount holds the ' +
    'per-payment figure, and ledger_entries holds the balanced double-entry ' +
    'record of it. platform_fees is a flat subset of both, with no currency, no ' +
    'balance and no idempotency key',
  reward_tiers: 'superseded by campaign_rewards',
};

function sourceBlob(): string {
  const parts: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next') continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (/\.(ts|tsx)$/.test(entry)) parts.push(readFileSync(p, 'utf8'));
    }
  };
  for (const d of ['app', 'lib', 'components']) {
    try { walk(join(WEB_ROOT, d)); } catch { /* directory is optional */ }
  }
  return parts.join('\n');
}

function schemaTables(): string[] {
  const sql = readFileSync(SCHEMA, 'utf8');
  return [...sql.matchAll(/^CREATE TABLE public\.(\w+) \(/gm)].map((m) => m[1]);
}

describe('every table has a reader, or a documented reason it does not', () => {
  const tables = schemaTables();
  const blob = sourceBlob();
  const unreferenced = tables.filter(
    (t) => !new RegExp(`\\.from\\(\\s*['"\`]${t}['"\`]\\s*\\)`).test(blob),
  );

  it('parses the schema and the source', () => {
    // Keeps both assertions below from passing vacuously.
    expect(tables.length).toBeGreaterThan(100);
    expect(blob.length).toBeGreaterThan(100_000);
  });

  it('has no UNDOCUMENTED orphan', () => {
    const undocumented = unreferenced.filter((t) => !(t in DELIBERATELY_UNREAD)).sort();
    expect(
      undocumented,
      'table with no `.from()` reader and no entry in DELIBERATELY_UNREAD — either ' +
        'wire it, delete it, or add it with the reason it is deliberately unread',
    ).toEqual([]);
  });

  it('has no STALE entry that has since gained a reader', () => {
    // The other direction. Without this the list slowly becomes a record of
    // things that used to be true, which is worse than no list.
    const stale = Object.keys(DELIBERATELY_UNREAD)
      .filter((t) => !unreferenced.includes(t))
      .sort();
    expect(
      stale,
      'listed as deliberately unread but now has a `.from()` call site — remove it',
    ).toEqual([]);
  });

  it('the successors named for the money table are real, read, and carry the fee', () => {
    // `platform_fees` is the one entry whose reason names replacements by name,
    // and it is a fee record — so the claim is checked rather than trusted.
    // Without this, "superseded by X" can outlive X.
    const schema = readFileSync(SCHEMA, 'utf8');
    expect(schema, 'campaign_payments must still hold the per-payment fee')
      .toMatch(/CREATE TABLE public\.campaign_payments \([\s\S]*?platform_fee_amount bigint/);
    expect(schema).toContain('CREATE TABLE public.ledger_entries (');

    // Derived from the REASON STRING, not a second hardcoded list — otherwise
    // editing the reason to cite a different table would leave this passing
    // while checking something the reason no longer says.
    const reason = DELIBERATELY_UNREAD.platform_fees;
    const cited = [...new Set(
      [...reason.matchAll(/\b(campaign_payments|ledger_entries)\b/g)].map((m) => m[1]),
    )];
    expect(cited.length, 'the platform_fees reason must name where the fee now lives').toBe(2);

    for (const successor of cited) {
      expect(
        new RegExp(`\\.from\\(\\s*['"\`]${successor}['"\`]\\s*\\)`).test(blob),
        `${successor} is cited as where the fee lives, so it must actually be read`,
      ).toBe(true);
    }
  });

  it('does not assert anything about production schema state', () => {
    // The multi-tenancy entries used to say "migration unapplied in production".
    // Nothing here can observe that — those tables have no reader, which is
    // exactly why the migration has no public signal to probe. A reason that
    // claims unverifiable facts is how a wrong belief survives review.
    // Reads the REASON VALUES, not the file text. The first version of this
    // sliced the source on the constant's name and landed on the wrong
    // occurrence, so it passed with the claim planted back in — caught by
    // mutation-testing it, which is the only reason it is written this way.
    const claiming = Object.entries(DELIBERATELY_UNREAD)
      .filter(([, reason]) => /(un|not )applied in production|migration.*not live/i.test(reason))
      .map(([table]) => table);
    expect(
      claiming,
      'these reasons claim a migration is unapplied in production — this repo ' +
        'cannot observe that, and the tables involved are exactly the ones with no ' +
        'public signal to probe. Say what is measurable: whether app code reads it.',
    ).toEqual([]);
  });
});
