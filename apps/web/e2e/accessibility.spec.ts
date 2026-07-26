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


const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];


/** One test per theme so a failure names the theme without re-running everything. */
for (const theme of ['light', 'dark'] as const) {
  test(`public routes have no WCAG A/AA violations (${theme})`, async ({ page, request }) => {
    test.setTimeout(900_000);

    const { usable, skipped } = await resolveRoutes(request, PUBLIC_ROUTES);
    if (skipped.length > 0) {
      test.info().annotations.push({ type: 'skipped-unseeded', description: skipped.join(', ') });
    }

    const failures: string[] = [];

    for (const route of usable) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      // Scan the page we asked for, or fail — never something we were sent to.
      // (Shared with the other public sweeps; see public-routes.ts for why.)
      expectNoRedirect(page, route);

      // The app reads its theme from data-theme on <html>; set it before scanning
      // so colour-contrast rules evaluate the colours a visitor actually gets.
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
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
