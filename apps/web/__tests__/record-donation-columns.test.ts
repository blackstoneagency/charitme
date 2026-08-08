import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// Can a database built from `supabase/migrations/` accept a donation?
//
// `record_donation` is the ONLY path a Stripe donation takes into this database.
// It is plpgsql, so Postgres does not validate its body against the schema until
// it runs — a column named in its INSERT that no migration creates compiles
// fine, deploys fine, and raises 42703 the first time real money arrives. The
// function's own handler logs to `webhook_events` and re-raises, so Stripe
// retries the delivery forever: the donor is charged and the campaign is never
// credited.
//
// That is not hypothetical. `stripe_checkout_session_id` was in exactly that
// state — written and read by record_donation, created by no migration, present
// only in the live database because someone once added it by hand. Every test in
// this repo passed, because every other test compares code against the LIVE
// snapshot, and live had the column.
//
// This test compares the function against what the MIGRATIONS build. It is the
// narrow, high-consequence slice of the drift check in
// `migrations-reproduce-schema.test.ts`: that one tolerates a recorded baseline
// of known drift, which is right for 49 columns on 18 reporting tables and wrong
// for the money path. Nothing here gets a baseline.
// ─────────────────────────────────────────────────────────────────────────────

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** The newest definition of a function wins — later migrations replace it. */
function latestRecordDonationBody(): string {
  const dir = join(REPO_ROOT, 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  let body: string | null = null;
  for (const f of files) {
    const sql = readFileSync(join(dir, f), 'utf8');
    if (/create\s+or\s+replace\s+function\s+public\.record_donation/i.test(sql)) body = sql;
  }
  expect(body, 'no migration defines record_donation').toBeTruthy();
  return body!;
}

/** The column list of `insert into donations (...)`. */
function insertedColumns(sql: string): string[] {
  const m = /insert\s+into\s+donations\s*\(([^)]*)\)/i.exec(sql);
  expect(m, 'record_donation no longer has an `insert into donations (...)`').toBeTruthy();
  return m![1]
    .split(',')
    .map((c) => c.replace(/--.*$/gm, '').trim())
    .filter(Boolean);
}

/** Columns referenced in a `where` clause, which must exist to be compared. */
function whereColumns(sql: string): string[] {
  const m = /select\s+id\s+into\s+v_existing\s+from\s+donations\s+where([\s\S]*?)\s+limit/i.exec(sql);
  if (!m) return [];
  return [...m[1].matchAll(/\b(stripe_\w+)\s*=/g)].map((x) => x[1]);
}

/** Every column on `donations` after replaying schema.sql + the migrations. */
function donationsColumnsAfterFreshProvision(): Set<string> {
  const schema = readFileSync(join(REPO_ROOT, 'supabase', 'schema.sql'), 'utf8');
  const create = /CREATE TABLE public\.donations \(([\s\S]*?)\n\);/.exec(schema);
  expect(create, 'schema.sql no longer declares donations').toBeTruthy();

  const cols = new Set(
    create![1]
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('--') && !l.startsWith('CONSTRAINT'))
      .map((l) => l.split(/\s+/)[0]),
  );

  const dir = join(REPO_ROOT, 'supabase', 'migrations');
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(dir, f), 'utf8');
    // `alter table [if exists] [public.]donations ... add column if not exists x`
    // — the schema qualifier is optional across this repo's history, and the
    // single-statement form repeats the ALTER per column.
    for (const m of sql.matchAll(
      /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?donations\b([\s\S]*?);/gi,
    )) {
      for (const c of m[1].matchAll(/add\s+column\s+if\s+not\s+exists\s+(\w+)/gi)) cols.add(c[1]);
    }
  }
  return cols;
}

describe('record_donation only touches columns the migrations create', () => {
  const sql = latestRecordDonationBody();
  const available = donationsColumnsAfterFreshProvision();

  it('sees a real donations table, not an empty parse', () => {
    // Without this the sweeps below pass vacuously if either regex stops matching.
    expect(available.size).toBeGreaterThan(20);
    expect(available.has('amount_cents')).toBe(true);
    expect(insertedColumns(sql).length).toBeGreaterThan(8);
  });

  it('every INSERTed column exists after a fresh provision', () => {
    const missing = insertedColumns(sql).filter((c) => !available.has(c));
    expect(
      missing,
      'record_donation inserts into donations columns that NO migration creates:\n' +
        `  ${missing.join(', ')}\n` +
        'A database provisioned from supabase/migrations/ raises 42703 on the first\n' +
        'real donation, and Stripe retries that webhook forever. Add an\n' +
        '`alter table ... add column if not exists` migration with the real type.',
    ).toEqual([]);
  });

  it('every column its idempotency check compares exists too', () => {
    // This one runs BEFORE the insert, so a missing column here fails the RPC
    // even for a donation that would otherwise have been a clean no-op replay.
    const cols = whereColumns(sql);
    expect(cols).toContain('stripe_checkout_session_id');
    expect(cols.filter((c) => !available.has(c))).toEqual([]);
  });

  it('offline defaults to false, because two readers treat NULL as "not a Stripe donation"', () => {
    // lib/reconciliation.ts and lib/pricing-analytics.ts both filter
    // `.eq('offline', false)`. record_donation never sets the column, so a
    // nullable `offline` leaves every online donation at NULL — SQL equality
    // excludes NULL, and both surfaces report zero while the table is full.
    const dir = join(REPO_ROOT, 'supabase', 'migrations');
    const declaring = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .find((s) => /add\s+column\s+if\s+not\s+exists\s+offline\s+boolean/i.test(s));
    expect(declaring, 'no migration creates donations.offline').toBeTruthy();
    expect(declaring!).toMatch(/add\s+column\s+if\s+not\s+exists\s+offline\s+boolean\s+not\s+null\s+default\s+false/i);

    const readers = ['lib/reconciliation.ts', 'lib/pricing-analytics.ts'].map((p) =>
      readFileSync(join(REPO_ROOT, 'apps', 'web', p), 'utf8'),
    );
    for (const src of readers) expect(src).toContain(".eq('offline', false)");
  });

  it('has a rollback that warns before dropping donor data', () => {
    const dir = join(REPO_ROOT, 'supabase', 'rollbacks');
    const file = readdirSync(dir).find((f) => f.includes('donations_columns_missing'));
    expect(file, 'the rollback is missing').toBeTruthy();
    const rollback = readFileSync(join(dir, file!), 'utf8');
    // The forward migration is a no-op on production, so this rollback deletes
    // columns it never created. That has to be stated where it is read.
    expect(rollback.toLowerCase()).toContain('offline donation');
    expect(rollback).toContain('drop column if exists stripe_checkout_session_id');
  });
});
