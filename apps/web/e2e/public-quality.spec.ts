import { expect, test } from '@playwright/test';

const PUBLIC_ROUTES = [
  '/', '/about-us', '/achievements', '/blog', '/campaigns', '/contact', '/faq',
  '/features', '/fees', '/for-donors', '/for-individuals', '/for-nonprofits',
  '/grants', '/help', '/how-it-works', '/offline', '/pricing', '/privacy',
  '/refunds', '/security', '/success-stories', '/supported-countries', '/terms',
  '/transparency', '/trust-safety', '/volunteer',
] as const;

test('public routes meet baseline document accessibility', async ({ page }) => {
  for (const route of PUBLIC_ROUTES) {
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
