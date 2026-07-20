import 'server-only';
// ─────────────────────────────────────────────────────────────────────────────
// Entitlements — Supabase read side. Pure catalog/resolution in
// `@shared/entitlements`. This reads a user's current subscription row and
// resolves it to concrete feature access, defaulting to the free tier when there
// is no active subscription. Any feature can gate on this without knowing about
// Stripe. (Writing the subscription row via Stripe billing is a separate,
// staging-gated task — see todo.md C4.)
// ─────────────────────────────────────────────────────────────────────────────
import { supabaseAdmin } from './supabase';
import {
  resolveEntitlements,
  hasFeature,
  PLAN_CATALOG,
  type PlanEntitlements,
  type FeatureKey,
} from '@shared/entitlements';

/**
 * Resolve the effective entitlements for a user. Picks the most-relevant
 * subscription (active/trialing first, newest wins) and resolves it; falls back
 * to the free tier when there is none.
 */
export async function getUserEntitlements(userId: string | null | undefined): Promise<PlanEntitlements> {
  if (!userId) return PLAN_CATALOG.free;

  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status, current_period_end, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(5);

  const rows = data ?? [];
  if (rows.length === 0) return PLAN_CATALOG.free;

  // Prefer an in-good-standing subscription; otherwise the newest row (already sorted).
  const best = rows.find((r) => r.status === 'active' || r.status === 'trialing') ?? rows[0];
  return resolveEntitlements(best.plan, best.status);
}

/** Convenience: does this user currently have a given feature? */
export async function userHasFeature(userId: string | null | undefined, feature: FeatureKey): Promise<boolean> {
  const ent = await getUserEntitlements(userId);
  return hasFeature(ent, feature);
}
