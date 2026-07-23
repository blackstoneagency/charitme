import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertDemoSeedAllowed } from './seed-guard.mjs';

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
    'super_admin_console_seed.sql',
  ];
  for (const file of files) {
    const sql = readFileSync(new URL(`../supabase/seeds/${file}`, import.meta.url), 'utf8');
    assert.match(sql, /current_setting\('app\.charitme_allow_demo_seed',\s*true\)/, file);
    assert.match(sql, /Demo seed blocked/, file);
  }
});

test('seed coverage verification fails when any expected table is incomplete', () => {
  const sql = readFileSync(new URL('../supabase/seeds/99_verify_counts.sql', import.meta.url), 'utf8');
  assert.match(sql, /if n_missing > 0 or n_ok <> n_total then/);
  assert.match(sql, /raise exception 'CharitMe seed coverage failed/);
  assert.match(sql, /all expected tables have >= 100 rows/);
});
