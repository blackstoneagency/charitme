import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// A Server Component may import a COMPONENT from a 'use client' module, but not
// plain DATA. Next replaces a client module with a reference proxy on the
// server, so a non-component export arrives as an object rather than its value.
//
// This shipped: app/admin/super/page.tsx imported SUPER_ADMIN_NAV (an array)
// from components/SuperAdminNav.tsx ('use client') and threw
// "SUPER_ADMIN_NAV.filter is not a function" — the super-admin console overview
// 500'd. Nothing caught it: it typechecks cleanly (the types are real), lint is
// silent, and the page is behind requireSuperAdmin() so no routine sweep opened
// it. Only the signed-in browser sweep did.
//
// The rule enforced here: a server file may import a client module's default
// export (a component) or a `type`, but not a named value.
// ─────────────────────────────────────────────────────────────────────────────

const WEB_ROOT = path.join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e);
    if (statSync(full).isDirectory()) {
      if (e === 'node_modules' || e === '.next') continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

const isClientModule = (src: string) => /^\s*['"]use client['"]/.test(src);

const files = [
  ...walk(path.join(WEB_ROOT, 'app')),
  ...walk(path.join(WEB_ROOT, 'components')),
];

/** Resolve a relative import specifier to a file on disk. */
function resolveImport(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const cand of [`${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')]) {
    try { if (statSync(cand).isFile()) return cand; } catch { /* keep looking */ }
  }
  return null;
}

describe('server components do not import plain values from client modules', () => {
  it('finds the files it is meant to scan', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('no server file imports a named non-component value from a "use client" module', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      if (isClientModule(src)) continue; // client → client is fine

      for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g)) {
        const [full, names, spec] = m;
        if (full.includes('import type')) continue;
        const target = resolveImport(file, spec);
        if (!target) continue;
        if (!isClientModule(readFileSync(target, 'utf8'))) continue;

        for (const raw of names.split(',')) {
          const name = raw.split(/\s+as\s+/)[0].trim();
          if (!name || raw.trim().startsWith('type ')) continue;
          // A PascalCase name is a component, which crosses the boundary fine.
          // A SCREAMING_CASE or camelCase name is data, which does not.
          if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) continue;
          offenders.push(
            `${path.relative(WEB_ROOT, file)} imports { ${name} } from '${spec}' ('use client')`,
          );
        }
      }
    }

    expect(
      offenders,
      'A Server Component is importing plain data across the client boundary. On ' +
        'the server that import is a client-reference proxy, not the value, so it ' +
        'throws at runtime (e.g. ".filter is not a function") while typechecking ' +
        'cleanly. Move the value into a module with no "use client" directive and ' +
        'import it from there:\n  ' +
        offenders.join('\n  '),
    ).toEqual([]);
  });
});
