import { expect, test } from '@playwright/test';

test('campaign creation offers exactly two working paths', async ({ page }) => {
  await page.goto('/create', { waitUntil: 'domcontentloaded' });
  expect(new URL(page.url()).pathname).toBe('/create');

  const cards = page.locator('.cm-choose-card');
  await expect(cards).toHaveCount(2);
  await expect(page.getByRole('link', { name: /Build with AI About 3 minutes/i })).toHaveAttribute('href', '/ai-campaign');
  await expect(page.getByRole('link', { name: /Step by step About 8 minutes/i })).toHaveAttribute('href', '/create?path=guided');

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(0);

  await page.getByRole('link', { name: /Step by step About 8 minutes/i }).click();
  await expect(page).toHaveURL(/\/create\?path=guided/);
  await expect(page.getByRole('heading', { name: 'Name Your Campaign' })).toBeVisible();
});

test('AI intake explains invalid input before authentication', async ({ page }) => {
  await page.goto('/ai-campaign', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Build my campaign/i }).click();
  await expect(page.locator('.ai-intake-error')).toContainText('Tell us a little more');
  await expect(page).toHaveURL(/\/ai-campaign/);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('AI intake cannot submit before hydration', async ({ page }) => {
    await page.goto('/ai-campaign', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /Build my campaign/i })).toBeDisabled();
  });
});

test('guided creation autosaves and resumes the current question', async ({ page }) => {
  await page.goto('/create?path=guided', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Name Your Campaign' })).toBeVisible();
  await page.getByLabel('Campaign title').fill('Help Maya recover and return home');
  await expect(page.getByText('Saved', { exact: false }).first()).toBeVisible({ timeout: 5_000 });

  await page.reload({ waitUntil: 'domcontentloaded' });
  const recovery = page.getByRole('region', { name: 'Resume unfinished campaign' });
  await expect(recovery).toBeVisible();
  await recovery.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByLabel('Campaign title')).toHaveValue('Help Maya recover and return home');
  await expect(page.getByRole('heading', { name: 'Name Your Campaign' })).toBeVisible();

  await page.getByRole('button', { name: /Continue/i }).click();
  await expect(page.getByRole('heading', { name: 'Choose the Beneficiary' })).toBeVisible();
  const myself = page.getByRole('button', { name: /Myself The funds support your own need/i });
  await expect(myself).not.toHaveClass(/selected/);
  await myself.click();
  await expect(myself).toHaveClass(/selected/);
});

test('AI generation fills known fields and skips directly to the first missing question', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('charitme-ai-intake-v1', JSON.stringify({
      version: 1,
      path: 'ai',
      prompt: 'Help Maya recover after a house fire. We need $5,000 for essential repairs.',
      links: ['https://example.org/recovery-plan'],
      files: [],
      createdAt: Date.now(),
    }));
  });
  await page.route('**/api/ai/campaign', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        title: 'Help Maya rebuild after the fire',
        summary: 'Help Maya replace essentials and return home safely.',
        story: 'Maya lost essential belongings in a house fire and needs practical recovery support. Every gift will follow the documented repair plan.',
        category: 'Emergency',
        suggestedGoalCents: 500_000,
        useOfFunds: [
          { label: 'Essential repairs', amountCents: 300_000 },
          { label: 'Replacement belongings', amountCents: 125_000 },
          { label: 'Temporary housing', amountCents: 75_000 },
        ],
        socialCaption: 'Help Maya rebuild safely after a house fire.',
        longPost: 'Maya needs practical recovery support after a house fire. Please donate or share.',
        sms: 'Please help Maya rebuild: [campaign link]',
        email: 'Maya needs practical recovery support after a house fire. Thank you for considering a gift.',
        donorFaq: [{ question: 'How are funds used?', answer: 'The published budget covers repairs, belongings, and temporary housing.' }],
        donationTiers: [{ amountCents: 2500, label: 'Replace an essential item' }],
        milestones: [{ title: 'Recovery plan funded', description: 'Repairs can begin.', targetCents: 500_000 }],
        seoTitle: 'Help Maya Rebuild After a House Fire',
        seoDescription: 'Support Maya with essential repairs and temporary housing after a devastating house fire.',
        coverImageGuidance: 'Use a clear, respectful photo of Maya or the real repair work.',
        missingTrustSignals: ['Add beneficiary details'],
        qualityScore: 86,
      }),
    });
  });

  await page.goto('/create?path=ai&intake=1', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Choose the Beneficiary' })).toBeVisible();
  await page.getByRole('button', { name: /Back/i }).click();
  await expect(page.getByLabel('Campaign title')).toHaveValue('Help Maya rebuild after the fire');
  await page.getByRole('button', { name: /Continue/i }).click();

  await page.getByRole('button', { name: /Someone I know/i }).click();
  await page.getByLabel('Beneficiary Name').fill('Maya');
  await page.getByLabel('Your Relationship to Them').fill('Friend');
  await page.getByRole('button', { name: /Continue/i }).click();

  await expect(page.getByRole('heading', { name: 'Add Photos' })).toBeVisible();
});
