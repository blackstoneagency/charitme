import { expect, test } from '@playwright/test';
import { resolveRoutes } from './data-routes';
import { PUBLIC_ROUTES, expectNoRedirect } from './public-routes';

// This accessibility sweep walks every public route in one test. Supabase-backed pages cost
// several seconds each when the database is a placeholder (CI), so the default
// 30s cap is far too tight — the sweep was timing out rather than failing on a
// real defect, which is why it could never gate CI.
test.setTimeout(600_000);

test('public routes meet baseline document accessibility', async ({ page, request }) => {
  // Data-dependent routes are skipped when the database is not seeded, so this
  // sweep can gate CI without silently dropping static-route regressions.
  const { usable, skipped } = await resolveRoutes(request, PUBLIC_ROUTES);
  if (skipped.length > 0) test.info().annotations.push({ type: 'skipped-unseeded', description: skipped.join(', ') });
  for (const route of usable) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), route).toBeLessThan(400);
    // A 307 to /login also arrives here as a 200 once followed, so the status
    // check alone cannot tell us we are looking at `route`. This can.
    expectNoRedirect(page, route);
    await expect(page.locator('body'), route).toBeVisible();

    const audit = await page.evaluate(() => ({
      language: document.documentElement.lang,
      unnamedButtons: Array.from(document.querySelectorAll('button')).filter((element) => {
        const label = element.getAttribute('aria-label') ?? element.textContent ?? '';
        return !label.trim() && !element.hasAttribute('aria-hidden');
      }).length,
      unnamedLinks: Array.from(document.querySelectorAll('a')).filter((element) => {
        const label = element.getAttribute('aria-label') ?? element.textContent ?? '';
        return !label.trim() && !element.hasAttribute('aria-hidden');
      }).length,
      imagesWithoutAlt: Array.from(document.querySelectorAll('img')).filter((element) => !element.hasAttribute('alt')).length,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }));

    expect(audit.language, route).toBeTruthy();
    expect(audit.unnamedButtons, route).toBe(0);
    expect(audit.unnamedLinks, route).toBe(0);
    expect(audit.imagesWithoutAlt, route).toBe(0);
    expect(audit.horizontalOverflow, route).toBe(false);
  }
});
