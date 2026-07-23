#!/usr/bin/env node
/**
 * RLS anonymous-exposure audit (CHAR-0012).
 *
 * Probes every public table with the PUBLIC ANON KEY — the same key that ships
 * to every browser — and reports which tables return rows to an unauthenticated
 * caller. Anything not on the ALLOWLIST below is a potential data leak.
 *
 * Read-only: issues only SELECT ... LIMIT 1 requests. Safe to run against prod.
 *
 * Usage:
 *   node scripts/rls-anon-audit.mjs                 # human report
 *   node scripts/rls-anon-audit.mjs --ci            # exit 1 if an unexpected table is exposed
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY, and
 * SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF to enumerate tables.
 * Reads apps/web/.env.local when the vars are not already in the environment.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Tables that are INTENTIONALLY world-readable (public product surface).
 * Adding a table here is a deliberate decision to publish it — review carefully.
 */
const ALLOWLIST = new Set([
  'aeo_entries', 'announcements', 'campaign_faqs', 'campaign_media',
  'campaign_milestones', 'campaign_rewards', 'campaign_updates', 'campaigns',
  'challenge_participants', 'challenges', 'donor_messages', 'event_tickets',
  'fundraising_events', 'grants', 'nonprofit_profiles', 'peer_fundraisers',
  'sponsors', 'sponsorship_opportunities', 'transparency_ledger_items',
  'trust_scores', 'user_badges', 'volunteer_opportunities', 'volunteer_profiles',
  // Public transparency surface — each is status- or parent-gated, verified
  // against pg_policies 2026-07-23 (not blanket `using (true)`):
  //   impact_plans/impact_updates : status='published' OR owns_campaign OR is_admin()
  //   impact_plan_items/evidence  : inherit parent plan/update visibility
  //   impact_metrics              : gated on campaign visibility
  //   matching_programs           : only active/paused/closed programs
  //   grant_deadlines             : gated on parent grant being visible
  'impact_plans', 'impact_plan_items', 'impact_updates', 'impact_evidence',
  'impact_metrics', 'matching_programs', 'grant_deadlines',
]);

function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(resolve(ROOT, 'apps/web/.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i < 0) continue;
      const k = line.slice(0, i).trim();
      if (!env[k]) env[k] = line.slice(i + 1).trim();
    }
  } catch { /* env file optional */ }
  return env;
}

async function listTables(env) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query:
          "select c.relname as t from pg_class c " +
          "join pg_namespace n on n.oid = c.relnamespace " +
          "where n.nspname = 'public' and c.relkind = 'r' order by 1",
      }),
      signal: AbortSignal.timeout(45_000),
    },
  );
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error(`could not list tables: ${JSON.stringify(json).slice(0, 200)}`);
  return json.map((r) => r.t);
}

async function probe(env, table) {
  try {
    const res = await fetch(
      `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?select=*&limit=1`,
      {
        headers: {
          apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (res.status !== 200) return { rows: 0, status: res.status };
    const body = await res.json();
    return Array.isArray(body)
      ? { rows: body.length, cols: body[0] ? Object.keys(body[0]) : [] }
      : { rows: 0, status: 200, error: body?.code };
  } catch {
    return { rows: 0, error: 'request-failed' };
  }
}

async function main() {
  const ci = process.argv.includes('--ci');
  const env = loadEnv();
  for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROJECT_REF']) {
    if (!env[k]) {
      console.error(`missing ${k}`);
      process.exit(2);
    }
  }

  const tables = await listTables(env);
  const exposed = [];
  const errored = [];

  for (const t of tables) {
    const r = await probe(env, t);
    if (r.error && r.error !== 'request-failed') errored.push({ t, code: r.error });
    if (r.rows > 0) exposed.push({ t, cols: r.cols ?? [] });
  }

  const unexpected = exposed.filter((e) => !ALLOWLIST.has(e.t));
  const expected = exposed.filter((e) => ALLOWLIST.has(e.t));

  console.log(`Probed ${tables.length} public tables with the anon key.`);
  console.log(`  intentionally public : ${expected.length}`);
  console.log(`  UNEXPECTED exposure  : ${unexpected.length}`);

  if (errored.length) {
    console.log(`\nTables erroring for anon (should deny cleanly, not error):`);
    for (const e of errored) console.log(`  ${e.t} -> ${e.code}`);
  }

  if (unexpected.length) {
    console.log(`\n*** POTENTIAL DATA LEAK ***`);
    for (const e of unexpected) {
      console.log(`  ${e.t}\n    columns: ${e.cols.slice(0, 10).join(', ')}`);
    }
    console.log(`\nEither add an RLS policy restricting the table, or add it to`);
    console.log(`ALLOWLIST in this script if publishing it is intentional.`);
  } else {
    console.log(`\nNo unexpected anonymous exposure.`);
  }

  if (ci && (unexpected.length > 0 || errored.length > 0)) process.exit(1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(2);
});
