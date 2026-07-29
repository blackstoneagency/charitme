import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsRoot = resolve(process.cwd(), '../../supabase/migrations');
const files = readdirSync(migrationsRoot).filter((file) => file.endsWith('.sql')).sort();
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
});
