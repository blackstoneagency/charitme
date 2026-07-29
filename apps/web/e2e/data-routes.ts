import type { APIRequestContext } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// Routes that only exist when the database has been seeded.
//
// The public-route sweeps are otherwise pure static assertions, which is what
// lets them gate CI against a placeholder-Supabase build. The campaign embed
// fixture is the exception: it resolves a real `campaigns` row, so it 404s on a
// fresh/placeholder database and used to fail the whole sweep — which is why the
// e2e suite could never be wired into CI at all.
//
// Rather than delete the coverage, these routes are probed once and skipped when
// absent. A seeded environment still exercises them fully; CI still gates on
// everything else.
// ─────────────────────────────────────────────────────────────────────────────

// The list lives in JSON so scripts/audit-mobile.mjs can consume the SAME source.
// It is a .mjs and cannot import this module, and a second hand-maintained copy is
// exactly the drift `route-list-single-source` already caught once.
import DATA_DEPENDENT from './data-dependent-routes.json' with { type: 'json' };

/** Public routes that require seeded data to resolve. */
export const DATA_DEPENDENT_ROUTES: readonly string[] = DATA_DEPENDENT;

export function isDataDependent(route: string): boolean {
  return DATA_DEPENDENT_ROUTES.includes(route);
}

/**
 * Filter a route list down to what this environment can actually serve.
 *
 * Only data-dependent routes are probed — static routes are always kept, so a
 * genuine regression on them still fails the run rather than being skipped.
 * Returns the usable routes plus the ones skipped, so the spec can report them.
 */
export async function resolveRoutes(
  request: APIRequestContext,
  routes: readonly string[],
): Promise<{ usable: string[]; skipped: string[] }> {
  const usable: string[] = [];
  const skipped: string[] = [];

  for (const route of routes) {
    if (!isDataDependent(route)) {
      usable.push(route);
      continue;
    }
    try {
      const res = await request.get(route);
      if (res.status() < 400) usable.push(route);
      else skipped.push(route);
    } catch {
      skipped.push(route);
    }
  }
  return { usable, skipped };
}
