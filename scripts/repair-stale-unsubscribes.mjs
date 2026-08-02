// ─────────────────────────────────────────────────────────────────────────────
// Repair for the capture bug: an explicit email opt-in wrote a `marketing_consent`
// row and returned 200, but never cleared the two things `unsubscribeEmail` had
// set — `marketing_contacts.status` and `marketing_suppression_list`. So someone
// who unsubscribed and later re-subscribed saw a confirmation and then received
// nothing, indefinitely, with no signal anywhere that it had failed.
//
// Read-only by default. Pass --apply to write.
//
//   node scripts/repair-stale-unsubscribes.mjs            # measure
//   node scripts/repair-stale-unsubscribes.mjs --apply    # measure, then repair
//
// ── The criterion, and why it is safe ────────────────────────────────────────
// Repair a contact iff its LATEST email consent row says granted=true while the
// contact is still status='unsubscribed'.
//
// This works because `unsubscribeEmail` writes its OWN consent row
// (granted=false, source='unsubscribe_link'). The consent log is therefore a
// complete ordered record of both directions, which cleanly separates:
//   · re-opted in and we ignored it   → latest row granted=true   → REPAIR
//   · consented once, unsubscribed later → latest row granted=false → LEAVE
// Without that second write there would be no way to tell those apart, and this
// script could not exist safely.
//
// ⚠️ Suppression rows are cleared ONLY where reason='unsubscribed'. A 'bounced'
// or 'complaint' row must survive: those mean the address is undeliverable or
// its owner reported us as spam, and re-enabling sends on the strength of a form
// submission damages domain reputation for every other recipient.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const APPLY = process.argv.includes('--apply');

for (const line of readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

// supabase-js RESOLVES rather than throwing on a query error, so an unchecked
// read returns data:null and every count below would report a confident 0.
function must(label, { data, error, count }) {
  if (error) {
    console.error(`✖ ${label} failed: ${error.message}`);
    process.exit(1);
  }
  return count ?? data;
}

// ── Non-vacuity first. "0 affected" from a healthy table and "0 affected" from
// an empty one or a failed read look identical in the output, and only the first
// is a result. ───────────────────────────────────────────────────────────────
const sizes = {};
for (const table of ['marketing_contacts', 'marketing_consent', 'marketing_suppression_list']) {
  sizes[table] = must(`count ${table}`, await db.from(table).select('*', { count: 'exact', head: true }));
}
console.log('table sizes:', sizes);
if (sizes.marketing_contacts === 0) {
  console.log('\nmarketing_contacts is EMPTY — this is not a "nothing to repair" result.');
  process.exit(1);
}

const unsub = must(
  'read unsubscribed contacts',
  await db.from('marketing_contacts').select('id, email, client_type').eq('status', 'unsubscribed'),
);
console.log(`\ncontacts with status='unsubscribed': ${unsub.length}`);

let affected = [];
if (unsub.length > 0) {
  const consent = must(
    'read consent log',
    await db
      .from('marketing_consent')
      .select('contact_id, granted, source, created_at')
      .eq('channel', 'email')
      .in('contact_id', unsub.map((c) => c.id))
      .order('created_at', { ascending: false }),
  );
  // First row per contact wins — the query is already newest-first.
  const latest = new Map();
  for (const row of consent) if (!latest.has(row.contact_id)) latest.set(row.contact_id, row);

  affected = unsub.filter((c) => latest.get(c.id)?.granted === true);
  console.log(`  ├ latest consent GRANTED → affected by the bug: ${affected.length}`);
  console.log(`  ├ latest consent revoked → correctly unsubscribed: ${unsub.filter((c) => latest.get(c.id)?.granted === false).length}`);
  console.log(`  └ no email consent row   → leave alone: ${unsub.filter((c) => !latest.has(c.id)).length}`);
  for (const c of affected.slice(0, 20)) {
    console.log(`   · ${c.email ?? '(no email)'} — opted in ${latest.get(c.id).created_at} via ${latest.get(c.id).source}`);
  }
}

// The suppression half is measured over EVERY unsubscribed-then-reconsented
// address, and also independently: an address can sit on the suppression list
// while its contact status is already correct.
const emails = affected.map((c) => c.email).filter(Boolean);
let staleSuppression = [];
if (emails.length > 0) {
  staleSuppression = must(
    'read suppression list',
    await db.from('marketing_suppression_list').select('id, email, reason').in('email', emails),
  );
  const byReason = {};
  for (const s of staleSuppression) byReason[s.reason] = (byReason[s.reason] ?? 0) + 1;
  console.log(`\nof those addresses, still suppressed: ${staleSuppression.length} — by reason ${JSON.stringify(byReason)}`);
}
const clearable = staleSuppression.filter((s) => s.reason === 'unsubscribed');
const kept = staleSuppression.filter((s) => s.reason !== 'unsubscribed');

if (affected.length === 0 && clearable.length === 0) {
  console.log('\n✅ Nothing to repair. The bug was latent: no contact has ever been unsubscribed.');
  process.exit(0);
}

if (!APPLY) {
  console.log(`\nDRY RUN. Would set ${affected.length} contact(s) to 'active' and clear ${clearable.length} suppression row(s).`);
  if (kept.length) console.log(`Would KEEP ${kept.length} bounce/complaint suppression(s) — a form submission is not evidence a hard bounce is resolved.`);
  console.log('Re-run with --apply to write.');
  process.exit(0);
}

// ── Apply ────────────────────────────────────────────────────────────────────
if (affected.length > 0) {
  const { error } = await db
    .from('marketing_contacts')
    .update({ status: 'active' })
    .in('id', affected.map((c) => c.id));
  if (error) { console.error('✖ status update failed:', error.message); process.exit(1); }
  console.log(`✔ set ${affected.length} contact(s) to 'active'`);
}
if (clearable.length > 0) {
  const { error } = await db
    .from('marketing_suppression_list')
    .delete()
    .in('id', clearable.map((s) => s.id));
  if (error) { console.error('✖ suppression delete failed:', error.message); process.exit(1); }
  console.log(`✔ cleared ${clearable.length} stale 'unsubscribed' suppression row(s)`);
}
if (kept.length > 0) console.log(`· kept ${kept.length} bounce/complaint suppression(s), deliberately`);

// ── Verify by RE-READING, not by trusting the writes above ───────────────────
const stillWrong = must(
  'verify contacts',
  await db.from('marketing_contacts').select('id').in('id', affected.map((c) => c.id)).eq('status', 'unsubscribed'),
);
const stillSuppressed = clearable.length
  ? must('verify suppression', await db.from('marketing_suppression_list').select('id').in('id', clearable.map((s) => s.id)))
  : [];
if (stillWrong.length || stillSuppressed.length) {
  console.error(`\n✖ repair INCOMPLETE — ${stillWrong.length} contact(s) and ${stillSuppressed.length} suppression row(s) unchanged.`);
  process.exit(1);
}
console.log('\n✅ Repair verified by re-reading both tables.');
