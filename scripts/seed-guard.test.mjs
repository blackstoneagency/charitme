import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertDemoSeedAllowed } from './seed-guard.mjs';
import { buildFixtures } from '../apps/web/scripts/supabase-stub-fixtures.mjs';

test('allows demo seeds only with an explicit non-production opt-in', () => {
  assert.doesNotThrow(() => assertDemoSeedAllowed({ NODE_ENV: 'development', CHARITME_ALLOW_DEMO_SEED: 'true' }));
});

test('rejects demo seeds without the explicit opt-in', () => {
  assert.throws(() => assertDemoSeedAllowed({ NODE_ENV: 'development' }), /CHARITME_ALLOW_DEMO_SEED/);
});

test('rejects demo seeds in production even when opted in', () => {
  assert.throws(() => assertDemoSeedAllowed({ NODE_ENV: 'production', CHARITME_ALLOW_DEMO_SEED: 'true' }), /production/);
});

test('all mutating SQL seed files require the database session guard', () => {
  const files = [
    '00_test_users.sql',
    '01_campaigns_core.sql',
    '02_marketplaces.sql',
    '03_events.sql',
    '04_impact_gamification.sql',
    '05_engagement_financial.sql',
    '06_extended_features.sql',
    '07_operational_features.sql',
    '08_sponsors.sql',
    'super_admin_console_seed.sql',
  ];
  for (const file of files) {
    const sql = readFileSync(new URL(`../supabase/seeds/${file}`, import.meta.url), 'utf8');
    assert.match(sql, /current_setting\('app\.charitme_allow_demo_seed',\s*true\)/, file);
    assert.match(sql, /Demo seed blocked/, file);
  }
});

test('legacy duplicate seed guards fail closed and accept the documented opt-in', () => {
  const files = [
    '00_test_users.sql',
    '01_campaigns_core.sql',
    '02_marketplaces.sql',
    '03_events.sql',
    '04_impact_gamification.sql',
    '05_engagement_financial.sql',
    '06_extended_features.sql',
    'super_admin_console_seed.sql',
  ];
  const failClosedGuard = /if coalesce\(current_setting\('app\.charitme_allow_demo_seed',\s*true\),\s*''\) <> 'true'\s+and coalesce\(current_setting\('charitme\.allow_demo_seed',\s*true\),\s*''\) <> 'true' then/;

  for (const file of files) {
    const sql = readFileSync(new URL(`../supabase/seeds/${file}`, import.meta.url), 'utf8');
    assert.match(sql, failClosedGuard, file);
  }
});

test('seed coverage verification fails when any expected table is incomplete', () => {
  const sql = readFileSync(new URL('../supabase/seeds/99_verify_counts.sql', import.meta.url), 'utf8');
  assert.match(sql, /if n_missing > 0 or n_ok <> n_total then/);
  assert.match(sql, /raise exception 'CharitMe seed coverage failed/);
  assert.match(sql, /all expected tables have >= 100 rows/);
  assert.match(sql, /CharitMe role seed coverage failed/);
});

test('local reset runs the complete ordered seed suite and verifier', () => {
  const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8');
  const baseSeed = readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8');
  const ordered = [
    './seed.sql',
    './seeds/00_test_users.sql',
    './seeds/01_campaigns_core.sql',
    './seeds/02_marketplaces.sql',
    './seeds/03_events.sql',
    './seeds/04_impact_gamification.sql',
    './seeds/05_engagement_financial.sql',
    './seeds/06_extended_features.sql',
    './seeds/07_operational_features.sql',
    './seeds/08_sponsors.sql',
    './seeds/99_verify_counts.sql',
  ];
  let previous = -1;
  for (const seedPath of ordered) {
    const index = config.indexOf(`"${seedPath}"`);
    assert.ok(index > previous, `${seedPath} must be configured in seed order`);
    previous = index;
  }
  const safetyGuard = baseSeed.indexOf('Local demo seed blocked: non-demo auth users already exist.');
  const firstOptIn = baseSeed.indexOf("set charitme.allow_demo_seed = 'true'");
  assert.ok(safetyGuard >= 0 && safetyGuard < firstOptIn, 'real-user safety guard must run before seed opt-in');
  assert.match(baseSeed, /from auth\.users/);
  assert.match(baseSeed, /@charitme\.invalid/);
  assert.match(baseSeed, /@charitme\.test/);
  assert.match(baseSeed, /@example\.test/);
  assert.match(baseSeed, /set charitme\.allow_demo_seed = 'true'/);
  assert.match(baseSeed, /set app\.charitme_allow_demo_seed = 'true'/);
});

test('signed-in audit fixtures match current receipt-adjacent schemas', () => {
  const fixtures = buildFixtures();
  assert.equal(fixtures.notifications.length, 30);
  assert.equal(fixtures.notifications.filter((row) => row.read_at === null).length, 10);
  assert.ok(fixtures.webhook_events.every((row) => 'event_type' in row));
  assert.ok(fixtures.webhook_events.every((row) => !('type' in row)));
  assert.ok(fixtures.recurring_donations.every((row) => 'cadence' in row));
  assert.ok(fixtures.recurring_donations.every((row) => 'next_bill_at' in row));
});
