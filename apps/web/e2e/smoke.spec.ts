import { expect, test } from '@playwright/test';
import { INDEXABLE_PUBLIC_ROUTES } from '../lib/public-routes';

test.describe.configure({ mode: 'serial' });
test.setTimeout(60_000);

test('homepage presents CharitMe trust positioning', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('CharitMe').first()).toBeVisible();
  await expect(page.getByText('0%').first()).toBeVisible();
  await expect(page.getByText('Create My Fundraiser With AI').first()).toBeVisible();
  const csp = (await page.request.get('/')).headers()['content-security-policy'] ?? '';
  expect(csp).toContain("script-src 'self' 'nonce-");
  expect(csp).toContain("object-src 'none'");
});

test('pricing page shows transparent fee model', async ({ page }) => {
  await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Accept donations (0% platform fee)')).toBeVisible();
  await expect(page.getByText('CharitMe Boost')).toBeVisible();
});

test('all indexable public pages expose searchable metadata and AEO structured data', async ({ page }) => {
  const responses: { route: string; response: Awaited<ReturnType<typeof page.request.get>>; html: string }[] = [];
  for (const route of INDEXABLE_PUBLIC_ROUTES) {
    const response = await page.request.get(route.path);
    responses.push({ route: route.path, response, html: await response.text() });
  }

  for (const { route, response, html } of responses) {
    expect(response.ok(), `${route} should return a successful response`).toBeTruthy();
    expect(html, `${route} should include a title`).toMatch(/<title>[^<]+<\/title>/i);
    expect(html, `${route} should include a meta description`).toMatch(/<meta name="description"[^>]+content="[^"]+"/i);
    expect(html, `${route} should include structured data`).toMatch(/application\/ld\+json/i);
  }

  await page.goto('/campaigns', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/campaigns/i);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /campaign/i);

  const robots = await page.request.get('/robots.txt');
  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toContain('Sitemap:');

  const sitemap = await page.request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  expect(await sitemap.text()).toContain('/campaigns');
});

test('guest campaign builder requires sign-in before leaving location step', async ({ page }) => {
  await page.goto('/create', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Start Your Fundraiser' })).toBeVisible();

  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByRole('heading', { name: 'Pick a Category' })).toBeVisible();
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByRole('heading', { name: 'Where Are You Located?', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /continue/i }).click();

  await expect(page.getByText('Continue to your dashboard.')).toBeVisible();
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
});

test('campaign API rejects unauthenticated mutations', async ({ request }) => {
  const response = await request.post('/api/campaigns', { data: {} });
  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({ error: expect.any(String) });
});
