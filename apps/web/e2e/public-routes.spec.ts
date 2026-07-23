import { expect, test } from '@playwright/test';

const PUBLIC_ROUTES = [
  '/',
  '/about-us',
  '/achievements',
  '/blog',
  '/campaigns',
  '/contact',
  '/faq',
  '/features',
  '/fees',
  '/for-donors',
  '/for-individuals',
  '/for-nonprofits',
  '/grants',
  '/help',
  '/how-it-works',
  '/offline',
  '/pricing',
  '/privacy',
  '/refunds',
  '/security',
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
