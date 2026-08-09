import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/20260809000000_harden_privileged_database_boundaries.sql'),
  'utf8',
).replace(/\r\n/g, '\n').toLowerCase();
const profileSync = readFileSync(resolve(process.cwd(), 'lib/profile-sync.ts'), 'utf8').toLowerCase();
const retiredApplySchema = readFileSync(
  resolve(process.cwd(), 'app/api/admin/apply-schema/route.ts'),
  'utf8',
).toLowerCase();

describe('privileged database boundaries migration', () => {
  it('does not trust signup metadata for roles', () => {
    const handleNewUser = migration.match(
      /create or replace function public\.handle_new_user\(\)[\s\S]*?\n\$\$;/,
    )?.[0];

    expect(handleNewUser).toBeDefined();
    expect(handleNewUser).not.toContain("raw_user_meta_data -> 'roles'");
    expect(handleNewUser).toContain(`'["donor"]'::jsonb`);
  });

  it('guards privilege-bearing profile fields from browser mutations', () => {
    expect(migration).toContain('create trigger protect_profile_privileged_fields');
    for (const field of [
      'roles',
      'identity_verified',
      'trust_passport_score',
      'plan',
      'stripe_customer_id',
      'stripe_subscription_id',
      'email',
    ]) {
      expect(migration).toContain(`new.${field}`);
    }
    expect(migration).toContain("auth.role(), '') = 'service_role'");
    expect(migration).toContain("new.email is distinct from nullif(auth.jwt() ->> 'email', '')");
    expect(migration).toContain('revoke create on schema public from public, anon, authenticated');
    expect(migration).not.toContain('set search_path = public, pg_catalog');
  });

  it('keeps profile repair from restoring metadata roles', () => {
    expect(profileSync).not.toContain('parseroles(metadata.roles)');
    expect(profileSync).toContain("roles: ['donor']");
  });

  it('removes public financial inserts', () => {
    for (const table of ['donations', 'donor_tips', 'platform_fees', 'campaign_reports']) {
      expect(migration).toContain(
        `revoke insert on table public.${table} from public, anon, authenticated`,
      );
      expect(migration).toContain(`grant insert on table public.${table} to service_role`);
    }
  });

  it('makes privileged RPCs service-role only', () => {
    for (const fn of [
      'record_donation',
      'increment_campaign_stats',
      'decrement_campaign_stats',
      'claim_campaign_reward',
      'get_admin_system_resource_usage',
    ]) {
      expect(migration).toMatch(
        new RegExp(`revoke all on function public\\.${fn}\\([\\s\\S]*?from public, anon, authenticated`),
      );
      expect(migration).toMatch(
        new RegExp(`grant execute on function public\\.${fn}\\([\\s\\S]*?to service_role`),
      );
    }
  });

  it('tolerates production databases where the legacy donation overload is already gone', () => {
    expect(migration).toContain(
      "to_regprocedure(\n    'public.record_donation(text,uuid,uuid,bigint,bigint,bigint,text,boolean,text,text)'",
    );
    expect(migration).toContain('if to_regprocedure(');
  });

  it('enforces valid go-forward financial amounts', () => {
    expect(migration).toContain('add column if not exists tip_cents bigint');
    expect(migration).toContain('add column if not exists processing_fee_cents bigint');
    expect(migration).toContain('check (amount_cents > 0) not valid');
    expect(migration).toContain('check (tip_cents >= 0 and processing_fee_cents >= 0) not valid');
  });

  it('retires in-app schema mutation in favor of the release workflow', () => {
    expect(retiredApplySchema).toContain("code: 'release_workflow_required'");
    expect(retiredApplySchema).toContain('{ status: 410 }');
    expect(retiredApplySchema).not.toContain('database/query');
    expect(retiredApplySchema).not.toMatch(
      /\b(create|alter|drop|grant|revoke)\s+(table|function|policy|role|default)/,
    );
  });
});
