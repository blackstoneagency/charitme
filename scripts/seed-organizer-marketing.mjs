// Seed organizer_sends history for the campaigns that have the most donors,
// so the "My Supporters" dashboard shows realistic send history.
// Re-runnable: removes prior seed rows (body tagged [demo-seed]) first.
//
// Usage: node scripts/seed-organizer-marketing.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { assertDemoSeedAllowed } from './seed-guard.mjs';

const root = process.cwd();
function loadEnvLocal() {
  const text = readFileSync(join(root, 'apps', 'web', '.env.local'), 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}
const env = loadEnvLocal();
assertDemoSeedAllowed({ ...env, ...process.env });
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const rand = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rand(a.length)];
const daysAgo = (d) => new Date(Date.now() - d * 86_400_000 - rand(43_200_000)).toISOString();

const SENDS = [
  { template_key: 'thank_recent',   target_group: 'recent_donors',   subject: 'Thank you for supporting {{campaign_title}}' },
  { template_key: 'update_blast',   target_group: 'all_donors',      subject: 'An update on {{campaign_title}}' },
  { template_key: 'lapsed_nudge',   target_group: 'lapsed_donors',   subject: '{{campaign_title}} — we are still going, thanks to you' },
  { template_key: 'monthly_upgrade',target_group: 'one_time_donors', subject: 'Could you make your impact monthly?' },
];

async function main() {
  console.log('── Cleaning previous seed sends…');
  await db.from('organizer_sends').delete().like('body', '%[demo-seed]%');

  // Campaigns with the most completed donations
  const { data: donations } = await db
    .from('donations')
    .select('campaign_id')
    .eq('status', 'completed')
    .limit(2000);
  const counts = new Map();
  for (const d of donations ?? []) counts.set(d.campaign_id, (counts.get(d.campaign_id) ?? 0) + 1);
  const topIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([id]) => id);
  if (!topIds.length) { console.log('No donated campaigns found.'); return; }

  const { data: campaignsRaw } = await db
    .from('campaigns')
    .select('id, title, user_id')
    .in('id', topIds)
    .not('user_id', 'is', null);

  // organizer_id must reference a real auth.users row — validate via auth admin API
  const campaigns = [];
  for (const c of campaignsRaw ?? []) {
    const { data, error } = await db.auth.admin.getUserById(c.user_id);
    if (!error && data?.user) campaigns.push(c);
  }

  console.log(`── Seeding sends for ${campaigns.length} campaigns…`);
  const rows = [];
  for (const c of campaigns) {
    const donors = counts.get(c.id) ?? 1;
    const nSends = 1 + rand(3);
    for (let i = 0; i < nSends; i++) {
      const def = pick(SENDS);
      const recipients = Math.max(1, Math.round(donors * (0.3 + Math.random() * 0.7)));
      const suppressed = Math.round(recipients * Math.random() * 0.1);
      rows.push({
        campaign_id: c.id,
        organizer_id: c.user_id,
        template_key: def.template_key,
        target_group: def.target_group,
        subject: def.subject.replace('{{campaign_title}}', c.title),
        body: `Hi {{first_name}},\n\nDemo send body. [demo-seed]\n\nThank you!`,
        recipient_count: recipients,
        sent_count: recipients - suppressed,
        suppressed_count: suppressed,
        status: suppressed > 0 ? 'partial' : 'sent',
        created_at: daysAgo(1 + rand(60)),
      });
    }
  }
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from('organizer_sends').insert(rows.slice(i, i + 200));
    if (error) throw new Error(error.message);
  }
  console.log(`✅ Seeded ${rows.length} organizer sends across ${campaigns.length} campaigns.`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
