#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const MIN_ROWS = 100;
const TARGET_TABLES = [
  'profiles', 'campaigns', 'campaign_updates', 'campaign_faqs', 'campaign_milestones',
  'campaign_rewards', 'donations', 'saved_campaigns', 'notifications',
  'sponsorship_opportunities', 'sponsorship_requests', 'grants', 'grant_deadlines',
  'grant_applications', 'grant_documents', 'grant_matches', 'matching_programs',
  'matching_claims', 'volunteer_opportunities', 'volunteer_applications',
  'volunteer_profiles', 'nonprofit_profiles', 'fundraising_events', 'event_tickets',
  'event_registrations', 'event_checkins', 'peer_fundraisers', 'impact_plans',
  'impact_plan_items', 'impact_updates', 'impact_evidence', 'impact_metrics',
  'challenges', 'challenge_participants', 'user_badges', 'donor_messages',
  'recurring_donations', 'refunds', 'payouts', 'verification_documents',
  'risk_flags', 'tax_receipts', 'business_leads',
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const jsonOutput = process.argv.includes('--json');

if (!url || !serviceRoleKey) {
  console.error('Seed audit requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = await Promise.all(TARGET_TABLES.map(async (table) => {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return {
    table,
    count: error ? null : count ?? 0,
    ok: !error && (count ?? 0) >= MIN_ROWS,
    present: !error,
  };
}));

const passing = results.filter(result => result.ok).length;
const summary = {
  minimumRows: MIN_ROWS,
  tablesChecked: results.length,
  tablesPassing: passing,
  allPassing: passing === results.length,
  results,
};

if (jsonOutput) {
  console.log(JSON.stringify(summary));
} else {
  console.log(`Seed coverage audit: ${passing}/${results.length} tables at ${MIN_ROWS}+ rows`);
  for (const result of results) {
    console.log(`${result.ok ? 'OK ' : 'ERR'} ${result.table.padEnd(32)} ${result.count ?? 'missing'}`);
  }
}

if (!summary.allPassing) process.exit(1);
