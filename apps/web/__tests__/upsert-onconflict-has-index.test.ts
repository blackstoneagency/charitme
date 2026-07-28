import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const WEB_ROOT = join(__dirname, '..');
const SCHEMA = join(WEB_ROOT, '..', '..', 'supabase', 'schema.sql');

// ─────────────────────────────────────────────────────────────────────────────
// `upsert(row, { onConflict: 'a,b' })` compiles to `ON CONFLICT (a, b)`, which
// Postgres resolves by INFERENCE: it needs a unique index or constraint on
// exactly those columns, or it raises 42P10 and the whole write fails.
//
// Nothing in TypeScript checks that. Two shipped upserts named a conflict target
// that could never be inferred, and because both discarded their result, the
// handlers reported success while writing nothing:
//
//   • refunds     — no unique index on donation_id at all (and rightly so: a
//                   donation can have a donor request AND an admin's processed
//                   row). "Trigger refund" never queued a refund.
//   • tax_receipts — had a unique index, but a PARTIAL one
//                   (`where donation_id is not null`). Postgres only infers a
//                   partial index when the statement repeats the predicate, and
//                   supabase-js `onConflict` takes column names only. Verified
//                   against Postgres 16; fixed in
//                   20260728020000_fix_tax_receipt_upsert_inference.sql.
//
// So this checks every onConflict target against the generated schema mirror.
// A partial index does NOT count — that is the whole point of the second case.
// ─────────────────────────────────────────────────────────────────────────────

type Site = { file: string; line: number; table: string; cols: string[] };

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '__tests__') continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.tsx?$/.test(entry)) out.push(p);
  }
  return out;
}

function collectSites(): Site[] {
  const sites: Site[] = [];
  for (const file of [...sourceFiles(join(WEB_ROOT, 'app')), ...sourceFiles(join(WEB_ROOT, 'lib'))]) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const m = /onConflict:\s*'([^']+)'/.exec(line);
      // Skip prose: the fix for the refunds case documents the old call in a comment.
      if (!m || /^\s*(\/\/|\*)/.test(line)) return;
      // The table is the nearest `.from('x')` at or above the upsert.
      let table = '';
      for (let j = i; j >= 0 && j > i - 40; j--) {
        const f = /\.from\('([a-z_]+)'\)/.exec(lines[j]);
        if (f) { table = f[1]; break; }
      }
      sites.push({
        file: file.slice(WEB_ROOT.length + 1),
        line: i + 1,
        table,
        cols: m[1].split(',').map((c) => c.trim()).sort(),
      });
    });
  }
  return sites;
}

/** Unique column-sets per table, from the generated mirror. Partial indexes excluded. */
function uniqueSets(): Map<string, string[][]> {
  const sql = readFileSync(SCHEMA, 'utf8');
  const byTable = new Map<string, string[][]>();
  const add = (table: string, cols: string) =>
    byTable.set(table, [
      ...(byTable.get(table) ?? []),
      cols.split(',').map((c) => c.trim().replace(/\s+(ASC|DESC)$/i, '')).sort(),
    ]);

  // CREATE UNIQUE INDEX x ON public.t USING btree (a, b);  — the trailing `;`
  // matters: an index with a WHERE clause is deliberately NOT matched.
  const idx = /CREATE UNIQUE INDEX \w+ ON public\.(\w+) USING btree \(([^)]+)\);/g;
  for (let m = idx.exec(sql); m; m = idx.exec(sql)) add(m[1], m[2]);

  // ALTER TABLE ONLY public.t ADD CONSTRAINT c UNIQUE (a, b);  /  PRIMARY KEY (a)
  const con = /ALTER TABLE ONLY public\.(\w+)\s+ADD CONSTRAINT \w+ (?:UNIQUE|PRIMARY KEY) \(([^)]+)\)/g;
  for (let m = con.exec(sql); m; m = con.exec(sql)) add(m[1], m[2]);

  return byTable;
}

describe('every upsert onConflict target is inferable', () => {
  const sites = collectSites();
  const sets = uniqueSets();

  it('finds the upsert sites and the schema mirror', () => {
    // Guards every assertion below from going vacuous if the parsing breaks.
    expect(sites.length).toBeGreaterThan(20);
    expect(sets.size).toBeGreaterThan(50);
    expect(sites.every((s) => s.table !== '')).toBe(true);
  });

  it('has a matching non-partial unique index or constraint for each', () => {
    const unmatched = sites.filter((s) => {
      const candidates = sets.get(s.table) ?? [];
      return !candidates.some(
        (c) => c.length === s.cols.length && c.every((col, i) => col === s.cols[i]),
      );
    });
    expect(
      unmatched.map((s) => `${s.file}:${s.line} — ${s.table}(${s.cols.join(',')})`),
      'ON CONFLICT target with no inferable unique index — this upsert raises 42P10 at runtime',
    ).toEqual([]);
  });
});
