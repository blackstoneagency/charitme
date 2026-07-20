import { describe, expect, it } from 'vitest';
import {
  PLAN_CATALOG,
  PLAN_ORDER,
  FEATURE_KEYS,
  FEATURE_LABELS,
  entitlementsForPlan,
  resolveEntitlements,
  hasFeature,
  isPaidPlan,
  withinLimit,
  type PlanId,
  type FeatureKey,
} from '@shared/entitlements';

// ─────────────────────────────────────────────────────────────────────────────
// Plan entitlements: the READ/gate side of subscriptions. Pins the catalog
// superset invariants, status-based downgrade (lapsed payers lose paid features),
// and the limit helper. Independent of Stripe billing.
// ─────────────────────────────────────────────────────────────────────────────

describe('plan catalog', () => {
  it('has every plan in PLAN_ORDER and no others', () => {
    expect(Object.keys(PLAN_CATALOG).sort()).toEqual([...PLAN_ORDER].sort());
  });

  it('free unlocks no paid features and caps campaigns/AI', () => {
    const free = PLAN_CATALOG.free;
    expect(FEATURE_KEYS.every((k: FeatureKey) => free.features[k] === false)).toBe(true);
    expect(free.limits.activeCampaigns).toBe(1);
    expect(free.limits.aiGenerationsPerMonth).toBe(3);
  });

  it('each higher tier is a feature superset of the one below', () => {
    for (let i = 1; i < PLAN_ORDER.length; i++) {
      const lower = PLAN_CATALOG[PLAN_ORDER[i - 1] as PlanId];
      const higher = PLAN_CATALOG[PLAN_ORDER[i] as PlanId];
      for (const k of FEATURE_KEYS) {
        if (lower.features[k]) {
          expect(higher.features[k], `${PLAN_ORDER[i]} should keep ${k} from ${PLAN_ORDER[i - 1]}`).toBe(true);
        }
      }
    }
  });

  it('every feature key has a non-empty display label', () => {
    for (const k of FEATURE_KEYS) {
      expect(FEATURE_LABELS[k], `missing label for ${k}`).toBeTruthy();
    }
    // no stray labels beyond the known keys
    expect(Object.keys(FEATURE_LABELS).sort()).toEqual([...FEATURE_KEYS].sort());
  });

  it('enterprise unlocks white-label, API, SSO, and audit logs', () => {
    const e = PLAN_CATALOG.enterprise;
    for (const k of ['white_label', 'api_access', 'sso', 'audit_logs'] as FeatureKey[]) {
      expect(hasFeature(e, k)).toBe(true);
    }
    // ...which lower tiers do not have
    expect(hasFeature(PLAN_CATALOG.pro, 'white_label')).toBe(false);
  });
});

describe('entitlementsForPlan', () => {
  it('returns the matching plan; unknown falls back to free', () => {
    expect(entitlementsForPlan('pro').planId).toBe('pro');
    expect(entitlementsForPlan('nonsense').planId).toBe('free');
    expect(entitlementsForPlan(null).planId).toBe('free');
  });
});

describe('resolveEntitlements (status-aware)', () => {
  it('grants paid features while active or trialing', () => {
    expect(resolveEntitlements('pro', 'active').planId).toBe('pro');
    expect(resolveEntitlements('starter', 'trialing').planId).toBe('starter');
  });

  it('downgrades a lapsed/cancelled/past_due/paused payer to free', () => {
    for (const status of ['cancelled', 'past_due', 'paused', 'unknown', null]) {
      expect(resolveEntitlements('pro', status).planId, `status=${status}`).toBe('free');
    }
  });

  it('free stays free under any status', () => {
    expect(resolveEntitlements('free', 'cancelled').planId).toBe('free');
    expect(resolveEntitlements(null, null).planId).toBe('free');
  });
});

describe('helpers', () => {
  it('isPaidPlan is true only for paid tiers', () => {
    expect(isPaidPlan('free')).toBe(false);
    expect(isPaidPlan(null)).toBe(false);
    expect(isPaidPlan('starter')).toBe(true);
    expect(isPaidPlan('enterprise')).toBe(true);
  });

  it('withinLimit respects finite caps and treats null as unlimited', () => {
    const free = PLAN_CATALOG.free; // activeCampaigns = 1
    expect(withinLimit(free, 'activeCampaigns', 0)).toBe(true);
    expect(withinLimit(free, 'activeCampaigns', 1)).toBe(false); // at the cap
    const pro = PLAN_CATALOG.pro; // unlimited
    expect(withinLimit(pro, 'activeCampaigns', 9999)).toBe(true);
  });
});
