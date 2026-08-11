import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// `audit-financial-rls.mjs` is the evidence for §5 of the payments audit: users
// must not read another owner's financial data or modify Stripe account IDs,
// fees, amounts, ledger, transfer or payout records.
//
// Measured against production 2026-08-11 with the public anon key:
//   10/10 financial tables         → 0 rows
//   connected_accounts UPDATE      → denied (200, 0 rows affected)
//   donations INSERT               → denied (42501 insufficient_privilege)
//
// This test protects the AUDIT, because an audit that cannot fail is worse than
// none: it produces a clean report either way, and the clean report is what
// someone acts on.
// ─────────────────────────────────────────────────────────────────────────────

const script = readFileSync(
  path.join(__dirname, '..', 'scripts', 'audit-financial-rls.mjs'),
  'utf8',
);

describe('the audit probes with a browser credential', () => {
  it('uses the ANON key, not the service-role key, for every probe', () => {
    // ⚠️ The service-role client bypasses RLS entirely. Probing with it would
    // report every table as readable and every write as allowed — a report that
    // looks like a catastrophic finding and means nothing at all.
    expect(script).toMatch(/const anon = createClient\(url, anonKey/);
    expect(script).toMatch(/anon\.from\(table\)\.select/);
    expect(script).toMatch(/anon\s*\n?\s*\.from\('connected_accounts'\)\s*\n?\s*\.update/);
  });

  it('covers the tables the requirement names', () => {
    for (const table of [
      'connected_accounts',
      'payouts',
      'donations',
      'ledger_entries',
      'campaign_owner_transfers',
    ]) {
      expect(script, `${table} not probed`).toContain(`'${table}'`);
    }
  });
});

describe('it cannot mistake a blocked write for a successful one', () => {
  it('counts rows affected rather than trusting the absence of an error', () => {
    // ⚠️ PostgREST answers a policy-blocked UPDATE with 200 and zero rows, not an
    // error. A probe that only checked `if (error)` would report every blocked
    // write as ALLOWED — the audit would invent a critical finding on a correctly
    // secured database, and the next person would "fix" working policies.
    expect(script).toMatch(/const changed = \(updated \?\? \[\]\)\.length/);
    expect(script).toMatch(/if \(updateError \|\| changed === 0\)/);
  });

  it('treats a zero-row read as a denial, not as an empty table', () => {
    expect(script).toMatch(/rows\.length === 0/);
    expect(script).toContain('policy filters everything');
  });
});

describe('it is safe to run against production', () => {
  it('probes updates with a no-op value', () => {
    // Sets the column to the value it already holds, so a broken policy is
    // reported without the row being changed. An audit that must corrupt data to
    // discover it can corrupt data is not one you can run on production.
    expect(script).toMatch(/\.update\(\{ stripe_account_id: target\.stripe_account_id \}\)/);
  });

  it('verifies the target row is unchanged afterwards', () => {
    expect(script).toContain('target row unchanged');
  });

  it('deletes the one probe that really does create a row', () => {
    // The donations INSERT cannot be a no-op, so it is cleaned up explicitly.
    expect(script).toMatch(/await admin\.from\('donations'\)\.delete\(\)\.eq\('id', row\.id\)/);
  });

  it('exits non-zero when it finds something', () => {
    // A finding that does not fail the command is a finding nobody sees in CI.
    expect(script).toMatch(/process\.exit\(1\)/);
  });
});
