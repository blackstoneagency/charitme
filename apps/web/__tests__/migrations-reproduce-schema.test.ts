import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import schemaColumns from './fixtures/schema-columns.json';
import driftBaseline from './fixtures/schema-migration-drift-baseline.json';

// ─────────────────────────────────────────────────────────────────────────────
// Do the migrations actually reproduce production?
//
// `schema-contract.test.ts` answers a DIFFERENT question. It checks that every
// column the CODE selects exists in the live-database snapshot — i.e. that code
// matches production. It cannot tell you that `supabase/migrations/` fails to
// rebuild production, because it never looks at the migrations at all.
//
// That gap is why 61 columns across 21 tables drifted unnoticed: they exist live,
// no migration creates them, and every test still passed. Provisioning a fresh
// database silently produced a `donations` table with no `tip_cents`, a
// `campaigns` table with no `location`, and a `profiles` table missing both the
// preference and the billing columns.
//
// This test reconstructs what a fresh provision yields — `schema.sql`'s CREATE
// TABLE bodies plus every `add column if not exists` in the migrations — and
// compares it against the live snapshot.
//
// The known gap is recorded in `schema-migration-drift-baseline.json` rather than
// failing the suite today, because fixing it needs real column TYPES from
// `information_schema.columns`, which is a live-DB query. Guessing types would be
// worse than the gap: `tip_cents` as `text` gives you a database that looks right
// and behaves differently.
//
// So this fails on CHANGE, in both directions:
//   • new drift  → a column was added live (or a migration was dropped) → fix it
//   • less drift → someone closed part of the gap → shrink the baseline
// Regenerate the baseline only when the change is understood and intended.
// ─────────────────────────────────────────────────────────────────────────────

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const LIVE = schemaColumns as Record<string, string[]>;
const BASELINE = driftBaseline as Record<string, string[]>;

/** Columns declared in `schema.sql`'s CREATE TABLE bodies, per table. */
function columnsFromSchemaSql(): Record<string, Set<string>> {
  const sql = readFileSync(join(REPO_ROOT, 'supabase', 'schema.sql'), 'utf8');
  const out: Record<string, Set<string>> = {};
  const re = /CREATE TABLE public\.(\w+) \(([\s\S]*?)\n\);/g;
  for (const m of sql.matchAll(re)) {
    out[m[1]] = new Set(
      m[2]
        .trim()
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('--'))
        .map((l) => l.split(/\s+/)[0]),
    );
  }
  return out;
}

/** Columns added by `add column if not exists` across every migration. */
function columnsFromMigrations(): Record<string, Set<string>> {
  const dir = join(REPO_ROOT, 'supabase', 'migrations');
  const out: Record<string, Set<string>> = {};
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(dir, f), 'utf8');
    const re = /public\.(\w+)\s*\n?\s*add column if not exists "?(\w+)"?/gi;
    for (const m of sql.matchAll(re)) {
      (out[m[1]] ??= new Set()).add(m[2]);
    }
  }
  return out;
}

function currentDrift(): Record<string, string[]> {
  const base = columnsFromSchemaSql();
  const added = columnsFromMigrations();
  const drift: Record<string, string[]> = {};
  for (const [table, cols] of Object.entries(LIVE)) {
    // Only tables schema.sql actually declares — others are out of its scope.
    if (!base[table]) continue;
    const have = new Set([...base[table], ...(added[table] ?? [])]);
    const missing = cols.filter((c) => !have.has(c)).sort();
    if (missing.length) drift[table] = missing;
  }
  return drift;
}

describe('migrations reproduce the live schema', () => {
  it('has no drift beyond the recorded baseline', () => {
    const drift = currentDrift();
    const newDrift: string[] = [];
    for (const [table, cols] of Object.entries(drift)) {
      const known = new Set(BASELINE[table] ?? []);
      const fresh = cols.filter((c) => !known.has(c));
      if (fresh.length) newDrift.push(`${table}: ${fresh.join(', ')}`);
    }
    expect(
      newDrift,
      `Columns exist in the live database that NO migration creates, beyond the\n` +
        `known baseline. A fresh provision will be missing them.\n` +
        `Add an "alter table ... add column if not exists" migration with the REAL\n` +
        `type from information_schema.columns — do not guess:\n  ${newDrift.join('\n  ')}`,
    ).toEqual([]);
  });

  it('baseline is not stale — shrink it when drift is fixed', () => {
    const drift = currentDrift();
    const fixed: string[] = [];
    for (const [table, cols] of Object.entries(BASELINE)) {
      const still = new Set(drift[table] ?? []);
      const closed = cols.filter((c) => !still.has(c));
      if (closed.length) fixed.push(`${table}: ${closed.join(', ')}`);
    }
    expect(
      fixed,
      `These baseline entries are now covered by a migration. Regenerate\n` +
        `schema-migration-drift-baseline.json so it keeps shrinking rather than\n` +
        `hiding future drift:\n  ${fixed.join('\n  ')}`,
    ).toEqual([]);
  });

  it('the check is non-vacuous — it can see both sources', () => {
    const base = columnsFromSchemaSql();
    const added = columnsFromMigrations();
    // schema.sql parses, and profiles is fully covered after this session's two
    // migrations — proof the migration parser works, not just the schema one.
    expect(Object.keys(base).length).toBeGreaterThan(100);
    expect(added.profiles?.size ?? 0).toBeGreaterThanOrEqual(14);
    expect(currentDrift().profiles).toBeUndefined();
  });
});
