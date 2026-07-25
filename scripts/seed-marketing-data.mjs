// Seed the marketing engine with realistic demo data:
//   ~500 contacts (+identities +consent), ~2,500 events, sent campaigns with
//   recipients, unsubscribes + suppression, form submissions, automation runs,
//   then evaluates every segment so member counts are real.
//
// Re-runnable: deletes prior seed rows (emails @charitme-demo.com) first.
//
// Usage (from repo root):
//   node scripts/seed-marketing-data.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { assertDemoSeedAllowed } from './seed-guard.mjs';

const root = process.cwd();

function loadEnvLocal() {
  const envPath = join(root, 'apps', 'web', '.env.local');
  const text = readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnvLocal();
assertDemoSeedAllowed({ ...env, ...process.env });
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing Supabase env in apps/web/.env.local'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

// ── helpers ──
const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];
const chance = (p) => Math.random() < p;
const daysAgo = (d) => new Date(Date.now() - d * 86_400_000 - rand(86_400_000)).toISOString();

const FIRST = ['James','Mary','Robert','Patricia','John','Jennifer','Michael','Linda','David','Elizabeth','William','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Charles','Karen','Daniel','Lisa','Matthew','Nancy','Anthony','Betty','Mark','Margaret','Donald','Sandra','Steven','Ashley','Paul','Kimberly','Andrew','Emily','Joshua','Donna','Kenneth','Michelle','Kevin','Carol','Brian','Amanda','George','Dorothy','Timothy','Melissa','Ronald','Deborah'];
const LAST = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores'];
const COUNTRIES = ['US','US','US','US','US','US','CA','GB','AU','DE','FR','MX'];
const SOURCES = ['google','facebook','instagram','twitter','direct','newsletter','referral','linkedin','tiktok','youtube'];
const MEDIUMS = ['cpc','social','organic','email','referral','none'];
const MKT_CAMPS = ['spring_appeal','giving_tuesday','launch_2026','donor_reactivation','organizer_push','brand'];
const CAUSES = ['medical','education','emergency','community','animals','environment','memorial','sports'];

// distribution of client types (sums to 1)
const TYPE_DIST = [
  ['visitor', .14], ['newsletter', .15], ['lead', .08], ['donor', .22],
  ['repeat_donor', .12], ['recurring_donor', .05], ['high_value_donor', .04],
  ['organizer', .07], ['draft_organizer', .06], ['beneficiary', .03],
  ['nonprofit', .02], ['support', .02],
];
function pickType() {
  let r = Math.random(), acc = 0;
  for (const [t, p] of TYPE_DIST) { acc += p; if (r <= acc) return t; }
  return 'visitor';
}

function buildContact(i) {
  const first = pick(FIRST), last = pick(LAST);
  const type = pickType();
  const isDonor = type.includes('donor');
  const donationCount =
    type === 'donor' ? 1
    : type === 'repeat_donor' ? 2 + rand(4)
    : type === 'recurring_donor' ? 3 + rand(10)
    : type === 'high_value_donor' ? 2 + rand(8)
    : chance(.1) ? 1 : 0;
  const avgGift =
    type === 'high_value_donor' ? 25_000 + rand(150_000)
    : isDonor ? 2_000 + rand(15_000)
    : 1_000 + rand(5_000);
  const donorValue = donationCount * avgGift;
  const lastActiveDays =
    chance(.35) ? rand(7)          // active this week
    : chance(.5) ? 7 + rand(40)    // active this month-ish
    : 60 + rand(200);              // dormant
  const lifecycle =
    lastActiveDays > 90 ? 'dormant'
    : donationCount >= 3 || donorValue >= 50_000 || type === 'recurring_donor' ? 'champion'
    : donationCount >= 1 || type === 'organizer' ? 'customer'
    : chance(.4) ? 'engaged' : chance(.5) ? 'lead' : 'subscriber';
  const engagement = lastActiveDays <= 7 ? 40 + rand(55) : lastActiveDays <= 30 ? 15 + rand(40) : rand(20);
  const lead = Math.min(100, donationCount * 12 + Math.floor(donorValue / 10_000) * 4
    + (type === 'recurring_donor' ? 15 : 0) + (type === 'organizer' ? 20 : 0) + rand(12));
  const source = pick(SOURCES);
  const unsub = chance(.045);

  return {
    email: `${first.toLowerCase()}.${last.toLowerCase()}.${i}@charitme-demo.com`,
    first_name: first,
    last_name: last,
    client_type: type,
    lifecycle_stage: lifecycle,
    country: pick(COUNTRIES),
    preferred_causes: [pick(CAUSES), ...(chance(.4) ? [pick(CAUSES)] : [])],
    preferred_channel: chance(.85) ? 'email' : 'sms',
    first_touch_source: source,
    first_touch_medium: pick(MEDIUMS),
    first_touch_campaign: pick(MKT_CAMPS),
    last_touch_source: chance(.6) ? source : pick(SOURCES),
    last_touch_medium: pick(MEDIUMS),
    last_touch_campaign: pick(MKT_CAMPS),
    landing_page: pick(['/', '/campaigns', '/ai-campaign', '/how-it-works', '/success-stories']),
    lead_score: lastActiveDays > 60 ? Math.round(lead / 2) : lead,
    engagement_score: engagement,
    donor_value_cents: donorValue,
    donation_count: donationCount,
    churn_risk: lastActiveDays <= 14 ? 'low' : lastActiveDays <= 45 ? 'medium' : 'high',
    last_active_at: daysAgo(lastActiveDays),
    status: unsub ? 'unsubscribed' : 'active',
    created_at: daysAgo(lastActiveDays + rand(120)),
  };
}

function eventsFor(contact) {
  const out = [];
  const base = { contact_id: contact.id, utm_source: contact.last_touch_source, utm_medium: contact.last_touch_medium, utm_campaign: contact.last_touch_campaign };
  const recency = Math.min(60, Math.max(1, Math.round((Date.now() - new Date(contact.last_active_at).getTime()) / 86_400_000)));
  const n = 2 + rand(6);
  for (let i = 0; i < n; i++) {
    out.push({ ...base, event_type: chance(.6) ? 'page_viewed' : 'campaign_viewed', url: pick(['/', '/campaigns', '/campaigns/help-local-family', '/campaigns/medical-fund']), created_at: daysAgo(recency + rand(30)) });
  }
  const dc = contact.donation_count;
  for (let i = 0; i < dc; i++) {
    const amt = Math.round(contact.donor_value_cents / Math.max(dc, 1));
    out.push({ ...base, event_type: 'donation_started', amount_cents: amt, created_at: daysAgo(recency + rand(60)) });
    out.push({ ...base, event_type: 'donation_completed', amount_cents: amt, created_at: daysAgo(recency + rand(60)) });
  }
  if (dc === 0 && chance(.25)) {
    out.push({ ...base, event_type: 'donation_started', amount_cents: 2_500 + rand(10_000), created_at: daysAgo(recency + rand(20)) }); // abandoned
  }
  if (contact.client_type === 'organizer') {
    out.push({ ...base, event_type: 'campaign_published', created_at: daysAgo(recency + rand(90)) });
    if (chance(.6)) out.push({ ...base, event_type: 'campaign_shared', created_at: daysAgo(recency + rand(30)) });
  }
  if (contact.client_type === 'draft_organizer') out.push({ ...base, event_type: 'campaign_drafted', created_at: daysAgo(recency + rand(60)) });
  if (contact.client_type === 'newsletter') out.push({ ...base, event_type: 'form_submitted', created_at: daysAgo(recency + rand(90)) });
  if (contact.client_type === 'support') out.push({ ...base, event_type: 'support_contacted', created_at: daysAgo(recency + rand(30)) });
  if (chance(.3)) out.push({ ...base, event_type: 'email_opened', marketing_campaign_id: null, created_at: daysAgo(rand(14)) });
  if (chance(.12)) out.push({ ...base, event_type: 'email_clicked', created_at: daysAgo(rand(14)) });
  return out;
}

async function insertBatch(table, rows, size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await db.from(table).insert(rows.slice(i, i + size));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

// ── segment evaluation (mirror of lib/marketing-core.ts) ──
function matchCondition(c, cond, eventTypes) {
  if (cond.field === 'event') {
    const has = eventTypes.includes(String(cond.value));
    return cond.op === 'not_has' ? !has : has;
  }
  if (cond.field === 'inactive_days') {
    if (!c.last_active_at) return cond.op === 'gte';
    const days = (Date.now() - new Date(c.last_active_at).getTime()) / 86_400_000;
    return cond.op === 'gte' ? days >= Number(cond.value) : days <= Number(cond.value);
  }
  const raw = c[cond.field];
  if (typeof raw === 'number') {
    const v = Number(cond.value);
    return cond.op === 'eq' ? raw === v : cond.op === 'neq' ? raw !== v : cond.op === 'gte' ? raw >= v : cond.op === 'lte' ? raw <= v : false;
  }
  const s = String(raw ?? '').toLowerCase(), v = String(cond.value).toLowerCase();
  return cond.op === 'eq' ? s === v : cond.op === 'neq' ? s !== v : cond.op === 'contains' ? s.includes(v) : false;
}

async function main() {
  console.log('── Cleaning previous seed data…');
  const { data: oldContacts } = await db.from('marketing_contacts').select('id').like('email', '%@charitme-demo.com');
  if (oldContacts?.length) {
    const ids = oldContacts.map(c => c.id);
    for (let i = 0; i < ids.length; i += 200) {
      await db.from('marketing_contacts').delete().in('id', ids.slice(i, i + 200)); // cascades to identities/events/consent/members
    }
    console.log(`   removed ${ids.length} old seed contacts`);
  }
  await db.from('marketing_suppression_list').delete().like('email', '%@charitme-demo.com');
  await db.from('marketing_campaigns').delete().like('name', '[Demo]%');
  await db.from('marketing_forms').delete().like('name', '[Demo]%');

  console.log('── Inserting 500 contacts…');
  const contacts = Array.from({ length: 500 }, (_, i) => buildContact(i + 1));
  await insertBatch('marketing_contacts', contacts);
  const { data: inserted } = await db.from('marketing_contacts').select('*').like('email', '%@charitme-demo.com');
  console.log(`   ${inserted.length} contacts in`);

  console.log('── Identities + consent…');
  await insertBatch('marketing_identities', inserted.map(c => ({ contact_id: c.id, kind: 'email', value: c.email })));
  await insertBatch('marketing_consent', inserted.map(c => ({
    contact_id: c.id, channel: 'email', granted: c.status !== 'unsubscribed',
    source: pick(['form', 'checkout', 'newsletter_signup']), created_at: c.created_at,
  })));

  console.log('── Suppression for unsubscribed…');
  const unsubs = inserted.filter(c => c.status === 'unsubscribed');
  if (unsubs.length) await insertBatch('marketing_suppression_list', unsubs.map(c => ({ email: c.email, reason: 'unsubscribed' })));
  console.log(`   ${unsubs.length} suppressed`);

  console.log('── Events…');
  const allEvents = inserted.flatMap(eventsFor);
  await insertBatch('marketing_events', allEvents);
  console.log(`   ${allEvents.length} events`);

  console.log('── Demo form + 500 submissions…');
  const { data: form } = await db.from('marketing_forms')
    .insert({ name: '[Demo] Newsletter signup', form_type: 'newsletter', fields: ['email', 'first_name'], submission_count: 0 })
    .select('id').single();
  const sample500 = [...inserted].sort(() => Math.random() - .5).slice(0, 500);
  await insertBatch('marketing_form_submissions', sample500.map(c => ({
    form_id: form.id, contact_id: c.id, data: { email: c.email, first_name: c.first_name },
    url: c.landing_page, created_at: c.created_at,
  })));
  await db.from('marketing_forms').update({ submission_count: sample500.length }).eq('id', form.id);

  console.log('── Sent campaigns + recipients…');
  const campDefs = [
    { name: '[Demo] Welcome series — March', goal: 'welcome', subject: 'Welcome to CharitMe, {{first_name}}!', open: .52, click: .14, daysAgoSent: 70 },
    { name: '[Demo] Spring giving appeal', goal: 'seasonal', subject: 'This spring, your kindness goes further', open: .41, click: .09, daysAgoSent: 45 },
    { name: '[Demo] Abandoned donation rescue', goal: 'abandoned_donation', subject: 'Your donation is waiting, {{first_name}}', open: .47, click: .19, daysAgoSent: 30 },
    { name: '[Demo] Dormant donor reactivation', goal: 'reactivation', subject: 'The causes you love still need you', open: .33, click: .07, daysAgoSent: 14 },
    { name: '[Demo] Recurring upgrade push', goal: 'recurring_upgrade', subject: 'Make your impact monthly', open: .44, click: .12, daysAgoSent: 5 },
  ];
  for (const def of campDefs) {
    const audience = [...inserted].filter(c => c.status === 'active').sort(() => Math.random() - .5).slice(0, 120 + rand(200));
    const { data: camp } = await db.from('marketing_campaigns').insert({
      name: def.name, campaign_type: 'email', goal: def.goal, subject: def.subject,
      body: 'Hi {{first_name}},\n\nDemo campaign body…\n\nThe CharitMe Team',
      status: 'sent', sent_at: daysAgo(def.daysAgoSent),
      sent_count: audience.length,
      open_count: Math.round(audience.length * def.open),
      click_count: Math.round(audience.length * def.click),
      conversion_count: Math.round(audience.length * def.click * .3),
      revenue_cents: Math.round(audience.length * def.click * .3) * (3_000 + rand(8_000)),
    }).select('id').single();
    const recips = audience.map(c => {
      const opened = chance(def.open), clicked = opened && chance(def.click / def.open);
      return {
        campaign_id: camp.id, contact_id: c.id,
        status: clicked ? 'clicked' : opened ? 'opened' : 'sent',
        sent_at: daysAgo(def.daysAgoSent),
        opened_at: opened ? daysAgo(def.daysAgoSent - 1) : null,
        clicked_at: clicked ? daysAgo(def.daysAgoSent - 1) : null,
      };
    });
    await insertBatch('marketing_campaign_recipients', recips);
    console.log(`   ${def.name}: ${audience.length} recipients`);
  }

  console.log('── Automation run history…');
  const { data: autos } = await db.from('marketing_automations').select('id, name');
  if (autos?.length) {
    const runs = [];
    for (const a of autos) {
      const n = 20 + rand(60);
      for (let i = 0; i < n; i++) {
        const c = pick(inserted);
        runs.push({
          automation_id: a.id, contact_id: c.id,
          status: chance(.85) ? 'success' : chance(.6) ? 'skipped' : 'failed',
          detail: 'seeded demo run', created_at: daysAgo(rand(45)),
        });
      }
      await db.from('marketing_automations').update({ run_count: n, last_run_at: daysAgo(rand(7)) }).eq('id', a.id);
    }
    await insertBatch('marketing_automation_runs', runs);
    console.log(`   ${runs.length} runs across ${autos.length} automations`);
  }

  console.log('── Evaluating segments…');
  const { data: segments } = await db.from('marketing_segments').select('id, name, rules');
  // build event-type map
  const evtMap = new Map();
  for (const e of allEvents) {
    const arr = evtMap.get(e.contact_id) ?? [];
    if (!arr.includes(e.event_type)) arr.push(e.event_type);
    evtMap.set(e.contact_id, arr);
  }
  for (const seg of segments ?? []) {
    const rules = seg.rules;
    const matched = inserted.filter(c => {
      if (c.status !== 'active') return false;
      const results = (rules.conditions ?? []).map(cond => matchCondition(c, cond, evtMap.get(c.id) ?? []));
      if (!results.length) return false;
      return rules.logic === 'or' ? results.some(Boolean) : results.every(Boolean);
    });
    await db.from('marketing_segment_members').delete().eq('segment_id', seg.id);
    if (matched.length) {
      await insertBatch('marketing_segment_members', matched.map(c => ({ segment_id: seg.id, contact_id: c.id })));
    }
    await db.from('marketing_segments').update({ member_count: matched.length }).eq('id', seg.id);
    console.log(`   ${seg.name}: ${matched.length} members`);
  }

  console.log('\n✅ Seed complete.');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
