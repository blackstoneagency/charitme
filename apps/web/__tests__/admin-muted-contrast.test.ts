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
