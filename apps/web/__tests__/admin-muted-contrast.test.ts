import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// The muted-slate pair that fails AA in LIGHT mode.
//
// todo.md's C1 recorded "admin fails AA in *both* themes". Measured, that is
// wrong, and the correction matters because it changes what a fix has to do:
//
//        #94a3b8   on #121530 (dark s1)   6.97:1  PASS
//        #94a3b8   on #ffffff (light s1)  2.56:1  FAIL
//        #8c9ab5   on #121530             6.30:1  PASS
//        #8c9ab5   on #ffffff             2.84:1  FAIL
//
// It is a LIGHT-mode-only failure, which is precisely the kind a sweep that
// measures dark twice reports as clean — the failure mode CLAUDE.md records as
// how "a 2.56:1 light-mode failure survived". 2.56:1 is this exact pair.
//
// Fixed by using `var(--t3)`, which is token-driven and clears AA in both
// themes (5.88:1 light, 5.59:1 dark), or `#556070` where a WHITE-text badge
// background is needed (6.38:1).
//
// A `var(--t3, #94a3b8)` FALLBACK is not a violation: the literal only applies
// if the custom property is missing, which it never is.
// ─────────────────────────────────────────────────────────────────────────────

const APP = join(__dirname, '..', 'app');
const COMPONENTS = join(__dirname, '..', 'components');
const BANNED = /#94a3b8|#8c9ab5/gi;
/** `var(--token, #hex)` — the hex is a fallback, not the applied value. */
const FALLBACK = /var\(\s*--[\w-]+\s*,\s*#(?:94a3b8|8c9ab5)\s*\)/gi;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/**
 * Browser-rendered components only.
 *
 * `app/api/**` is excluded on purpose: those routes generate EMAIL bodies and a
 * QR poster, where a CSS custom property does not resolve at all. A hardcoded
 * colour is correct there, and "fixing" it would render the text invisible in
 * every mail client.
 */
function browserRendered(): string[] {
  return [...walk(APP), ...walk(COMPONENTS)].filter((f) => !f.includes('/app/api/'));
}

describe('the light-mode muted-slate failure does not come back', () => {
  const files = browserRendered();

  it('scans a real set of components', () => {
    expect(files.length).toBeGreaterThan(150);
  });

  it('no browser-rendered component applies the failing slate directly', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      // Drop fallbacks and comments before matching: both mention the colour
      // without applying it, and an assertion defeated by its own explanation
      // is worse than no assertion.
      const stripped = src
        .replace(FALLBACK, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      for (const m of stripped.matchAll(BANNED)) {
        offenders.push(`${f.slice(f.indexOf('/app') + 1 || f.indexOf('/components') + 1)}: ${m[0]}`);
      }
    }
    expect(
      offenders,
      'This slate is 2.56:1 on a white surface — an AA failure a dark-only sweep will not see. Use var(--t3), or #556070 behind white text.',
    ).toEqual([]);
  });

  it('Pill can carry a CSS custom property, not just a hex', () => {
    // It used `background: ${color}18`, appending an alpha suffix to the
    // literal — which forced every caller to pass a hex and pinned the muted
    // state to one theme. `var(--t3)18` is not valid CSS.
    const src = readFileSync(join(APP, 'admin', 'marketing', '_components', 'AdminMarketingClient.tsx'), 'utf8');
    expect(src, 'the tint must be computed with color-mix so a token works')
      .toMatch(/color-mix\(in srgb, \$\{color\}/);
    expect(src).not.toMatch(/background: `\$\{color\}18`/);
  });

  it('the API email/poster generators keep their literals', () => {
    // Guards the exclusion above: a custom property does not resolve in an
    // email client, so these MUST stay hardcoded.
    const emails = join(APP, 'api', 'campaigns');
    const hasLiteral = walk(emails).concat(
      readdirSync(emails, { recursive: true } as never) as unknown as string[],
    );
    void hasLiteral;
    const thank = readFileSync(join(emails, '[id]', 'thank', 'route.ts'), 'utf8');
    expect(thank, 'email bodies cannot use var() — the literal is correct here')
      .toMatch(/#[0-9a-f]{6}/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The wider class: text designed for a LIGHT card that goes invisible in DARK.
//
// Measured across every browser-rendered component, 36 `color: '#hex'` literals
// passed comfortably on white and failed on the dark surfaces the same card
// flips to — several below 2:1, and `#0f0f30` at **1.04:1**, which is not "low
// contrast", it is invisible. They survived because `audit:contrast` cannot log
// in, so the admin surface it lives on is never swept by a browser.
//
// This checks the RATIO, not a list of banned colours, so a newly-invented dark
// literal is caught too.
// ─────────────────────────────────────────────────────────────────────────────

function luminance(h: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('the light-designed text that went invisible in dark stays fixed', () => {
  /**
   * ⚠️ SCOPE, and why it is not the obvious general rule.
   *
   * The natural guard — "flag any literal that passes in one theme and fails in
   * the other" — FIRES ON CORRECT CODE, and I ran it before narrowing it:
   *
   *   · `/success-stories` uses `#b89eff` on a hero band whose background is a
   *     hardcoded `rgba(108,53,255,.25)` over dark. Pale violet is right there.
   *   · `app/global-error.tsx` replaces the whole document when the ROOT layout
   *     throws, so it renders its own <html>/<body> with inline styles only —
   *     the app's CSS never loaded. A token there resolves to nothing, which
   *     would make the one page that exists to explain a crash unreadable.
   *
   * Static analysis cannot see the background an element actually sits on, so it
   * cannot tell those apart from a literal pinned inside a token-driven card. A
   * guard that fails on correct code gets switched off, so this is scoped to a
   * REGRESSION check on the 35 sites that were measured, inspected one by one,
   * and fixed — not a general rule the codebase cannot satisfy.
   *
   * The general case needs a signed-in browser sweep, which is blocked on the
   * owner-provided test login.
   */
  const FIXED = [
    '#0f0f30', '#101944', '#334064', '#334155', '#3b4a74', '#4a154b',
    '#475569', '#4b5676', '#7035ff', '#551cf2', '#4338ca', '#1d4ed8',
    '#1e40af', '#9d174d', '#0f6e3f', '#155e75',
  ];

  /**
   * The donation widget renders inside a THIRD-PARTY page whose background this
   * app does not control, so a theme token could resolve against a surface the
   * host chose. Exempt by path, and the exemption is asserted so it cannot widen.
   */
  const HOST_CONTEXT = 'app/campaigns/[slug]/embed/page.tsx';

  it('none of the fixed literals came back as a text colour', () => {
    const back: string[] = [];
    for (const f of browserRendered()) {
      if (f.endsWith(HOST_CONTEXT)) continue;
      const src = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      for (const m of src.matchAll(/\bcolor\s*:\s*'(#[0-9a-fA-F]{6})'/g)) {
        if (FIXED.includes(m[1].toLowerCase())) back.push(`${f.slice(f.indexOf('/app') + 1)}: ${m[1]}`);
      }
    }
    expect(
      back,
      'These read fine on a white card and drop below 3:1 — one of them to 1.04:1 — on the dark surface the same card flips to. Use a token so they flip too.',
    ).toEqual([]);
  });

  it('the ratio maths is right (guards the guard)', () => {
    expect(contrast('#0f0f30', '#121530')).toBeLessThan(1.1);   // measured 1.04
    expect(contrast('#0f0f30', '#ffffff')).toBeGreaterThan(17); // measured 17.45
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 0);
    // And the replacements actually clear the bar they were chosen for.
    expect(contrast('#e2e8f8', '#121530')).toBeGreaterThan(4.5); // --t1 dark
    expect(contrast('#0f1238', '#ffffff')).toBeGreaterThan(4.5); // --t1 light
  });

  it('the host-context exemption is still needed', () => {
    // If the embed stops carrying such a literal, delete the exemption rather
    // than leaving it as dead permission.
    const src = readFileSync(join(__dirname, '..', HOST_CONTEXT), 'utf8');
    expect(src).toMatch(/color:\s*'#[0-9a-fA-F]{6}'/);
  });
});
