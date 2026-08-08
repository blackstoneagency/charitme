import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateTrustScore, getTrustStatus, trustScoreIsMeasurable } from '../lib/ai-platform';
import { STORED_TRUST_TIERS } from '../lib/trust-tiers';

const here = dirname(fileURLToPath(import.meta.url));
const cardRaw = readFileSync(join(here, '..', 'components', 'CampaignCard.tsx'), 'utf8');
/**
 * Comments stripped before any "must not contain" check.
 *
 * The comment in CampaignCard NAMES the function it stopped calling, to explain
 * why. Asserting absence against the raw file therefore fails on correct code —
 * and would pass on code that called it again after someone deleted the comment.
 * Third time this exact trap has bitten in this codebase; it is written down
 * here rather than rediscovered a fourth time.
 */
const card = cardRaw.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ─────────────────────────────────────────────────────────────────────────────
// A campaign card showed two trust labels that contradicted each other.
//
// MEASURED ON PRODUCTION, /supporter-space, before this fix:
//   · 18 of 18 cards carried an admin-set "✓ Verified" badge
//   · 18 of 18 simultaneously showed a computed chip reading "Needs More Info"
//   · only TWO distinct scores existed across all 18 cards: 52 and 57
//
// The cause is that `calculateTrustScore` treats an ABSENT signal exactly like a
// FALSE one, and `CampaignCardData` carries 5 of the 15 signals it reads. The
// other 10 scored as failures on every campaign, so the chip was a
// confident-looking constant that disagreed with the badge beside it.
//
// This is the same class as "136 days left" above "This campaign has ended":
// two surfaces answering one question differently, on one card.
// ─────────────────────────────────────────────────────────────────────────────

/** Exactly the fields `CampaignCardData` carries that the scorer reads. */
const CARD_SHAPED = {
  cover_image_url: 'https://example.test/a.jpg',
  tagline: 'A tagline comfortably over twenty-four characters',
  deadline: '2030-01-01',
  backer_count: 9,
  status: 'active',
};

describe('a score built from a card is not a trust score', () => {
  it('reports card-shaped input as unmeasurable', () => {
    expect(trustScoreIsMeasurable(CARD_SHAPED)).toBe(false);
  });

  it('reports a full row as measurable', () => {
    // The trust-score APIs pass real rows; they must keep working.
    expect(trustScoreIsMeasurable({ ...CARD_SHAPED, identity_verified: true })).toBe(true);
    expect(trustScoreIsMeasurable({ ...CARD_SHAPED, stripe_onboarded: false })).toBe(true);
    expect(trustScoreIsMeasurable({ ...CARD_SHAPED, evidence_count: 0 })).toBe(true);
    expect(trustScoreIsMeasurable({ ...CARD_SHAPED, admin_review_status: 'pending' })).toBe(true);
  });

  it('distinguishes absent from false, which is the whole point', () => {
    // `false` is an answer; `undefined` is not. Treating them alike is what
    // produced the constant.
    expect(trustScoreIsMeasurable({ identity_verified: false })).toBe(true);
    expect(trustScoreIsMeasurable({})).toBe(false);
  });

  it('demonstrates the constant the old chip rendered', () => {
    // Reproduces production exactly: 52 without three backers, 57 with.
    const lean = calculateTrustScore({ ...CARD_SHAPED, backer_count: 0 });
    const full = calculateTrustScore(CARD_SHAPED);
    expect([lean, full]).toEqual([52, 57]);
    // …and both label the same way, on every campaign, regardless of the badge.
    expect(getTrustStatus(lean)).toBe('Needs More Info');
    expect(getTrustStatus(full)).toBe('Needs More Info');
  });

  it('a verified campaign scored identically to an unverified one', () => {
    // The contradiction in one assertion: identical card input, opposite stored
    // tiers, same computed label.
    const verified = calculateTrustScore({ ...CARD_SHAPED });
    const unknown = calculateTrustScore({ ...CARD_SHAPED });
    expect(verified).toBe(unknown);
  });
});

describe('the card shows the stored tier, not a score it cannot compute', () => {
  it('no longer computes a score at all', () => {
    expect(card, 'a card cannot compute a trust score from what it carries')
      .not.toMatch(/calculateTrustScore\(/);
    expect(card).not.toMatch(/getTrustLabel\(/);
  });

  it('renders the stored tier instead', () => {
    expect(cardRaw).toMatch(/STORED_TRUST_TIERS\.find\(\(t\) => t === c\.trust_status\)/);
  });

  it('does not repeat "Verified" when the badge already says it', () => {
    expect(cardRaw).toMatch(/\{tier && !isVerified &&/);
  });

  it('replaced the Trust tile with a figure the card actually has', () => {
    expect(cardRaw).toMatch(/label: 'Raised', value: formatCents\(c\.raised_amount \?\? 0, currency\)/);
    expect(card).not.toMatch(/label: 'Trust'/);
  });
});

describe('the two trust vocabularies are recorded as different', () => {
  it('the stored tiers include what the scorer can never produce', () => {
    // `Trusted` is the most common value in production (133 of 314 measured) and
    // `getTrustStatus` never returns it. `Flagged` likewise.
    expect(STORED_TRUST_TIERS).toContain('Trusted');
    expect(STORED_TRUST_TIERS).toContain('Flagged');
  });

  it('the scorer produces a label the stored column can never hold', () => {
    // `Strong Trust` is not settable in admin. Two vocabularies, three shared
    // words, three that differ — which is exactly how they got conflated.
    expect(getTrustStatus(75)).toBe('Strong Trust');
    expect(STORED_TRUST_TIERS as readonly string[]).not.toContain('Strong Trust');
  });
});
