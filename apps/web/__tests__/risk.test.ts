import { describe, expect, it } from 'vitest';
import { detectRiskFlags, detectVelocityAnomaly, detectRefundAnomaly, detectDuplicateContent } from '../lib/risk';

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

describe('detectVelocityAnomaly', () => {
  it('flags an unusual spike in donation volume', () => {
    const flag = detectVelocityAnomaly({ donationsLast24h: 12, avgDailyDonations: 2 });
    expect(flag?.code).toBe('velocity_anomaly');
  });

  it('does not flag normal donation volume', () => {
    const flag = detectVelocityAnomaly({ donationsLast24h: 5, avgDailyDonations: 4 });
    expect(flag).toBeNull();
  });
});

describe('detectRefundAnomaly', () => {
  it('flags a high refund rate', () => {
    const flag = detectRefundAnomaly({ totalDonations: 8, refundedDonations: 3 });
    expect(flag?.code).toBe('refund_anomaly');
  });

  it('does not flag a low refund rate', () => {
    const flag = detectRefundAnomaly({ totalDonations: 8, refundedDonations: 1 });
    expect(flag).toBeNull();
  });
});

describe('detectDuplicateContent', () => {
  it('flags content shared with another organizer', () => {
    const flag = detectDuplicateContent('duplicate_story', 1);
    expect(flag?.code).toBe('duplicate_story');
    expect(flag?.severity).toBe('high');
  });

  it('does not flag content that is unique to this organizer', () => {
    const flag = detectDuplicateContent('media_reuse', 0);
    expect(flag).toBeNull();
  });
});
