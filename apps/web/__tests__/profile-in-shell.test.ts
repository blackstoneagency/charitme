import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(here, '..', p), 'utf8');

const page = read('app/profile/page.tsx');
const css = read('app/globals.css');

// ─────────────────────────────────────────────────────────────────────────────
// `/profile` renders INSIDE the signed-in shell, with the left navigation.
//
// It previously rendered as a standalone marketing-style page: a signed-in
// member landing on it lost the sidebar entirely and had no way back into the
// product except the browser's back button.
//
// ⚠️ The subtle half — and the reason this file exists rather than a one-line
// assertion — is the `mktg-page` wrapper. It looks like dead marketing cruft
// once the page is in the shell, and removing it is the obvious "cleanup".
// It is load-bearing: 47 dark-theme rules in globals.css are scoped to
// `.mktg-page`, and several utilities this page uses have NO unscoped dark
// rule. Dropping the wrapper leaves near-black text on the shell's dark
// surface — and the site ships dark, so that is the DEFAULT rendering.
// ─────────────────────────────────────────────────────────────────────────────

describe('/profile renders inside the signed-in shell', () => {
  it('wraps the page in CharitMeShell so the left navigation is present', () => {
    expect(page).toMatch(/import \{ CharitMeShell \} from '\.\.\/\.\.\/components\/CharitMeShellServer'/);
    expect(page).toMatch(/<CharitMeShell active=/);
    expect(page).toMatch(/<\/CharitMeShell>/);
  });

  it('does not render as a bare standalone page any more', () => {
    // The old root element. `min-h-screen` on a shell child would fight the
    // shell's own scroll container.
    expect(page).not.toMatch(/<div className="mktg-page min-h-screen">/);
  });

  it('puts the profile form above the account summary', () => {
    // Matches the requested layout: the form is the page, the stats are context
    // for it. Asserted by position so a future reshuffle is visible here.
    const form = page.indexOf('<ProfileForm');
    const stats = page.indexOf('{/* Stats banner */}');
    expect(form).toBeGreaterThan(-1);
    expect(stats).toBeGreaterThan(-1);
    expect(form, 'the form should come first').toBeLessThan(stats);
  });

  it('renders ProfileForm exactly once', () => {
    // Moving the form meant deleting its old call site. Two would double every
    // form control and every id on the page.
    expect(page.match(/<ProfileForm\b/g) ?? []).toHaveLength(1);
  });

  it('keeps the /roles link, which no persona navigation carries', () => {
    // Three of the four quick links are duplicated by the sidebar; this one is
    // not. Deleting the row as "now redundant" would orphan /roles.
    expect(page).toMatch(/href="\/roles"/);
  });
});

describe('the mktg-page wrapper is kept, and neutralised correctly', () => {
  it('is still on the page, because the dark rules hang off it', () => {
    expect(page).toMatch(/className="mktg-page/);
  });

  it('has its page background cancelled inside the shell, in BOTH themes', () => {
    // Light mode is `background: #fff` and dark mode is `background: var(--bg)`,
    // and each would paint an opaque slab over the shell's own surface. A rule
    // that only cancelled one of them would fix the theme you happened to test.
    expect(css).toMatch(/\.kf-main \.mktg-page,\s*\n\[data-theme="dark"\] \.kf-main \.mktg-page \{ background: transparent; \}/);
  });

  it('cancels ONLY the background, not the colour rules it exists for', () => {
    const rule = css.slice(css.indexOf('.kf-main .mktg-page,'));
    const decl = rule.slice(0, rule.indexOf('}'));
    expect(decl).toContain('background: transparent');
    // A `color:` or `all: unset` here would undo the very rules the wrapper is
    // being kept for.
    expect(decl).not.toMatch(/\bcolor:/);
    expect(decl).not.toMatch(/\ball:\s*unset/);
  });

  it('still carries the dark rules that have no unscoped equivalent', () => {
    // Pins the actual dependency rather than the story about it. If someone
    // gives these utilities unscoped dark rules, the wrapper can go — and this
    // test is where they will find that out.
    for (const util of ['text-slate-950', 'text-slate-700', 'border-slate-200', 'bg-red-50']) {
      const scoped = new RegExp(`\\[data-theme="dark"\\][^{]*\\.mktg-page[^{]*\\.${util}\\b`);
      const unscoped = new RegExp(`\\[data-theme="dark"\\]\\s*\\.${util}\\s*\\{`);
      expect(
        scoped.test(css),
        `${util} should still have a .mktg-page-scoped dark rule`,
      ).toBe(true);
      expect(
        unscoped.test(css),
        `${util} has gained an unscoped dark rule — the mktg-page wrapper may now be removable`,
      ).toBe(false);
    }
  });
});
