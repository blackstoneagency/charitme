import { describe, expect, it } from 'vitest';
import { donationTotal, donorTip, platformFee, processingFee } from '@shared/fees';

describe('GiveRise fee model', () => {
  it('uses 0% mandatory platform fee', () => {
    expect(platformFee(10_000)).toBe(0);
  });

  it('calculates optional donor tips', () => {
    expect(donorTip(10_000, 8)).toBe(800);
  });

  it('shows transparent total with processing coverage', () => {
    expect(donationTotal(10_000, true, 8)).toBe(10_000 + 800 + processingFee(10_000));
  });
});
