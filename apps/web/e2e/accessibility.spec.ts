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

// Only routes that render their own content to a signed-out visitor belong here.
//
// `/achievements` and `/privacy-center` used to be on this list and were NOT
// public: both call `requireUser()` and 307 to `/login`. Playwright follows that
// redirect, so the sweep was scanning the *login page* twice under their names —
// reporting coverage it did not have, and passing while testing nothing. The
// assertion in the loop below now makes that impossible; they are removed here
// because they are genuinely auth-gated by design, not because the gate is
// inconvenient.
//
// Deliberately excluded for the same "it would scan something else" reason:
// `/create`, `/profile`, `/*/manage` (redirect to /login), `/donor` (signed-in
// donor dashboard), `/beneficiary/accept` (token-gated invite flow). Covering
// those needs a real session — see the auth-gated sweep, not this one.
const PUBLIC_ROUTES = [
  '/', '/about-us', '/ai-campaign', '/ai-fundraising', '/blog',
  '/campaigns', '/contact', '/events', '/faq', '/features',
  '/features/fundraising-core', '/fees', '/fast-payouts', '/for-donors',
  '/for-individuals', '/for-nonprofits', '/forgot-password', '/grants', '/help',
  '/how-it-works', '/impact', '/leaderboard', '/matching', '/offline', '/pricing',
  '/privacy', '/prohibited-use', '/refunds', '/security', '/sponsor',
  '/success-stories', '/supported-countries', '/terms', '/transparency',
  '/trust-safety', '/volunteer',
] as const;

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
      //
      // Playwright follows redirects silently, so a route that 307s to /login (or
      // to any auth wall) gets scanned as if it were the real page: axe finds the
      // login page clean and the run goes green having tested nothing. That is a
      // false pass in the most dangerous direction, and it was live here —
      // /achievements and /privacy-center were both on the public list while both
      // redirected to /login.
      //
      // The same trap applies to external targets: pointing PLAYWRIGHT_BASE_URL at
      // a Vercel preview sends every route to the Vercel SSO wall, which would
      // otherwise scan clean 36 times. Comparing pathnames catches both.
      const landed = new URL(page.url()).pathname.replace(/\/$/, '') || '/';
      const asked = route.replace(/\/$/, '') || '/';
      expect(
        landed,
        `${route} redirected to ${landed} — the scan would have measured that page, ` +
          `not ${route}. Either it is not public (remove it from PUBLIC_ROUTES) or ` +
          `the redirect is a bug.`,
      ).toBe(asked);

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
