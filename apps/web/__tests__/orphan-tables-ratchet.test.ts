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

  // Code-complete but inert: the migration is not applied in production, so a
  // reader would query a table that does not exist there.
  organizations: 'multi-tenancy; migration unapplied in production',
  organization_members: 'multi-tenancy; migration unapplied in production',
  brands: 'multi-tenancy; migration unapplied in production',

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
  platform_fees: 'superseded by the fee columns on campaign_payments',
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
});
