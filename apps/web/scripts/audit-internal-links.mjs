// Static internal-link check across the WHOLE app, signed-in surface included.
//
// The existing broken-link crawl walks 464 links over the PUBLIC pages only —
// authenticated pages 307 to /login for an anonymous crawler, so every link on
// the dashboard, the donor portal and the campaign builder is unverified. A
// `<Link href>` pointing at a route that does not exist renders a normal-looking
// button that 404s, and nothing in this repo would notice.
//
// This resolves literal hrefs in the source against the App Router's actual
// route table (built from app/**/page.tsx, honouring [param], [...catch] and
// route groups), so it needs no server and no session.
//
// Usage: node scripts/audit-internal-links.mjs [--ci]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(WEB_ROOT, 'app');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full, out);
    } else out.push(full);
  }
  return out;
}

// ── The route table ──────────────────────────────────────────────────────────
// A segment wrapped in (parens) is a route GROUP: it organises files without
// appearing in the URL. Missing that would make every grouped route look broken.
function toRoute(file, base) {
  const rel = path.relative(base, path.dirname(file));
  const segs = rel.split(path.sep).filter((s) => s && !(s.startsWith('(') && s.endsWith(')')));
  return '/' + segs.join('/');
}

const files = walk(APP);
const pageRoutes = files.filter((f) => /[/\\]page\.tsx?$/.test(f)).map((f) => toRoute(f, APP));
const apiRoutes = files.filter((f) => /[/\\]route\.tsx?$/.test(f)).map((f) => toRoute(f, APP));

/** Turn `/campaigns/[slug]/embed` into a matcher. */
function matcher(route) {
  const parts = route.split('/').filter(Boolean);
  return (candidate) => {
    const cand = candidate.split('/').filter(Boolean);
    let ci = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.startsWith('[...') || p.startsWith('[[...')) return true; // catch-all swallows the rest
      if (ci >= cand.length) return false;
      if (p.startsWith('[')) { ci++; continue; }
      // '*' is an interpolated segment from a template literal — it can stand in
      // for a dynamic segment, and leniently for a literal one too (someone may
      // interpolate a constant). Being lenient here can miss a bug; being strict
      // would invent one, and a checker that cries wolf gets switched off.
      if (cand[ci] === '*') { ci++; continue; }
      if (p !== cand[ci]) return false;
      ci++;
    }
    return ci === cand.length;
  };
}

const pageMatchers = pageRoutes.map(matcher);
const apiMatchers = apiRoutes.map(matcher);

// Routes served by something other than a page.tsx — metadata handlers and the
// files in public/. Absent from the route table but perfectly valid to link to.
const SPECIAL = new Set(['/robots.txt', '/sitemap.xml', '/manifest.webmanifest', '/favicon.ico', '/opensearch.xml']);
const publicFiles = (() => {
  try { return new Set(walk(path.join(WEB_ROOT, 'public')).map((f) => '/' + path.relative(path.join(WEB_ROOT, 'public'), f).split(path.sep).join('/'))); }
  catch { return new Set(); }
})();

function isKnown(route) {
  if (SPECIAL.has(route) || publicFiles.has(route)) return true;
  if (route.startsWith('/api/')) return apiMatchers.some((m) => m(route));
  // A route.ts outside /api serves a real URL too — app/go/[code]/route.ts is
  // the outreach click-tracking redirect. Checking only page.tsx for non-/api
  // paths reported /go/* as broken when it is the whole point of that module.
  return pageMatchers.some((m) => m(route)) || apiMatchers.some((m) => m(route));
}

// ── Collect literal internal routes ──────────────────────────────────────────
// NOT just `href=`. The first version of this matched only href attributes and
// reported 0 broken links across 74 routes — vacuously, because the admin and
// dashboard navs are arrays of TUPLES (`['Overview', '/admin/super', 'grid']`)
// with no href key anywhere. That is precisely the surface this check exists for.
//
// So: every quoted absolute-path literal. Templates (`${...}`) are skipped —
// they cannot be resolved statically, and guessing produces the false positives
// that get a checker ignored.
const sources = [...walk(APP), ...walk(path.join(WEB_ROOT, 'components')), ...walk(path.join(WEB_ROOT, 'lib'))]
  .filter((f) => /\.tsx?$/.test(f));

// Files whose absolute-path literals are PREFIX lists, not links. robots.ts and
// sitemap.ts disallow `/dashboard`, `/signup`, `/go` … as prefixes; the policy
// modules mirror them. `/signup` legitimately appears there without existing as
// a page — the prefix simply never matches anything.
// Clients for SOMEONE ELSE'S API — the paths are on a different host, reached
// through a helper that supplies the base URL, so there is no `https://` on the
// line to give them away.
const EXTERNAL_API_CLIENTS = new Set([
  path.join('lib', 'github.ts'),        // api.github.com — /repos/{owner}/{repo}/…
]);

const PREFIX_LIST_FILES = new Set([
  path.join('app', 'robots.ts'),
  path.join('app', 'sitemap.ts'),
  path.join('lib', 'public-route-policy.ts'),
  path.join('components', 'MarketingTracker.tsx'),
]);

// Exact literals that look like routes but address something else entirely.
// Each needs a reason — this map is how a real broken link would get silenced,
// so it stays short and explicit rather than becoming a dumping ground.
const NOT_OURS = new Map([
  ['/doc/cor', 'SFTP directory on sftp.floridados.gov (lib/state-filings.ts)'],
  [
    '/storage/v1/object/public/campaign-media',
    'Supabase Storage public-object path used to recover persisted campaign media',
  ],
]);

// Absolute-path strings that are not navigable routes.
const NOT_A_ROUTE = [
  /\./,                    // asset paths and file names
  /^\/$/,                  // the root is always valid
  /^\/[A-Z]/,              // header-ish and non-path strings
  /^\/(month|year|week|day|mo|yr)$/,  // billing suffixes: `You pay{'/month'}`
];

const hits = new Map(); // route -> Set(file:line)
for (const file of sources) {
  const rel = path.relative(WEB_ROOT, file);
  if (PREFIX_LIST_FILES.has(rel) || EXTERNAL_API_CLIENTS.has(rel)) continue;
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    // A path on a line that builds an external URL is part of that URL, not an
    // internal link (e.g. FL_COR_DIR = '/doc/cor' on the state-filings host).
    if (line.includes('http://') || line.includes('https://')) return;
    for (const m of line.matchAll(/["'`](\/[a-zA-Z0-9][a-zA-Z0-9/_-]*)["'`]/g)) {
      const route = m[1].replace(/\/$/, '') || '/';
      if (!hits.has(route)) hits.set(route, new Set());
      hits.get(route).add(`${rel}:${i + 1}`);
    }
    // Template links AND template fetches: `/dashboard/campaigns/${id}/edit`,
    // fetch(`/api/matching/claims/${id}`). The literal-only pass was blind to
    // every one — together that is most of the dynamic navigation in the
    // dashboard and admin console (91) plus 130 API calls, where a wrong path
    // fails silently at runtime. Matching any backtick template that starts with
    // '/' rather than only href={`…`} is what reaches the fetches. Each
    // interpolated segment becomes '*'; the LITERAL parts and the segment COUNT
    // are still checked, which is where this class of path actually breaks.
    for (const m of line.matchAll(/`(\/[^`]*)`/g)) {
      const raw = m[1].split('#')[0].split('?')[0];
      if (raw.includes('${') === false) continue;
      const route = '/' + raw.split('/').filter(Boolean)
        .map((seg) => (seg.includes('${') ? '*' : seg)).join('/');
      if (!hits.has(route)) hits.set(route, new Set());
      hits.get(route).add(`${rel}:${i + 1}`);
    }

    // API paths are worth checking too, but only where they are actually called.
    for (const m of line.matchAll(/["'`](\/api\/[a-zA-Z0-9/_-]*)["'`]/g)) {
      const route = m[1].replace(/\/$/, '');
      if (!hits.has(route)) hits.set(route, new Set());
      hits.get(route).add(`${rel}:${i + 1}`);
    }
  });
}

const broken = [...hits]
  .filter(([route]) => route.startsWith('/api/') || !NOT_A_ROUTE.some((re) => re.test(route)))
  .filter(([route]) => !NOT_OURS.has(route))
  .filter(([route]) => !isKnown(route))
  .sort();

/** `[route, [where, …]]` for every literal internal path with no matching route. */
export function findBrokenLinks() {
  return broken.map(([route, where]) => [route, [...where]]);
}

export const stats = {
  pages: pageRoutes.length,
  apiRoutes: apiRoutes.length,
  literals: hits.size,
  // Template-literal links (`/x/${id}/y`), normalised to `/x/*/y`.
  templates: [...hits.keys()].filter((r) => r.includes('/*')).length,
};

// Only print when run directly, so importing this from a test stays silent.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`route table: ${stats.pages} pages, ${stats.apiRoutes} api routes`);
  console.log(`literal internal paths: ${stats.literals} distinct across ${sources.length} source files`);
  console.log(`broken: ${broken.length}\n`);
  for (const [route, where] of broken) {
    console.log(`\u2717 ${route}`);
    for (const w of [...where].slice(0, 6)) console.log(`    ${w}`);
  }
  if (process.argv.includes('--ci') && broken.length) process.exit(1);
}
