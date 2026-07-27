import { describe, expect, it } from 'vitest';
import { PLATFORM_MODULES, isFeatureBuilt } from '../lib/feature-catalog';

// ─────────────────────────────────────────────────────────────────────────────
// The feature catalog drives /features — marketing copy shown to prospective
// fundraisers and donors. It must not claim capabilities the catalog itself
// records as unbuilt.
//
// This has now happened twice, the same way both times:
//   • "Full parity" was hardcoded per competitor, advertising parity that counted
//     features marked planned (since fixed — it is now `competitor.fullParity`).
//   • The "Nonprofit Growth Suite" — status 'Production Ready' — listed "auctions"
//     in its summary, while `Auctions` is `planned: true` and has no API, lib or
//     UI at all, only seeded tables. That copy was live on production.
//
// Both are prose drifting from the structured data sitting next to it. Prose
// can't be type-checked, so it gets a test.
// ─────────────────────────────────────────────────────────────────────────────

/** Names of features the catalog itself reports as not built. */
const unbuiltFeatureNames = Array.from(
  new Set(
    PLATFORM_MODULES.flatMap((m) =>
      m.features.filter((f) => !isFeatureBuilt(m, f)).map((f) => f.name),
    ),
  ),
);

describe('feature catalog honesty', () => {
  it('has a meaningful set of modules and features to check', () => {
    expect(PLATFORM_MODULES.length).toBeGreaterThan(3);
    expect(PLATFORM_MODULES.flatMap((m) => m.features).length).toBeGreaterThan(50);
  });

  it('no SHIPPED module advertises a capability the catalog reports as unbuilt', () => {
    const offenders: string[] = [];
    // A module whose own status is 'Planned' may describe what it will do — the
    // status label is right there, so a visitor isn't misled. The failure mode is
    // a module presented as shipped that lists something unbuilt.
    for (const mod of PLATFORM_MODULES.filter((m) => m.status !== 'Planned')) {
      const haystack = `${mod.title} ${mod.summary}`.toLowerCase();
      for (const name of unbuiltFeatureNames) {
        // Compare on the singular stem so "auctions" in prose matches "Auctions".
        const stem = name.toLowerCase().replace(/s$/, '');
        if (stem.length > 3 && haystack.includes(stem)) {
          offenders.push(
            `module '${mod.slug}' (status: ${mod.status}) advertises unbuilt feature '${name}'`,
          );
        }
      }
    }
    expect(
      offenders,
      `A module presented as shipped claims something this catalog reports as unbuilt:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('every module marked Production Ready has at least one built feature', () => {
    const hollow = PLATFORM_MODULES.filter(
      (m) => m.status === 'Production Ready' && !m.features.some((f) => isFeatureBuilt(m, f)),
    ).map((m) => m.slug);
    expect(hollow, `Production Ready module with nothing built: ${hollow.join(', ')}`).toEqual([]);
  });
});
