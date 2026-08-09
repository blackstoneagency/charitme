import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { resolveRoutes } from './data-routes';
import { PUBLIC_ROUTES, expectNoRedirect } from './public-routes';

// ─────────────────────────────────────────────────────────────────────────────
// WCAG 2.0/2.1 A + AA, enforced.
//
// Accessibility was previously asserted by four hand-rolled checks in
// public-quality.spec.ts (document language, named buttons, named links, image
// alt text). Those are worth having, but they are a small fraction of WCAG — and
// the "axe A/AA clean across N routes" claim in the docs came from ad-hoc browser
// runs in earlier sessions. Nothing repeatable enforced it, so a regression
// shipped silently, exactly like the e2e suite that ran in no workflow.
//
// This runs the real axe-core ruleset over every public route in both light and
// dark themes (contrast rules only fire against actual rendered colours, so a
// light-only pass cannot speak for dark mode).
// ─────────────────────────────────────────────────────────────────────────────


// WCAG 2.0 / 2.1 / 2.2, A + AA — all ENFORCED, no exemptions.
//
// 2.2 was previously absent, so `target-size` (2.5.8) had never run. Enabling it
// found two things: header nav links were a 19.5px tap target on every page, and
// two "partially obscured" findings that turned out to be symptoms of a real
// layout bug — the desktop nav was rendering on top of the header controls at
// every width from 1101px to 1800px. Both are fixed (see globals.css), so 2.2
// enforces cleanly rather than needing a baseline.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];


/** One test per theme so a failure names the theme without re-running everything. */
for (const theme of ['light', 'dark'] as const) {
  test(`public routes have no WCAG A/AA violations (${theme})`, async ({ page, request }) => {
    test.setTimeout(900_000);

    const { usable, skipped } = await resolveRoutes(request, PUBLIC_ROUTES);
    if (skipped.length > 0) {
      test.info().annotations.push({ type: 'skipped-unseeded', description: skipped.join(', ') });
    }

    const failures: string[] = [];

    // Persist the theme BEFORE any navigation, the way audit-contrast.mjs does.
    //
    // This test used to set `data-theme` with page.evaluate AFTER load. The
    // ThemeProvider hydrates a moment later, reads localStorage, and OVERWRITES
    // the attribute — measured: the light run asked for "light", the attribute
    // read "light" immediately, and 250ms later at scan time it was "dark".
    //
    // So BOTH tests scanned dark mode and light was never audited at all, while
    // reporting "36 routes × light/dark, no baseline, no exemptions". A real
    // 2.56:1 light-mode failure on /ai-fundraising survived every such run.
    await page.context().addInitScript((t) => {
      try { localStorage.setItem('charitme-theme-v2', t); } catch { /* ignore */ }
    }, theme);

    for (const route of usable) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });

      if (!response || response.status() >= 400) {
        failures.push(`${route} [${theme}] HTTP ${response?.status() ?? 'NO_RESPONSE'} - route did not render`);
        continue;
      }

      // Scan the page we asked for, or fail — never something we were sent to.
      // (Shared with the other public sweeps; see public-routes.ts for why.)
      expectNoRedirect(page, route);

      // Belt and braces: the init script above is what actually holds, but assert
      // the page really is in the requested theme at scan time. A silent revert
      // is precisely the failure this test could not see before.
      await page.waitForFunction(
        (expectedTheme) => document.documentElement.getAttribute('data-theme') === expectedTheme,
        theme,
        { timeout: 2_000 },
      ).catch(() => undefined);
      const active = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      if (active !== theme) {
        failures.push(`${route} [${theme}] THEME-NOT-APPLIED — scanned as "${active}"; result would not describe ${theme} mode`);
        continue;
      }
      // Let transitions settle before scanning. Several controls animate colour
      // over ~120ms (e.g. .fee-calc-preset) and axe reads computed styles, so a
      // mid-transition sample produced a phantom colour-contrast failure that did
      // not reproduce on a fresh load.
      //
      // Note: injecting a `transition: none` stylesheet is NOT an option — the app
      // ships a strict `style-src 'self'` CSP, so page.addStyleTag is refused
      // (which is the CSP working correctly). Emulating reduced motion is both
      // CSP-safe and semantically what we want; the short settle covers anything
      // that does not honour the media query.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(250);

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      for (const v of violations) {
        // Report the rule, its impact, and one offending selector — enough to fix
        // without re-running, which matters when a full sweep takes minutes.
        const where = v.nodes[0]?.target?.join(' ') ?? '(unknown)';
        failures.push(`${route} [${theme}] ${v.id} (${v.impact}) — ${v.help} → ${where}`);
      }
    }

    expect(failures, `WCAG A/AA violations:\n${failures.join('\n')}`).toEqual([]);
  });
}
