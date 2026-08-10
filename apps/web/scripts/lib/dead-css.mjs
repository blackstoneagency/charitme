import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

/**
 * Which rules in `globals.css` can no longer match anything?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS AND NOT ROUTE-SCOPING
 *
 * The tracker's biggest open CSS item is "one 700 KB stylesheet on every route,
 * 94–98% unused", and the obvious remedy — splitting families into per-route
 * sheets — was attempted and REVERTED, because a route sheet loads AFTER
 * `globals.css`: move a family's base rules out while its `@media` overrides
 * stay behind and the base rule starts winning at equal specificity, so
 * responsive behaviour runs backwards.
 *
 * Deleting a rule that matches NOTHING has no such hazard. There is no element
 * for it to apply to, in any sheet, at any breakpoint, so removal cannot change
 * the cascade. It is strictly smaller than the route-scoping win in ambition and
 * strictly safer in kind.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RULE FOR "DEAD", AND WHY IT ERRS TOWARDS KEEPING
 *
 * A selector is dead when it mentions at least one class and EVERY class in it
 * is unreachable from source. Compound selectors are the reason for "every":
 * `.hiw-page .pub-badge` must survive as long as `.pub-badge` is live, because
 * deleting it would be deleting a rule about a live element.
 *
 * ⚠️ A class counts as reachable if its literal name appears anywhere in source
 * OR if any prefix of it ending in `-` does. The second clause is not
 * defensive padding — it is load-bearing. `kind-menu-layout-explore-causes`
 * appears in no file; it is built as `kind-menu-layout-${slug}`. A naive
 * "is the whole string present?" check reports 571 dead classes where there are
 * 158, and deleting on that basis would silently unstyle the header's mega-menu.
 *
 * Both directions of error are possible and they are NOT symmetric:
 *   · keeping a dead rule costs bytes
 *   · deleting a live rule ships a visual regression to production
 * so every ambiguity resolves towards keeping.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
export const WEB_ROOT = join(HERE, '..', '..');
export const GLOBALS = join(WEB_ROOT, 'app', 'globals.css');

const SOURCE_DIRS = ['app', 'components', 'lib', 'e2e', 'scripts', '__tests__', 'public'];
const SOURCE_FILE = /\.(tsx|ts|jsx|js|mjs|cjs|json|html|md)$/;
const SKIP_DIR = new Set(['node_modules', '.next', 'coverage']);

/** Every byte of source a class name could plausibly be written in. */
export function readAllSource() {
  let text = '';
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIR.has(entry.name)) walk(full);
      } else if (SOURCE_FILE.test(entry.name)) {
        text += readFileSync(full, 'utf8');
      }
    }
  };
  for (const dir of SOURCE_DIRS) walk(join(WEB_ROOT, dir));
  return text;
}

export function makeIsLive(source) {
  const cache = new Map();
  return function isLive(cls) {
    const hit = cache.get(cls);
    if (hit !== undefined) return hit;
    let live = source.includes(cls);
    if (!live) {
      // Dynamic construction: `kind-menu-layout-${slug}` leaves only the prefix
      // in source. Any prefix ending in `-` counts, shortest length 4 so that a
      // stub like `a-` cannot resurrect the whole sheet.
      for (let i = cls.length - 1; i > 3 && !live; i--) {
        if (cls[i] === '-' && source.includes(cls.slice(0, i + 1))) live = true;
      }
    }
    cache.set(cls, live);
    return live;
  };
}

const CLASS_IN_SELECTOR = /\.[a-zA-Z][a-zA-Z0-9_-]*/g;

export function classesIn(selector) {
  return (selector.match(CLASS_IN_SELECTOR) ?? []).map((s) => s.slice(1));
}

/**
 * Rules whose every selector is dead.
 *
 * Returns the postcss nodes so a caller can either report them or remove them —
 * the audit and the codemod must not disagree about what "dead" means, which is
 * why neither of them re-implements this.
 */
export function findDeadRules(cssText, isLive) {
  const root = postcss.parse(cssText);
  const dead = [];

  const selectorIsDead = (selector) => {
    const classes = classesIn(selector);
    // A selector with no class at all (`body`, `:root`, `h2`) is never dead by
    // this test — element and variable rules are outside what source scanning
    // can decide.
    if (classes.length === 0) return false;
    return classes.every((cls) => !isLive(cls));
  };

  root.walkRules((rule) => {
    // Keyframe steps (`0%`, `from`) parse as rules and carry no classes; the
    // `classes.length === 0` guard already excludes them, but skipping the
    // parent outright keeps the intent legible.
    if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
    const selectors = rule.selectors ?? [];
    if (selectors.length > 0 && selectors.every(selectorIsDead)) dead.push(rule);
  });

  return { root, dead };
}

export function summarise(dead) {
  const byFamily = {};
  let bytes = 0;
  for (const rule of dead) {
    bytes += rule.toString().length;
    for (const cls of classesIn(rule.selector)) {
      const family = cls.split('-')[0];
      byFamily[family] = (byFamily[family] ?? 0) + 1;
    }
  }
  return { count: dead.length, bytes, byFamily };
}
