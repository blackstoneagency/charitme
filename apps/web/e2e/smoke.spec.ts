import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });
test.setTimeout(60_000);

test('homepage presents CharitMe trust positioning', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('CharitMe').first()).toBeVisible();
  await expect(page.getByText('0%').first()).toBeVisible();
  await expect(page.getByText('Create My Fundraiser Now!').first()).toBeVisible();
});

test('pricing page shows transparent fee model', async ({ page }) => {
  await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Accept donations (0% platform fee)')).toBeVisible();
  await expect(page.getByText('CharitMe Boost')).toBeVisible();
});
