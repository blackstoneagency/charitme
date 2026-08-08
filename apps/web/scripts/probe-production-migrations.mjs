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
//
// 5. One probe proves its case by the ABSENCE of a string, which is a weaker
//    shape than the rest and needs its own guard. The peer-fundraiser page
//    renders a visible note when `donations.peer_fundraiser_id` is missing, so
//    "note not present" means the read succeeded. Reword that note and the probe
//    would report APPLIED forever without anyone noticing — so `sentinel` records
//    the exact string and `__tests__/migration-probes.test.ts` fails if it is no
//    longer in the page source. Absence-probes must also assert something
//    POSITIVE (`requires`) so a blank page or an error shell cannot pass.
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
 * @property {(base: string, get: (base: string, path: string) => Promise<{status: number, body: unknown, text: string}>) => Promise<string | null>} [resolve]
 *   for probes whose URL cannot be written down in advance (a peer page exists
 *   only for a campaign that has one). Returns the path, or null when none was
 *   found — which is "no proof", never "pending".
 * @property {string} [sentinel]  absence-probes only: the exact failure string
 * @property {string} [sentinelSource]  file the sentinel must still appear in
 * @property {RegExp} [requires]  absence-probes only: something that must be PRESENT
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
  {
    migration: '20260815000000_peer_fundraiser_attribution',
    proves: 'donations.peer_fundraiser_id',
    firstCreatedIn: '20260815000000_peer_fundraiser_attribution',
    // This was listed for a while as unprobeable, on the grounds that the app
    // "degrades silently" when the column is missing. That was wrong: it degrades
    // LOUDLY and on purpose. `/campaigns/<slug>/team/<peerSlug>` probes the column
    // itself and, when the read fails, renders a note telling the visitor that
    // per-supporter totals are not being recorded on this deployment. So the note
    // is the schema, published.
    //
    // Hence an absence-probe (see note 5): no note = the select succeeded.
    resolve: findPeerFundraiserPage,
    sentinel: 'Per-supporter totals are not being recorded yet',
    sentinelSource: 'app/campaigns/[slug]/team/[peerSlug]/page.tsx',
    // The positive half. Without it a 200 that returned an error shell, a
    // redirect body or an empty document would read as APPLIED.
    requires: /Fundraising team/,
    ok: (_b, text) =>
      /Fundraising team/.test(text ?? '') && !/not being recorded yet/i.test(text ?? ''),
    // Static, so it needs no discovery: the route segment exists and answers
    // notFound() for a peer that is not there.
    control: { path: '/campaigns/not-a-campaign-x9/team/not-a-peer-x9', status: 404 },
  },
];

/**
 * Find a live peer-fundraiser page.
 *
 * There is no unauthenticated list of them — `/api/campaigns/[id]/peer-fundraisers`
 * is POST-only and 401s — so this walks the sitemap's campaign URLs and takes the
 * first that renders a team link. Bounded to a handful of requests; returning null
 * is a normal outcome that reports "no proof", not "pending".
 */
async function findPeerFundraiserPage(base, get) {
  const sitemap = await get(base, '/sitemap.xml');
  const campaigns = [...(sitemap.text ?? '').matchAll(/<loc>([^<]*\/campaigns\/[^<]*)<\/loc>/g)]
    .map((m) => m[1])
    .filter((u) => !/\/campaigns\/?$/.test(u))
    .slice(0, 12);

  for (const url of campaigns) {
    const path = url.replace(base, '');
    const page = await get(base, path);
    const peer = page.text?.match(/\/campaigns\/[a-z0-9-]+\/team\/[a-z0-9-]+/i)?.[0];
    if (peer) return peer;
  }
  return null;
}

/**
 * Migrations with NO public signal, and why. Listed so the next person does not
 * re-derive it, and does not mistake "not probed" for "not applied".
 */
const NO_PUBLIC_SIGNAL = [
  ['20260830000000_protect_verification_and_campaign_integrity', 'database triggers reject privileged writes to campaigns, nonprofit profiles, and verification documents; proving the rejection requires an authenticated destructive test, which runs in the isolated staging platform matrix instead of against production'],
  ['20260829000000_reconcile_live_schema_columns', 'the migration records 49 columns that already exist in production, so every public reader succeeds both before and after the ledger entry is applied; only the migration ledger can distinguish those states'],
  ['20260828000000_repair_editorial_admin_policies', 'RLS policy replacement; a successful public read cannot distinguish the hardened is_admin predicate from the legacy generated-role predicate'],
  ['20260827010000_donations_columns_missing_from_migrations', 'no-op against production BY CONSTRUCTION — all five columns already exist live, which is why it was written; a probe could only confirm what schema-columns.json already records. It matters solely for provisioning a NEW database, where its absence makes record_donation raise 42703 on the first donation'],
  ['20260827000000_campaign_path', 'the campaign page selects `*`, which succeeds whether or not the column exists, and no public endpoint names campaign_path — so a read cannot distinguish applied from not. The only rendered difference is a chip that appears solely on a nonprofit/team campaign, and none exist yet. Applying it is safe and uncoordinated: the insert already retries without the column (lib/campaign-insert-columns.ts), so campaigns are created either way'],
  ['20260826000000_platform_reports', 'public SELECT is gated on published=true and no report has been published, so applied-but-empty is indistinguishable from not-applied; there is also no reader yet — the migration lands the table and bucket so applying it is one owner command instead of an engineering task'],
  ['20260825000000_cause_impact_stats', 'public SELECT is gated on published=true and the seed ships unpublished, so applied-but-unpublished is indistinguishable from not-applied; the band falls back to measured counts either way'],
  ['20260824000000_cause_stories', 'public SELECT is gated on published=true, so applied-but-unseeded is indistinguishable from not-applied; the cause page falls back to campaigns either way'],
  ['20260823500000_profiles_role_replay_compatibility', 'temporary generated column used only while replaying later migrations; the repair migration removes it before the application starts'],
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

    let path = p.path;
    if (p.resolve) {
      path = await p.resolve(base, get);
      if (!path) {
        // No sample page exists to look at. That is an absence of evidence, and
        // is reported as such — the one thing this script must never do is let a
        // failed lookup harden into "pending".
        console.log(
          `❔ NO PROOF  ${p.migration}\n` +
          `             via ${p.proves} — no sample page found to probe (not a claim about the schema)`,
        );
        continue;
      }
    }

    const r = await get(base, path);
    const yes = r.status === 200 && p.ok(r.body, r.text);
    if (yes) applied.add(p.migration);
    console.log(
      `${yes ? '✅ APPLIED ' : '❔ NO PROOF'}  ${p.migration}\n` +
      `             via ${p.proves} — HTTP ${r.status} ` +
      `${r.body === null ? `(html ${path})` : JSON.stringify(r.body).slice(0, 80)}`,
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
