import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPTS = join(__dirname, '..', 'scripts');
const read = (f: string) => readFileSync(join(SCRIPTS, f), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// The audit sweeps must fail loudly rather than pass vacuously.
//
// This project's recurring defect is "a check that passed while measuring the
// wrong thing" — five route lists that audited /login, a responsive sweep green
// through 222 renders while the nav overlapped the header. Two more instances,
// both found by running the sweeps rather than reading them:
//
//  • audit-web-vitals and audit-responsive default to :3000 and reported
//    findings-shaped noise against a dead port (fixed earlier with preflights).
//  • audit-scroll-keyboard took a POSITIONAL base while the other two take
//    `--base`. Passing `--base <url>` made the base literally "--base", every
//    navigation failed, and it printed "No keyboard-unreachable scrollable
//    regions" — a green result from zero successful page loads.
//
// A disagreement in CLI shape is not cosmetic when it silently disables a check.
// ─────────────────────────────────────────────────────────────────────────────

const BROWSER_SWEEPS = [
  'audit-scroll-keyboard.mjs',
  'audit-responsive.mjs',
  'audit-web-vitals.mjs',
];

describe('every browser sweep refuses to run against a dead base URL', () => {
  for (const file of BROWSER_SWEEPS) {
    it(`${file} preflights the base URL`, () => {
      // Asserted behaviourally, not by prose: the three sweeps word the message
      // differently ("Nothing usable on" / "Nothing is listening on") and
      // pinning the wording would make this test about copy rather than about
      // whether the guard exists.
      const src = read(file);
      expect(src, `${file} does not probe the base before sweeping`).toMatch(/await fetch\(BASE/);
      expect(src, `${file} does not abort on an unusable base`).toMatch(/process\.exit\(2\)/);
      expect(src, `${file} does not tell the operator how to fix it`).toMatch(/pass --base <url>/);
    });
  }
});

describe('every browser sweep accepts --base', () => {
  for (const file of BROWSER_SWEEPS) {
    it(`${file} understands the same flag as the others`, () => {
      // The whole point: one shared invocation shape, so passing the flag the
      // other sweeps use cannot silently become the URL.
      expect(read(file), `${file} does not parse --base`).toMatch(/--base/);
    });
  }
});

describe('the keyboard sweep cannot report green from zero measurements', () => {
  const src = read('audit-scroll-keyboard.mjs');

  it('counts successful navigations', () => {
    expect(src).toMatch(/navigated\+\+/);
    expect(src).toMatch(/navFailed\+\+/);
  });

  it('exits non-zero when nothing loaded', () => {
    expect(src).toMatch(/if \(navigated === 0\)/);
    expect(src).toMatch(/nothing was audited/);
  });

  it('exits non-zero when most pages failed to load', () => {
    // A handful of failures is noise; half of them means the result is not
    // evidence of anything.
    expect(src).toMatch(/navFailed > attempted \/ 2/);
  });

  it('prints the denominator so a partial sweep is visible', () => {
    expect(src).toMatch(/Audited \$\{navigated\}\/\$\{attempted\}/);
  });

  it('still accepts a bare positional base for compatibility', () => {
    expect(src).toMatch(/argv\.slice\(2\)\.find\(\(a\) => !a\.startsWith\('--'\)\)/);
  });
});
