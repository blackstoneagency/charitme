import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// Plain ESM helper shared with scripts/audit-dead-css.mjs. The audit and this
// guard must agree on what "dead" means, so neither of them re-implements it;
// a second definition is a second answer.
import { GLOBALS, readAllSource, makeIsLive, findDeadRules, summarise } from '../scripts/lib/dead-css.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// `globals.css` ships on every route and the tracker's biggest open CSS item is
// how much of it goes unused. Splitting it per route was attempted and reverted:
// a route sheet loads AFTER globals.css, so moving a family's base rules out
// while its `@media` overrides stay behind lets the base rule win at equal
// specificity and responsive behaviour runs backwards.
//
// A rule that can match NOTHING has no such hazard, and 363 of them had
// accumulated — 36 KB, mostly whole replaced surfaces (`.hiw-*` from the old
// how-it-works, `.aiw-*` from the old AI wizard, `.dn-*` from the pre-checkout
// donate form, `.kf-*` from the old builder preview).
//
// This keeps it at zero. It is a RATCHET, not a style rule: deleting a page's
// markup and leaving its stylesheet behind is the normal way this grows, and it
// is invisible in the diff that causes it.
// ─────────────────────────────────────────────────────────────────────────────

const source = readAllSource();
const isLive = makeIsLive(source);

describe('globals.css carries no rule that cannot match', () => {
  it('has zero fully-dead rules', { timeout: 60_000 }, () => {
    const { dead } = findDeadRules(readFileSync(GLOBALS, 'utf8'), isLive);
    const { byFamily } = summarise(dead);
    expect(
      dead.map((r: { selector: string }) => r.selector),
      `dead rules by family: ${JSON.stringify(byFamily)} — run \`node scripts/audit-dead-css.mjs --fix\``,
    ).toEqual([]);
  });
});

describe('the deadness test itself', () => {
  // ⚠️ Mutation-tested in BOTH directions. A detector that flags nothing passes
  // the assertion above forever while protecting nothing, and a detector that
  // flags too much would have deleted the header's mega-menu.

  it('catches a planted dead rule', () => {
    // ⚠️ Built from fragments, and checked against an EMPTY source rather than
    // the repo's. This file lives in `__tests__`, which `readAllSource` reads —
    // so a class name written literally here is present in source and the
    // detector correctly calls it live. The planted rule would never fail, and
    // the mutation test would silently protect nothing. This repo has shipped
    // that exact bug before, in guards whose own prose satisfied them.
    const planted = `.${'zz'}-${'planted'}-${'dead'} { color: red; }`;
    const { dead } = findDeadRules(planted, makeIsLive(''));
    expect(dead).toHaveLength(1);
  });

  it('does NOT flag a class built from a template literal', () => {
    // `kind-menu-layout-explore-causes` is written nowhere; the header composes
    // it as `kind-menu-layout-${slug}`. Treating "the whole string is absent" as
    // proof of death reported 571 dead classes where there are 142.
    const dynamic = makeIsLive('const cls = `kind-menu-layout-${slug}`;');
    expect(dynamic('kind-menu-layout-explore-causes')).toBe(true);
  });

  it('keeps a compound selector alive when any one of its classes is live', () => {
    // `.hiw-page .pub-badge` styles a LIVE badge. Deleting it because the
    // ancestor is gone would change a live element.
    const mixed = makeIsLive('<span className="pub-badge" />');
    const { dead } = findDeadRules('.hiw-page .pub-badge { margin: 0; }', mixed);
    expect(dead).toEqual([]);
  });

  it('never calls an element or :root rule dead', () => {
    // Source scanning cannot decide these — there is no class to look for.
    const { dead } = findDeadRules(':root { --x: 1px; } body { margin: 0; } h2 { font-size: 1rem; }', isLive);
    expect(dead).toEqual([]);
  });

  it('reads enough source for the answer to mean anything', () => {
    // A path bug that made the scan read an empty string would report the whole
    // stylesheet dead — and `--fix` would then empty it. The tracker records a
    // near-identical `path.join(__dirname, '..')` slip that silently dropped 67
    // tests from a run while printing no failure line.
    expect(source.length).toBeGreaterThan(2_000_000);
    expect(source).toContain('kind-menu-layout-');
  });
});
