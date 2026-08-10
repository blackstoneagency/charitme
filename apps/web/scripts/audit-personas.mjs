#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';
import { STUB_PERSONAS } from './supabase-stub-fixtures.mjs';

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');
const argv = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const index = argv.indexOf(flag);
  return index === -1 ? fallback : argv[index + 1];
};

const APP_PORT = Number(argOf('--port', '3015'));
const STUB_PORT = Number(argOf('--stub-port', '54323'));
const ONLY = String(argOf('--only', '')).split(',').filter(Boolean);
const STUB_URL = `http://127.0.0.1:${STUB_PORT}`;
const BASE_URL = `http://127.0.0.1:${APP_PORT}`;
const LABELS = {
  donor: 'Donor',
  organizer: 'Organizer',
  beneficiary: 'Beneficiary',
  nonprofit: 'Nonprofit',
  admin: 'Admin',
  super_admin: 'Super Admin',
};
const EXPECTED_NAV = {
  donor: [
    '/dashboard', '/donor', '/dashboard/saved', '/dashboard/tax',
    '/dashboard/recurring', '/dashboard/payment-methods', '/dashboard/tickets',
    '/dashboard/volunteer', '/dashboard/referrals', '/dashboard/settings',
    '/fundraising-guide', '/resources', '/events', '/help',
  ],
  organizer: [
    '/dashboard', '/dashboard/campaigns', '/dashboard/tools', '/dashboard/forms',
    '/dashboard/calendar', '/dashboard/tickets', '/dashboard/tasks',
    '/dashboard/documents', '/dashboard/ai-growth-plan', '/dashboard/ai-coach',
    '/dashboard/donations', '/dashboard/tax', '/dashboard/donor',
    '/dashboard/grants', '/dashboard/volunteer', '/dashboard/corporate',
    '/dashboard/referrals', '/dashboard/updates', '/dashboard/creator',
    '/dashboard/payouts', '/dashboard/analytics', '/dashboard/messages',
    '/dashboard/team', '/dashboard/integrations', '/dashboard/developers',
    '/dashboard/webhooks', '/dashboard/domains', '/dashboard/giving-days',
    '/dashboard/segments', '/dashboard/buttons', '/dashboard/settings',
    '/fundraising-guide', '/resources', '/events', '/help',
  ],
  beneficiary: [
    '/dashboard', '/dashboard/beneficiary', '/donor', '/dashboard/saved',
    '/dashboard/tax', '/dashboard/tickets', '/dashboard/volunteer',
    '/dashboard/messages', '/dashboard/settings', '/fundraising-guide',
    '/resources', '/events', '/help',
  ],
  nonprofit: [
    '/dashboard', '/dashboard/nonprofit', '/dashboard/campaigns',
    '/dashboard/tools', '/dashboard/forms', '/dashboard/calendar',
    '/dashboard/tickets', '/dashboard/tasks', '/dashboard/documents',
    '/dashboard/ai-growth-plan', '/dashboard/ai-coach', '/dashboard/donations',
    '/dashboard/tax', '/dashboard/donor', '/dashboard/grants',
    '/dashboard/volunteer', '/dashboard/corporate', '/dashboard/referrals',
    '/dashboard/updates', '/dashboard/creator', '/dashboard/payouts',
    '/dashboard/analytics', '/dashboard/messages', '/dashboard/team',
    '/dashboard/integrations', '/dashboard/developers', '/dashboard/webhooks',
    '/dashboard/domains', '/dashboard/giving-days', '/dashboard/segments',
    '/dashboard/buttons', '/dashboard/settings', '/fundraising-guide',
    '/resources', '/events', '/help',
  ],
  admin: [
    '/dashboard', '/donor', '/dashboard/tax', '/dashboard/tickets', '/dashboard/messages',
    '/dashboard/settings',
  ],
  super_admin: [
    '/dashboard', '/donor', '/dashboard/tax', '/dashboard/tickets', '/dashboard/messages',
    '/dashboard/settings',
  ],
};
const routeManifest = JSON.parse(
  readFileSync(new URL('../e2e/public-routes.json', import.meta.url), 'utf8'),
);
const knownAuthenticatedRoutes = new Set([
  ...routeManifest.public,
  ...routeManifest.authGated.routes,
  ...routeManifest.authGated.consoles,
]);
for (const routes of Object.values(EXPECTED_NAV)) {
  for (const route of routes) {
    if (!knownAuthenticatedRoutes.has(route)) {
      throw new Error(`Persona navigation route ${route} is missing from e2e/public-routes.json.`);
    }
  }
}

const browserExecutable = [
  process.env.PLAYWRIGHT_CHROMIUM_PATH,
  chromium.executablePath(),
  process.env.PROGRAMFILES
    ? `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`
    : null,
  process.env['PROGRAMFILES(X86)']
    ? `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`
    : null,
  process.env.LOCALAPPDATA
    ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
    : null,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((candidate) => candidate && existsSync(candidate));

function cookieNameFor(url) {
  return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
}

function sessionCookieValue(persona) {
  const now = Math.floor(Date.now() / 1000);
  const session = {
    access_token: persona.token,
    refresh_token: `stub-${persona.key}-refresh-token`,
    token_type: 'bearer',
    expires_in: 31_536_000,
    expires_at: now + 31_536_000,
    user: {
      id: persona.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: persona.email,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { full_name: persona.name },
    },
  };
  return `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
}

async function waitForHttp(url, label, attempts = 60) {
  for (let index = 0; index < attempts; index++) {
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

const children = [];
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

function cleanup() {
  for (const child of children) {
    try {
      child.kill('SIGTERM');
    } catch {
      continue;
    }
  }
}

async function navigate(page, path) {
  const response = await page.goto(`${BASE_URL}${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  if (!response || response.status() >= 400) {
    throw new Error(`${path} returned ${response?.status() ?? 'no response'}`);
  }
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  return new URL(page.url()).pathname;
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, received ${actual}`);
}

function assertList(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}\nexpected ${JSON.stringify(expected)}\nreceived ${JSON.stringify(actual)}`,
    );
  }
}

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: STUB_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'stub-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'stub-service-key',
  ADMIN_EMAILS: '',
};

let browser;
let failures = 0;
try {
  spawnChild(process.execPath, ['scripts/supabase-stub.mjs', '--port', String(STUB_PORT)], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  await waitForHttp(`${STUB_URL}/auth/v1/user`, 'supabase stub');

  if (argv.includes('--build')) {
    process.stdout.write('Building CharitMe against the six-persona Supabase stub...\n');
    await runChild(process.execPath, [nextBin, 'build'], {
      env,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
  }

  spawnChild(process.execPath, [nextBin, 'start', '-p', String(APP_PORT)], {
    env,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  await waitForHttp(`${BASE_URL}/api/health`, 'Next.js');

  browser = await chromium.launch({
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
    args: ['--no-sandbox'],
  });

  const personas = ONLY.length > 0
    ? STUB_PERSONAS.filter((persona) => ONLY.includes(persona.key))
    : STUB_PERSONAS;
  for (const persona of personas) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([{
      name: cookieNameFor(STUB_URL),
      value: sessionCookieValue(persona),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    }]);
    const page = await context.newPage();

    try {
      const taxPath = await navigate(page, '/dashboard/tax');
      assertEqual(taxPath, '/dashboard/tax', `${persona.key} tax route`);
      await page.getByRole('heading', { name: 'Tax Documents', exact: true }).waitFor({
        state: 'visible',
        timeout: 20_000,
      });
      await page.waitForFunction(
        () => document.querySelectorAll('.kf-sidebar').length === 1,
        undefined,
        { timeout: 20_000 },
      );
      const label = (await page.locator('.kf-user-chip-meta small').textContent() ?? '').trim();
      assertEqual(label, LABELS[persona.key], `${persona.key} shell label`);

      const navGroups = page.locator('.kf-sidebar > .kf-nav');
      const navGroupCount = await navGroups.count();
      if (navGroupCount !== 1) {
        const details = await navGroups.evaluateAll((groups) => groups.map((group) => ({
          parentClass: group.parentElement?.className ?? '',
          parentIndex: [...document.querySelectorAll('.kf-sidebar')].indexOf(group.parentElement),
          role: group.parentElement?.querySelector('.kf-user-chip-meta small')?.textContent ?? '',
          appClass: group.parentElement?.parentElement?.className ?? '',
          display: getComputedStyle(group).display,
          hrefs: [...group.querySelectorAll('a')].map((link) => new URL(link.href).pathname),
        })));
        throw new Error(
          `${persona.key} primary navigation count: expected 1, received ${navGroupCount}; `
          + JSON.stringify(details),
        );
      }
      const nav = await navGroups.first().locator('a').evaluateAll((links) =>
        links.map((link) => new URL(link.href).pathname),
      );
      assertList(nav, EXPECTED_NAV[persona.key], `${persona.key} navigation`);
      assertEqual(
        await page.locator('a.kf-create').getAttribute('href'),
        '/create/choose-path',
        `${persona.key} create campaign action`,
      );

      const adminPath = await navigate(page, '/admin');
      assertEqual(
        adminPath,
        ['admin', 'super_admin'].includes(persona.key) ? '/admin' : '/dashboard',
        `${persona.key} admin boundary`,
      );

      const superPath = await navigate(page, '/admin/super/roles');
      const expectedSuperPath = persona.key === 'super_admin'
        ? '/admin/super/roles'
        : persona.key === 'admin' ? '/admin' : '/dashboard';
      if (superPath !== expectedSuperPath) {
        const whoami = await page.request.get(`${BASE_URL}/api/admin/super/whoami`);
        throw new Error(
          `${persona.key} super-admin boundary: expected ${expectedSuperPath}, `
          + `received ${superPath}; whoami=${whoami.status()} ${await whoami.text()}`,
        );
      }
      process.stdout.write(`PASS ${persona.key}: identity, navigation, admin boundaries\n`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${persona.key}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await context.close();
    }
  }
} finally {
  if (browser) await browser.close();
  cleanup();
}

if (failures > 0) {
  console.error(`Persona certification failed for ${failures} role(s).`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Certified ${ONLY.length > 0 ? ONLY.length : STUB_PERSONAS.length} independent role sessions.\n`);
}
