#!/usr/bin/env node
/**
 * Apply ONE migration to production, by name.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS: `supabase db push` is all-or-nothing.
 *
 * There are 49 pending migrations. Applying the deletion tombstone — a table
 * with two inserts, needed before self-service account deletion can be switched
 * on — currently means running all 49, including three whose own authors
 * recorded them as needing staging verification first, and two that delete
 * duplicate rows from payment-adjacent tables.
 *
 * "Apply the one migration you actually reviewed" had no path. This is that path.
 *
 *   node scripts/apply-one-migration.mjs 20260904030000_deleted_user_tombstone
 *   node scripts/apply-one-migration.mjs <name> --commit
 *
 * Requires `SUPABASE_ACCESS_TOKEN` (Supabase → Account → Access Tokens). The
 * service-role key CANNOT do this: PostgREST executes RPCs, not DDL. That is
 * measured, not assumed — production answers a DDL attempt with a 404 route.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ SAFETY, because this writes to a database holding real donations
 *
 *  · Dry run by default. `--commit` is required to execute anything.
 *  · Refuses any migration whose SQL contains an unguarded destructive verb —
 *    see DESTRUCTIVE below. The tombstone is additive; if a migration needs
 *    DROP or DELETE, it should be applied by a human who has read it.
 *  · Records the migration in `supabase_migrations.schema_migrations` in the
 *    same call, so a later `db push` does not try it again and so the ledger
 *    stops overstating what is pending.
 *  · Verifies afterwards by re-reading, rather than trusting the write.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', '..', '..', 'supabase', 'migrations');

const argv = process.argv.slice(2);
const COMMIT = argv.includes('--commit');
const name = argv.find((a) => !a.startsWith('--'));

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF?.trim() || 'yanexccimwooursawynm';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN?.trim();

/**
 * Verbs that change or remove existing data.
 *
 * ⚠️ `DROP POLICY` / `DROP TRIGGER` are excluded deliberately: every migration in
 * this repo uses `DROP … IF EXISTS` immediately before `CREATE` to stay
 * replayable, so flagging them would refuse almost everything and train whoever
 * runs this to pass a bypass flag — which is worse than no check.
 */
const DESTRUCTIVE = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bDROP\s+CONSTRAINT\b/i,
  /\bTRUNCATE\s+(?:TABLE\s+)?[a-z_."]/i,
  /\bDELETE\s+FROM\b/i,
  /\bALTER\s+COLUMN\s+\w+\s+TYPE\b/i,
];

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!name) fail('name a migration, e.g. 20260904030000_deleted_user_tombstone');

const file = readdirSync(MIGRATIONS).find((f) => f === `${name}.sql` || f === name);
if (!file) fail(`no such migration: ${name}`);

const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
// Comments explain what a migration avoids doing, and those explanations quote
// the very verbs below. Stripping them first is what stops the tombstone's own
// commentary from failing its own safety check.
const code = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--[^\n]*$/gm, '');

const hits = DESTRUCTIVE.filter((re) => re.test(code));
console.log(`migration : ${file}`);
console.log(`project   : ${PROJECT_REF}`);
console.log(`bytes     : ${sql.length.toLocaleString()}`);
console.log(`mode      : ${COMMIT ? 'COMMIT' : 'dry run'}`);

if (hits.length > 0) {
  fail(
    `refusing: this migration contains ${hits.length} destructive statement(s).\n` +
    '  Apply it by hand, after reading it and counting what it will remove.\n' +
    '  This tool is for additive migrations only.',
  );
}
console.log('checks    : additive only ✓');

if (!TOKEN) {
  console.log(
    '\nSUPABASE_ACCESS_TOKEN is not set, so nothing can be applied from here.\n' +
    'Get one at https://supabase.com/dashboard/account/tokens, then:\n' +
    `  SUPABASE_ACCESS_TOKEN=… node scripts/apply-one-migration.mjs ${name} --commit`,
  );
  process.exit(COMMIT ? 1 : 0);
}

if (!COMMIT) {
  console.log('\nDry run only. Re-run with --commit to apply.');
  process.exit(0);
}

const endpoint = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function query(statement) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: statement }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const version = file.replace(/_.*$/, '').replace(/\.sql$/, '');

try {
  // Already applied? Re-running an idempotent migration is harmless, but saying
  // so is more useful than silently doing nothing.
  const existing = await query(
    `select version from supabase_migrations.schema_migrations where version = '${version}' limit 1;`,
  );
  if (Array.isArray(existing) && existing.length > 0) {
    console.log(`\n· already recorded as applied (version ${version}); nothing to do.`);
    process.exit(0);
  }

  console.log('\n· applying…');
  await query(sql);

  // Record it, so `db push` skips it and the pending ledger stops overstating.
  await query(
    `insert into supabase_migrations.schema_migrations (version, name)
     values ('${version}', '${file.replace(/'/g, "''")}')
     on conflict (version) do nothing;`,
  );

  // Verify by reading back rather than trusting the write.
  const confirm = await query(
    `select version from supabase_migrations.schema_migrations where version = '${version}' limit 1;`,
  );
  if (!Array.isArray(confirm) || confirm.length === 0) {
    fail('applied, but the ledger row is missing — check the project before re-running');
  }
  console.log(`✓ applied and recorded: ${file}`);
} catch (e) {
  fail(String(e.message).slice(0, 400));
}
