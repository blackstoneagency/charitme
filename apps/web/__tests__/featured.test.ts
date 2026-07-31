import { describe, expect, it } from 'vitest';
import {
  resolveFeaturePriceCents,
  selectRotatorCampaigns,
  hasEnded,
  hasReachedGoal,
  isRotatorEligible,
  FEATURE_PRICE_DEFAULT_CENTS,
  FEATURE_PRICE_MIN_CENTS,
  FEATURE_PRICE_MAX_CENTS,
} from '../lib/featured';

describe('resolveFeaturePriceCents', () => {
  it('reads the admin-configured price from payment settings', () => {
    expect(resolveFeaturePriceCents({ featuredCampaignPriceCents: 500 })).toBe(500);
    expect(resolveFeaturePriceCents({ featuredCampaignPriceCents: 2500 })).toBe(2500);
  });

  it('falls back to the $5 default when unset, zero, or non-numeric', () => {
    expect(resolveFeaturePriceCents(undefined)).toBe(FEATURE_PRICE_DEFAULT_CENTS);
    expect(resolveFeaturePriceCents({})).toBe(FEATURE_PRICE_DEFAULT_CENTS);
    expect(resolveFeaturePriceCents({ featuredCampaignPriceCents: 0 })).toBe(FEATURE_PRICE_DEFAULT_CENTS);
    expect(resolveFeaturePriceCents({ featuredCampaignPriceCents: 'abc' })).toBe(FEATURE_PRICE_DEFAULT_CENTS);
    expect(resolveFeaturePriceCents(null)).toBe(FEATURE_PRICE_DEFAULT_CENTS);
  });

  it('clamps out-of-range values to the sane min/max', () => {
    expect(resolveFeaturePriceCents({ featuredCampaignPriceCents: 5 })).toBe(FEATURE_PRICE_MIN_CENTS);
    expect(resolveFeaturePriceCents({ featuredCampaignPriceCents: 9_999_999 })).toBe(FEATURE_PRICE_MAX_CENTS);
  });

  it('rounds fractional cents to whole cents', () => {
    expect(resolveFeaturePriceCents({ featuredCampaignPriceCents: 599.6 })).toBe(600);
  });
});

describe('selectRotatorCampaigns', () => {
  const c = (id: string, featured: boolean) => ({ id, featured });

  it('returns only featured campaigns when at least one is featured', () => {
    const list = [c('a', false), c('b', true), c('c', false), c('d', true)];
    expect(selectRotatorCampaigns(list).map((x) => x.id)).toEqual(['b', 'd']);
  });

  it('falls back to the full list when none are featured (hero never empty)', () => {
    const list = [c('a', false), c('b', false)];
    expect(selectRotatorCampaigns(list)).toHaveLength(2);
  });

  it('preserves the input order of featured campaigns (callers pre-sort by rank)', () => {
    const list = [c('x', true), c('y', false), c('z', true)];
    expect(selectRotatorCampaigns(list).map((x) => x.id)).toEqual(['x', 'z']);
  });

  it('treats missing/null featured as not-featured', () => {
    const list = [{ id: 'a' }, { id: 'b', featured: null }, { id: 'c', featured: true }];
    expect(selectRotatorCampaigns(list).map((x) => x.id)).toEqual(['c']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rotator eligibility.
//
// A paid homepage slot pointing at a campaign that cannot use the money is worse
// than an empty slot: the visitor clicks through to a closed campaign, and the
// creator paid for a placement that converts nothing. Neither condition throws,
// so nothing but a test catches it.
// ─────────────────────────────────────────────────────────────────────────────

const DAY = 86_400_000;
const NOW = Date.parse('2026-07-31T12:00:00.000Z');
const iso = (offsetDays: number) => new Date(NOW + offsetDays * DAY).toISOString();

describe('hasEnded', () => {
  it('is true once the deadline has passed', () => {
    expect(hasEnded({ deadline: iso(-1) }, NOW)).toBe(true);
    expect(hasEnded({ deadline: iso(1) }, NOW)).toBe(false);
  });

  it('treats a deadline exactly at now as ended', () => {
    // Matches the campaign page, which shows "This campaign has ended." when
    // deadline <= now. Two surfaces disagreeing is how a campaign reads as
    // closed on its own page while still rotating on the homepage.
    expect(hasEnded({ deadline: new Date(NOW).toISOString() }, NOW)).toBe(true);
  });

  it('treats a missing or unparseable deadline as NOT ended', () => {
    // Most campaigns have no deadline. Reading absence as "expired" would empty
    // the rotator entirely.
    expect(hasEnded({}, NOW)).toBe(false);
    expect(hasEnded({ deadline: null }, NOW)).toBe(false);
    expect(hasEnded({ deadline: 'not-a-date' }, NOW)).toBe(false);
  });
});

describe('hasReachedGoal', () => {
  it('is true at or above the goal', () => {
    expect(hasReachedGoal({ goal_amount: 1000, raised_amount: 1000 })).toBe(true);
    expect(hasReachedGoal({ goal_amount: 1000, raised_amount: 1001 })).toBe(true);
    expect(hasReachedGoal({ goal_amount: 1000, raised_amount: 999 })).toBe(false);
  });

  it('never reports a goal reached when no goal is set', () => {
    // 0 >= 0 is true, so a naive check would exclude every goal-less campaign
    // the instant it existed — and silently empty the rotator.
    expect(hasReachedGoal({ goal_amount: 0, raised_amount: 0 })).toBe(false);
    expect(hasReachedGoal({ goal_amount: 0, raised_amount: 50_000 })).toBe(false);
    expect(hasReachedGoal({ raised_amount: 50_000 })).toBe(false);
    expect(hasReachedGoal({ goal_amount: null, raised_amount: 10 })).toBe(false);
  });

  it('treats a missing raised amount as zero raised', () => {
    expect(hasReachedGoal({ goal_amount: 1000 })).toBe(false);
  });
});

describe('isRotatorEligible', () => {
  it('requires BOTH still-running and still-needing-money', () => {
    expect(isRotatorEligible({ deadline: iso(5), goal_amount: 1000, raised_amount: 400 }, NOW)).toBe(true);
    // Ended but under goal — excluded. The requirement's "or" phrasing would
    // literally admit this; keeping it would leave expired campaigns in the hero.
    expect(isRotatorEligible({ deadline: iso(-5), goal_amount: 1000, raised_amount: 400 }, NOW)).toBe(false);
    // Running but fully funded — excluded.
    expect(isRotatorEligible({ deadline: iso(5), goal_amount: 1000, raised_amount: 1000 }, NOW)).toBe(false);
    expect(isRotatorEligible({ deadline: iso(-5), goal_amount: 1000, raised_amount: 1000 }, NOW)).toBe(false);
  });
});

describe('selectRotatorCampaigns — exclusions', () => {
  const live = (id: string, featured: boolean) => ({
    id,
    featured,
    deadline: iso(10),
    goal_amount: 100_000,
    raised_amount: 10_000,
  });

  it('drops an ended featured campaign', () => {
    const list = [live('ok', true), { ...live('ended', true), deadline: iso(-1) }];
    expect(selectRotatorCampaigns(list, NOW).map((x) => x.id)).toEqual(['ok']);
  });

  it('drops a fully funded featured campaign', () => {
    const list = [live('ok', true), { ...live('funded', true), raised_amount: 100_000 }];
    expect(selectRotatorCampaigns(list, NOW).map((x) => x.id)).toEqual(['ok']);
  });

  it('rotates through EVERY eligible featured campaign, not a subset', () => {
    // The requirement is explicit: all featured campaigns meeting the exclusions
    // are rotated. Nothing here may cap the list.
    const list = Array.from({ length: 25 }, (_, i) => live(`f${i}`, true));
    expect(selectRotatorCampaigns(list, NOW)).toHaveLength(25);
  });

  it('falls back to ELIGIBLE non-featured when every featured one is excluded', () => {
    const list = [
      { ...live('endedFeatured', true), deadline: iso(-1) },
      { ...live('fundedFeatured', true), raised_amount: 100_000 },
      live('plainLive', false),
      { ...live('plainEnded', false), deadline: iso(-2) },
    ];
    // Not the ended plain one either — the exclusions are not a featured-only rule.
    expect(selectRotatorCampaigns(list, NOW).map((x) => x.id)).toEqual(['plainLive']);
  });

  it('returns an empty list when nothing qualifies, rather than an expired campaign', () => {
    // Safe: HeroRotator renders a generic hero when the list is empty.
    const list = [
      { ...live('a', true), deadline: iso(-1) },
      { ...live('b', false), raised_amount: 100_000 },
    ];
    expect(selectRotatorCampaigns(list, NOW)).toEqual([]);
  });

  it('still prefers featured over eligible non-featured', () => {
    const list = [live('plain', false), live('paid', true)];
    expect(selectRotatorCampaigns(list, NOW).map((x) => x.id)).toEqual(['paid']);
  });
});
