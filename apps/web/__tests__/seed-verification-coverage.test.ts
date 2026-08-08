import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// Does the seed VERIFIER check everything the seeds WRITE?
//
// `supabase/seeds/99_verify_counts.sql` is the script an owner runs after
// seeding to confirm it worked — it counts rows per table and raises if any
// present table has fewer than 100. Its authority comes entirely from its table
// list, and that list is hand-maintained.
//
// A table seeded by 00–08 but absent from that list is verified by NOBODY: its
// seed can fail, insert nothing, and the verifier still prints success. That has
// happened here before — the file's own comment records `sponsors` shipping 50
// rows of an expected 120 with the coverage check reporting green, because
// `sponsors` was not in the array.
//
// Today the gap is zero. This keeps it there: add a seed file with a new table
// and this fails until the verifier knows about it.
//
// ⚠️ The list lives in a plpgsql `text[]`, not in SQL `FROM` clauses. Parsing it
// as SQL matches nine incidental `from public.%I` format strings and reports 93
// of 98 tables unverified — a fabricated crisis. Parse the array.
// ─────────────────────────────────────────────────────────────────────────────

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SEEDS = join(REPO_ROOT, 'supabase', 'seeds');

/** Table names inside the verifier's `tbls text[] := array[...]`. */
function verifiedTables(): Set<string> {
  const sql = readFileSync(join(SEEDS, '99_verify_counts.sql'), 'utf8');
  const block = /tbls text\[\] := array\[([\s\S]*?)\];/.exec(sql);
  expect(block, 'the verifier no longer declares a `tbls text[]` array').toBeTruthy();
  return new Set([...block![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
}

/** Tables the seed files insert into, public schema only. */
function seededTables(): Map<string, string> {
  const out = new Map<string, string>();
  for (const file of readdirSync(SEEDS).filter((f) => f.endsWith('.sql') && !f.startsWith('99'))) {
    const sql = readFileSync(join(SEEDS, file), 'utf8');
    // `public.` qualified only — `insert into auth.users` is GoTrue's table and
    // is not something a public row-count check can or should cover.
    for (const m of sql.matchAll(/insert\s+into\s+public\.([a-z_]+)/gi)) {
      if (!out.has(m[1])) out.set(m[1], file);
    }
  }
  return out;
}

describe('the seed verifier covers every seeded table', () => {
  const verified = verifiedTables();
  const seeded = seededTables();

  it('parsed both sides — not an empty scan', () => {
    // Without this, a changed array syntax makes the sweep below pass while
    // comparing nothing, which is the failure this file exists to prevent.
    expect(verified.size).toBeGreaterThan(80);
    expect(seeded.size).toBeGreaterThan(80);
    expect(verified.has('campaigns')).toBe(true);
    expect(seeded.has('campaigns')).toBe(true);
    // The regression the verifier's own comment records.
    expect(verified.has('sponsors'), 'sponsors was the one that got away once').toBe(true);
  });

  it('no seeded table is left unverified', () => {
    const gaps = [...seeded.entries()]
      .filter(([table]) => !verified.has(table))
      .map(([table, file]) => `${table} (seeded by ${file})`);
    expect(
      gaps,
      'These tables are written by a seed file but are not in the verifier\'s\n' +
        'table list, so their seed can insert nothing and 99_verify_counts.sql\n' +
        'still reports success:\n  ' + gaps.join('\n  '),
    ).toEqual([]);
  });

  it('the verifier still fails loudly rather than just printing', () => {
    // A "verifier" that only raises notices verifies nothing — the whole point
    // is a non-zero exit when a table is short.
    const sql = readFileSync(join(SEEDS, '99_verify_counts.sql'), 'utf8');
    expect(sql).toMatch(/raise exception 'CharitMe seed coverage failed/);
    expect(sql).toContain('n_ok <> n_total');
  });

  it('detects an unverified table when one is planted', () => {
    // A guard that has never fired proves nothing.
    const planted = new Map(seeded);
    planted.set('a_table_the_verifier_never_heard_of', '01_campaigns_core.sql');
    const gaps = [...planted.keys()].filter((t) => !verified.has(t));
    expect(gaps).toEqual(['a_table_the_verifier_never_heard_of']);
  });
});
