import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_DONATION_CENTS, MIN_DONATION_CENTS } from '@shared/fees';
import {
  REWARD_DELIVERY_MAX,
  REWARD_DESCRIPTION_MAX,
  REWARD_TITLE_MAX,
  REWARD_TITLE_MIN,
  MAX_REWARDS_PER_CAMPAIGN,
  draftRewardHasContent,
  emptyDraftReward,
  rewardAmountCents,
  summarizeRewardSync,
  parseDraftRewards,
  toRewardPayloads,
  validateDraftReward,
  validateDraftRewards,
  type DraftReward,
} from '../lib/campaign-rewards-draft';

function reward(overrides: Partial<DraftReward> = {}): DraftReward {
  return { ...emptyDraftReward('k1'), title: 'Tote bag', amount: '25', ...overrides };
}

describe('rewardAmountCents', () => {
  it('parses plain and decimal dollars', () => {
    expect(rewardAmountCents('25')).toBe(2500);
    expect(rewardAmountCents('25.50')).toBe(2550);
    expect(rewardAmountCents('0.99')).toBe(99);
  });

  it('tolerates currency formatting the organizer pastes in', () => {
    expect(rewardAmountCents('$25')).toBe(2500);
    expect(rewardAmountCents('1,000')).toBe(100000);
    expect(rewardAmountCents(' 25 ')).toBe(2500);
  });

  it('rounds rather than inheriting float error', () => {
    // parseFloat('25.10') * 100 is 2509.9999…, which the route's z.number().int()
    // would reject outright.
    expect(rewardAmountCents('25.10')).toBe(2510);
    expect(Number.isInteger(rewardAmountCents('25.10'))).toBe(true);
    expect(rewardAmountCents('19.99')).toBe(1999);
  });

  it('returns null for unusable input instead of NaN', () => {
    expect(rewardAmountCents('')).toBeNull();
    expect(rewardAmountCents('abc')).toBeNull();
    expect(rewardAmountCents('12abc')).toBeNull();
    expect(rewardAmountCents('1.2.3')).toBeNull();
  });
});

describe('validateDraftReward', () => {
  it('accepts a well-formed reward', () => {
    expect(validateDraftReward(reward())).toBeNull();
  });

  it('accepts a blank item limit as unlimited', () => {
    expect(validateDraftReward(reward({ itemLimit: '' }))).toBeNull();
  });

  it('names the field that is wrong, so the builder can focus it', () => {
    expect(validateDraftReward(reward({ title: 'x' }))?.field).toBe('title');
    expect(validateDraftReward(reward({ amount: '' }))?.field).toBe('amount');
    expect(validateDraftReward(reward({ itemLimit: 'many' }))?.field).toBe('itemLimit');
    expect(validateDraftReward(reward({ description: 'x'.repeat(REWARD_DESCRIPTION_MAX + 1) }))?.field)
      .toBe('description');
    expect(validateDraftReward(reward({ estimatedDelivery: 'x'.repeat(REWARD_DELIVERY_MAX + 1) }))?.field)
      .toBe('estimatedDelivery');
  });

  it('enforces the shared donation bounds', () => {
    expect(validateDraftReward(reward({ amount: '0.50' }))?.field).toBe('amount');
    expect(validateDraftReward(reward({ amount: String(MIN_DONATION_CENTS / 100) }))).toBeNull();
    expect(validateDraftReward(reward({ amount: String(MAX_DONATION_CENTS / 100 + 1) }))?.field)
      .toBe('amount');
  });

  it('rejects a zero or negative item limit', () => {
    expect(validateDraftReward(reward({ itemLimit: '0' }))?.field).toBe('itemLimit');
    // A leading minus fails the digits-only test rather than parsing to -5.
    expect(validateDraftReward(reward({ itemLimit: '-5' }))?.field).toBe('itemLimit');
  });
});

describe('validateDraftRewards', () => {
  it('ignores untouched rows — the editor always shows one', () => {
    expect(validateDraftRewards([emptyDraftReward('a'), emptyDraftReward('b')])).toBeNull();
  });

  it('reports which row is broken', () => {
    const result = validateDraftRewards([
      reward({ key: 'good' }),
      reward({ key: 'bad', amount: 'nope' }),
    ]);
    expect(result?.key).toBe('bad');
    expect(result?.error.field).toBe('amount');
  });

  it('treats a partially filled row as real input, not a blank', () => {
    // Someone typing a title and tabbing away must not silently lose the reward.
    const partial = emptyDraftReward('p');
    partial.title = 'Signed print';
    expect(draftRewardHasContent(partial)).toBe(true);
    expect(validateDraftRewards([partial])?.error.field).toBe('amount');
  });
});

describe('toRewardPayloads', () => {
  it('drops untouched rows and numbers the rest in order', () => {
    const payloads = toRewardPayloads([
      reward({ key: 'a', title: 'Sticker', amount: '10' }),
      emptyDraftReward('blank'),
      reward({ key: 'b', title: 'Tote', amount: '25' }),
    ]);
    expect(payloads).toHaveLength(2);
    expect(payloads.map((p) => p.sortOrder)).toEqual([0, 1]);
    expect(payloads.map((p) => p.title)).toEqual(['Sticker', 'Tote']);
  });

  it('omits optional fields rather than sending empty strings', () => {
    const [payload] = toRewardPayloads([reward()]);
    expect(payload).toBeDefined();
    expect('description' in payload!).toBe(false);
    expect('estimatedDelivery' in payload!).toBe(false);
    expect(payload!.itemLimit).toBeNull();
  });

  it('includes optional fields when the organizer filled them in', () => {
    const [payload] = toRewardPayloads([
      reward({ description: 'Organic cotton', estimatedDelivery: 'March 2027', itemLimit: '50' }),
    ]);
    expect(payload!.description).toBe('Organic cotton');
    expect(payload!.estimatedDelivery).toBe('March 2027');
    expect(payload!.itemLimit).toBe(50);
  });

  it('never emits an invalid payload, even if the caller skipped validation', () => {
    const payloads = toRewardPayloads([reward({ amount: 'not-a-number' })]);
    expect(payloads).toEqual([]);
  });

  it('caps the number of rewards written', () => {
    const many = Array.from({ length: MAX_REWARDS_PER_CAMPAIGN + 5 }, (_, i) =>
      reward({ key: `k${i}`, title: `Tier ${i}`, amount: '10' }));
    expect(toRewardPayloads(many)).toHaveLength(MAX_REWARDS_PER_CAMPAIGN);
  });

  it('trims whitespace so titles are stored clean', () => {
    const [payload] = toRewardPayloads([reward({ title: '  Tote bag  ' })]);
    expect(payload!.title).toBe('Tote bag');
  });
});

describe('parseDraftRewards', () => {
  it('round-trips what the builder stores', () => {
    const original = [reward({ key: 'a', description: 'Nice', itemLimit: '10' })];
    expect(parseDraftRewards(JSON.stringify(original))).toEqual(original);
  });

  it('never throws on junk — an unreadable draft must not cost the campaign', () => {
    for (const raw of ['', null, undefined, 'not json', '{}', '42', '"a string"', '[null, 3]']) {
      expect(() => parseDraftRewards(raw)).not.toThrow();
    }
    expect(parseDraftRewards('not json')).toEqual([]);
    expect(parseDraftRewards('{}')).toEqual([]);
    expect(parseDraftRewards('[null, 3]')).toEqual([]);
  });

  it('coerces non-string fields rather than trusting the stored shape', () => {
    const [restored] = parseDraftRewards(JSON.stringify([{ title: 42, amount: null, key: 'k' }]));
    expect(restored!.title).toBe('');
    expect(restored!.amount).toBe('');
  });

  it('gives every row a key, so React does not reuse inputs across rows', () => {
    const rows = parseDraftRewards(JSON.stringify([{ title: 'a' }, { title: 'b' }]));
    expect(rows.map((r) => r.key)).toEqual(['restored-0', 'restored-1']);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });

  it('caps a hand-edited draft at the maximum', () => {
    const many = Array.from({ length: MAX_REWARDS_PER_CAMPAIGN + 10 }, (_, i) => ({ title: `t${i}` }));
    expect(parseDraftRewards(JSON.stringify(many))).toHaveLength(MAX_REWARDS_PER_CAMPAIGN);
  });
});

describe('summarizeRewardSync', () => {
  it('says nothing when there was nothing to do, or everything worked', () => {
    expect(summarizeRewardSync(0, 0)).toBeNull();
    expect(summarizeRewardSync(3, 3)).toBeNull();
  });

  it('never describes a partial failure as a failed publish', () => {
    // The campaign IS live. Telling the organizer publishing failed would invite
    // a retry that creates a second campaign.
    for (const message of [
      summarizeRewardSync(1, 0),
      summarizeRewardSync(3, 0),
      summarizeRewardSync(3, 2),
    ]) {
      expect(message).toBeTruthy();
      expect(message!.toLowerCase()).toContain('live');
      expect(message!.toLowerCase()).not.toContain('failed to publish');
      expect(message!.toLowerCase()).not.toContain('try again');
    }
  });

  it('counts correctly on a partial write', () => {
    expect(summarizeRewardSync(3, 2)).toContain('2 of 3');
  });

  it('uses singular wording for a single reward', () => {
    expect(summarizeRewardSync(1, 0)).toContain('the reward');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Drift guard. These bounds are duplicated from the route's zod schema on
// purpose (so the organizer is told before publishing, not after), which means
// the two copies must be checked against each other.
// ─────────────────────────────────────────────────────────────────────────────

describe('bounds match the API route', () => {
  const route = readFileSync(
    join(__dirname, '..', 'app', 'api', 'campaigns', '[id]', 'rewards', 'route.ts'),
    'utf8',
  );

  it('reads the route source it is guarding', () => {
    // Fails loudly if the route moves, rather than silently guarding nothing.
    expect(route).toContain('const CreateSchema');
  });

  it('mirrors the title bounds', () => {
    expect(route).toContain(`min(${REWARD_TITLE_MIN}).max(${REWARD_TITLE_MAX})`);
  });

  it('mirrors the description and delivery bounds', () => {
    expect(route).toContain(`max(${REWARD_DESCRIPTION_MAX})`);
    expect(route).toContain(`max(${REWARD_DELIVERY_MAX})`);
  });

  it('mirrors the amount bounds by referencing the same shared constants', () => {
    expect(route).toContain('MIN_DONATION_CENTS');
    expect(route).toContain('MAX_DONATION_CENTS');
  });
});
