import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const WEB = resolve(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const css = read('app/globals.css');

/** Every dashboard page file, found rather than listed. */
function dashboardPages(dir = join(WEB, 'app/dashboard'), rel = 'app/dashboard'): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (!statSync(abs).isDirectory()) continue;
    if (readdirSync(abs).includes('page.tsx')) out.push(`${rel}/${entry}/page.tsx`);
    out.push(...dashboardPages(abs, `${rel}/${entry}`));
  }
  return out;
}

/**
 * `.kf-main` supplies no horizontal padding, and `.kf-topbar` carries its own.
 *
 * A page that renders content straight into `.kf-main`, or that overrides a
 * container's padding shorthand, therefore sits 32px LEFT of its own title and
 * runs flush to the right edge of the window. Measured across all 55 dashboard
 * routes in a browser, three pages did exactly that — /payment-methods (where
 * it was reported), /grants and /volunteer — while 34 were fine.
 */
describe('the dashboard body gutter exists and is responsive', () => {
  it('.kf-body is defined with a horizontal gutter', () => {
    expect(css).toMatch(/\.kf-body(?![\w-])/);
    const rule = css.slice(css.indexOf('.kf-body {'));
    expect(rule.slice(0, rule.indexOf('}'))).toMatch(/padding:\s*0\s+32px/);
  });

  it('narrows on smaller screens, like the topbar it aligns with', () => {
    // A fixed 32px gutter on a phone wastes a fifth of the width. The topbar
    // steps down to 18px and 16px; the body must follow or they diverge at
    // exactly the sizes where the misalignment is most visible.
    const bodyRules = css.match(/\.kf-body\s*\{[^}]*\}/g) ?? [];
    expect(bodyRules.length, 'no responsive .kf-body rules').toBeGreaterThanOrEqual(3);
  });
});

describe('no dashboard page zeroes its container gutter', () => {
  // The exact defect on /grants and /volunteer: `padding: '4px 0'` on an element
  // that also carries `.kf-admin-dash`. The shorthand replaces the class's
  // `0 32px 32px` wholesale, so the horizontal gutter silently became 0. It is
  // invisible in review — the class is right there in the same attribute.
  const pages = dashboardPages();

  it('finds the dashboard pages at all', () => {
    // Guards the guard: an empty list would make the sweep below pass vacuously.
    expect(pages.length).toBeGreaterThan(30);
  });

  it.each(pages)('%s keeps the horizontal padding of its layout class', (rel) => {
    // Comments stripped first. Both fixed pages carry a note EXPLAINING the bug,
    // and that note necessarily quotes the offending shorthand — matching raw
    // text fails on the explanation and teaches the next author to delete it.
    const src = read(rel)
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
    // A padding shorthand whose horizontal component is 0, on a line that also
    // names one of the gutter-bearing container classes.
    const offenders = src
      .split('\n')
      .filter((line) => /kf-admin-dash|kf-content-grid/.test(line))
      .filter((line) => /padding:\s*'[^']*\s0'/.test(line) || /padding:\s*'0[^']*'/.test(line));
    expect(offenders, `${rel} overrides its container gutter`).toEqual([]);
  });
});

describe('the reported page is fixed', () => {
  const src = read('app/dashboard/payment-methods/page.tsx');

  it('wraps its body in the shared gutter', () => {
    expect(src).toContain('className="kf-body"');
  });

  it('puts its action in the TopBar slot, not a full-width row below it', () => {
    // The button used to sit in a `space-between` row spanning the whole
    // content column, which threw it to the far right of the window — about
    // 700px from the sentence it was paired with, and past the right edge of
    // every card on the page. Every other dashboard page with a page-level
    // action uses the TopBar slot.
    expect(src).toMatch(/actions=\{loaded\.state !== 'unavailable' \? <AddMethodButton \/> : undefined\}/);
    expect(src).not.toMatch(/justifyContent: 'space-between'[\s\S]{0,400}<AddMethodButton \/>/);
  });

  it('still hides the action when the read failed', () => {
    // "Add a method" next to "we couldn't load your methods" invites someone to
    // act on a page that just told them it does not know the current state.
    expect(src).toContain("loaded.state !== 'unavailable'");
  });
});
