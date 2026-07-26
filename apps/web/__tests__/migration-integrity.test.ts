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

function literalPostgrestTables(): Set<string> {
  const source = SOURCE_ROOTS.flatMap(sourceFiles)
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');
  return new Set(
    [...source.matchAll(/\.from\(\s*['"]([a-z_][a-z0-9_]*)['"]\s*\)/gi)]
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
