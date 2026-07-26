import { expect, test } from '@playwright/test';
import { resolveRoutes } from './data-routes';

// This route sweep walks every public route in one test. Supabase-backed pages cost
// several seconds each when the database is a placeholder (CI), so the default
// 30s cap is far too tight — the sweep was timing out rather than failing on a
// real defect, which is why it could never gate CI.
test.setTimeout(600_000);

const PUBLIC_ROUTES = [
  '/',
  '/about-us',
  '/achievements',
  '/ai-campaign',
  '/ai-fundraising',
  '/blog',
  '/campaigns',
  '/campaigns/security-header-fixture/embed',
  '/contact',
  '/events',
  '/faq',
  '/features',
  '/features/fundraising-core',
  '/fees',
  '/fast-payouts',
  '/for-donors',
  '/for-individuals',
  '/for-nonprofits',
  '/grants',
  '/help',
  '/how-it-works',
  '/leaderboard',
  '/matching',
  '/offline',
  '/pricing',
  '/privacy',
  '/privacy-center',
  '/prohibited-use',
  '/refunds',
  '/security',
  '/sponsor',
  '/success-stories',
  '/supported-countries',
  '/terms',
  '/transparency',
  '/trust-safety',
  '/volunteer',
] as const;

test('public routes render successfully', async ({ page, request }) => {
  const { usable, skipped } = await resolveRoutes(request, PUBLIC_ROUTES);
  if (skipped.length > 0) test.info().annotations.push({ type: 'skipped-unseeded', description: skipped.join(', ') });
  for (const route of usable) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), route).toBeLessThan(400);
    await expect(page.locator('body'), route).toBeVisible();
  }
});
