// ─────────────────────────────────────────────────────────────────────────────
// Draft rewards for the builder's step 7.
//
// ⚠️ **Rewards cannot be saved while the organizer is building.** The API is
// `POST /api/campaigns/[id]/rewards` — it needs a campaign id, verifies the
// caller owns that campaign, and the campaign does not exist until publish. So
// step 7 collects rewards into the wizard draft like any other field, and they
// are written immediately after the campaign row is created.
//
// That ordering has a consequence worth stating plainly: **publishing can
// succeed and a reward write can still fail.** The campaign is live either way,
// so the builder must not present that as a failed publish. `summarizeRewardSync`
// exists to describe exactly that partial outcome.
//
// The validation below deliberately mirrors the zod schema in the route. Two
// copies of a rule is normally the drift this repo has been bitten by; here the
// alternative is an organizer filling in five rewards, publishing, and only then
// discovering the server rejects a 300-character title. The rules are asserted
// against the route's own bounds in the tests so they cannot silently diverge.
// ─────────────────────────────────────────────────────────────────────────────

import { MAX_DONATION_CENTS, MIN_DONATION_CENTS } from '@shared/fees';

export const REWARD_TITLE_MIN = 2;
export const REWARD_TITLE_MAX = 200;
export const REWARD_DESCRIPTION_MAX = 1000;
export const REWARD_DELIVERY_MAX = 100;
/** Upper bound on reward tiers per campaign — well past what anyone builds by hand. */
export const MAX_REWARDS_PER_CAMPAIGN = 20;

export interface DraftReward {
  /** Client-side only, for React keys and edit/remove. Never sent to the API. */
  key: string;
  title: string;
  description: string;
  /** Raw text as typed, e.g. "25" or "25.50". Parsed by `rewardAmountCents`. */
  amount: string;
  estimatedDelivery: string;
  /** Empty string means unlimited. */
  itemLimit: string;
}

export function emptyDraftReward(key: string): DraftReward {
  return { key, title: '', description: '', amount: '', estimatedDelivery: '', itemLimit: '' };
}

/**
 * Parse a typed dollar amount into integer cents.
 *
 * Returns null rather than NaN for anything unusable. Rounding is explicit
 * because `parseFloat('25.10') * 100` is 2509.9999…, and a fractional cent is
 * rejected by the route's `z.number().int()`.
 */
export function rewardAmountCents(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  if (!/^\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/**
 * Restore drafted rewards from the JSON held in `FormState.rewardsJson`.
 *
 * Never throws. A draft can be a week old, hand-edited in localStorage, or
 * written by an older build, and none of those may cost the organizer the rest
 * of their campaign — an unreadable value simply yields no rewards.
 */
export function parseDraftRewards(raw: string | null | undefined): DraftReward[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .slice(0, MAX_REWARDS_PER_CAMPAIGN)
    .map((entry, index) => {
      const text = (value: unknown) => (typeof value === 'string' ? value : '');
      return {
        key: typeof entry.key === 'string' && entry.key ? entry.key : `restored-${index}`,
        title: text(entry.title),
        description: text(entry.description),
        amount: text(entry.amount),
        estimatedDelivery: text(entry.estimatedDelivery),
        itemLimit: text(entry.itemLimit),
      };
    });
}

export interface RewardFieldError {
  field: 'title' | 'amount' | 'description' | 'estimatedDelivery' | 'itemLimit';
  message: string;
}

/**
 * Validate one drafted reward.
 *
 * Returns the first problem with the field that owns it, so the builder can
 * focus that input — the same shape `builder-validation.ts` uses, and the
 * difference between a disabled button and one the organizer can act on.
 */
export function validateDraftReward(reward: DraftReward): RewardFieldError | null {
  const title = reward.title.trim();
  if (title.length < REWARD_TITLE_MIN) {
    return { field: 'title', message: 'Give this reward a name of at least 2 characters.' };
  }
  if (title.length > REWARD_TITLE_MAX) {
    return { field: 'title', message: `Reward names are limited to ${REWARD_TITLE_MAX} characters.` };
  }
  if (reward.description.trim().length > REWARD_DESCRIPTION_MAX) {
    return { field: 'description', message: `Reward descriptions are limited to ${REWARD_DESCRIPTION_MAX} characters.` };
  }
  if (reward.estimatedDelivery.trim().length > REWARD_DELIVERY_MAX) {
    return { field: 'estimatedDelivery', message: `Keep delivery estimates under ${REWARD_DELIVERY_MAX} characters.` };
  }

  const cents = rewardAmountCents(reward.amount);
  if (cents === null) {
    return { field: 'amount', message: 'Enter the donation amount that earns this reward.' };
  }
  if (cents < MIN_DONATION_CENTS) {
    return { field: 'amount', message: `The minimum is $${(MIN_DONATION_CENTS / 100).toFixed(2)}.` };
  }
  if (cents > MAX_DONATION_CENTS) {
    return { field: 'amount', message: 'That amount is larger than we can accept.' };
  }

  const limitRaw = reward.itemLimit.trim();
  if (limitRaw) {
    if (!/^\d+$/.test(limitRaw)) {
      return { field: 'itemLimit', message: 'Enter a whole number, or leave blank for unlimited.' };
    }
    if (Number(limitRaw) < 1) {
      return { field: 'itemLimit', message: 'A limit must be at least 1, or blank for unlimited.' };
    }
  }

  return null;
}

/** True when the organizer has typed anything into this reward at all. */
export function draftRewardHasContent(reward: DraftReward): boolean {
  return Boolean(
    reward.title.trim() ||
    reward.description.trim() ||
    reward.amount.trim() ||
    reward.estimatedDelivery.trim() ||
    reward.itemLimit.trim(),
  );
}

/**
 * Validate the whole set, ignoring rows the organizer never filled in.
 *
 * A blank row is not an error — the editor always shows one empty row to type
 * into, and treating that as invalid would block the step for everyone who
 * chose to skip rewards entirely.
 */
export function validateDraftRewards(
  rewards: DraftReward[],
): { key: string; error: RewardFieldError } | null {
  for (const reward of rewards) {
    if (!draftRewardHasContent(reward)) continue;
    const error = validateDraftReward(reward);
    if (error) return { key: reward.key, error };
  }
  return null;
}

/** The API payload for one reward — exactly the route's `CreateSchema` shape. */
export interface RewardPayload {
  title: string;
  description?: string;
  amountCents: number;
  estimatedDelivery?: string;
  itemLimit: number | null;
  sortOrder: number;
}

/**
 * Convert drafted rewards into API payloads, dropping untouched rows.
 *
 * Optional fields are omitted rather than sent as empty strings: the route
 * declares them `.optional()`, and an empty string would store a blank
 * description where the column should stay null.
 */
export function toRewardPayloads(rewards: DraftReward[]): RewardPayload[] {
  return rewards
    .filter(draftRewardHasContent)
    .filter((r) => validateDraftReward(r) === null)
    .slice(0, MAX_REWARDS_PER_CAMPAIGN)
    .map((reward, index) => {
      const description = reward.description.trim();
      const estimatedDelivery = reward.estimatedDelivery.trim();
      const limitRaw = reward.itemLimit.trim();
      return {
        title: reward.title.trim(),
        ...(description ? { description } : {}),
        amountCents: rewardAmountCents(reward.amount)!,
        ...(estimatedDelivery ? { estimatedDelivery } : {}),
        itemLimit: limitRaw ? Number(limitRaw) : null,
        sortOrder: index,
      };
    });
}

/**
 * Describe the outcome of writing rewards after a successful publish.
 *
 * ⚠️ The campaign is already live at this point. This must never read as a
 * failed publish, because retrying the publish would be the wrong action and
 * could create a second campaign. It says what did happen and where to fix the
 * rest.
 */
export function summarizeRewardSync(attempted: number, succeeded: number): string | null {
  if (attempted === 0 || succeeded === attempted) return null;
  if (succeeded === 0) {
    return attempted === 1
      ? 'Your campaign is live, but the reward could not be saved. You can add it from your dashboard.'
      : `Your campaign is live, but the ${attempted} rewards could not be saved. You can add them from your dashboard.`;
  }
  return `Your campaign is live. ${succeeded} of ${attempted} rewards were saved — you can add the rest from your dashboard.`;
}
