import { describe, expect, it } from 'vitest';
import { detectRiskFlags } from '../lib/risk';

describe('risk detection', () => {
  it('flags high-risk language without making public accusations', () => {
    const flags = detectRiskFlags({ story: 'Please send urgent cash only off platform.' });
    expect(flags.some((flag) => flag.code === 'high_risk_keywords')).toBe(true);
  });

  it('flags rapid campaign creation', () => {
    const flags = detectRiskFlags({ story: 'Normal story', campaignCountLastDay: 4 });
    expect(flags.some((flag) => flag.code === 'rapid_creation')).toBe(true);
  });
});
