import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// The rotator rules are structural, and every way of breaking them compiles.
//
// Requirement: only featured campaigns that have NOT ended and have NOT reached
// their goal may rotate on the homepage — and ALL of the ones that qualify must.
//
// Three separate code paths feed the homepage hero, and each one has previously
// been, or could silently become, a bypass:
//   1. /api/campaigns/rotator      — the authoritative rotating list
//   2. lib/home-data rotatorCampaigns — the server-rendered seed (first paint)
//   3. app/page.tsx heroCandidates — hero spots, fed by a NON-rotator list too
// ─────────────────────────────────────────────────────────────────────────────

describe('rotator eligibility is applied on every path into the hero', () => {
  it('the rotator API selects through the shared helper', () => {
    const src = read('app/api/campaigns/rotator/route.ts');
    expect(src).toContain('selectRotatorCampaigns');
  });

  it('the server-rendered seed selects too, so the first paint is not exempt', () => {
    // Without this the hero flashes an ended or funded campaign on every cold
    // load, until the client fetch replaces it a moment later.
    const src = read('lib/home-data.ts');
    expect(src).toContain('selectRotatorCampaigns(rawRotatorCampaigns)');
  });

  it('hero spots filter for eligibility', () => {
    // heroCandidates is fed by featuredCampaigns as well as rotatorCampaigns,
    // and that second list is not rotator-selected — a funded campaign reached
    // the hero through that door.
    const src = read('app/page.tsx');
    expect(src).toContain('isRotatorEligible');
  });
});

describe('the rotator does not cap paid placements', () => {
  const src = read('app/api/campaigns/rotator/route.ts');

  it('queries featured campaigns separately from the fallback pool', () => {
    // The original single query took the top 20 by (featured, raised) and THEN
    // filtered to featured. A creator who paid but sat 21st by amount raised
    // never appeared at all. Filtering after a LIMIT is only correct when the
    // limit exceeds the population, and nothing enforced that.
    expect(src).toContain("eq('featured', true)");
    expect(src).toMatch(/FEATURED_CEILING/);
  });

  it('gives featured campaigns a far larger ceiling than the fallback list', () => {
    const featured = Number(/FEATURED_CEILING = (\d+)/.exec(src)?.[1]);
    const fallback = Number(/FALLBACK_LIMIT = (\d+)/.exec(src)?.[1]);
    expect(Number.isFinite(featured)).toBe(true);
    expect(Number.isFinite(fallback)).toBe(true);
    expect(featured).toBeGreaterThan(fallback);
  });

  it('prunes ended campaigns in SQL rather than spending the row budget on them', () => {
    expect(src).toMatch(/deadline\.is\.null,deadline\.gt\./);
  });
});

describe('the featured price is read live, never hardcoded', () => {
  it('the builder upsell fetches the price instead of printing a literal', () => {
    const src = read('app/create/FeatureUpsell.tsx');
    expect(src).toContain('/feature');
    // A hardcoded price would misquote the creator the moment an admin changed
    // it, and the mismatch would only surface on the Stripe page.
    //
    // Comments are stripped first: this file's own header explains the hazard by
    // naming the literal, and matching prose rather than code is how a guard
    // starts failing for the wrong reason.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    expect(code).not.toMatch(/\$\s?5(\.00)?\b/);
  });

  it('the feature route re-reads settings per request', () => {
    const src = read('app/api/campaigns/[id]/feature/route.ts');
    expect(src).toContain('featurePriceCents');
    expect(src).toContain('resolveFeaturePriceCents');
  });

  it('super-admin writes the price where the resolver reads it', () => {
    // The PATCH merge is shallow, so writing this key at the top level would
    // store a value nothing reads — the setting would look like it worked and
    // change nothing.
    const src = read('app/api/admin/super/settings/route.ts');
    expect(src).toContain('featuredCampaignPriceCents');
    expect(src).toContain('nextConfig.payment');
  });
});
