import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const seed = readFileSync(
  resolve(process.cwd(), '../../supabase/seeds/09_full_platform_volume.sql'),
  'utf8',
).toLowerCase();
const config = readFileSync(resolve(process.cwd(), '../../supabase/config.toml'), 'utf8');

describe('full-platform volume seed', () => {
  it('is disposable-only, deterministic, and part of reset order', () => {
    expect(seed).toContain("current_setting('charitme.allow_demo_seed', true)");
    expect(seed).toContain("current_setting('app.charitme_allow_demo_seed', true)");
    expect(seed).toContain("md5('charitme-seed09-campaign:' || series)::uuid");
    expect(seed).toContain('on conflict (id) do update');
    expect(config).toContain('"./seeds/09_full_platform_volume.sql"');
    expect(config.indexOf('09_full_platform_volume.sql')).toBeLessThan(config.indexOf('99_verify_counts.sql'));
  });

  it('provides 500-row CRUD and parent-child datasets without payment artifacts', () => {
    for (const table of [
      'public.campaigns',
      'public.donations',
      'public.campaign_updates',
      'public.notifications',
      'public.donor_messages',
      'public.campaign_analytics_events',
      'public.direct_messages',
      'public.fundraising_events',
    ]) {
      expect(seed).toContain(`insert into ${table}`);
    }
    expect([...seed.matchAll(/generate_series\(1, 500\)/g)].length).toBeGreaterThanOrEqual(10);
    expect(seed).not.toContain('stripe_payment_intent_id,');
    expect(seed).not.toContain('stripe_checkout_session_id,');
  });

  it('creates two 500-contact tenants and fails on cross-tenant or orphan rows', () => {
    expect(seed).toContain("values ('a', org_a, users[1]), ('b', org_b, users[2])");
    expect(seed).toContain('event.org_id is distinct from contact.org_id');
    expect(seed).toContain('tenant isolation failed');
    expect(seed).toContain('orphan rows');
    expect(seed).toContain('if row_count <> 500 then');
  });
});
