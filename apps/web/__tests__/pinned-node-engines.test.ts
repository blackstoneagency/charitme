import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// `semver` ships no type declarations, and this file exists to police
// dependencies — adding `@types/semver` just to read three functions would be a
// poor trade. Narrow surface, declared where it is used.
type Semver = {
  valid(version: string): string | null;
  validRange(range: string): string | null;
  satisfies(version: string, range: string): boolean;
};
const semver = createRequire(import.meta.url)('semver') as Semver;

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(web, '..', '..');

// ─────────────────────────────────────────────────────────────────────────────
// EVERY DEPENDENCY MUST RUN ON THE NODE VERSION THIS PROJECT PINS.
//
// ⚠️ Written after breaking master. `@capacitor/cli@8` declares
// `engines: { node: ">=22.0.0" }`. `.node-version` pins **20.19.0**, and
// `.npmrc` sets `engine-strict=true` — so `npm ci` does not warn, it FAILS:
//
//   npm error code EBADENGINE
//   npm error Not compatible with your version of node/npm: @capacitor/cli@8.5.0
//   npm error notsup Required: {"node":">=22.0.0"}  Actual: {"node":"v20.20.2"}
//
// All five CI jobs died at "Install dependencies" in about one second, and
// Vercel reads the same `.node-version` and the same `.npmrc`, so production
// deploys were failing too.
//
// The reason it was not caught before pushing is the whole point of this file:
// **the sandbox runs Node 22**, so `npm install`, `npm ci`, the build and 4,659
// tests all passed locally. Nothing that executes on the developer's machine can
// see this, because the developer's machine is not the pinned version.
//
// So this checks the DECLARED ranges against the PINNED version rather than
// against `process.version`. It is the one form of the check that stays true
// regardless of who runs it.
// ─────────────────────────────────────────────────────────────────────────────

const pinned = readFileSync(join(repo, '.node-version'), 'utf8').trim();

/** Installed packages, walking the workspace-hoisted tree. */
function installedPackages(): Array<{ name: string; version: string; engines?: string }> {
  const out: Array<{ name: string; version: string; engines?: string }> = [];
  const seen = new Set<string>();

  function walk(dir: string, depth: number): void {
    if (depth > 4 || !existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = join(dir, entry.name);
      if (entry.name.startsWith('@')) { walk(full, depth); continue; }
      if (entry.name === 'node_modules') { walk(full, depth + 1); continue; }

      const pkgPath = join(full, 'package.json');
      if (existsSync(pkgPath) && !seen.has(full)) {
        seen.add(full);
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
            name?: string; version?: string; engines?: { node?: string };
          };
          if (pkg.name && pkg.version) {
            out.push({ name: pkg.name, version: pkg.version, engines: pkg.engines?.node });
          }
        } catch { /* an unreadable package.json is not this test's business */ }
      }
      const nested = join(full, 'node_modules');
      if (existsSync(nested)) walk(nested, depth + 1);
    }
  }

  walk(join(repo, 'node_modules'), 0);
  return out;
}

describe('the pinned Node version is real and enforced', () => {
  it('.node-version holds a concrete version', () => {
    expect(semver.valid(pinned), `.node-version must be an exact version, got "${pinned}"`).toBeTruthy();
  });

  it('satisfies the app\'s own engines range', () => {
    const pkg = JSON.parse(readFileSync(join(web, 'package.json'), 'utf8')) as {
      engines?: { node?: string };
    };
    const range = pkg.engines?.node;
    expect(range, 'apps/web must declare an engines.node range').toBeDefined();
    expect(
      semver.satisfies(pinned, range!),
      `.node-version ${pinned} does not satisfy apps/web engines "${range}"`,
    ).toBe(true);
  });

  it('engine-strict is on, which is what turns a mismatch into a failed install', () => {
    // Without it npm prints a warning and continues, and this whole class of
    // breakage becomes invisible until something misbehaves at runtime.
    expect(readFileSync(join(repo, '.npmrc'), 'utf8')).toMatch(/engine-strict\s*=\s*true/);
  });
});

describe('no installed dependency demands a newer Node than we pin', () => {
  const packages = installedPackages();

  it('actually walked the dependency tree', () => {
    // A scan that finds nothing passes every assertion below for the wrong
    // reason — the exact failure mode this file exists to prevent elsewhere.
    expect(packages.length, 'found no installed packages — run npm install first').toBeGreaterThan(200);
    expect(packages.filter((p) => p.engines).length, 'no package declared engines.node — the walk is wrong')
      .toBeGreaterThan(20);
  });

  it(`every declared engines.node range admits ${pinned}`, () => {
    const incompatible = packages
      .filter((p) => p.engines && semver.validRange(p.engines))
      .filter((p) => !semver.satisfies(pinned, p.engines!))
      .map((p) => `${p.name}@${p.version} requires node "${p.engines}"`);

    expect(
      [...new Set(incompatible)],
      `These packages cannot install on the pinned Node ${pinned}.\n`
      + 'Because .npmrc sets engine-strict=true, `npm ci` FAILS rather than warns —\n'
      + 'so this breaks CI and Vercel, not just a local run. Either pick a version\n'
      + 'of the package that supports the pinned Node, or raise the pin deliberately\n'
      + '(which changes the production runtime, and .node-version is what Vercel reads).\n'
      + '⚠️ You will not reproduce this locally unless your machine runs the pinned\n'
      + 'version — that is why this test compares against the PIN, not process.version.',
    ).toEqual([]);
  });
});
