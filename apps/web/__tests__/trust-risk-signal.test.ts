import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { calculateTrustScore } from '../lib/ai-platform';

// ─────────────────────────────────────────────────────────────────────────────
// The risk-flag signal used to fail OPEN.
//
// `buildCampaignTrustInput` returned `risk_flag_count: riskRes.count ?? 0`, and
// `count` is null whenever the query errors — so a timeout, an RLS denial or a
// missing table handed a campaign with open risk flags a clean bill of health.
// The score deducts up to 24 points for flags, which is enough to move a campaign
// out of the red/amber band into green on the PUBLIC campaign page.
//
// Production currently holds **560 open/reviewing risk flags**, so "assume clean"
// is the wrong default here.
//
// The chosen behaviour: unknown applies the FULL deduction. Briefly under-scoring
// an honest campaign during a database blip is a much smaller harm than briefly
// certifying a flagged one as trustworthy, and it self-corrects on the next read.
// ─────────────────────────────────────────────────────────────────────────────

// Deliberately mid-range: the score is clamped at 99, and a maximal base sat on
// that ceiling where an 8-point deduction was invisible — the first version of
// this test failed for that reason, not because the code was wrong.
const base = {
  cover_image_url: 'https://example.test/x.webp',
  tagline: 'A clear tagline for the campaign',
  description: 'x'.repeat(600),
  raised_amount: 50_000,
  goal_amount: 100_000,
  backer_count: 40,
  status: 'active',
  identity_verified: false,
  beneficiary_verified: false,
  stripe_onboarded: true,
  evidence_count: 1,
  account_age_days: 30,
  prior_campaign_count: 0,
};

describe('an unreadable risk signal never scores as clean', () => {
  it('scores strictly lower than a verified-clean campaign', () => {
    const clean = calculateTrustScore({ ...base, risk_flag_count: 0 });
    const unknown = calculateTrustScore({ ...base, risk_flag_count: null, risk_signal_unavailable: true });
    expect(unknown).toBeLessThan(clean);
  });

  it('is treated as at least as severe as three flags', () => {
    // 3 × 8 = 24 = the cap, so unknown must not beat it.
    const threeFlags = calculateTrustScore({ ...base, risk_flag_count: 3 });
    const unknown = calculateTrustScore({ ...base, risk_flag_count: null, risk_signal_unavailable: true });
    expect(unknown).toBeLessThanOrEqual(threeFlags);
  });

  it('a null count WITHOUT the flag still behaves as before', () => {
    // Guards against the fix changing unrelated callers that pass no risk data.
    const nullNoFlag = calculateTrustScore({ ...base, risk_flag_count: null });
    const zero = calculateTrustScore({ ...base, risk_flag_count: 0 });
    expect(nullNoFlag).toBe(zero);
  });
});

describe('known risk counts still score normally', () => {
  it('each flag costs score, up to the cap', () => {
    const zero = calculateTrustScore({ ...base, risk_flag_count: 0 });
    const one = calculateTrustScore({ ...base, risk_flag_count: 1 });
    const many = calculateTrustScore({ ...base, risk_flag_count: 50 });
    expect(one).toBeLessThan(zero);
    expect(many).toBeLessThan(one);
    // The deduction is capped, so 50 flags cannot cost more than the cap.
    expect(zero - many).toBeLessThanOrEqual(24);
  });
});

describe('the builder marks the signal unavailable', () => {
  const src = readFileSync(join(__dirname, '../lib/trust-signals.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');

  it('no longer coerces a failed count to zero', () => {
    expect(src).not.toMatch(/risk_flag_count:\s*riskRes\.count \?\? 0/);
  });

  it('checks the query error and the null count', () => {
    expect(src).toMatch(/Boolean\(riskRes\.error\) \|\| riskRes\.count == null/);
    expect(src).toContain('risk_signal_unavailable');
  });
});
