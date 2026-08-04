#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Which pending migrations are ALREADY LIVE in production?
//
// `supabase migration list` answers this properly, but it needs credentials.
// This asks the running site instead, over plain HTTP, with no auth at all.
//
// Why it exists: the release plan was built on "27 pending", a FILE COUNT that
// nobody had measured. Two migrations were then shown to be already applied by
// poking public endpoints — which meant the runbook's "if it is not 87/27, stop"
// precondition could never be satisfied and would have aborted a valid release.
// This script generalises that poke so the next person measures instead of
// counting files.
//
//   node scripts/probe-production-migrations.mjs [--base https://www.charitme.com]
//
// ⚠️ READ THIS BEFORE TRUSTING A RESULT.
//
// 1. APPLIED is proof; PENDING is NOT. A probe answering "yes" means a select on
//    that table/column succeeded, which cannot happen unless the migration ran.
//    A probe answering "no" means the read failed — the table may be missing, or
//    the database may be down, or the route may have been refactored. Never
//    downgrade a migration to "pending" on this script's say-so.
//
// 2. Every probe needs a CONTROL that fails differently. Without one, a route
//    that 404s because it was renamed looks exactly like a missing table.
//    `control` below must return a specific non-200 that proves the handler ran.
//
// 3. A probe is only valid if the table is FIRST created by the migration it
//    claims to prove. `reconcile_runtime_tables` uses `create table if not
//    exists`, so several of its tables could have predated it — each entry
//    records where the table is first created, checked with:
//      grep -lE 'create table if not exists (public\.)?<t>\b' supabase/migrations/*.sql
//
// 4. Routes that authenticate BEFORE reading are useless here: they answer 401
//    without touching the table. `/api/locale` looks like a `profiles.locale`
//    probe and is not — it returns `{locale:null}` for anonymous callers before
//    any query runs. It was caught during review and deliberately excluded.
// ─────────────────────────────────────────────────────────────────────────────

import { pathToFileURL } from 'node:url';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * @typedef {object} Probe
 * @property {string} migration  filename stem it proves
 * @property {string} proves     the table/column the read touches
 * @property {string} firstCreatedIn  migration that first creates it (must equal `migration`)
 * @property {string} path       unauthenticated request whose 200 proves the read succeeded
 * @property {(body: unknown, text: string) => boolean} ok  given parsed JSON (null for HTML) and the raw body
 * @property {{ path: string, status: number, method?: string }} control  same handler, must fail distinctly
 */

/** @type {Probe[]} */
const PROBES = [
  {
    migration: '20260805000000_reconcile_runtime_tables',
    proves: 'campaign_milestones',
    firstCreatedIn: '20260805000000_reconcile_runtime_tables',
    path: `/api/campaigns/${NIL_UUID}/milestones`,
    ok: (b) => Array.isArray(b?.milestones),
    // A nonexistent campaign id still reaches the select and answers 200 with an
    // empty list, so the control has to prove the ROUTE is live some other way.
    // POST on the same handler rejects an anonymous caller with 401 before it
    // touches the database — live route, no read.
    //
    // ⚠️ The first control here was GET on `/api/campaigns//milestones` expecting
    // 404. Next answers 308 to an empty path segment, so it never reached the
    // handler. The script correctly refused to report APPLIED — which is the
    // whole point of requiring a control.
    control: { path: `/api/campaigns/${NIL_UUID}/milestones`, status: 401, method: 'POST' },
  },
  {
    migration: '20260805000000_reconcile_runtime_tables',
    proves: 'campaign_faqs',
    firstCreatedIn: '20260805000000_reconcile_runtime_tables',
    path: `/api/campaigns/${NIL_UUID}/faqs`,
    ok: (b) => Array.isArray(b?.faqs),
    control: { path: `/api/campaigns/${NIL_UUID}/faqs`, status: 401, method: 'POST' },
  },
  {
    migration: '20260806000000_volunteer_shifts_hours',
    proves: 'volunteer_shifts',
    firstCreatedIn: '20260806000000_volunteer_shifts_hours',
    path: `/api/volunteers/shifts?opportunity_id=${NIL_UUID}`,
    ok: (b) => Array.isArray(b?.shifts),
    // Omitting the param makes the handler answer 400 before querying — proof
    // the route is live and unauthenticated, so a 500 above would mean the read.
    control: { path: '/api/volunteers/shifts', status: 400 },
  },
  {
    migration: '20260817000000_campaign_geolocation',
    proves: 'campaigns.latitude / longitude',
    firstCreatedIn: '20260817000000_campaign_geolocation',
    path: '/api/campaigns/nearby?lat=40.7&lng=-74',
    // The route reports `available:false` on PostgREST's 42703 rather than
    // failing, so the flag IS the probe — a 200 alone would prove nothing.
    ok: (b) => b?.available === true,
    control: { path: '/api/campaigns/nearby', status: 400 },
  },
  {
    migration: '20260820000000_incidents_and_maintenance',
    proves: 'incidents (rendered by /status)',
    firstCreatedIn: '20260820000000_incidents_and_maintenance',
    path: '/status',
    // An HTML probe, because there is no public JSON route. /status renders the
    // `length === 0` branch only after a successful read, and says "Incident
    // history could not be loaded" otherwise — two distinguishable strings, so
    // an empty table and a failed read do not look alike.
    ok: (_b, text) =>
      /No incidents reported/i.test(text ?? '') && !/could not be loaded/i.test(text ?? ''),
    // A neighbouring path under the same app router that must 404, proving the
    // server is serving this deployment rather than a cached edge error page.
    control: { path: '/status/definitely-not-a-page', status: 404 },
  },
];

/**
 * Migrations with NO public signal, and why. Listed so the next person does not
 * re-derive it, and does not mistake "not probed" for "not applied".
 */
const NO_PUBLIC_SIGNAL = [
  ['20260824000000_cause_stories', 'public SELECT is gated on published=true, so applied-but-unseeded is indistinguishable from not-applied; the cause page falls back to campaigns either way'],
  ['20260803000000_profiles_preference_columns', 'profiles columns are only read behind auth'],
  ['20260803010000_profiles_profile_billing_columns', 'same'],
  ['20260804000000_banner_content_and_recovery', 'banner_settings is read by admin routes only'],
  ['20260806010000_volunteer_hours_verify_guard_fix', 'changes a trigger function body; no readable surface'],
  ['20260807000000_organizations_multitenancy', 'organizations/brands have no reader in app code at all'],
  ['20260808000000_demo_data_labeling', 'is_demo has no reader'],
  ['20260809000000_harden_privileged_database_boundaries', 'RLS/privilege change — invisible to a successful read'],
  ['20260810000000_lock_down_service_managed_writes', 'same'],
  ['20260811000000_secure_schema_cache_reload', 'function body'],
  ['20260812000000_make_onconflict_targets_inferable', 'index shape; only observable on a write'],
  ['20260812010000_creator_tips_not_world_readable', 'RLS — a probe proving it is applied would BE the leak it closes'],
  ['20260812020000_recurring_tip_accounting', 'columns read behind auth'],
  ['20260812030000_tax_document_guest_access', 'guest token path needs a real document'],
  ['20260813000000_donor_message_anonymity_contract', 'RLS + trigger'],
  ['20260814000000_marketing_org_scoping', 'org_id read behind auth'],
  ['20260814010000_harden_role_and_team_boundaries', 'RLS'],
  ['20260815000000_peer_fundraiser_attribution', 'app probes the column itself and degrades silently — by design, so no external difference'],
  ['20260816000000_record_donation_peer_attribution', 'RPC body; only a real donation would show it'],
  ['20260818000000_profile_market_locale', '/api/locale answers anonymous callers WITHOUT querying (see note 4)'],
  ['20260819000000_donation_forms_slug_and_campaign_owner', 'needs a seeded form slug'],
  ['20260821000000_tasks', '/api/tasks answers 401 before the select'],
  ['20260822000000_data_retention_policies', 'admin only'],
  ['20260823000000_custom_domains', '/api/custom-domains answers 401 before the select'],
];

function parseBase(argv) {
  const i = argv.indexOf('--base');
  return (i !== -1 && argv[i + 1]) || process.env.PROBE_BASE || 'https://www.charitme.com';
}

async function get(base, path, method = 'GET') {
  const res = await fetch(base + path, { method, redirect: 'manual' });
  // Read once as text, then try JSON — a Response body can only be consumed
  // once, and the HTML probes need the text.
  const text = await res.text().catch(() => '');
  let body = null;
  try { body = JSON.parse(text); } catch { /* non-JSON is fine; status is what matters */ }
  return { status: res.status, body, text };
}

async function main() {
  const base = parseBase(process.argv);
  console.log(`Probing ${base} for migrations already applied in production\n`);

  const applied = new Set();
  let invalid = 0;

  for (const p of PROBES) {
    if (p.firstCreatedIn !== p.migration) {
      console.log(`⚠️  ${p.proves}: INVALID probe — first created in ${p.firstCreatedIn}, not ${p.migration}`);
      invalid++;
      continue;
    }

    const control = await get(base, p.control.path, p.control.method ?? 'GET');
    if (control.status !== p.control.status) {
      console.log(
        `⚠️  ${p.proves}: control expected HTTP ${p.control.status} from ${p.control.path}, got ${control.status} — ` +
        `the route moved or the site is down, so this probe proves NOTHING either way`,
      );
      invalid++;
      continue;
    }

    const r = await get(base, p.path);
    const yes = r.status === 200 && p.ok(r.body, r.text);
    if (yes) applied.add(p.migration);
    console.log(
      `${yes ? '✅ APPLIED ' : '❔ NO PROOF'}  ${p.migration}\n` +
      `             via ${p.proves} — HTTP ${r.status} ${r.body === null ? '(html)' : JSON.stringify(r.body).slice(0, 80)}`,
    );
  }

  console.log(`\n── ${applied.size} migration(s) PROVEN applied in production:`);
  for (const m of [...applied].sort()) console.log(`   ${m}`);

  console.log(`\n── ${NO_PUBLIC_SIGNAL.length} have no public signal (NOT a claim they are pending):`);
  for (const [m, why] of NO_PUBLIC_SIGNAL) console.log(`   ${m}\n      ${why}`);

  console.log(
    '\nUse this to SHRINK the unknown set before a release, never to skip a migration.\n' +
    '`supabase db push` applies only what is missing, so an already-applied one is\n' +
    'skipped anyway — the value here is planning the release against a real number.',
  );

  // Exit non-zero only when a probe could not be trusted. "No proof" is a normal
  // outcome and must not fail a release check.
  process.exit(invalid > 0 ? 1 : 0);
}

// Exported so `__tests__/migration-probes.test.ts` can check the catalogue
// offline — that every probe names a migration that exists, that no migration is
// silently left out, and that a probe never claims a migration that did not
// create the thing it reads. Guarded so importing the module does not fire live
// HTTP requests at production from a unit test.
export { PROBES, NO_PUBLIC_SIGNAL };

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((err) => {
    console.error('probe failed:', err?.message ?? err);
    process.exit(1);
  });
}
