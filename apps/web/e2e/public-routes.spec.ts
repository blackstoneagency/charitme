import { expect, test } from '@playwright/test';

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

test('public routes render successfully', async ({ page }) => {
  for (const route of PUBLIC_ROUTES) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), route).toBeLessThan(400);
    await expect(page.locator('body'), route).toBeVisible();
  }
});
