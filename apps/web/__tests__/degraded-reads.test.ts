import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(path: string): string {
  return readFileSync(join(WEB_ROOT, path), 'utf8');
}

// ─────────────────────────────────────────────────────────────────────────────
// Degraded-read contract.
//
// supabase-js RESOLVES on a query error instead of throwing, so `const { data } =
// await supabaseAdmin.from(...)` turns a timeout, an RLS denial, or a dropped
// column into `data: null` — which then reduces to an empty list and a total of 0.
// On an organizer's dashboard that renders as "no campaigns, $0 raised" to someone
// whose fundraiser is live and funded, i.e. the UI states their money is gone.
//
// The contract for any page that renders totals: read the `error` field, and when
// the read fails show unknown ('—') plus a role="alert" explanation — never a
// number that was never measured.
// ─────────────────────────────────────────────────────────────────────────────

const TOTALS_PAGES = [
  'app/dashboard/page.tsx',
  'app/dashboard/campaigns/page.tsx',
  'app/dashboard/donations/page.tsx',
  'app/dashboard/analytics/page.tsx',
  'app/dashboard/donor/page.tsx',
  'app/admin/super/page.tsx',
];

// The notice may be inline or the shared component; both must reach the DOM as a
// live region, so the assertion accepts either.
function hasAlert(src: string): boolean {
  return src.includes('role="alert"') || src.includes('<DegradedReadNotice');
}

describe('pages that render totals degrade honestly', () => {
  it.each(TOTALS_PAGES)('%s checks the query error field', (path) => {
    const src = read(path);
    expect(src, `${path} ignores the supabase error field`).toMatch(/\berror\b/);
    // A bare `const { data } = await supabaseAdmin` is the exact shape of the bug:
    // it cannot distinguish "no rows" from "the read failed".
    expect(
      src,
      `${path} destructures only data from a supabase read — an error becomes 0`,
    ).not.toMatch(/const \{\s*data\s*\}\s*=\s*await supabaseAdmin/);
  });

  it.each(TOTALS_PAGES)('%s renders unknown, not zero, and says so', (path) => {
    const src = read(path);
    expect(src, `${path} has no em-dash "unknown" rendering`).toContain('—');
    expect(hasAlert(src), `${path} fails silently — no alert region`).toBe(true);
  });

  it('the shared notice is a live region that reassures about funds', () => {
    const src = read('components/DegradedReadNotice.tsx');
    expect(src).toContain('role="alert"');
    expect(src).toMatch(/funds are\s+unaffected/);
  });

  // The wording is owned by whoever writes the copy; what must not change is that
  // it reassures the organizer their money is intact. A blank "couldn't load"
  // beside four zeros still reads as "your funds are gone".
  it.each(['app/dashboard/page.tsx', 'app/dashboard/campaigns/page.tsx'])(
    '%s tells the organizer their funds are unaffected',
    (path) => {
      expect(read(path)).toMatch(/funds are\s+unaffected|nothing has happened to your/);
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// A colour-token sweep once rewrote the numeric entity `&#128075;` (👋) in the
// dashboard greeting to `&var(--green-dark);`. That is not a valid HTML entity,
// so JSX rendered it verbatim: every organizer was greeted with
// "Welcome back, Dan! &var(--green-dark);". Cheap guard against the whole class.
// ─────────────────────────────────────────────────────────────────────────────

function sourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    if (name === 'node_modules' || name === '.next') return [];
    const path = join(root, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(name) ? [path] : [];
  });
}

describe('no CSS token was pasted into an HTML entity', () => {
  it('finds no `&var(--…);` anywhere in app, components, or lib', () => {
    const offenders = ['app', 'components', 'lib']
      .flatMap((dir) => sourceFiles(join(WEB_ROOT, dir)))
      .filter((path) => /&var\(--/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(WEB_ROOT, path));

    expect(offenders, `mangled entity in: ${offenders.join(', ')}`).toEqual([]);
  });
});
