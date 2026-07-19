import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// RLS COVERAGE GUARD (tests the REAL schema, not a TS simulation)
//
// Supabase exposes every table in the `public` schema through PostgREST, so a
// table with RLS disabled can be reachable with the anon key. This test parses
// the actual migration + schema SQL and asserts that every table created also
// has row-level security enabled — either via a literal
//   `alter table <t> enable row level security`
// or via a dynamic loop
//   `foreach t in array array[...] loop execute format('alter table ... %I ...
//    enable row level security', t)`.
//
// If a future migration adds a table and forgets RLS, this test fails.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../supabase');

function loadSql(): string {
  const parts: string[] = [];
  const migrationsDir = path.join(SUPABASE_DIR, 'migrations');
  for (const f of readdirSync(migrationsDir).filter((n) => n.endsWith('.sql'))) {
    parts.push(readFileSync(path.join(migrationsDir, f), 'utf8'));
  }
  // schema.sql is the canonical consolidated definition
  parts.push(readFileSync(path.join(SUPABASE_DIR, 'schema.sql'), 'utf8'));
  return parts.join('\n').toLowerCase();
}

function createdTables(sql: string): Set<string> {
  const set = new Set<string>();
  const re = /create table (?:if not exists )?(?:public\.)?([a-z0-9_]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) set.add(m[1]);
  return set;
}

function rlsEnabledTables(sql: string): Set<string> {
  const set = new Set<string>();

  // 1) Literal: alter table [only] [public.]<t> [ ]+ enable row level security
  const literal = /alter table (?:if exists )?(?:only )?(?:public\.)?([a-z0-9_]+)\s+enable row level security/g;
  let m: RegExpExecArray | null;
  while ((m = literal.exec(sql))) set.add(m[1]);

  // 2) Dynamic: any do-block that enables RLS via execute format contributes
  //    every table named in an array[...] literal inside that block.
  for (const block of sql.split(/do\s+\$\$/)) {
    if (!/enable row level security/.test(block)) continue;
    const arrays = block.match(/array\[([^\]]+)\]/g) ?? [];
    for (const arr of arrays) {
      for (const q of arr.match(/'([a-z0-9_]+)'/g) ?? []) {
        set.add(q.replace(/'/g, ''));
      }
    }
  }
  return set;
}

describe('RLS coverage: every public table has row-level security enabled', () => {
  const sql = loadSql();
  const created = createdTables(sql);
  const rls = rlsEnabledTables(sql);

  // Tables that legitimately do not need RLS (none today). Add here with a
  // written justification if a genuinely public/internal table is introduced.
  const ALLOWLIST = new Set<string>([]);

  it('parses a realistic number of tables from the schema', () => {
    // Guards against the regex silently matching nothing and passing vacuously.
    expect(created.size).toBeGreaterThan(80);
  });

  it('has no table without RLS enabled', () => {
    const missing = [...created].filter((t) => !rls.has(t) && !ALLOWLIST.has(t)).sort();
    expect(missing, `Tables missing RLS: ${missing.join(', ')}`).toEqual([]);
  });
});
