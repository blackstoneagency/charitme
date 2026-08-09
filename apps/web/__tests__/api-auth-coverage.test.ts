import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API_ROOT = join(WEB_ROOT, 'app', 'api');

// ─────────────────────────────────────────────────────────────────────────────
// Authorization coverage for mutating API routes.
//
// Measured state when this guard was written: 158 routes expose a mutating
// handler; 150 carry an auth guard and 8 are deliberately public. The point of
// the test is that adding a 9th public mutation has to be a DELIBERATE act —
// someone must add it to PUBLIC_MUTATIONS below and justify it — rather than
// something that slips in because a guard was forgotten.
//
// Public OpenAI-backed endpoints additionally need a DURABLE (Postgres-backed)
// rate limit: `lib/rate-limit.ts` is per-process, so on serverless each instance
// keeps its own counter and the effective global limit is `limit × instances`.
//
// ⚠️ KNOWN BLIND SPOT — this test cannot tell a gate from a personalisation.
//
// `AUTH` matches a token anywhere in the file, so these two are identical to it:
//
//     const { data: { user } } = await supabase.auth.getUser();
//     if (!user) return 401;                    // ← a gate
//
//     const { data: { user } } = await supabase.auth.getUser();
//     if (user) { /* also save it for them */ } // ← personalisation
//
// `app/api/ai/grant-match/route.ts` is the second kind — a deliberately public
// endpoint whose `getUser()` only decides whether to persist the result. This
// test reads it as guarded, so it never had to be justified in PUBLIC_MUTATIONS
// below, which is the one thing that list is for. It is not a hole in the route;
// it is a hole in this check.
//
// Tightening the regex was tried and abandoned: `if (authError || !user)` is as
// common as `if (!user)`, and each attempt mis-classified real routes in one
// direction or the other. The behavioural sweep is the answer instead —
// `npm run audit:route-auth`, which POSTs to all 185 mutating routes against a
// LOCAL build and reads the status code. Measured 2026-08-03: 166 enforce
// (401/403), 2 are declared public, 16 validate the body before authenticating
// (inconclusive, not counted as passing), 1 errors on the absent database.
//
// Keep this test: it is fast, it runs in CI, and it catches a forgotten guard.
// Just do not read a pass here as proof that a route refuses anonymous callers.
// ─────────────────────────────────────────────────────────────────────────────

const AUTH = /requireAdmin|requireUser|requireSuperAdmin|verifyAdmin|guardSuperAdmin|getUser\(\)|isAdmin\(|isSuperAdmin|CRON_SECRET|stripe\.webhooks|constructEvent|auth\.getUser/i;
const MUTATION = /export async function (POST|PATCH|PUT|DELETE)/;

/** Intentionally reachable without a session — each needs a reason. */
const PUBLIC_MUTATIONS: Record<string, string> = {
  'ai/goal-recommend': 'public goal suggestion; durable-rate-limited',
  'auth/signout': 'clearing your own session cannot require a session',
  'campaign-reports': 'abuse reports must be filable without an account',
  'contact': 'public contact form',
  'marketing/capture': 'public newsletter capture',
  'marketing/unsubscribe': 'unsubscribe links are followed while signed out',
  'trust-score': 'public trust-score calculator',
};

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === 'route.ts' ? [path] : [];
  });
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

const ROUTES = routeFiles(API_ROOT).map((path) => {
  const source = stripComments(readFileSync(path, 'utf8'));
  return {
    id: relative(API_ROOT, dirname(path)).replace(/\\/g, '/'),
    path: relative(WEB_ROOT, path),
    source,
    mutates: MUTATION.test(source),
    guarded: AUTH.test(source),
  };
});

describe('every mutating API route is guarded or explicitly public', () => {
  it('found the routes (guards against this test going vacuous)', () => {
    expect(ROUTES.length).toBeGreaterThan(100);
    expect(ROUTES.filter((r) => r.mutates).length).toBeGreaterThan(100);
  });

  it('no unguarded mutation outside the allow-list', () => {
    const offenders = ROUTES
      .filter((r) => r.mutates && !r.guarded && !(r.id in PUBLIC_MUTATIONS))
      .map((r) => r.path);

    expect(
      offenders,
      'These routes mutate state with no auth check. Add a guard, or add them to ' +
      `PUBLIC_MUTATIONS with a reason:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('the allow-list has no stale entries', () => {
    // A route that gained a guard should leave the list, so the list keeps
    // meaning "these are reachable anonymously".
    const stale = Object.keys(PUBLIC_MUTATIONS).filter((id) => {
      const route = ROUTES.find((r) => r.id === id);
      return !route || !route.mutates || route.guarded;
    });
    expect(stale, `No longer an unguarded mutation: ${stale.join(', ')}`).toEqual([]);
  });
});

describe('public OpenAI endpoints are durably rate-limited', () => {
  const openAiRoutes = ROUTES.filter((r) => /openai|chat\.completions/i.test(r.source));

  it('found the AI routes', () => {
    expect(openAiRoutes.length).toBeGreaterThan(5);
  });

  it('every anonymous one uses the Postgres-backed limiter, not the per-process one', () => {
    // `checkRateLimit` alone is per-instance: on serverless the real global limit
    // becomes limit × instanceCount, which is no limit at all for a paid API.
    // Method-agnostic on purpose — `ai/donation-impact` and `ai/donor-conversion`
    // are public GETs, and a GET that bills OpenAI needs the same protection a POST
    // does. Filtering to mutations would have skipped exactly those two.
    const offenders = openAiRoutes
      .filter((r) => !r.guarded)
      .filter((r) => !r.source.includes('checkRateLimitDurable'))
      .map((r) => r.path);

    expect(
      offenders,
      `Anonymous OpenAI endpoints without a durable limit:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
