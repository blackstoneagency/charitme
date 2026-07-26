import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { resolveRoutes } from './data-routes';

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

const PUBLIC_ROUTES = [
  '/', '/about-us', '/achievements', '/ai-campaign', '/ai-fundraising', '/blog',
  '/campaigns', '/contact', '/events', '/faq', '/features',
  '/features/fundraising-core', '/fees', '/fast-payouts', '/for-donors',
  '/for-individuals', '/for-nonprofits', '/grants', '/help', '/how-it-works',
  '/leaderboard', '/matching', '/offline', '/pricing', '/privacy',
  '/privacy-center', '/prohibited-use', '/refunds', '/security', '/sponsor',
  '/success-stories', '/supported-countries', '/terms', '/transparency',
  '/trust-safety', '/volunteer',
] as const;

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Known, pre-existing contrast failures on two branded marketing pages.
 *
 * These surfaced only once the sweep settled animations before scanning: the
 * earlier "0 violations" run sampled mid-transition, which under-reported. They
 * are NOT caused by tokenising those pages — they fail in light mode too, where
 * the token fallback is the original colour.
 *
 * `todo.md` records that branded marketing pages deliberately keep their own
 * palette rather than the app's theme tokens, so fixing these is a design decision
 * about that palette, not a mechanical token swap — and "intentional palette" does
 * not make a serious contrast failure acceptable, so they stay visible here rather
 * than being silently excluded.
 *
 * Baselined so the gate protects the other 34 routes; anything NEW fails.
 */
const KNOWN_CONTRAST_BASELINE = [
  '/features',
  '/ai-fundraising',
];

/** One test per theme so a failure names the theme without re-running everything. */
for (const theme of ['light', 'dark'] as const) {
  test(`public routes have no WCAG A/AA violations (${theme})`, async ({ page, request }) => {
    test.setTimeout(900_000);

    const { usable, skipped } = await resolveRoutes(request, PUBLIC_ROUTES);
    if (skipped.length > 0) {
      test.info().annotations.push({ type: 'skipped-unseeded', description: skipped.join(', ') });
    }

    const failures: string[] = [];
    const known: string[] = [];

    for (const route of usable) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
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
        const line = `${route} [${theme}] ${v.id} (${v.impact}) — ${v.help} → ${where}`;
        if (v.id === 'color-contrast' && KNOWN_CONTRAST_BASELINE.includes(route)) {
          known.push(line);
          continue;
        }
        failures.push(line);
      }
    }

    if (known.length > 0) {
      // Visible in the report rather than silently dropped.
      test.info().annotations.push({ type: 'known-contrast-baseline', description: known.join(' | ') });
    }
    expect(failures, `WCAG A/AA violations:\n${failures.join('\n')}`).toEqual([]);
  });
}
