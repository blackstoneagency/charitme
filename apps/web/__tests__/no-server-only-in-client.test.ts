import { describe, it, expect } from 'vitest';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// Guard: no 'use client' module may reach a `server-only` module through its
// imports — including indirectly.
//
// This class of bug is invisible to every other gate. Deriving the admin role
// filter from lib/role-capabilities.ts, which imports lib/roles.ts, which imports
// supabaseAdmin (server-only), broke the production build with:
//
//     You're importing a component that needs "server-only"
//
// while typecheck, lint and 1159 unit tests all passed. Only `next build` failed,
// several minutes in. The chain was two hops, so eyeballing the client file's own
// imports would not have shown it either.
//
// Walking the import graph catches it in milliseconds instead.
// ─────────────────────────────────────────────────────────────────────────────

const APP_WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['app', 'components', 'lib'];
const SKIP_DIRS = new Set(['node_modules', '.next', '__tests__', 'e2e', 'test-stubs']);

function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(p);
    }
  };
  walk(root);
  return out;
}

/** Resolve a relative import specifier to a real file on disk. */
function resolveImport(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null; // packages and aliases are out of scope
  const base = resolve(dirname(fromFile), spec);
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

// Value imports only. `import type { X } from './server-module'` is erased at
// compile time and never reaches webpack, so it does NOT trigger the server-only
// error — a first draft of this guard flagged 9 such lines as violations while the
// build was perfectly green.
const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s+(?!type\s)[^;'"]*?from\s*['"]([^'"]+)['"]/g;

function importsOf(file: string, source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(IMPORT_RE)) {
    const target = resolveImport(file, m[1]);
    if (target) out.push(target);
  }
  return out;
}

const isServerOnly = (src: string) => /^\s*import\s+['"]server-only['"]/m.test(src);
const isClient = (src: string) => /^\s*(['"])use client\1/m.test(src.trimStart());

describe('no server-only module reachable from a client component', () => {
  it('every use client file has a server-only-free import graph', () => {
    const files = SCAN_DIRS.flatMap((d) => listFiles(join(APP_WEB_ROOT, d)));
    const sources = new Map<string, string>();
    for (const f of files) sources.set(f, readFileSync(f, 'utf8'));

    // Depth-first walk from each client entry point, reporting the first chain
    // that reaches a server-only module.
    const offenders: string[] = [];
    for (const [file, src] of sources) {
      if (!isClient(src)) continue;
      const seen = new Set<string>([file]);
      const stack: { path: string; chain: string[] }[] = [{ path: file, chain: [file] }];
      while (stack.length) {
        const { path, chain } = stack.pop()!;
        const body = sources.get(path) ?? (existsSync(path) ? readFileSync(path, 'utf8') : '');
        if (path !== file && isServerOnly(body)) {
          offenders.push(chain.map((c) => relative(APP_WEB_ROOT, c)).join('\n        → '));
          break;
        }
        for (const next of importsOf(path, body)) {
          if (seen.has(next)) continue;
          seen.add(next);
          stack.push({ path: next, chain: [...chain, next] });
        }
      }
    }

    expect(
      offenders,
      `A 'use client' module reaches a server-only module through its imports.\n` +
        `next build fails on this ("You're importing a component that needs \\"server-only\\"")\n` +
        `but typecheck, lint and unit tests all pass. Split the pure data out into a\n` +
        `client-safe module, as lib/roles-shared.ts does for lib/roles.ts.\n\n` +
        offenders.join('\n\n'),
    ).toEqual([]);
  });

  it('detects a server-only chain rather than passing vacuously', () => {
    // The real regression: lib/roles.ts is server-only and lib/roles-shared.ts,
    // its client-safe half, must not be.
    const rolesSrc = readFileSync(join(APP_WEB_ROOT, 'lib/roles.ts'), 'utf8');
    const sharedSrc = readFileSync(join(APP_WEB_ROOT, 'lib/roles-shared.ts'), 'utf8');
    // Match a real import, not the word in prose — roles-shared.ts *explains* the
    // split in a comment that mentions supabaseAdmin, which a bare word match
    // wrongly flagged.
    const importsSupabaseAdmin = (src: string) =>
      /^\s*import\s[^;]*\bsupabaseAdmin\b[^;]*from/m.test(src);
    expect(isServerOnly(rolesSrc) || importsSupabaseAdmin(rolesSrc)).toBe(true);
    expect(isServerOnly(sharedSrc)).toBe(false);
    expect(importsSupabaseAdmin(sharedSrc)).toBe(false);

    // And the walker itself resolves a real relative import.
    const capabilities = join(APP_WEB_ROOT, 'lib/role-capabilities.ts');
    const resolved = importsOf(capabilities, readFileSync(capabilities, 'utf8'));
    expect(resolved.some((p) => p.endsWith('roles-shared.ts'))).toBe(true);
  });
});
