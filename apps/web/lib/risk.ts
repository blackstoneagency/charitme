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
