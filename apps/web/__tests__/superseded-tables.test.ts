import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// The INVERSE of the usual orphan-table guard.
//
// Every other check in this repo pushes toward "every table should have a
// reader". These tables should NOT get one, and the reason is the same in each
// case: a shipped table already holds the same facts, better. Wiring the older
// one would create a second source of truth for numbers that must agree — the
// exact failure this repo has paid for before (three hand-maintained copies of
// CAMPAIGN_CATEGORIES that drifted).
//
// So this test fails when one of them ACQUIRES a reader. If that happens, read
// the reason beside it before deleting the line. "The orphan count went down"
// is not a reason.
// ─────────────────────────────────────────────────────────────────────────────

const SUPERSEDED: Record<string, string> = {
  platform_fees:
    'ledger_entries already records the donation split as a BALANCED double-entry ' +
    'group, idempotent on a unique index, with refund/dispute reversals and a ' +
    'nightly reconciliation job (lib/ledger.ts, lib/reconciliation.ts). ' +
    'platform_fees is a flat subset of that with no currency, no balance and no ' +
    'idempotency key — two records of one number that can disagree.',
  donor_tips:
    'A tip is already `donations.tip_cents`, passed to record_donation as ' +
    'p_tip_cents and posted to the ledger. A separate tips table would be a ' +
    'second total that drifts from the donation it belongs to.',
  processor_accounts:
    'connected_accounts is the shipped equivalent and has 15 call sites. ' +
    'processor_accounts even carries an FK to it.',
  campaign_payment_settings:
    'Part of the same unshipped "payments v2" design as processor_accounts and ' +
    'campaign_payment_exports. The shipped path is connected_accounts + payouts ' +
    '(25 call sites) + ledger_entries.',
  campaign_payment_exports:
    'Same unshipped payments v2 design. Exports today go through the payouts and ' +
    'ledger surfaces.',
  admin_settings:
    'platform_settings is the live singleton config store (13 call sites, ' +
    'CHECK (id = 1), jsonb config). admin_settings is its untyped key/value ' +
    'predecessor; two config stores is how config drifts.',
};

function appSources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx|mjs)$/.test(full) && !full.includes('__tests__')) out.push(full);
    }
  };
  for (const root of ['app', 'lib', 'components', 'scripts']) {
    try { walk(join(__dirname, '..', root)); } catch { /* absent root */ }
  }
  return out;
}

function callSites(table: string, sources: readonly string[]): string[] {
  const needle = `from('${table}')`;
  return sources.filter((f) => readFileSync(f, 'utf8').includes(needle));
}

describe('tables deliberately left without a reader', () => {
  const sources = appSources();

  it('scans a real tree', () => {
    // Without this the sweep below passes vacuously if the walk breaks.
    expect(sources.length).toBeGreaterThan(200);
  });

  it('detects a reader when one exists', () => {
    // A guard that has never fired proves nothing. ledger_entries — the table
    // that SUPERSEDES platform_fees — is read by lib/ledger.ts, so the same
    // detector that reports "none" below must report "some" here.
    expect(callSites('ledger_entries', sources).length).toBeGreaterThan(0);
    expect(callSites('platform_settings', sources).length).toBeGreaterThan(0);
  });

  for (const [table, reason] of Object.entries(SUPERSEDED)) {
    it(`${table} still has no reader`, () => {
      const found = callSites(table, sources);
      expect(
        found,
        `\`${table}\` acquired a reader. Before deleting this line, read why it ` +
        `was left alone:\n\n  ${reason}\n\nIf that reasoning no longer holds, say ` +
        'so in todo.md and remove the entry deliberately.',
      ).toEqual([]);
    });
  }
});

describe('the superseding tables are named accurately', () => {
  it('every table cited as the shipped alternative actually exists', () => {
    const schema = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'schema.sql'), 'utf8');
    for (const table of ['ledger_entries', 'donations', 'connected_accounts', 'payouts', 'platform_settings']) {
      expect(schema, `${table} is cited as the shipped alternative`)
        .toContain(`CREATE TABLE public.${table} (`);
    }
  });

  it('every superseded table still exists in the schema', () => {
    // If one is ever DROPPED, its entry here is dead weight and should go.
    const schema = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'schema.sql'), 'utf8');
    for (const table of Object.keys(SUPERSEDED)) {
      expect(schema, `${table} is no longer in the schema — drop its entry`)
        .toContain(`CREATE TABLE public.${table} (`);
    }
  });
});
