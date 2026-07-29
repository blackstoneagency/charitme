import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  overrides?: Record<string, string>;
};

type PackageLock = {
  packages: Record<
    string,
    {
      engines?: Record<string, string>;
      version?: string;
    }
  >;
};

const SUPABASE_NODE_PACKAGES = [
  '@supabase/auth-js',
  '@supabase/functions-js',
  '@supabase/postgrest-js',
  '@supabase/realtime-js',
  '@supabase/storage-js',
  '@supabase/supabase-js',
] as const;

const repoRoot = resolve(process.cwd(), '..', '..');
const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8')) as T;

describe('Node runtime dependency contract', () => {
  it('fails installation when a package no longer supports the pinned runtime', () => {
    const npmConfig = readFileSync(resolve(repoRoot, '.npmrc'), 'utf8');

    expect(npmConfig).toMatch(/^engine-strict=true$/m);
  });

  it('keeps every installed Supabase JavaScript client on the Node 20 release line', () => {
    const rootPackage = readJson<PackageManifest>('package.json');
    const webPackage = readJson<PackageManifest>('apps/web/package.json');
    const lock = readJson<PackageLock>('package-lock.json');
    const supabaseClientPackages = Object.entries(lock.packages).filter(([path]) =>
      /node_modules\/@supabase\/(?:auth|functions|postgrest|realtime|storage|supabase)-js$/.test(
        path.replaceAll('\\', '/'),
      ),
    );

    expect(
      SUPABASE_NODE_PACKAGES.map((packageName) => rootPackage.overrides?.[packageName]),
    ).toEqual(SUPABASE_NODE_PACKAGES.map(() => '2.109.0'));
    expect(rootPackage.devDependencies?.['@supabase/supabase-js']).toBe('2.109.0');
    expect(webPackage.dependencies?.['@supabase/supabase-js']).toBe('2.109.0');
    expect(supabaseClientPackages.length).toBeGreaterThan(0);
    expect(new Set(supabaseClientPackages.map(([, entry]) => entry.version))).toEqual(
      new Set(['2.109.0']),
    );
    expect(new Set(supabaseClientPackages.map(([, entry]) => entry.engines?.node))).toEqual(
      new Set(['>=20.0.0']),
    );
  });
});
