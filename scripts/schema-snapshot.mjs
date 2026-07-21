#!/usr/bin/env node
/**
 * Refresh the schema-contract snapshot used by
 * apps/web/__tests__/schema-contract.test.ts.
 *
 * Pulls the live public-schema column inventory via the Supabase Management API
 * and writes apps/web/__tests__/fixtures/schema-columns.json as
 * { "table": ["col", ...], ... }.
 *
 * Run this after any migration that adds/removes/renames columns, then commit the
 * updated fixture alongside the migration.
 *
 * Env:
 *   SUPABASE_ACCESS_TOKEN   personal access token (app.supabase.com → Access Tokens)
 *   NEXT_PUBLIC_SUPABASE_URL used to derive the project ref (…/<ref>.supabase.co)
 *   SUPABASE_PROJECT_REF     optional explicit override of the project ref
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref =
  process.env.SUPABASE_PROJECT_REF ||
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!token) { console.error('Set SUPABASE_ACCESS_TOKEN.'); process.exit(1); }
if (!ref) { console.error('Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_PROJECT_REF.'); process.exit(1); }

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'Mozilla/5.0 (schema-snapshot)',
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json();
  if (!Array.isArray(body)) {
    console.error('Unexpected response:', JSON.stringify(body).slice(0, 300));
    process.exit(1);
  }
  return body;
}

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps/web/__tests__/fixtures');
const writeSorted = (name, obj) =>
  writeFileSync(join(fixturesDir, name), JSON.stringify(Object.fromEntries(Object.entries(obj).sort()), null, 0) + '\n');

// ── Columns per table ──
const colRows = await query(
  `select table_name, json_agg(column_name order by column_name) as cols
   from information_schema.columns where table_schema='public' group by table_name`,
);
const columns = {};
for (const row of colRows) columns[row.table_name] = [...row.cols].sort();
writeSorted('schema-columns.json', columns);

// ── Public functions → named parameters (empty array when none) ──
const fnRows = await query(
  `select proname as fn, coalesce(to_json(proargnames), '[]'::json) as params
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`,
);
const functions = {};
for (const row of fnRows) {
  const set = new Set(functions[row.fn] ?? []);
  for (const p of row.params ?? []) if (p) set.add(p);
  functions[row.fn] = [...set].sort();
}
writeSorted('schema-functions.json', functions);

console.log(`Wrote ${Object.keys(columns).length} tables and ${Object.keys(functions).length} functions to ${fixturesDir}`);
