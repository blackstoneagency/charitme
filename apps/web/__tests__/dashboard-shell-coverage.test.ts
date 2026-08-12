import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Every signed-in page — dashboard AND admin — must render the shell header.
//
// THE BUG THIS EXISTS FOR: five of the 56 dashboard pages, and four of the 58
// admin pages, returned a bare `<div>` and mounted no shell at all:
//   /dashboard/notifications
//   /dashboard/campaigns/[id]/{analytics,settings,updates}
//   /dashboard/tax/fundraiser/[year]
//   /admin/{backups,incidents,retention}
//   /admin/marketing/templates
// They rendered with no sidebar, no logo, and — the part nobody notices from a
// screenshot of a working page — no theme toggle, no search, no notification
// bell and no account menu. There is no way to sign out from those screens.
//
// ⚠️ THE SECOND HALF IS THE ONE THAT CATCHES REGRESSIONS. `ShellAccountControls`
// is rendered in exactly ONE place: inside `TopBar`. A page can therefore mount
// `CharitMeShell`, look completely correct in a screenshot of the sidebar, and
// still have nothing in the top-right. Mounting the shell is not sufficient —
// the page must also render `TopBar` (or `ShellAccountControls` itself, which is
// what `/dashboard` does inside its own `dash-head`).
// ─────────────────────────────────────────────────────────────────────────────

const APP = path.join(__dirname, '..', 'app');
const rel = (f: string) => path.relative(path.join(__dirname, '..'), f);

function pageFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...pageFiles(full));
    else if (entry.name === 'page.tsx') out.push(full);
  }
  return out;
}

/**
 * A page that only calls `redirect()` renders no UI at all, so it has no header
 * to get wrong. Detected from the source rather than listed by name — a
 * hand-maintained exception list is exactly how a real page sneaks onto it.
 *
 * ⚠️ Deliberately narrow: `redirect()` must be the whole body. A page that
 * redirects CONDITIONALLY still renders UI on the other branch and is held to
 * the full requirement.
 */
function isPureRedirect(src: string): boolean {
  const body = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/[^\n]*$/gm, '')
    .replace(/^import[^\n]*$/gm, '')
    .trim();
  return /redirect\(/.test(body) && !/return\s*\(/.test(body) && !/<[A-Za-z]/.test(body);
}

for (const [console_, dir] of [['dashboard', 'dashboard'], ['admin', 'admin']] as const) {
  const root = path.join(APP, dir);
  const all = pageFiles(root);
  const rendered = all.filter((f) => !isPureRedirect(readFileSync(f, 'utf8')));

  describe(`every /${console_} page renders the signed-in shell`, () => {
    it('finds the pages at all', () => {
      // A glob that silently matches nothing would make every assertion below
      // vacuously true — the failure mode this repo has hit more than once.
      expect(all.length).toBeGreaterThan(40);
      expect(rendered.length).toBeGreaterThan(40);
    });

    it('does not classify most of them away as redirects', () => {
      // Guards the guard: if `isPureRedirect` ever became too loose it would
      // quietly excuse real pages instead of failing.
      expect(all.length - rendered.length).toBeLessThan(15);
    });

    for (const file of rendered) {
      it(`mounts CharitMeShell: ${rel(file)}`, () => {
        expect(readFileSync(file, 'utf8')).toContain('CharitMeShell');
      });
    }

    for (const file of rendered) {
      it(`renders the account controls: ${rel(file)}`, () => {
        // TopBar is the only component that renders ShellAccountControls — the
        // theme toggle, search, bell and account menu. /dashboard renders the
        // controls directly in its own header instead, which is equally fine.
        const src = readFileSync(file, 'utf8');
        expect(
          /\bTopBar\b/.test(src) || /\bShellAccountControls\b/.test(src),
          'no TopBar and no ShellAccountControls — this page would have an empty top-right',
        ).toBe(true);
      });
    }
  });

  describe(`a notFound() inside /${console_} keeps the header`, () => {
    // ⚠️ A source-level check on `page.tsx` CANNOT catch this, and that is the
    // whole point. `dashboard/campaigns/[id]/page.tsx` contains both
    // `CharitMeShell` and `TopBar`, yet `notFound()` short-circuits before any
    // of its JSX runs — so the rendered page came from the root marketing 404,
    // with no sidebar, no account menu, and no link back. It was the only one of
    // 56 routes that failed the real signed-in browser sweep.
    const file = path.join(root, 'not-found.tsx');

    it('exists, so it does not fall through to the marketing 404', () => {
      expect(() => readFileSync(file, 'utf8')).not.toThrow();
    });

    it('renders the shell and the account controls', () => {
      const src = readFileSync(file, 'utf8');
      expect(src).toContain('CharitMeShell');
      expect(src).toMatch(/\bTopBar\b/);
    });

    it(`offers a route back INTO /${console_}, not out of it`, () => {
      // The root 404 offers "Back to home" and "Browse campaigns" — both leave
      // the console, which is the wrong destination for someone signed in.
      expect(readFileSync(file, 'utf8')).toContain(`href="/${console_}"`);
    });
  });
}

describe('the shell never reaches the printer', () => {
  // `/dashboard/tax/fundraiser/[year]` is a printable tax record and now renders
  // inside the shell like every other page. Without these rules the sidebar, its
  // navigation and the account menu print onto the statement.
  const css = readFileSync(path.join(APP, 'globals.css'), 'utf8');
  const print = css.slice(css.indexOf('@media print'));

  it('hides the sidebar and topbar when printing', () => {
    expect(print).toMatch(/\.kf-sidebar,\s*\.kf-topbar\s*\{[^}]*display:\s*none/);
  });

  it('releases the shell grid so the statement is not printed in a narrow column', () => {
    expect(print).toMatch(/\.kf-app\s*\{[^}]*display:\s*block/);
  });
});
