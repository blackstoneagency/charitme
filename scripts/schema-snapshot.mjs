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

// ── RLS posture: tables with RLS disabled + tables with a public USING(true) read ──
const rlsRows = await query(
  `select c.relname as tbl, c.relrowsecurity as rls,
     exists(select 1 from pg_policy p where p.polrelid = c.oid and p.polcmd in ('r','*')
            and coalesce(pg_get_expr(p.polqual, p.polrelid), '') in ('true','(true)')) as public_read
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'`,
);
const rls = {
  rlsDisabled: rlsRows.filter((r) => !r.rls).map((r) => r.tbl).sort(),
  publicRead: rlsRows.filter((r) => r.public_read).map((r) => r.tbl).sort(),
};
writeFileSync(
  join(fixturesDir, 'schema-rls.json'),
  JSON.stringify(rls, Object.keys(rls).sort(), 0) + '\n',
);

console.log(
  `Wrote ${Object.keys(columns).length} tables, ${Object.keys(functions).length} functions, ` +
    `RLS posture (${rls.rlsDisabled.length} disabled, ${rls.publicRead.length} public-read) to ${fixturesDir}`,
);
