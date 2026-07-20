// ─────────────────────────────────────────────────────────────────────────────
// Plan entitlements — pure catalog + resolution (no I/O, unit-testable).
//
// Maps a subscription plan (the `subscriptions.plan` enum) to the concrete
// features and limits a user gets. This is the READ/gate side of subscriptions
// and is independent of billing: it works the moment a subscription row exists,
// however that row is written (Stripe webhook later, or an admin today).
// The Stripe checkout/webhook that WRITES the row is separate (and gated on a
// Stripe test environment — see todo.md C4).
// ─────────────────────────────────────────────────────────────────────────────

export type PlanId = 'free' | 'starter' | 'pro' | 'enterprise';

export type SubscriptionStatus = 'active' | 'trialing' | 'cancelled' | 'past_due' | 'paused';

/** A plan's paid entitlements apply only while the subscription is in good standing. */
export const ENTITLED_STATUSES: readonly SubscriptionStatus[] = ['active', 'trialing'] as const;

export type FeatureKey =
  | 'ai_campaign_writer'
  | 'ai_media'
  | 'custom_campaign_url'
  | 'advanced_analytics'
  | 'donor_crm'
  | 'email_marketing'
  | 'automation'
  | 'priority_support'
  | 'custom_branding'
  | 'white_label'
  | 'api_access'
  | 'sso'
  | 'audit_logs'
  | 'multi_admin';

export const FEATURE_KEYS: readonly FeatureKey[] = [
  'ai_campaign_writer',
  'ai_media',
  'custom_campaign_url',
  'advanced_analytics',
  'donor_crm',
  'email_marketing',
  'automation',
  'priority_support',
  'custom_branding',
  'white_label',
  'api_access',
  'sso',
  'audit_logs',
  'multi_admin',
] as const;

/** Human-readable labels for each feature, for UI display. */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  ai_campaign_writer: 'AI campaign writer',
  ai_media: 'AI images & media',
  custom_campaign_url: 'Custom campaign URL',
  advanced_analytics: 'Advanced analytics',
  donor_crm: 'Donor CRM',
  email_marketing: 'Email marketing',
  automation: 'Marketing automation',
  priority_support: 'Priority support',
  custom_branding: 'Custom branding',
  white_label: 'White-label pages',
  api_access: 'API access',
  sso: 'Single sign-on (SSO)',
  audit_logs: 'Audit logs',
  multi_admin: 'Multiple admins',
};

export interface PlanLimits {
  /** Max simultaneously-active campaigns. null = unlimited. */
  activeCampaigns: number | null;
  /** AI generations per month. null = unlimited. */
  aiGenerationsPerMonth: number | null;
  /** Team seats (admins/collaborators). */
  teamSeats: number;
}

export interface PlanEntitlements {
  planId: PlanId;
  name: string;
  monthlyPriceCents: number;
  limits: PlanLimits;
  features: Record<FeatureKey, boolean>;
}

function feats(enabled: FeatureKey[]): Record<FeatureKey, boolean> {
  const out = {} as Record<FeatureKey, boolean>;
  for (const k of FEATURE_KEYS) out[k] = enabled.includes(k);
  return out;
}

// Canonical catalog. Higher tiers are supersets of lower ones.
const STARTER_FEATURES: FeatureKey[] = ['ai_campaign_writer', 'ai_media', 'custom_campaign_url', 'priority_support'];
const PRO_FEATURES: FeatureKey[] = [
  ...STARTER_FEATURES,
  'advanced_analytics',
  'donor_crm',
  'email_marketing',
  'automation',
  'custom_branding',
  'multi_admin',
];
const ENTERPRISE_FEATURES: FeatureKey[] = [...PRO_FEATURES, 'white_label', 'api_access', 'sso', 'audit_logs'];

export const PLAN_CATALOG: Record<PlanId, PlanEntitlements> = {
  free: {
    planId: 'free',
    name: 'CharitMe Free',
    monthlyPriceCents: 0,
    limits: { activeCampaigns: 1, aiGenerationsPerMonth: 3, teamSeats: 1 },
    features: feats([]),
  },
  starter: {
    planId: 'starter',
    name: 'CharitMe Plus',
    monthlyPriceCents: 1999,
    limits: { activeCampaigns: 5, aiGenerationsPerMonth: null, teamSeats: 2 },
    features: feats(STARTER_FEATURES),
  },
  pro: {
    planId: 'pro',
    name: 'Nonprofit Growth',
    monthlyPriceCents: 7900,
    limits: { activeCampaigns: null, aiGenerationsPerMonth: null, teamSeats: 10 },
    features: feats(PRO_FEATURES),
  },
  enterprise: {
    planId: 'enterprise',
    name: 'Enterprise',
    monthlyPriceCents: 0, // custom pricing
    limits: { activeCampaigns: null, aiGenerationsPerMonth: null, teamSeats: 1000 },
    features: feats(ENTERPRISE_FEATURES),
  },
};

export const PLAN_ORDER: readonly PlanId[] = ['free', 'starter', 'pro', 'enterprise'] as const;

/** Raw catalog entry for a plan (no status handling). Unknown → free. */
export function entitlementsForPlan(planId: string | null | undefined): PlanEntitlements {
  return PLAN_CATALOG[(planId as PlanId)] ?? PLAN_CATALOG.free;
}

/**
 * Effective entitlements given a plan AND subscription status. A subscription that
 * is not in good standing (cancelled/past_due/paused) falls back to the free tier,
 * so a lapsed payer immediately loses paid features.
 */
export function resolveEntitlements(
  planId: string | null | undefined,
  status: string | null | undefined,
): PlanEntitlements {
  // A paid plan only entitles while the subscription is in good standing;
  // anything else (including free/unknown plans) resolves to the free tier.
  if (!planId || !(ENTITLED_STATUSES as readonly string[]).includes(status ?? '')) {
    return PLAN_CATALOG.free;
  }
  return entitlementsForPlan(planId);
}

export function hasFeature(entitlements: PlanEntitlements, feature: FeatureKey): boolean {
  return entitlements.features[feature] === true;
}

export function isPaidPlan(planId: string | null | undefined): boolean {
  return planId === 'starter' || planId === 'pro' || planId === 'enterprise';
}

/** Type guard: is this a known plan id? */
export function isValidPlan(planId: string | null | undefined): planId is PlanId {
  return (PLAN_ORDER as readonly string[]).includes(planId ?? '');
}

/** True when `used` is strictly below the plan's limit (null limit = unlimited). */
export function withinLimit(entitlements: PlanEntitlements, key: keyof PlanLimits, used: number): boolean {
  const limit = entitlements.limits[key];
  return limit === null || used < limit;
}
