import { describe, expect, it } from 'vitest';
import { buildBeneficiarySummary } from '../lib/beneficiary-data';

// ─────────────────────────────────────────────────────────────────────────────
// Beneficiary portal — shaping and money math.
//
// Unit-tested because the page is auth-gated and there is no database here, so
// the totals would otherwise ship unverified. Payout money in particular must be
// right: this view tells someone whether funds raised for them have actually been
// paid out, and an over-count would be a false reassurance.
// ─────────────────────────────────────────────────────────────────────────────

const campaign = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'c1', slug: 'help-me', title: 'Help me', status: 'active',
  goal_amount: 500_00, raised_amount: 120_00, backer_count: 4,
  cover_image_url: null, category: 'Medical', created_at: '2026-01-01T00:00:00Z',
  user_id: 'org1', ...over,
}) as never;

describe('buildBeneficiarySummary', () => {
  it('returns an empty, zeroed summary when the user benefits from nothing', () => {
    const s = buildBeneficiarySummary([], [], []);
    expect(s.campaigns).toEqual([]);
    expect(s.totalRaisedCents).toBe(0);
    expect(s.totalPaidOutCents).toBe(0);
    expect(s.activeCount).toBe(0);
  });

  it('maps a campaign and resolves the organizer name', () => {
    const s = buildBeneficiarySummary([campaign()], [], [{ id: 'org1', full_name: 'Dana Organizer' }]);
    expect(s.campaigns[0]).toMatchObject({
      slug: 'help-me', title: 'Help me', raisedCents: 120_00, goalCents: 500_00,
      organizerName: 'Dana Organizer',
    });
  });

  it('falls back to a neutral organizer label when the profile is missing', () => {
    const s = buildBeneficiarySummary([campaign()], [], []);
    expect(s.campaigns[0].organizerName).toBe('Organizer');
  });

  it('counts ONLY paid payouts as paid out', () => {
    const s = buildBeneficiarySummary([campaign()], [
      { campaign_id: 'c1', amount_cents: 50_00, status: 'paid' },
      { campaign_id: 'c1', amount_cents: 30_00, status: 'requested' },
      { campaign_id: 'c1', amount_cents: 10_00, status: 'failed' },
    ], []);
    // 'failed' must not inflate either bucket — telling a beneficiary money
    // arrived when it bounced would be worse than showing nothing.
    expect(s.campaigns[0].paidOutCents).toBe(50_00);
    expect(s.campaigns[0].pendingPayoutCents).toBe(30_00);
  });

  it('treats requested and approved as in-flight, not delivered', () => {
    const s = buildBeneficiarySummary([campaign()], [
      { campaign_id: 'c1', amount_cents: 20_00, status: 'requested' },
      { campaign_id: 'c1', amount_cents: 25_00, status: 'approved' },
    ], []);
    expect(s.campaigns[0].paidOutCents).toBe(0);
    expect(s.campaigns[0].pendingPayoutCents).toBe(45_00);
  });

  it('does not attribute another campaign\'s payouts', () => {
    const s = buildBeneficiarySummary([campaign()], [
      { campaign_id: 'OTHER', amount_cents: 999_00, status: 'paid' },
    ], []);
    expect(s.campaigns[0].paidOutCents).toBe(0);
    expect(s.totalPaidOutCents).toBe(0);
  });

  it('ignores payout rows with no campaign id rather than mis-attributing them', () => {
    const s = buildBeneficiarySummary([campaign()], [
      { campaign_id: null, amount_cents: 77_00, status: 'paid' },
    ], []);
    expect(s.totalPaidOutCents).toBe(0);
  });

  it('totals across several campaigns and counts only active ones', () => {
    const s = buildBeneficiarySummary(
      [campaign(), campaign({ id: 'c2', slug: 'b', raised_amount: 80_00, status: 'completed' })],
      [
        { campaign_id: 'c1', amount_cents: 40_00, status: 'paid' },
        { campaign_id: 'c2', amount_cents: 60_00, status: 'paid' },
      ],
      [],
    );
    expect(s.totalRaisedCents).toBe(200_00);
    expect(s.totalPaidOutCents).toBe(100_00);
    expect(s.activeCount).toBe(1);
  });

  it('tolerates null money columns as zero rather than NaN', () => {
    const s = buildBeneficiarySummary(
      [campaign({ goal_amount: null, raised_amount: null, backer_count: null })],
      [{ campaign_id: 'c1', amount_cents: null, status: 'paid' }],
      [],
    );
    expect(s.campaigns[0].raisedCents).toBe(0);
    expect(s.campaigns[0].goalCents).toBe(0);
    expect(s.totalPaidOutCents).toBe(0);
    expect(Number.isNaN(s.totalRaisedCents)).toBe(false);
  });
});
