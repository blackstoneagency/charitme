import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// There must be exactly ONE list of public routes.
//
// There were five hardcoded copies — in accessibility.spec.ts,
// public-quality.spec.ts, public-routes.spec.ts, audit-contrast.mjs and
// audit-responsive.mjs — and all five were wrong in the same way: they listed
// `/achievements` and `/privacy-center` as public while both call requireUser()
// and 307 to /login. Playwright follows redirects, so five separate sweeps
// audited the LOGIN PAGE under two other names and reported green.
//
// One of those copies even carried the comment "Kept in sync … so the three
// sweeps cannot drift apart". It was kept in sync by hand, which is exactly how
// they drifted. A comment cannot enforce this; a test can.
//
// All five now read e2e/public-routes.json. This fails if a sixth copy appears.
// ─────────────────────────────────────────────────────────────────────────────

const WEB_ROOT = path.join(__dirname, '..');
const SEARCH_DIRS = ['e2e', 'scripts'];

/** The one legitimate home for the list, plus the module that re-exports it. */
const ALLOWED = new Set([
  path.join('e2e', 'public-routes.json'),
  path.join('e2e', 'public-routes.ts'),
]);

/**
 * A "route-list literal" is a run of quoted absolute paths. Ten is comfortably
 * above incidental clusters (a spec naming a handful of fixtures) and well below
 * the ~37 a real copy of the list would contain.
 */
const MIN_ROUTES_TO_COUNT_AS_A_LIST = 10;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e);
    if (statSync(full).isDirectory()) {
      if (e === 'node_modules' || e === 'test-results') continue;
      walk(full, out);
    } else if (/\.(ts|tsx|mjs|js|json)$/.test(e)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Count distinct quoted absolute paths that look like public page routes.
 *
 * Excludes anything with a `.` (asset paths), an `api/` segment, or a `${`
 * (templates) — those are not route-list entries.
 */
function countRouteLiterals(source: string): number {
  const found = new Set<string>();
  for (const m of source.matchAll(/['"](\/[a-z0-9][a-z0-9/-]*)['"]/g)) {
    const route = m[1];
    if (route.includes('.') || route.startsWith('/api')) continue;
    found.add(route);
  }
  return found.size;
}

describe('public route list has a single source of truth', () => {
  const files = SEARCH_DIRS.flatMap((d) => walk(path.join(WEB_ROOT, d)));

  it('finds the files it is supposed to be scanning', () => {
    // Guards against the walk silently matching nothing and passing vacuously —
    // the exact failure mode this whole test exists to prevent elsewhere.
    expect(files.length).toBeGreaterThan(5);
    const rels = files.map((f) => path.relative(WEB_ROOT, f));
    expect(rels).toContain(path.join('e2e', 'public-routes.json'));
    expect(rels).toContain(path.join('scripts', 'audit-responsive.mjs'));
    expect(rels).toContain(path.join('scripts', 'audit-contrast.mjs'));
  });

  it('has no second hardcoded route list', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = path.relative(WEB_ROOT, file);
      if (ALLOWED.has(rel)) continue;
      const source = readFileSync(file, 'utf8');
      // A file that READS the shared list is anchored to it and cannot drift
      // silently — a curated subset is legitimate provided every entry is
      // validated against the shared file (see scripts/audit-scroll-keyboard.mjs).
      if (source.includes('public-routes.json') || source.includes('./public-routes')) continue;
      const count = countRouteLiterals(source);
      if (count >= MIN_ROUTES_TO_COUNT_AS_A_LIST) offenders.push(`${rel} (${count} routes)`);
    }
    expect(
      offenders,
      'These files hardcode a public-route list instead of reading e2e/public-routes.json.\n' +
        'Five copies existed before and all five drifted the same way — two of the\n' +
        'routes were not public, so the sweeps audited /login and passed. Import the\n' +
        'shared list (see e2e/public-routes.ts, or readFileSync for .mjs) instead:\n  ' +
        offenders.join('\n  '),
    ).toEqual([]);
  });

  it('the shared list is the real one — non-trivial and free of auth-gated routes', () => {
    const data = JSON.parse(
      readFileSync(path.join(WEB_ROOT, 'e2e', 'public-routes.json'), 'utf8'),
    ) as { public: string[]; authGated: { routes: string[] } };

    expect(data.public.length).toBeGreaterThan(30);

    // The original bug, pinned: a route cannot be in both lists, and the known
    // offenders must stay on the auth-gated side.
    const overlap = data.public.filter((r) => data.authGated.routes.includes(r));
    expect(overlap, `Routes claimed as both public and auth-gated: ${overlap.join(', ')}`).toEqual([]);
    expect(data.authGated.routes).toContain('/achievements');
    expect(data.authGated.routes).toContain('/privacy-center');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The signed-in console list must track the filesystem.
//
// `authGated.consoles` is what the signed-in sweep (scripts/audit-signed-in.mjs)
// actually visits. A new page under /dashboard or /admin that nobody adds here is
// not "untested but visible" — it is invisible, because the sweep enumerates the
// list, not the app. The public list drifted exactly this way and cost five
// sweeps their meaning; this one is derived from disk so it cannot.
//
// Deliberately one-directional in strictness: a route on disk but missing from
// the list is a coverage hole and fails. A route in the list but not on disk also
// fails, because the sweep would report it as a 404 finding and someone would go
// looking for a colour bug that is really a deleted page.
// ─────────────────────────────────────────────────────────────────────────────
describe('signed-in console routes are derived from the app directory', () => {
  function pageRoutes(dir: string, prefix: string, out: string[] = []): string[] {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return out;
    }
    for (const e of entries) {
      const full = path.join(dir, e);
      if (statSync(full).isDirectory()) {
        pageRoutes(full, `${prefix}/${e}`, out);
      } else if (e === 'page.tsx') {
        out.push(prefix || '/');
      }
    }
    return out;
  }

  const onDisk = [
    ...pageRoutes(path.join(WEB_ROOT, 'app', 'dashboard'), '/dashboard'),
    ...pageRoutes(path.join(WEB_ROOT, 'app', 'admin'), '/admin'),
  ].sort();

  const data = JSON.parse(
    readFileSync(path.join(WEB_ROOT, 'e2e', 'public-routes.json'), 'utf8'),
  ) as { authGated: { consoles: string[]; dynamicSamples: string[] } };

  it('scans a real tree', () => {
    expect(onDisk.length).toBeGreaterThan(50);
    expect(onDisk).toContain('/dashboard');
    expect(onDisk).toContain('/admin/super');
  });

  it('lists every static /dashboard and /admin page, and nothing that is gone', () => {
    const staticOnDisk = onDisk.filter((r) => !r.includes('['));
    const listed = [...data.authGated.consoles].sort();

    const missing = staticOnDisk.filter((r) => !listed.includes(r));
    const stale = listed.filter((r) => !staticOnDisk.includes(r));

    expect(
      missing,
      'These pages exist but the signed-in sweep never visits them — it walks the\n' +
        'list, not the app, so an unlisted page is unaudited and looks fine:\n  ' +
        missing.join('\n  '),
    ).toEqual([]);
    expect(
      stale,
      `Listed but no longer on disk (the sweep will report a phantom 404): ${stale.join(', ')}`,
    ).toEqual([]);
  });

  it('instantiates every [param] template exactly once', () => {
    const dynamicOnDisk = onDisk.filter((r) => r.includes('['));
    // Each sample is the template with its params substituted, so the shapes must
    // correspond one-to-one; a template with no sample is an unswept page type.
    expect(data.authGated.dynamicSamples).toHaveLength(dynamicOnDisk.length);
    for (const sample of data.authGated.dynamicSamples) {
      expect(sample, `sample still contains an unsubstituted param: ${sample}`).not.toMatch(/[[\]]/);
    }
  });
});
