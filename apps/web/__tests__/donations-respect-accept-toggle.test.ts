import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROUTES = ['../app/api/donations/route.ts', '../app/api/donations/recurring/route.ts'];

// Regression: /api/campaigns/donations-toggle lets an organizer switch donations
// off. The campaign page honoured it (via `acceptDonations` in `isActive`) but
// neither donation route selected or checked the flag, so a direct POST still took
// money after the organizer had explicitly said stop.
describe('donation routes honour accept_donations', () => {
  for (const rel of ROUTES) {
    const name = rel.includes('recurring') ? 'recurring' : 'one-time';
    const src = readFileSync(join(here, rel), 'utf8');

    it(`${name}: selects the flag`, () => {
      expect(src).toMatch(/select\([^)]*accept_donations/);
    });

    it(`${name}: rejects when explicitly disabled`, () => {
      expect(src).toMatch(/accept_donations === false/);
      expect(src).toMatch(/DONATIONS_CLOSED/);
    });

    it(`${name}: rejects donations after the deadline`, () => {
      // The campaign page renders "This campaign has ended." and hides the donate
      // form once the deadline passes; the API previously accepted a direct POST.
      expect(src).toMatch(/select\([^)]*deadline/);
      expect(src).toMatch(/CAMPAIGN_ENDED/);
      // Boundary must match the page's Math.ceil((deadline-now)/day) > 0, i.e.
      // blocked precisely when deadline <= now.
      expect(src).toMatch(/getTime\(\) <= Date\.now\(\)/);
    });

    it(`${name}: treats a null deadline as open-ended`, () => {
      expect(src, 'a campaign with no deadline must never be blocked')
        .toMatch(/deadlineAt &&/);
    });

    it(`${name}: treats null/undefined as accepting`, () => {
      // The column defaults to true and is null on older rows; a falsy check
      // would wrongly block campaigns that never opted out.
      expect(src, 'must compare to false, not use a falsy check')
        .not.toMatch(/if \(!\s*campaign\.accept_donations\s*\)/);
    });
  }
});

describe('inactive payment methods are normalised, not rejected', () => {
  const src = readFileSync(join(here, '../app/api/donations/route.ts'), 'utf8');

  it('remaps paypal/venmo to a method Checkout actually offers', () => {
    // METHOD_FEES prices paypal at 3.49%+$0.49 and venmo at 1.9%+$0.10, but
    // neither is in ONE_TIME_PAYMENT_METHOD_TYPES, so such a donor pays by card
    // regardless. Quoting them a rate they cannot use misstates the fee.
    expect(src).toMatch(/requestedMethod === 'paypal' \|\| requestedMethod === 'venmo'/);
    expect(src).toMatch(/\?\s*'card'/);
  });

  it('does not reject them with a 400', () => {
    // A stale cached client sending 'paypal' should still be able to donate; an
    // error would turn a real donation attempt into a lost one.
    expect(src).not.toMatch(/paypal[\s\S]{0,120}status: 400/);
  });
});
