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
    // The inline parser this used to assert on moved into scripts/lib/audit-base.mjs
    // when all the audits were unified on one resolver. The behaviour it protects —
    // a bare positional URL still works — is unchanged, and is now covered directly
    // by __tests__/audit-base-resolution.test.ts rather than by matching source text.
    expect(source).toMatch(/resolveBase\(/);
    expect(source).toMatch(/from '\.\/lib\/audit-base\.mjs'/);
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
const a11ySource = readFileSync(
  path.join(WEB_ROOT, 'scripts', 'audit-a11y.mjs'),
  'utf8',
);
const packageJson = JSON.parse(
  readFileSync(path.join(WEB_ROOT, 'package.json'), 'utf8'),
) as { scripts: Record<string, string> };
const ciWorkflow = readFileSync(
  path.resolve(WEB_ROOT, '../..', '.github', 'workflows', 'ci.yml'),
  'utf8',
);

describe('signed-in audit integrity', () => {
  it('fails pages that return errors, revert themes, throw, or render empty', () => {
    expect(contrastSource).toContain('response.status() >= 400');
    expect(contrastSource).toContain("getAttribute('data-theme')");
    expect(contrastSource).toContain('activeTheme !== theme');
    // ⚠️ The catch still counts a failure — but it now skips a route declared in
    // `e2e/data-dependent-routes.json` first, because such a route can fail by
    // never completing navigation when the database is unreachable. The pattern
    // therefore no longer has `failures++` immediately after `catch (e) {`.
    //
    // Asserted as TWO facts rather than one loosened regex, so this cannot pass
    // if the skip is ever widened into an unconditional swallow:
    //   1. the catch still increments `failures` somewhere;
    //   2. the only early exit from it is gated on `dataDependent`.
    expect(contrastSource).toMatch(/catch \(e\) \{[\s\S]{0,900}?failures\+\+/);
    expect(contrastSource).toMatch(/catch \(e\) \{[\s\S]{0,600}?dataDependent\.includes\(path\)/);
    expect(contrastSource).toContain('CONTRAST_MIN_TEXT');
    expect(contrastSource).toContain('failures += emptyRenders.length');
  });

  it('gives thin client-rendered states one bounded settle retry', () => {
    expect(contrastSource).toContain('CONTRAST_THIN_THRESHOLD ?? 14');
    expect(contrastSource).toContain('initialCount >= thinThreshold');
    expect(contrastSource).toContain('setTimeout(resolve, 2_000)');
    expect(contrastSource).toContain('return countVisibleLeafText()');
  });

  it('uses Playwright browser discovery unless an explicit override is supplied', () => {
    // The property is unchanged — discovery with an env override, never a hardcoded
    // sandbox path as THE executable — but it moved into scripts/lib/audit-browser.mjs
    // when all the audits were unified on one resolver. Assert it where it now lives,
    // and that audit-contrast actually uses it.
    expect(contrastSource).toContain('resolveChromium()');
    expect(contrastSource).not.toContain("executablePath: '/opt/pw-browsers/chromium'");

    const browserHelper = readFileSync(
      path.join(WEB_ROOT, 'scripts', 'lib', 'audit-browser.mjs'),
      'utf8',
    );
    expect(browserHelper).toContain('PLAYWRIGHT_CHROMIUM_PATH');
    expect(browserHelper).toContain('chromium.executablePath()');
    // Every candidate is existence-checked, so a stale path never beats a real one —
    // the omission that left the signed-in sweep unable to launch at all.
    expect(browserHelper).toContain('existsSync(candidate)');
    expect(browserHelper).toContain("'/opt/pw-browsers/chromium'");
    // Explicit override must win over both.
    expect(browserHelper.indexOf('PLAYWRIGHT_CHROMIUM_PATH'))
      .toBeLessThan(browserHelper.indexOf("'/opt/pw-browsers/chromium'"));
  });

  it('starts Next portably and verifies the build target for BOTH roles', () => {
    expect(signedInSource).toContain("require.resolve('next/dist/bin/next')");
    expect(signedInSource).not.toContain("spawnChild('npx'");
    // The probe is mode-aware, and each route proves both halves of what is
    // needed: `/admin` renders only for an admin, `/dashboard` renders 200 only
    // for a non-admin. Probing the wrong one would either fail on a correct
    // build or pass on a build with no admin grant at all.
    expect(signedInSource).toContain("const probePath = AS_MEMBER ? '/dashboard' : '/admin'");
    expect(signedInSource).toContain('`${BASE}${probePath}`');
  });

  it('switches the FIXTURE USER for --no-admin, not just the env var', () => {
    // Clearing ADMIN_EMAILS is not enough: `isAdmin` also reads the profile's
    // `roles` array, and the default fixture carries admin + super_admin. With
    // only the env var changed the sweep stayed an admin and /dashboard kept
    // redirecting — which is how the member dashboard went unmeasured by every
    // audit in this repo.
    expect(signedInSource).toContain("const AS_MEMBER = process.argv.slice(2).includes('--no-admin')");
    expect(signedInSource).toContain('00000000-0000-4000-8000-000000000012');
    // The stub resolves the persona from the bearer token, so that must switch too.
    expect(signedInSource).toContain("const USER_TOKEN = AS_MEMBER ? 'stub-organizer-access-token'");
  });

  it('refuses occupied app and stub ports before launching either service', () => {
    expect(signedInSource).toContain("from './lib/audit-port.mjs'");
    expect(signedInSource).toContain("assertPortAvailable(APP_PORT, 'Next app')");
    expect(signedInSource).toContain("assertPortAvailable(STUB_PORT, 'Supabase stub')");
    expect(signedInSource.indexOf('await Promise.all(['))
      .toBeLessThan(signedInSource.indexOf("spawnChild(process.execPath, ['scripts/supabase-stub.mjs'"));
  });

  it('passes machine-readable output through without orchestration text', () => {
    expect(signedInSource).toContain("const AS_JSON = argv.includes('--json')");
    expect(signedInSource).toContain("...(AS_JSON ? ['--json'] : [])");
    expect(signedInSource).toContain('if (!AS_JSON) console.log');
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

  it('enforces the signed-in contrast sweep in CI', () => {
    expect(ciWorkflow).toContain('Signed-in contrast audit (WCAG AA, both themes)');
    expect(ciWorkflow).toContain('npm run audit:signed-in -- --port 3310 --stub-port 55432');
  });

  it('makes the live authenticated axe sweep fail on broken pages or theme drift', () => {
    expect(authedSource).toContain('chromium.executablePath()');
    expect(authedSource).toContain('response.status() >= 400');
    expect(authedSource).toContain('activeTheme !== theme');
    expect(authedSource).toContain('errors++');
    expect(authedSource).toContain('if (errors > 0)');
  });
});

describe('public accessibility audit integrity', () => {
  it('rejects HTTP errors and unexpected redirects before running axe', () => {
    expect(a11ySource).toContain('response.status() >= 400');
    expect(a11ySource).toContain('actualPath !== expectedPath');
    expect(a11ySource.indexOf('response.status() >= 400'))
      .toBeLessThan(a11ySource.indexOf('new AxeBuilder'));
  });

  it('supports a validated targeted route for fast regression certification', () => {
    expect(a11ySource).toContain("process.argv.indexOf('--only')");
    expect(a11ySource).toContain('Unknown public audit route');
  });
});
