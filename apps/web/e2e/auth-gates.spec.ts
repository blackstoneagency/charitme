import { expect, test } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// Auth gates — the security boundary in middleware.ts had NO browser coverage.
//
// Everything auth-gated (the whole dashboard and admin surface) was untested
// end-to-end: nothing verified that an unauthenticated visitor is actually kept
// out, that the post-login return path is preserved, or that the deliberate
// public exception under a protected prefix still works.
//
// Signing IN cannot be tested here — that needs real Supabase credentials, which
// CI does not have (see docs / todo.md, owner-gated). But the half that matters
// most for safety is testable without them: a visitor with no session must never
// be served a protected page. A regression that opened up /admin or /dashboard
// would previously have shipped silently.
// ─────────────────────────────────────────────────────────────────────────────

test.setTimeout(120_000);

// ⚠️ These two lists used to be hand-copied here with the comment "Mirrors
// PROTECTED in middleware.ts". They drifted, exactly as every other hand-kept
// copy in this repo has: `/create` was deliberately opened to signed-out
// visitors (the builder has a guest mode, and every write still calls
// requireUser()), and this spec went on demanding a redirect — failing CI for
// ~59 minutes per run over a change that was correct. IMPORTED now, so the
// boundary and its test cannot disagree again.
import { PROTECTED, PUBLIC_EXCEPTIONS } from '../middleware';

/**
 * Every protected prefix that is NOT itself a public exception, plus deeper
 * paths under each — a prefix guard that only checked exact matches would pass
 * the first list and leak the second.
 */
const PROTECTED_PATHS = [
  ...PROTECTED.filter((p) => !PUBLIC_EXCEPTIONS.includes(p)),
  '/dashboard/campaigns',
  '/admin/marketing',
  '/admin/marketing/goals',
];

test('protected routes redirect an unauthenticated visitor to login', async ({ page }) => {
  for (const path of PROTECTED_PATHS) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    // Landing anywhere other than /login would mean a protected page was served
    // (or partially rendered) to someone with no session.
    expect(new URL(page.url()).pathname, `${path} should redirect to /login`).toBe('/login');
  }
});

test('the login redirect preserves where the visitor was heading', async ({ page }) => {
  await page.goto('/dashboard/campaigns', { waitUntil: 'domcontentloaded' });
  const url = new URL(page.url());
  expect(url.pathname).toBe('/login');
  // Without `next`, every gated visit dumps the user on a generic dashboard and
  // they have to find their way back by hand.
  expect(url.searchParams.get('next')).toBe('/dashboard/campaigns');
});

test('the next parameter cannot be used as an open redirect', async ({ page }) => {
  // A protected path is what populates `next`, so it must always be same-origin.
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  const next = new URL(page.url()).searchParams.get('next');
  expect(next, 'next should be present').toBeTruthy();
  expect(next!.startsWith('/'), 'next must be a relative path').toBe(true);
  expect(next!.startsWith('//'), 'next must not be protocol-relative').toBe(false);
  expect(next!.toLowerCase()).not.toContain('http');
});

test('public exceptions under a protected prefix stay reachable', async ({ page }) => {
  for (const path of PUBLIC_EXCEPTIONS) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), path).toBeLessThan(400);
    // The whole point of the exception: visible before sign-in.
    expect(new URL(page.url()).pathname, `${path} must not redirect to login`).toBe(path);
  }
});

test('protected API routes reject an unauthenticated caller instead of redirecting', async ({ request }) => {
  // API routes are excluded from the middleware matcher, so each handler owns its
  // own auth check. A redirect (or a 200) here would mean the handler is not
  // gating at all — the exact class of bug that leaks data.
  for (const endpoint of ['/api/campaigns/draft', '/api/admin/marketing/goals']) {
    const res = await request.get(endpoint, { maxRedirects: 0 });
    expect([401, 403], `${endpoint} returned ${res.status()}`).toContain(res.status());
  }
});
