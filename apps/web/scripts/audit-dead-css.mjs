#!/usr/bin/env node
/**
 * Report — and with `--fix`, remove — rules in `app/globals.css` that can no
 * longer match anything.
 *
 *   node scripts/audit-dead-css.mjs           # report
 *   node scripts/audit-dead-css.mjs --fix     # rewrite globals.css
 *   node scripts/audit-dead-css.mjs --json
 *
 * The definition of "dead" lives in `scripts/lib/dead-css.mjs` and is shared
 * with `__tests__/dead-css.test.ts`, so the guard and the codemod cannot drift
 * into disagreeing about what they are each doing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import {
  GLOBALS,
  readAllSource,
  makeIsLive,
  findDeadRules,
  summarise,
} from './lib/dead-css.mjs';

const argv = process.argv;
const FIX = argv.includes('--fix');
const AS_JSON = argv.includes('--json');

const before = readFileSync(GLOBALS, 'utf8');
const isLive = makeIsLive(readAllSource());
const { root, dead } = findDeadRules(before, isLive);
const stats = summarise(dead);

if (AS_JSON) {
  console.log(JSON.stringify({ ...stats, fixed: FIX }, null, 2));
} else {
  const pct = ((stats.bytes / before.length) * 100).toFixed(1);
  console.log(`globals.css: ${before.length.toLocaleString()} B`);
  console.log(`dead rules:  ${stats.count} (${stats.bytes.toLocaleString()} B, ${pct}%)`);
  for (const [family, count] of Object.entries(stats.byFamily).sort((a, b) => b[1] - a[1])) {
    console.log(`  .${family}-*`.padEnd(18) + count);
  }
}

if (!FIX) process.exit(0);

for (const rule of dead) rule.remove();

// An at-rule left holding nothing is itself dead weight, and a stray empty
// `@media` block is the kind of residue that makes a later diff unreadable.
let emptied;
do {
  emptied = 0;
  root.walkAtRules((at) => {
    if (at.nodes && at.nodes.length === 0 && !/^(charset|import|namespace)$/.test(at.name)) {
      at.remove();
      emptied++;
    }
  });
} while (emptied > 0);

const after = root.toString();
writeFileSync(GLOBALS, after, 'utf8');
if (!AS_JSON) {
  console.log(`\nrewrote globals.css: ${before.length.toLocaleString()} → ${after.length.toLocaleString()} B`);
}
