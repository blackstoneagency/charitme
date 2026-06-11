export type RiskFlagCode =
  | 'duplicate_story'
  | 'duplicate_beneficiary'
  | 'high_risk_keywords'
  | 'unusual_payout'
  | 'rapid_creation'
  | 'media_reuse'
  | 'velocity_anomaly'
  | 'refund_anomaly';

export type RiskFlag = {
  code: RiskFlagCode;
  severity: 'low' | 'medium' | 'high';
  label: string;
};

const HIGH_RISK_TERMS = ['wire', 'crypto', 'guaranteed cure', 'urgent cash only', 'off platform'];

export function detectRiskFlags(input: {
  story: string;
  campaignCountLastDay?: number;
  payoutCents?: number;
  raisedCents?: number;
}): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const story = input.story.toLowerCase();

  if (HIGH_RISK_TERMS.some((term) => story.includes(term))) {
    flags.push({ code: 'high_risk_keywords', severity: 'medium', label: 'Language needs review' });
  }

  if ((input.campaignCountLastDay ?? 0) >= 3) {
    flags.push({ code: 'rapid_creation', severity: 'high', label: 'Rapid campaign creation' });
  }

  if ((input.payoutCents ?? 0) > 0 && (input.raisedCents ?? 0) > 0 && (input.payoutCents ?? 0) / (input.raisedCents ?? 1) > 0.9) {
    flags.push({ code: 'unusual_payout', severity: 'medium', label: 'Large payout request' });
  }

  return flags;
}

// ── AI Fraud & Misuse Monitor — additional heuristics ─────────────────────────

/** Flags an unusual spike in donation volume vs. the campaign's recent baseline. */
export function detectVelocityAnomaly(input: { donationsLast24h: number; avgDailyDonations: number }): RiskFlag | null {
  const { donationsLast24h, avgDailyDonations } = input;
  if (donationsLast24h >= 10 && avgDailyDonations > 0 && donationsLast24h > avgDailyDonations * 4) {
    return { code: 'velocity_anomaly', severity: 'medium', label: 'Unusual donation velocity' };
  }
  return null;
}

/** Flags a campaign whose donations are being refunded at a high rate. */
export function detectRefundAnomaly(input: { totalDonations: number; refundedDonations: number }): RiskFlag | null {
  const { totalDonations, refundedDonations } = input;
  if (totalDonations >= 5 && refundedDonations / totalDonations >= 0.25) {
    return { code: 'refund_anomaly', severity: 'medium', label: 'High refund rate' };
  }
  return null;
}

const DUPLICATE_CONTENT_LABELS: Record<'duplicate_story' | 'duplicate_beneficiary' | 'media_reuse', string> = {
  duplicate_story: 'Campaign story matches another campaign by a different organizer',
  duplicate_beneficiary: 'Beneficiary name matches another campaign by a different organizer',
  media_reuse: 'Cover image reused across multiple campaigns by different organizers',
};

/** Flags content (story, beneficiary name, or cover image) shared with campaigns from other organizers. */
export function detectDuplicateContent(code: 'duplicate_story' | 'duplicate_beneficiary' | 'media_reuse', otherOrganizerCount: number): RiskFlag | null {
  if (otherOrganizerCount <= 0) return null;
  return { code, severity: 'high', label: DUPLICATE_CONTENT_LABELS[code] };
}
