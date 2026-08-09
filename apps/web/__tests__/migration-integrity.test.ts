import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = join(WEB_ROOT, '..', '..');
const MIGRATIONS_ROOT = join(REPO_ROOT, 'supabase', 'migrations');
const SOURCE_ROOTS = ['app', 'components', 'lib'].map((dir) => join(WEB_ROOT, dir));

function sourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.[cm]?[jt]sx?$/.test(name) ? [path] : [];
  });
}

// Block comments are stripped first: JSDoc usage examples (e.g. the
// `supabaseAdmin.from('x').select()` sample in lib/query-timeout.ts) are not real
// queries, and counting them demands a migration for a table that never existed.
// Only `/* */` is stripped — `//` appears inside every https:// literal, so
// removing line comments would swallow real code.
function stripBlockComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

// SQL comments only. `--` starts a comment to end of line and `/* */` blocks
// nest in Postgres, but a single non-nested pass is enough for these files and
// keeps a documented `p.role` in prose from reading as a live predicate.
function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
}

function literalPostgrestTables(): Set<string> {
  const source = stripBlockComments(
    SOURCE_ROOTS.flatMap(sourceFiles)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n'),
  );
  // `storage.from('bucket')` is a STORAGE BUCKET, not a PostgREST table, and has
  // no `create table` to find — matching it reported the `reports` bucket as a
  // table with no migration. The negative lookbehind excludes it while leaving
  // `supabase.from('table')` and `supabaseAdmin.from('table')` matched.
  return new Set(
    [...source.matchAll(/(?<!storage)\.from\(\s*['"]([a-z_][a-z0-9_]*)['"]\s*\)/gi)]
      .map((match) => match[1]),
  );
}

describe('migration integrity', () => {
  const files = readdirSync(MIGRATIONS_ROOT).filter((name) => name.endsWith('.sql'));
  const migrationSql = files.map((name) => readFileSync(join(MIGRATIONS_ROOT, name), 'utf8')).join('\n');

  it('uses one valid version per migration file', () => {
    const invalid = files.filter((name) => !/^\d{14}_[a-z0-9_]+\.sql$/.test(name));
    const versions = files.map((name) => name.slice(0, 14));
    const duplicates = [...new Set(versions.filter((version, index) => versions.indexOf(version) !== index))];

    expect(invalid, `Invalid migration filenames: ${invalid.join(', ')}`).toEqual([]);
    expect(duplicates, `Duplicate migration versions: ${duplicates.join(', ')}`).toEqual([]);
  });

  // Guards the comment-stripping above: if it ever over-matches and blanks out real
  // source, the check below would pass vacuously instead of catching a missing table.
  it('still finds the core tables after comments are stripped', () => {
    const found = literalPostgrestTables();
    for (const table of ['campaigns', 'donations', 'profiles']) {
      expect(found.has(table), `scanner lost ${table}`).toBe(true);
    }
    expect(found.size).toBeGreaterThan(20);
  });

  // `profiles.role` does not exist. 20260823500000 adds one purely as a replay
  // bridge for three older migrations, and 20260828000000 drops it again — so any
  // migration ordered AFTER the repair that checks `p.role` raises 42703 on a
  // database provisioned from scratch, while working fine against a production
  // database that still carries a hand-added column. That asymmetry is why it
  // reaches CI rather than a local run: it only fails on a replay from zero, and
  // it failed exactly that way once (20260829010000_platform_impact_stats).
  it('checks admin rights with is_admin(), not the removed profiles.role column', () => {
    const REPAIR = '20260828000000';
    const offenders = files
      .filter((name) => name.slice(0, 14) > REPAIR)
      .filter((name) => {
        const sql = stripSqlComments(readFileSync(join(MIGRATIONS_ROOT, name), 'utf8'));
        return /\b[a-z_]+\.role\s+in\s*\(/i.test(sql) || /\bprofiles\.role\b/i.test(sql);
      });

    expect(
      offenders,
      `Migrations after ${REPAIR} that read the dropped profiles.role: ${offenders.join(', ')}. `
        + 'Use public.is_admin() instead.',
    ).toEqual([]);
  });

  // Proves the scanner above can actually see a violation — the same predicate,
  // taken from the migration that really did fail, must be detected.
  it('would catch a role-column predicate if one were reintroduced', () => {
    const planted = stripSqlComments(
      "-- p.role in ('admin') in a comment must NOT count\n"
        + "create policy x on public.y for all using (exists (select 1 from public.profiles p\n"
        + "  where p.id = auth.uid() and p.role in ('admin', 'super_admin')));",
    );
    expect(/\b[a-z_]+\.role\s+in\s*\(/i.test(planted)).toBe(true);
    expect(stripSqlComments("-- p.role in ('admin')\nselect 1;")).not.toMatch(/role\s+in\s*\(/i);
  });

  it('defines every table used by a literal PostgREST query', () => {
    const declared = new Set(
      [...migrationSql.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi)]
        .map((match) => match[1]),
    );
    const missing = [...literalPostgrestTables()].filter((table) => !declared.has(table)).sort();

    expect(
      missing,
      `PostgREST tables without a reproducible migration: ${missing.join(', ')}`,
    ).toEqual([]);
  });
});
