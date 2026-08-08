import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsRoot = resolve(process.cwd(), '../../supabase/migrations');
const rollbacksRoot = resolve(process.cwd(), '../../supabase/rollbacks');
const files = readdirSync(migrationsRoot).filter((file) => file.endsWith('.sql')).sort();
const rollbackFiles = readdirSync(rollbacksRoot).filter((file) => file.endsWith('.sql')).sort();
const migrations = files.map((file) => ({
  file,
  sql: readFileSync(resolve(migrationsRoot, file), 'utf8').toLowerCase(),
}));

function firstFile(pattern: RegExp): string | undefined {
  return migrations.find(({ sql }) => pattern.test(sql))?.file;
}

describe('ordered migration dependencies', () => {
  it('creates profiles before the initial is_admin function', () => {
    expect(files).toContain('20260524000000_profile_function_dependency.sql');
    expect(files.indexOf('20260524000000_profile_function_dependency.sql')).toBeLessThan(
      files.indexOf('20260525000000_initial_schema.sql'),
    );

    const dependency = migrations.find(
      ({ file }) => file === '20260524000000_profile_function_dependency.sql',
    );
    expect(dependency?.sql).toMatch(
      /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?public\.profiles\b/,
    );
  });

  it.each([
    {
      table: 'admin_settings',
      mutation: /\b(?:insert\s+into|update|delete\s+from)\s+public\.admin_settings\b/,
    },
    {
      table: 'feature_flags',
      mutation: /\b(?:insert\s+into|update|delete\s+from)\s+public\.feature_flags\b/,
    },
  ])('creates $table before its first data mutation', ({ table, mutation }) => {
    const createFile = firstFile(
      new RegExp(`\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${table}\\b`),
    );
    const mutationFile = firstFile(mutation);

    expect(createFile, `${table} has no migration-controlled CREATE TABLE`).toBeDefined();
    expect(mutationFile, `${table} has no data mutation to verify`).toBeDefined();
    expect(createFile!.localeCompare(mutationFile!)).toBeLessThan(0);
  });

  it('keeps the dependency bootstrap before every consumer migration', () => {
    expect(files).toContain('20260528114000_runtime_config_dependencies.sql');
    expect(files.indexOf('20260528114000_runtime_config_dependencies.sql')).toBeLessThan(
      files.indexOf('20260530100000_charitme_rebrand.sql'),
    );
    expect(files.indexOf('20260528114000_runtime_config_dependencies.sql')).toBeLessThan(
      files.indexOf('20260610000000_campaign_reward_tiers.sql'),
    );
  });

  it('removes legacy support policies before production hardening replaces them', () => {
    const compatibilityFile = '20260607900000_prepare_support_policy_hardening.sql';
    expect(files).toContain(compatibilityFile);
    expect(files.indexOf(compatibilityFile)).toBeLessThan(
      files.indexOf('20260608000000_production_hardening.sql'),
    );

    const compatibility = migrations.find(({ file }) => file === compatibilityFile);
    expect(compatibility?.sql).toContain("where version = '20260608000000'");
    expect(compatibility?.sql).toContain('drop policy if exists support_own_read');
    expect(compatibility?.sql).toContain('drop policy if exists support_own_insert');
  });

  it('bridges legacy profile-role policies and replaces them with is_admin', () => {
    const compatibilityFile = '20260823500000_profiles_role_replay_compatibility.sql';
    const repairFile = '20260828000000_repair_editorial_admin_policies.sql';
    const compatibility = migrations.find(({ file }) => file === compatibilityFile);
    const repair = migrations.find(({ file }) => file === repairFile);

    expect(files.indexOf(compatibilityFile)).toBeGreaterThan(
      files.indexOf('20260823000000_custom_domains.sql'),
    );
    expect(files.indexOf(compatibilityFile)).toBeLessThan(
      files.indexOf('20260824000000_cause_stories.sql'),
    );
    expect(files.indexOf(repairFile)).toBeGreaterThan(
      files.indexOf('20260827000000_campaign_path.sql'),
    );

    expect(compatibility?.sql).toContain("when roles ? 'super_admin' then 'super_admin'");
    expect(compatibility?.sql).toContain("when roles ? 'admin' then 'admin'");
    expect(compatibility?.sql).toContain('generated always as');

    for (const policy of [
      'cause_stories_admin_write',
      'cause_impact_stats_admin_write',
      'platform_reports_admin_write',
      'reports_admin_write',
    ]) {
      expect(repair?.sql).toContain(policy);
    }
    expect(repair?.sql.match(/public\.is_admin\(\)/g)).toHaveLength(8);
    expect(repair?.sql).not.toMatch(/profiles\s+profile|profile\.role|p\.role/);
    expect(rollbackFiles).toContain(
      '20260823500000_rollback_profiles_role_replay_compatibility.sql',
    );
    expect(rollbackFiles).toContain(
      '20260828000000_rollback_repair_editorial_admin_policies.sql',
    );
  });
});
