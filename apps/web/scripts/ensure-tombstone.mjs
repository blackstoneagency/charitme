#!/usr/bin/env node
/**
 * Provision the deletion tombstone — with the SERVICE-ROLE key, no access token.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS: the migration was misfiled as blocked.
 *
 * `20260904030000_deleted_user_tombstone.sql` was reported as needing
 * `SUPABASE_ACCESS_TOKEN`, on the reasoning that migrations need DDL and the
 * service-role key cannot run DDL. The first half of that is true. The second
 * half does not apply, because **this migration contains no DDL at all** — it is
 * two INSERTs into tables that already exist.
 *
 * `auth.admin.createUser` honours an explicit `id` with the service-role key
 * alone (verified against production with a throwaway id, created and deleted).
 * So the tombstone can be provisioned without a token, and the deletion feature
 * was never actually gated on one.
 *
 *   node scripts/ensure-tombstone.mjs            # report
 *   node scripts/ensure-tombstone.mjs --commit   # provision
 *
 * Idempotent: an existing tombstone is left alone. Safe to run repeatedly, and
 * safe to run against a database where the SQL migration has already been
 * applied — it converges on the same row either way.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(HERE, '..');

/**
 * Defaults to `TOMBSTONE_PROFILE_ID` in lib/deletion-cascade.ts; `--id <uuid>`
 * provisions somewhere else.
 *
 * ⚠️ Use `--id` when the default tombstone's auth row is poisoned — see the
 * BROKEN TOMBSTONE branch below. Provision a fresh one, then set the matching
 * `TOMBSTONE_PROFILE_ID` environment variable so the application uses it. That
 * recovers without any database access.
 */
const idFlag = process.argv.indexOf('--id');
const TOMBSTONE_ID =
  idFlag !== -1 && process.argv[idFlag + 1]
    ? process.argv[idFlag + 1]
    : '00000000-0000-4000-8000-0000deadbeef';
const TOMBSTONE_EMAIL =
  TOMBSTONE_ID === '00000000-0000-4000-8000-0000deadbeef'
    ? 'deleted-user@charitme.invalid'
    // Emails are UNIQUE in auth.users, so a second tombstone needs its own.
    : `deleted-user-${TOMBSTONE_ID.slice(-8)}@charitme.invalid`;
/** 100 years. The API rejects 'infinity'; this is the practical equivalent. */
const BAN_DURATION = '876000h';

const COMMIT = process.argv.includes('--commit');

function env() {
  const merged = { ...process.env };
  const file = join(WEB_ROOT, '.env.local');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.includes('=') || line.trim().startsWith('#')) continue;
      const key = line.slice(0, line.indexOf('=')).trim();
      // Explicit env wins over the file, so CI can override.
      if (!merged[key]) merged[key] = line.slice(line.indexOf('=') + 1).trim();
    }
  }
  return merged;
}

const e = env();
const url = e.NEXT_PUBLIC_SUPABASE_URL;
const key = e.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: existingProfile } = await sb
  .from('profiles')
  .select('id, full_name')
  .eq('id', TOMBSTONE_ID)
  .maybeSingle();

console.log(`project  : ${url.replace(/^https:\/\//, '').replace(/\.supabase\.co.*/, '')}`);
console.log(`tombstone: ${TOMBSTONE_ID}`);
console.log(`present  : ${existingProfile ? `yes (${existingProfile.full_name})` : 'no'}`);

if (existingProfile) {
  // ⚠️ A profile row is NOT proof of a healthy tombstone, and reporting it as one
  // is exactly how this script first misled me. Verify the AUTH side too.
  //
  // Measured against production: the tombstone id returned 500 from getUserById
  // while a real user id returned a clean 404 and a random id returned 404. The
  // cause was `banned_until = 'infinity'` in the first version of the migration —
  // valid PostgreSQL, unserialisable by GoTrue, so the row is permanently
  // unreadable AND unrepairable through the Auth API.
  const probe = await sb.auth.admin.getUserById(TOMBSTONE_ID);
  if (probe.data?.user) {
    console.log(`auth row : readable (banned_until=${probe.data.user.banned_until ?? 'none'})`);
    if (!probe.data.user.banned_until) {
      console.error('\n! the tombstone is NOT banned - it must never be sign-in-able.');
      process.exit(1);
    }
    console.log('\nNothing to do - already provisioned.');
    process.exit(0);
  }

  const status = probe.error?.status ?? 0;
  if (status === 500) {
    console.error(
      '\nx BROKEN TOMBSTONE. The profile row exists but its auth row returns 500,\n' +
      '  meaning banned_until holds a value GoTrue cannot serialise - infinity,\n' +
      '  from the first version of this migration.\n\n' +
      '  It cannot be repaired through the Auth API: getUserById, updateUserById\n' +
      '  and deleteUser all 500. Repair with ONE SQL statement:\n\n' +
      "    update auth.users set banned_until = '2999-12-31 00:00:00+00'\n" +
      `     where id = '${TOMBSTONE_ID}';\n\n` +
      '  Deletion still works meanwhile - reassignment targets profiles.id, which\n' +
      '  is readable - but the row cannot be audited until this is run.\n\n' +
      '  OR, with no database access at all:\n\n' +
      '    node scripts/ensure-tombstone.mjs --id 00000000-0000-4000-8000-00000000dead --commit\n' +
      '    then set TOMBSTONE_PROFILE_ID=00000000-0000-4000-8000-00000000dead\n\n' +
      '  The poisoned row is then inert: it owns nothing and cannot sign in.',
    );
    process.exit(1);
  }

  console.error(`\nx profile exists but the auth row is absent (${status}). Investigate first.`);
  process.exit(1);
}

if (!COMMIT) {
  console.log('\nDry run. Re-run with --commit to provision.');
  process.exit(0);
}

// 1. The auth user. `profiles.id` references it, so it has to exist first.
//
// ⚠️ No password is set, the email is left unconfirmed, and the account is
// banned for a century. A sign-in-able tombstone is an account that owns every
// deleted user's campaigns, payouts and Stripe subscriptions.
const { error: createError } = await sb.auth.admin.createUser({
  id: TOMBSTONE_ID,
  email: TOMBSTONE_EMAIL,
  email_confirm: false,
  user_metadata: { tombstone: true },
  app_metadata: { provider: 'tombstone', providers: ['tombstone'] },
  ban_duration: BAN_DURATION,
});
if (createError && !/already.*registered|already exists/i.test(createError.message)) {
  console.error(`✗ could not create the auth user: ${createError.message}`);
  process.exit(1);
}

// 2. The profile. `handle_new_user` may already have made one from the trigger
// on auth.users, so this converges rather than assuming either way.
const { error: profileError } = await sb
  .from('profiles')
  .upsert({ id: TOMBSTONE_ID, full_name: 'Deleted User', email: TOMBSTONE_EMAIL }, { onConflict: 'id' });
if (profileError) {
  console.error(`✗ could not write the profile: ${profileError.message}`);
  process.exit(1);
}

// 3. Verify by reading back, rather than trusting the writes.
const { data: check } = await sb
  .from('profiles')
  .select('id, full_name')
  .eq('id', TOMBSTONE_ID)
  .maybeSingle();
if (!check) {
  console.error('✗ wrote the tombstone but cannot read it back');
  process.exit(1);
}

const { data: authCheck } = await sb.auth.admin.getUserById(TOMBSTONE_ID);
const banned = authCheck?.user?.banned_until ?? null;
const confirmed = authCheck?.user?.email_confirmed_at ?? null;

console.log(`\n✓ provisioned: ${check.full_name}`);
console.log(`  banned_until      : ${banned ?? '(none)'}`);
console.log(`  email_confirmed_at: ${confirmed ?? '(never — correct)'}`);
if (!banned) {
  console.error('\n⚠️ the tombstone is NOT banned. It must never be sign-in-able — investigate before relying on it.');
  process.exit(1);
}
