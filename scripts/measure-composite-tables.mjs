// Read-only census + column shape for the tables the composite-image pages read.
// Columns come from a live row rather than the migrations: `catch_up.sql` lists
// the ORIGINAL columns and later migrations add more, so reading the SQL gives a
// stale answer — the detail page already queries published_at/scheduled_at, which
// appear in neither the base table nor catch_up.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

for (const line of readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TABLES = process.argv.slice(2).length ? process.argv.slice(2) : [
  'campaign_updates', 'campaign_media', 'donations', 'campaigns', 'profiles',
  'tax_receipts', 'donation_receipts', 'integration_connections',
  'support_cases', 'support_notes', 'donor_messages', 'organizer_sends',
  'direct_messages', 'impact_metrics', 'impact_updates', 'user_badges',
];

for (const t of TABLES) {
  const { count, error } = await db.from(t).select('*', { count: 'exact', head: true });
  if (error) { console.log(`${t.padEnd(24)} MISSING/ERR: ${error.message}`); continue; }
  const { data } = await db.from(t).select('*').limit(1);
  const cols = data?.[0] ? Object.keys(data[0]).join(', ') : '(no row to read columns from)';
  console.log(`\n${t}  [${count} rows]\n  ${cols}`);
}
