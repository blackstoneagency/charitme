// Does every fetch() call reach a route handler that exports that HTTP method?
//
// A path can be perfectly valid while the verb is not: POSTing to a route that
// only exports GET returns 405 with no route-level code involved, so nothing
// throws, nothing logs, and the feature just silently does nothing. The
// internal-link checker validates the PATH only, which cannot see this.
//
// Pairs each `fetch(url, { method })` with the exported handlers in the matching
// app/**/route.ts, resolving [param] and (group) segments the same way the
// router does.
//
// Usage: node scripts/audit-fetch-methods.mjs [--ci]
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

// ── Route handlers and the verbs each one exports ────────────────────────────
const handlers = [];
for (const file of walk(APP).filter((f) => /[/\\]route\.tsx?$/.test(f))) {
  const rel = path.relative(APP, path.dirname(file));
  const route =
    '/' + rel.split(path.sep).filter((s) => s && !(s.startsWith('(') && s.endsWith(')'))).join('/');
  const src = readFileSync(file, 'utf8');
  const verbs = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)) {
    verbs.add(m[1]);
  }
  // `export const POST = handler` / `export { POST }` are equally valid.
  for (const m of src.matchAll(/export\s+(?:const|let)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)) verbs.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.split(/\s+as\s+/).pop().trim();
      if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(name)) verbs.add(name);
    }
  }
  handlers.push({ route, verbs, file: path.relative(WEB_ROOT, file) });
}

function segmentsMatch(routeSegs, candSegs) {
  let ci = 0;
  for (const p of routeSegs) {
    if (p.startsWith('[...') || p.startsWith('[[...')) return true;
    if (ci >= candSegs.length) return false;
    if (p.startsWith('[') || candSegs[ci] === '*') { ci++; continue; }
    if (p !== candSegs[ci]) return false;
    ci++;
  }
  return ci === candSegs.length;
}

// Ranking candidates has to be POSITION-AWARE, and getting it wrong produced a
// confident false positive in each direction:
//
//   • first-match-wins said /api/notifications/count was served by [id]/route.ts.
//     Next prefers a STATIC segment, so count/route.ts wins. 4 false positives.
//   • then preferring static unconditionally said /api/campaigns/${id} was served
//     by donations-toggle/route.ts, because '*' matches any segment and
//     'donations-toggle' is static. 13 more.
//
// The rule that satisfies both: compare each route segment against the segment
// the CALLER actually wrote. A literal caller segment prefers a static route; an
// interpolated one ('*') is a runtime value, so it prefers the dynamic route.
function score(routeSegs, candSegs) {
  let total = 0;
  for (let i = 0; i < routeSegs.length; i++) {
    const r = routeSegs[i];
    const c = candSegs[i];
    const rDynamic = r.startsWith('[');
    if (c === '*') total += rDynamic ? 2 : 1;   // interpolated → dynamic route
    else total += rDynamic ? 1 : 2;             // literal → static route
  }
  return total;
}

function findHandler(route) {
  const segs = route.split('/').filter(Boolean);
  const matches = handlers.filter((h) => segmentsMatch(h.route.split('/').filter(Boolean), segs));
  if (matches.length <= 1) return matches[0];
  return matches.sort(
    (a, b) => score(b.route.split('/').filter(Boolean), segs) - score(a.route.split('/').filter(Boolean), segs),
  )[0];
}

// ── fetch() call sites ───────────────────────────────────────────────────────
// The url and the method are usually on different lines, so scan a small window
// after each fetch( rather than line by line.
const sources = [...walk(APP), ...walk(path.join(WEB_ROOT, 'components')), ...walk(path.join(WEB_ROOT, 'lib'))]
  .filter((f) => /\.tsx?$/.test(f) && !/[/\\]route\.tsx?$/.test(f));

const calls = [];
for (const file of sources) {
  const rel = path.relative(WEB_ROOT, file);
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const m = /fetch\(\s*[`'"](\/api\/[^`'"]*)[`'"]/.exec(line);
    if (!m) return;
    const route =
      '/' +
      m[1].split('?')[0].split('/').filter(Boolean).map((s) => (s.includes('${') ? '*' : s)).join('/');
    // The options object follows within a few lines; absent a method it is GET.
    //
    // A method can be a TERNARY — `method: editing ? 'PATCH' : 'POST'` — so take
    // every verb in the expression, not the first. Reading only the first
    // matched literal produced the last surviving false positive in this audit:
    // the regex missed the ternary entirely, defaulted to GET, and reported a
    // GET/405 on a route that is never called with GET.
    const windowSrc = lines.slice(i, i + 8).join('\n');
    const expr = /method:\s*([^,\n}]+)/.exec(windowSrc);
    const verbs = expr
      ? [...expr[1].matchAll(/['"`](GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)['"`]/gi)].map((v) => v[1].toUpperCase())
      : [];
    for (const method of verbs.length ? verbs : ['GET']) {
      calls.push({ route, method, where: `${rel}:${i + 1}` });
    }
  });
}

const problems = [];
for (const c of calls) {
  const h = findHandler(c.route);
  if (!h) continue; // a missing PATH is audit-internal-links.mjs's job, not this one
  if (!h.verbs.has(c.method)) {
    problems.push(`${c.method} ${c.route}  →  ${h.file} exports only [${[...h.verbs].sort().join(', ') || 'nothing'}]\n      ${c.where}`);
  }
}

export const stats = { handlers: handlers.length, calls: calls.length };
export function findMethodMismatches() { return problems; }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`route handlers: ${handlers.length}`);
  console.log(`fetch call sites: ${calls.length}`);
  console.log(`method mismatches: ${problems.length}\n`);
  for (const p of problems) console.log(`✗ ${p}`);
  if (process.argv.includes('--ci') && problems.length) process.exit(1);
}
