#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');
const argv = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const index = argv.indexOf(flag);
  return index === -1 ? fallback : argv[index + 1];
};

const APP_PORT = Number(argOf('--port', '3021'));
const STUB_PORT = Number(argOf('--stub-port', '54331'));
const STUB_URL = `http://127.0.0.1:${STUB_PORT}`;
const BASE_URL = `http://127.0.0.1:${APP_PORT}`;
const USER_ID = '00000000-0000-4000-8000-000000000001';
const ADMIN_EMAIL = 'audit-stub@charitme.local';
const children = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function spawnChild(command, args, options = {}) {
  const child = spawn(command, args, { stdio: 'inherit', ...options });
  children.push(child);
  return child;
}

function runChild(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnChild(command, args, options);
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code ?? 'no status'}`));
    });
  });
}

async function waitForHttp(url, label) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.status < 500) return;
    } catch {
      await sleep(500);
      continue;
    }
    await sleep(500);
  }
  throw new Error(`${label} never became reachable at ${url}`);
}

function cleanup() {
  for (const child of children) {
    try { child.kill('SIGTERM'); } catch { continue; }
  }
}

function sessionCookieValue() {
  const now = Math.floor(Date.now() / 1000);
  const session = {
    access_token: 'stub-access-token',
    refresh_token: 'stub-refresh-token',
    token_type: 'bearer',
    expires_in: 31_536_000,
    expires_at: now + 31_536_000,
    user: {
      id: USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: ADMIN_EMAIL,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { full_name: 'Sam Super Admin' },
    },
  };
  return `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
}

function browserExecutable() {
  return [
    process.env.PLAYWRIGHT_CHROMIUM_PATH,
    chromium.executablePath(),
    process.env.PROGRAMFILES
      ? `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`
      : null,
    process.env.LOCALAPPDATA
      ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
      : null,
  ].find((candidate) => candidate && existsSync(candidate));
}

async function readStoredConfig() {
  const response = await fetch(`${STUB_URL}/rest/v1/platform_settings?id=eq.1&select=config`, {
    headers: { apikey: 'stub-service-key', Authorization: 'Bearer stub-service-key' },
  });
  assert(response.ok, `Supabase fixture read returned ${response.status}`);
  const rows = await response.json();
  return rows[0]?.config ?? {};
}

async function saveSettings(page) {
  const pending = page.waitForResponse((response) =>
    response.url().endsWith('/api/admin/super/settings') &&
    response.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Save settings' }).click();
  const response = await pending;
  assert(response.ok(), `Settings save returned ${response.status()}`);
}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: STUB_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'stub-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'stub-service-key',
  ADMIN_EMAILS: ADMIN_EMAIL,
};

try {
  spawnChild(process.execPath, ['scripts/supabase-stub.mjs', '--port', String(STUB_PORT)], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  await waitForHttp(`${STUB_URL}/auth/v1/user`, 'Supabase stub');

  if (argv.includes('--build')) {
    await runChild(process.execPath, [nextBin, 'build'], { env });
  }

  spawnChild(process.execPath, [nextBin, 'start', '-p', String(APP_PORT)], {
    env,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  await waitForHttp(`${BASE_URL}/maintenance`, 'CharitMe production server');

  const executablePath = browserExecutable();
  assert(executablePath, 'No compatible Chromium or Chrome executable was found');
  const browser = await chromium.launch({ executablePath });
  try {
    const unauthenticated = await fetch(`${BASE_URL}/api/admin/super/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maintenanceMode: true }),
    });
    assert([401, 403].includes(unauthenticated.status), 'Unauthenticated settings write was not rejected');

    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([{
      name: `sb-${new URL(STUB_URL).hostname.split('.')[0]}-auth-token`,
      value: sessionCookieValue(),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    }]);
    const page = await context.newPage();

    const invalid = await context.request.patch(`${BASE_URL}/api/admin/super/settings`, {
      data: { maintenanceExpectedBackAt: 'not-a-date' },
    });
    assert(invalid.status() === 400, `Invalid maintenance date returned ${invalid.status()}`);

    await page.goto(`${BASE_URL}/admin/super/settings`, { waitUntil: 'domcontentloaded' });
    assert(page.url().includes('/admin/super/settings'), 'Super admin settings redirected unexpectedly');
    const toggle = page.locator('label', { hasText: 'Maintenance mode' }).getByRole('button');
    if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();

    const message = 'We are upgrading CharitMe donation services. Please check back shortly.';
    await page.getByLabel('Maintenance message').fill(message);
    const expectedDate = new Date(Date.now() + 20 * 60_000);
    const expected = new Date(expectedDate.getTime() - expectedDate.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
    await page.getByLabel('Expected return (optional)').fill(expected);
    await saveSettings(page);
    await page.getByText('Settings saved').waitFor({ state: 'visible' });

    const enabledConfig = await readStoredConfig();
    assert(enabledConfig.maintenanceMode === true, 'Supabase did not store maintenanceMode=true');
    assert(enabledConfig.maintenanceMessage === message, 'Supabase did not store the maintenance message');

    const publicContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await publicContext.addInitScript(() => localStorage.setItem('charitme-theme-v2', 'dark'));
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`${BASE_URL}/campaigns`, { waitUntil: 'domcontentloaded' });
    assert(new URL(publicPage.url()).pathname === '/maintenance', 'Public route did not enter maintenance mode');
    assert(await publicPage.getByText(message).isVisible(), 'Saved Supabase message did not render');
    assert(await publicPage.locator('.maintenance-countdown').isVisible(), 'Configured countdown did not render');
    assert(await publicPage.locator('.kind-header').count() === 0, 'Global shell leaked onto maintenance page');
    const imageLoaded = await publicPage.locator('.maintenance-art').evaluate((image) => image.complete && image.naturalWidth > 0);
    assert(imageLoaded, 'Maintenance artwork did not load');
    mkdirSync('test-results', { recursive: true });
    await publicPage.screenshot({ path: 'test-results/maintenance-enabled-dark-mobile.png', fullPage: true });
    await publicContext.close();

    await page.bringToFront();
    if ((await toggle.getAttribute('aria-pressed')) !== 'false') await toggle.click();
    await saveSettings(page);
    const disabledConfig = await readStoredConfig();
    assert(disabledConfig.maintenanceMode === false, 'Supabase did not store maintenanceMode=false');

    const restored = await context.newPage();
    await restored.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    assert(new URL(restored.url()).pathname === '/', 'Public site did not return after maintenance was disabled');
    await context.close();
  } finally {
    await browser.close();
  }

  process.stdout.write('PASS maintenance mode: auth, validation, Supabase persistence, redirect, countdown, artwork, and recovery\n');
} finally {
  cleanup();
}
