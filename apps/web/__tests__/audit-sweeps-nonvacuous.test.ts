import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path, { join } from 'node:path';

const WEB_ROOT = path.join(__dirname, '..');
const SCRIPTS = join(WEB_ROOT, 'scripts');
const read = (file: string) => readFileSync(join(SCRIPTS, file), 'utf8');

const BROWSER_SWEEPS = [
  'audit-scroll-keyboard.mjs',
  'audit-responsive.mjs',
  'audit-web-vitals.mjs',
];

describe('every browser sweep refuses to run against a dead base URL', () => {
  for (const file of BROWSER_SWEEPS) {
    it(`${file} preflights the base URL`, () => {
      const source = read(file);
      expect(source, `${file} does not probe the base before sweeping`).toMatch(/await fetch\(BASE/);
      expect(source, `${file} does not abort on an unusable base`).toMatch(/process\.exit\(2\)/);
      expect(source, `${file} does not tell the operator how to fix it`).toMatch(/pass --base <url>/);
    });
  }
});

describe('every browser sweep accepts --base', () => {
  for (const file of BROWSER_SWEEPS) {
    it(`${file} understands the same flag as the others`, () => {
      expect(read(file), `${file} does not parse --base`).toMatch(/--base/);
    });
  }
});

describe('the keyboard sweep cannot report green from zero measurements', () => {
  const source = read('audit-scroll-keyboard.mjs');

  it('counts successful navigations', () => {
    expect(source).toMatch(/navigated\+\+/);
    expect(source).toMatch(/navFailed\+\+/);
  });

  it('exits non-zero when nothing loaded', () => {
    expect(source).toMatch(/if \(navigated === 0\)/);
    expect(source).toMatch(/nothing was audited/);
  });

  it('exits non-zero when most pages failed to load', () => {
    expect(source).toMatch(/navFailed > attempted \/ 2/);
  });

  it('prints the denominator so a partial sweep is visible', () => {
    expect(source).toMatch(/Audited \$\{navigated\}\/\$\{attempted\}/);
  });

  it('still accepts a bare positional base for compatibility', () => {
    expect(source).toMatch(/argv\.slice\(2\)\.find\(\(a\) => !a\.startsWith\('--'\)\)/);
  });
});

const contrastSource = readFileSync(
  path.join(WEB_ROOT, 'scripts', 'audit-contrast.mjs'),
  'utf8',
);
const signedInSource = readFileSync(
  path.join(WEB_ROOT, 'scripts', 'audit-signed-in.mjs'),
  'utf8',
);
const authedSource = readFileSync(
  path.join(WEB_ROOT, 'scripts', 'audit-authed.mjs'),
  'utf8',
);
const packageJson = JSON.parse(
  readFileSync(path.join(WEB_ROOT, 'package.json'), 'utf8'),
) as { scripts: Record<string, string> };

describe('signed-in audit integrity', () => {
  it('fails pages that return errors, revert themes, throw, or render empty', () => {
    expect(contrastSource).toContain('response.status() >= 400');
    expect(contrastSource).toContain("getAttribute('data-theme')");
    expect(contrastSource).toContain('activeTheme !== theme');
    expect(contrastSource).toMatch(/catch \(e\) \{\s+failures\+\+/);
    expect(contrastSource).toContain('CONTRAST_MIN_TEXT');
    expect(contrastSource).toContain('failures += emptyRenders.length');
  });

  it('uses Playwright browser discovery unless an explicit override is supplied', () => {
    expect(contrastSource).toContain('PLAYWRIGHT_CHROMIUM_PATH');
    expect(contrastSource).not.toContain("executablePath: '/opt/pw-browsers/chromium'");
  });

  it('starts Next portably and verifies the admin build target', () => {
    expect(signedInSource).toContain("require.resolve('next/dist/bin/next')");
    expect(signedInSource).not.toContain("spawnChild('npx'");
    expect(signedInSource).toContain('`${BASE}/admin`');
  });

  it('verifies redirect contracts in a real browser', () => {
    expect(contrastSource).toContain('ROUTE_DATA.authGated.redirects');
    expect(contrastSource).toContain('actualTarget !== wantedTarget');
    expect(contrastSource).toContain('new URL(page.url())');
  });

  it('exposes the complete build-and-sweep command', () => {
    expect(packageJson.scripts['audit:signed-in']).toContain('--build');
    expect(packageJson.scripts['audit:signed-in']).toContain('--strict-gradients');
  });

  it('makes the live authenticated axe sweep fail on broken pages or theme drift', () => {
    expect(authedSource).toContain('chromium.executablePath()');
    expect(authedSource).toContain('response.status() >= 400');
    expect(authedSource).toContain('activeTheme !== theme');
    expect(authedSource).toContain('errors++');
    expect(authedSource).toContain('if (errors > 0)');
  });
});
