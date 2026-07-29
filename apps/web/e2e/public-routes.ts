import { expect, type Page } from '@playwright/test';
import routeData from './public-routes.json';

export type DynamicRouteSample = {
  template: string;
  path: string;
};

export type ExpectedRedirect = {
  from: string;
  to: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared public-route list + the guard that keeps it honest.
//
// Five specs/scripts each carried their own hardcoded copy of this list, and all
// five were wrong in the same way: `/achievements` and `/privacy-center` were
// listed as public while both call `requireUser()` and 307 to `/login`.
// Playwright follows redirects, so every sweep audited the login page under two
// other names — and passed, because the login page is fine.
//
// Measured, not assumed:
//   /achievements:   asserted status=200 | landed=/login | h1="Welcome back."
//   /privacy-center: asserted status=200 | landed=/login | h1="Something went wrong"
//
// One list, plus an assertion that the page under the microscope is the page we
// asked for.
// ─────────────────────────────────────────────────────────────────────────────

/** Routes that render their own content to a signed-out visitor. */
export const PUBLIC_ROUTES: readonly string[] = routeData.public;

/** Routes that redirect or need a session — auditing these needs a signed-in sweep. */
export const AUTH_GATED_ROUTES: readonly string[] = routeData.authGated.routes;

/** Static dashboard/admin pages that must render their own content when signed in. */
export const AUTH_GATED_CONSOLES: readonly string[] = routeData.authGated.consoles;

/** Intentional compatibility aliases and their exact destinations. */
export const AUTH_GATED_REDIRECTS: readonly ExpectedRedirect[] = routeData.authGated.redirects;

/** Populated URLs paired one-to-one with every parameterized signed-in template. */
export const AUTH_GATED_DYNAMIC_SAMPLES: readonly DynamicRouteSample[] =
  routeData.authGated.dynamicSamples;

/** Normalise for comparison: drop a trailing slash, keep root as "/". */
export function normalizePath(path: string): string {
  return path.replace(/\/$/, '') || '/';
}

/**
 * Fail if the browser ended up somewhere other than `route`.
 *
 * Call this after `page.goto` and before asserting anything about the page.
 * Without it a redirect to an auth wall is invisible: the response is a 200, the
 * body is valid, and every check passes against a page nobody meant to test.
 * The same trap applies to external targets — pointing PLAYWRIGHT_BASE_URL at a
 * Vercel preview sends every route to the Vercel SSO wall.
 */
export function expectNoRedirect(page: Page, route: string): void {
  const landed = normalizePath(new URL(page.url()).pathname);
  expect(
    landed,
    `${route} redirected to ${landed} — this check would have measured that page, ` +
      `not ${route}. Either it is not public (move it to authGated in ` +
      `public-routes.json) or the redirect is a bug.`,
  ).toBe(normalizePath(route));
}
