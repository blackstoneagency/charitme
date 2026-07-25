import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../app/api');
const PUBLIC_MUTATION_ROUTES = new Set([
  'ai/campaign/route.ts',
  'ai/goal-recommend/route.ts',
  'campaign-reports/route.ts',
  'contact/route.ts',
  'marketing/capture/route.ts',
  'marketing/unsubscribe/route.ts',
  'share-events/route.ts',
  'trust-score/route.ts',
]);
const SIGNATURE_OR_SESSION_MUTATIONS = new Set([
  'auth/signout/route.ts',
  'stripe/webhook/route.ts',
]);

function routeFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...routeFiles(fullPath));
    else if (entry.name === 'route.ts') files.push(fullPath);
  }
  return files;
}

function relativeRoute(file: string): string {
  return path.relative(API_DIR, file).replaceAll('\\', '/');
}

function hasPostHandler(source: string): boolean {
  return /export\s+async\s+function\s+POST\s*\(/u.test(source);
}

function hasAuthenticationGate(source: string): boolean {
  return /requireUser\s*\(|requireAdmin\s*\(|requireSuperAdmin\s*\(|verifyAdmin\s*\(|verifySuperAdmin\s*\(|guardSuperAdmin\s*\(|isAdmin\s*\(|isSuperAdmin\s*\(|auth\.getUser\s*\(|getUser\s*\(/u.test(source);
}

function hasRateLimit(source: string): boolean {
  return /checkRateLimit(?:Durable)?\s*\(/u.test(source);
}

describe('API mutation rate-limit coverage', () => {
  const routes = routeFiles(API_DIR)
    .filter((file) => hasPostHandler(readFileSync(file, 'utf8')))
    .map((file) => ({ file, route: relativeRoute(file), source: readFileSync(file, 'utf8') }));

  it('throttles every unauthenticated mutation route', () => {
    const missing = [...PUBLIC_MUTATION_ROUTES].filter((route) => {
      const match = routes.find((candidate) => candidate.route === route);
      return !match || !hasRateLimit(match.source);
    });
    expect(missing, `Public POST routes without rate limiting: ${missing.join(', ')}`).toEqual([]);
  });

  it('does not leave an unclassified unauthenticated mutation route', () => {
    const unclassified = routes
      .filter(({ source }) => !hasAuthenticationGate(source) && !hasRateLimit(source))
      .filter(({ route }) => !SIGNATURE_OR_SESSION_MUTATIONS.has(route));
    expect(
      unclassified.map(({ route }) => route),
      'Every unauthenticated POST must be rate-limited or explicitly classified as signature/session traffic',
    ).toEqual([]);
  });

  it('does not expose backend error details from public mutation routes', () => {
    const leaking = routes
      .filter(({ route }) => PUBLIC_MUTATION_ROUTES.has(route))
      .filter(({ source }) => /error:\s*error\.message/u.test(source))
      .map(({ route }) => route);
    expect(leaking, `Public mutation routes exposing backend error text: ${leaking.join(', ')}`).toEqual([]);
  });
});
