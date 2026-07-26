import { expect, test } from '@playwright/test';
import { resolveRoutes } from './data-routes';

// This accessibility sweep walks every public route in one test. Supabase-backed pages cost
// several seconds each when the database is a placeholder (CI), so the default
// 30s cap is far too tight — the sweep was timing out rather than failing on a
// real defect, which is why it could never gate CI.
test.setTimeout(600_000);

const PUBLIC_ROUTES = [
  '/', '/about-us', '/achievements', '/ai-campaign', '/ai-fundraising', '/blog',
  '/campaigns', '/campaigns/security-header-fixture/embed', '/contact', '/events',
  '/faq', '/features', '/features/fundraising-core', '/fees', '/fast-payouts',
  '/for-donors', '/for-individuals', '/for-nonprofits', '/grants', '/help',
  '/how-it-works', '/leaderboard', '/matching', '/offline', '/pricing', '/privacy',
  '/privacy-center', '/prohibited-use', '/refunds', '/security', '/sponsor',
  '/success-stories', '/supported-countries', '/terms', '/transparency',
  '/trust-safety', '/volunteer',
] as const;

test('public routes meet baseline document accessibility', async ({ page, request }) => {
  // Data-dependent routes are skipped when the database is not seeded, so this
  // sweep can gate CI without silently dropping static-route regressions.
  const { usable, skipped } = await resolveRoutes(request, PUBLIC_ROUTES);
  if (skipped.length > 0) test.info().annotations.push({ type: 'skipped-unseeded', description: skipped.join(', ') });
  for (const route of usable) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), route).toBeLessThan(400);
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
