import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const DATA_BACKED_CAMPAIGN = '/donate/stub-campaign-2';
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const;
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];

for (const viewport of VIEWPORTS) {
  test(`unified donation checkout works at ${viewport.name} width`, async ({ page }, testInfo) => {
    const browserErrors: string[] = [];
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const response = await page.goto(DATA_BACKED_CAMPAIGN, { waitUntil: 'domcontentloaded' });

    test.skip(
      !response || response.status() >= 400 || await page.getByText('Choose an amount', { exact: true }).count() === 0,
      'The target environment has no payout-ready campaign fixture.',
    );
    await page.waitForTimeout(1_000);
    expect(browserErrors, 'checkout browser errors').toEqual([]);

    const amountGroup = page.getByRole('radiogroup', { name: 'Donation amount' });
    await expect(amountGroup.getByRole('radio')).toHaveCount(6);
    const amountInput = page.getByRole('spinbutton', { name: 'Donation amount' });
    await expect(async () => {
      await amountGroup.getByRole('radio', { name: /^\$25$/ }).click();
      await expect(amountInput).toHaveValue('25');
    }).toPass({ timeout: 15_000 });
    await amountGroup.getByRole('radio', { name: /^\$50/ }).click();
    await expect(amountInput).toHaveValue('50');

    const methodButton = page.getByRole('button', { name: /^Payment method:/ });
    await expect(methodButton).toContainText('Stripe');
    await methodButton.click();
    const methodPanel = page.locator('#payment-method-panel');
    await expect(methodPanel.getByRole('radio')).toHaveCount(4);
    await methodPanel.getByRole('radio', { name: /Bank transfer/ }).check();
    await expect(methodButton).toContainText('Bank transfer');
    await expect(methodButton).toContainText('0.8% (max $5)');

    const feeButton = page.getByRole('button', { name: /^CharitMe fee:/ });
    await feeButton.click();
    const feePanel = page.locator('#service-fee-panel');
    await expect(feePanel.getByRole('radio')).toHaveCount(8);
    await feePanel.getByRole('radio', { name: /^Set support to 0 percent/ }).click();

    const breakdown = page.getByText('Breakdown', { exact: true }).locator('..');
    await expect(breakdown).toContainText('CharitMe fee (optional)');
    await expect(breakdown).toContainText('Bank transfer processing estimate');
    await expect(breakdown).toContainText('$50.40');
    await expect(page.getByRole('button', { name: /Donate to/ })).toContainText('$50.40');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(
      violations.map(({ id, impact, help, nodes }) => ({
        id,
        impact,
        help,
        target: nodes[0]?.target ?? [],
        html: nodes[0]?.html ?? '',
        failureSummary: nodes[0]?.failureSummary ?? '',
      })),
      'expanded checkout WCAG A/AA violations',
    ).toEqual([]);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
    await page.screenshot({
      path: testInfo.outputPath(`checkout-${viewport.name}.png`),
      fullPage: true,
    });
  });
}
