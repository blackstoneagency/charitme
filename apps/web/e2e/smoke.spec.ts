import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });
test.setTimeout(60_000);

test('homepage presents CharitMe trust positioning', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('CharitMe').first()).toBeVisible();
  await expect(page.getByText('0%').first()).toBeVisible();

  // ⚠️ This used to assert the copy "Create My Fundraiser Now!", which the
  // two-column hero rework deleted — the homepage has said "Start a Fundraiser"
  // for several commits while this spec still demanded the old string. It went
  // unnoticed because the e2e job has had no runner assigned since the Actions
  // allowance ran out, so nothing executed it.
  //
  // The replacement asserts the two things the homepage must actually offer,
  // by ROLE and DESTINATION rather than by exact wording: a donor path and a
  // fundraiser path. A copy tweak no longer breaks it; a missing or misrouted
  // call to action still does, which is the failure worth catching.
  const donate = page.getByRole('link', { name: /donate now/i }).first();
  await expect(donate).toBeVisible();
  await expect(donate).toHaveAttribute('href', '/campaigns');

  await expect(
    page.getByRole('link', { name: /start a fundraiser/i }).first(),
  ).toBeVisible();
});

test('pricing page shows transparent fee model', async ({ page }) => {
  await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Accept donations (0% platform fee)')).toBeVisible();
  await expect(page.getByText('CharitMe Boost')).toBeVisible();
});
