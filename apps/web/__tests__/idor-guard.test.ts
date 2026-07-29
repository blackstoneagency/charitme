import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// `supabaseAdmin` uses the service-role key and BYPASSES RLS. In a route with a
// caller-supplied `[id]`, that combination is the classic IDOR shape: the
// database will no longer refuse to hand over another user's row, so the route
// itself has to. Nothing else in the stack will catch it.
//
// Audited by hand 2026-07-28 across all 42 such routes: no gap found. Every
// mutating route either calls a named guard or compares against `user.id`.
// This test exists so a NEW route cannot quietly land without one.
//
// ⚠️ WHAT THIS CANNOT PROVE. Referencing `user.id` is necessary, not sufficient
// — a route could reference it and still compare the wrong thing. Five routes
// were read in full to check the comparisons are real (campaign settings,
// notifications, integrations, team-members, admin users); the rest rest on
// this weaker signal. Treat a pass as "nobody forgot", not "every check is
// correct".
//
// The guard list below is DISCOVERED, not guessed. Four separate hand-written
// pattern lists produced confident false positives during the audit — routes
// flagged as unprotected that were using `verifyAdmin` from app/api/admin/_auth,
// or an inline `.eq('owner_id', user.id)`, or `canManageCampaign`. Absence of
// the string you searched for is not absence of the behaviour.
// ─────────────────────────────────────────────────────────────────────────────

const WEB_ROOT = path.join(__dirname, '..');
const API_DIR = path.join(WEB_ROOT, 'app', 'api');

/**
 * Authorization helpers, DERIVED PER FILE from what the route imports.
 *
 * This was a hardcoded array, and the comment above it already said the list
 * should be discovered rather than guessed — then it was hardcoded anyway. It
 * went stale within a day: Codex added `lib/campaign-access.ts` with
 * `canViewCampaignAnalytics`, and `/api/campaigns/[id]/analytics` — which calls
 * it and returns 403 — was reported as an unprotected IDOR surface. That is the
 * fifth false positive this class of scan produced.
 *
 * So: any identifier imported from a module whose path looks like an
 * authorization concern counts as a guard for that file. A new helper in a new
 * module is picked up the moment a route imports it.
 */
const GUARD_MODULE = /(^|\/)(_auth|auth|auth-config|roles|guard|access|campaign-access|permissions?)(\.|$|\/)/;

function importedGuardNames(src: string): string[] {
  const names: string[] = [];
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const [, clause, from] = m;
    if (!GUARD_MODULE.test(from)) continue;
    for (const part of clause.split(',')) {
      const name = part.split(/\s+as\s+/).pop()!.trim();
      if (name) names.push(name);
    }
  }
  return names;
}

/** True when the file calls something it imported from an authorization module. */
function callsAnImportedGuard(src: string): boolean {
  return importedGuardNames(src).some((n) => new RegExp(`\\b${n}\\s*\\(`).test(src));
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry === 'route.ts' || entry === 'route.tsx') out.push(full);
  }
  return out;
}

const MUTATING = /export\s+(?:async\s+)?function\s+(POST|PATCH|PUT|DELETE)\b/;

/** Routes with a [param] segment that reach the DB with RLS bypassed. */
const riskyRoutes = walk(API_DIR).filter((f) => {
  const rel = path.relative(WEB_ROOT, f);
  if (!rel.includes('[')) return false;
  return readFileSync(f, 'utf8').includes('supabaseAdmin');
});

describe('service-role routes with a caller-supplied id verify ownership', () => {
  it('finds the routes it is supposed to be checking', () => {
    // Guards against the walk silently matching nothing — the failure mode this
    // whole file exists to prevent elsewhere.
    expect(riskyRoutes.length).toBeGreaterThan(30);
  });

  it('every mutating one checks the caller, not just that they are signed in', () => {
    const offenders: string[] = [];
    for (const file of riskyRoutes) {
      const src = readFileSync(file, 'utf8');
      if (!MUTATING.test(src)) continue;          // read-only: covered by the GET case below
      if (!/auth\.getUser/.test(src)) continue;   // public route; not an IDOR surface
      const hasNamedGuard = callsAnImportedGuard(src);
      const comparesCaller = /user\.id/.test(src);
      if (!hasNamedGuard && !comparesCaller) offenders.push(path.relative(WEB_ROOT, file));
    }
    expect(
      offenders,
      'These routes use supabaseAdmin (RLS bypassed) on a caller-supplied [id] and ' +
        'mutate, but never call an authorization helper or compare against user.id. ' +
        'Any signed-in user could act on another user\'s row:\n  ' + offenders.join('\n  '),
    ).toEqual([]);
  });

  it('a signed-in read of a caller-supplied id scopes to the caller', () => {
    // Same shape, read side. A route that authenticates and then reads by raw id
    // has decided the data is not caller-scoped — that is legitimate for public
    // resources, so this only fires when the route bothered to authenticate AND
    // mutates nothing AND never mentions the caller.
    const offenders: string[] = [];
    for (const file of riskyRoutes) {
      const src = readFileSync(file, 'utf8');
      if (MUTATING.test(src)) continue;
      if (!/auth\.getUser/.test(src)) continue;
      if (!callsAnImportedGuard(src) && !/user\.id/.test(src)) offenders.push(path.relative(WEB_ROOT, file));
    }
    expect(
      offenders,
      'These routes authenticate the caller, then read by raw [id] with RLS bypassed ' +
        'and never reference that caller — so the sign-in check is decorative:\n  ' +
        offenders.join('\n  '),
    ).toEqual([]);
  });
});
