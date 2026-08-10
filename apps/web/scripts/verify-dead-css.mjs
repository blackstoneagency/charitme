#!/usr/bin/env node
/**
 * Prove the classes `audit-dead-css` wants to delete appear in NO rendered page.
 *
 * Source scanning says "no file writes this class name". That is an argument
 * about the code. This is the observation: fetch every public route from a real
 * server and look for the class in the HTML that actually came back. A rule
 * whose class never appears in any served markup cannot be styling anything, so
 * deleting it cannot change a pixel — which is the entire safety claim, checked
 * rather than asserted.
 *
 *   node scripts/verify-dead-css.mjs --base http://127.0.0.1:4141
 *
 * ⚠️ Assert the STATUS of every fetch. A 500 returns an error document that
 * contains none of the classes, so a broken server would report a perfect
 * all-clear — the same silent-pass shape that let a zero-state page satisfy
 * every visual sweep in this repo.
 *
 * ⚠️ This covers server-rendered markup. A class applied only by client script
 * after hydration would not appear, so the source scan stays the primary gate
 * and this is corroboration, not a replacement for it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GLOBALS, WEB_ROOT, readAllSource, makeIsLive, findDeadRules, classesIn } from './lib/dead-css.mjs';
import { resolveBase } from './lib/audit-base.mjs';

const BASE = resolveBase(process.argv, 'http://127.0.0.1:4141');
const routes = JSON.parse(readFileSync(join(WEB_ROOT, 'e2e', 'public-routes.json'), 'utf8')).public;

const isLive = makeIsLive(readAllSource());
const { dead } = findDeadRules(readFileSync(GLOBALS, 'utf8'), isLive);

const candidates = new Set();
for (const rule of dead) for (const cls of classesIn(rule.selector)) candidates.add(cls);
console.log(`${candidates.size} classes proposed for deletion across ${dead.length} rules`);
console.log(`checking ${routes.length} rendered routes on ${BASE}\n`);

const found = new Map();
const failedRoutes = [];
let checked = 0;

for (const route of routes) {
  let res;
  try {
    res = await fetch(`${BASE}${route}`, { redirect: 'follow' });
  } catch (e) {
    failedRoutes.push([route, String(e.message).slice(0, 60)]);
    continue;
  }
  if (res.status !== 200) {
    failedRoutes.push([route, `HTTP ${res.status}`]);
    continue;
  }
  const html = await res.text();
  checked++;
  for (const cls of candidates) {
    // Word-boundary match: `dn-amt` must not be satisfied by `dn-amount`.
    if (new RegExp(`(?:^|[\\s"'\`])${cls}(?:[\\s"'\`]|$)`).test(html)) {
      if (!found.has(cls)) found.set(cls, []);
      found.get(cls).push(route);
    }
  }
}

console.log(`routes fetched 200: ${checked}/${routes.length}`);
if (failedRoutes.length) {
  console.log(`\nnot measured (${failedRoutes.length}):`);
  for (const [route, why] of failedRoutes) console.log(`  ${route.padEnd(34)} ${why}`);
}

if (found.size === 0) {
  console.log(`\n✅ none of the ${candidates.size} classes appears in any rendered route.`);
  process.exit(failedRoutes.length ? 1 : 0);
}

console.log(`\n❌ ${found.size} class(es) DO appear in rendered markup — do not delete these:`);
for (const [cls, where] of found) console.log(`  ${cls.padEnd(28)} ${where.slice(0, 4).join(', ')}`);
process.exit(1);
