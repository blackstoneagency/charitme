import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The pricing page opens on YEARLY — the better-value plan (20% off). Left on
// monthly, every visitor saw the higher per-month number first and had to find
// the saving themselves.
//
// Guarded because it is a one-word default that reads as arbitrary, and is
// exactly the kind of thing a later refactor flips back without noticing.
describe('pricing defaults to yearly billing', () => {
  const src = readFileSync(
    join(__dirname, '../app/pricing/PricingPageClient.tsx'),
    'utf8',
  );

  it('initialises the billing toggle to yearly', () => {
    expect(src).toMatch(/useState<'monthly' \| 'yearly'>\('yearly'\)/);
    expect(src).not.toMatch(/useState<'monthly' \| 'yearly'>\('monthly'\)/);
  });

  it('still offers monthly as a choice', () => {
    // Defaulting to yearly must not remove the option.
    expect(src).toMatch(/setBilling\('monthly'\)/);
  });
});
