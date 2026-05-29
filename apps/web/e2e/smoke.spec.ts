import { expect, test } from '@playwright/test';

test('homepage presents KindFund trust positioning', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('KindFund').first()).toBeVisible();
  await expect(page.getByText('0%')).toBeVisible();
  await expect(page.getByText('Start free fundraiser')).toBeVisible();
});

test('pricing page shows transparent fee model', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByText('0% mandatory platform fee')).toBeVisible();
  await expect(page.getByText('Growth AI')).toBeVisible();
});
