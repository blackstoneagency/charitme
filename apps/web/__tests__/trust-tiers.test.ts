import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROMOTABLE_TRUST_TIERS,
  NON_PROMOTABLE_TRUST_TIERS,
  isPromotableTrustTier,
} from '../lib/trust-tiers';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(here, '..', p), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// /success-stories is headed "Featured Stories" and was promoting a campaign
// titled "Support my medical expenses — Bitches!" as its second card. Measured
// across all 314 live campaigns it is the only one of its kind, and it was
// `trust_status: 'Needs More Info'` with a health score of 0 and no backers.
//
// The gate is the platform's own judgement, not a word list.
// ─────────────────────────────────────────────────────────────────────────────

describe('only campaigns the platform vouches for may be promoted', () => {
  it('promotes the affirmative tiers', () => {
    expect(isPromotableTrustTier('Verified')).toBe(true);
    expect(isPromotableTrustTier('Trusted')).toBe(true);
  });

  it('does NOT promote "Strong Trust", which is the other vocabulary', () => {
    // ⚠️ This list originally included it, and that was wrong. `Strong Trust` is
    // produced by `getTrustStatus(score)` — the COMPUTED label — and cannot be
    // set on `campaigns.trust_status`: it is absent from the admin allow-list and
    // production holds zero such rows. Since this constant filters the STORED
    // column, including it narrowed the query to two tiers while appearing to
    // allow three. See STORED_TRUST_TIERS for the two vocabularies side by side.
    expect(isPromotableTrustTier('Strong Trust')).toBe(false);
  });

  it('refuses the tiers that withhold trust', () => {
    expect(isPromotableTrustTier('Needs More Info')).toBe(false);
    expect(isPromotableTrustTier('Under Review')).toBe(false);
    // The one that matters most: nothing previously stopped a FLAGGED campaign
    // appearing under a "Featured Stories" heading.
    expect(isPromotableTrustTier('Flagged')).toBe(false);
  });

  it('refuses an absent tier rather than defaulting it in', () => {
    // An unscored campaign has not earned a marketing slot. Treating "no answer"
    // as a pass is the fail-open shape this repo keeps finding in money paths.
    expect(isPromotableTrustTier(null)).toBe(false);
    expect(isPromotableTrustTier(undefined)).toBe(false);
    expect(isPromotableTrustTier('')).toBe(false);
    expect(isPromotableTrustTier('verified'), 'case must not be a bypass').toBe(false);
  });
});

describe('the tier vocabulary cannot drift without failing', () => {
  // It had ALREADY drifted three ways when this was written:
  //   lib/ai-platform.ts   has 'Strong Trust', lacks 'Trusted' and 'Flagged'
  //   admin allow-list     has 'Trusted' and 'Flagged', lacks 'Strong Trust'
  //   production data      'Trusted' is the MOST COMMON value (133 of 314)
  // A filter written from any one of those lists alone is wrong.
  const adminRoute = read('app/api/admin/campaigns/[id]/route.ts');

  function adminSettableTiers(): string[] {
    const line = adminRoute.match(/allowedTrustStatus = new Set\(\[([^\]]*)\]\)/);
    expect(line, 'the admin allow-list moved — this guard is now blind').not.toBeNull();
    return [...line![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  }

  it('classifies every tier an admin can actually set', () => {
    // The real risk: someone adds a tier to the admin dropdown and it silently
    // becomes un-promotable (or worse, if this were a deny-list, promotable).
    const known = new Set<string>([...PROMOTABLE_TRUST_TIERS, ...NON_PROMOTABLE_TRUST_TIERS]);
    for (const tier of adminSettableTiers()) {
      expect(known.has(tier), `"${tier}" is settable in admin but unclassified in trust-tiers.ts`)
        .toBe(true);
    }
  });

  it('keeps the two sets disjoint', () => {
    for (const t of PROMOTABLE_TRUST_TIERS) {
      expect(NON_PROMOTABLE_TRUST_TIERS as readonly string[]).not.toContain(t);
    }
  });

  it('is an allow-list, so a new tier is not promotable by default', () => {
    expect(isPromotableTrustTier('Some Tier Invented Later')).toBe(false);
  });
});

describe('the gate is on the story list, not the platform totals', () => {
  const page = read('app/success-stories/page.tsx');

  it('filters the cards', () => {
    expect(page).toMatch(/\.in\('trust_status', \[\.\.\.PROMOTABLE_TRUST_TIERS\]\)/);
  });

  it('does NOT filter the totals', () => {
    // "N campaigns, N supporters, $N raised" is a claim about the whole
    // platform. Filtering it by trust tier would understate real money that real
    // donors really gave — a worse error than the one being fixed. `base()` is
    // shared by both queries, so the filter must sit outside it.
    const base = page.slice(page.indexOf('const base = () =>'), page.indexOf('let listQuery'));
    expect(base, 'the shared builder must stay unfiltered').not.toContain('trust_status');
  });

  it('applies before the row limit, so the gate cannot be filled by 8 bad rows', () => {
    // Ordering matters in the builder: filter then limit. A limit applied first
    // would take 8 rows and then drop the untrusted ones, leaving a short page.
    expect(page).toMatch(/\.in\('trust_status'[\s\S]{0,200}?\.limit\(8\)/);
  });
});
