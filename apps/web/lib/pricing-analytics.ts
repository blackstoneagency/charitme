import 'server-only';
// ─────────────────────────────────────────────────────────────────────────────
// Pricing & support analytics — Supabase data access. Pure math in
// `pricing-analytics-core.ts`. Reads completed online donations and rolls them
// into the support/revenue metrics the admin pricing dashboard shows.
// ─────────────────────────────────────────────────────────────────────────────
import { supabaseAdmin } from './supabase';
import { computePricingAnalytics, type PricingAnalytics } from './pricing-analytics-core';

/**
 * Pricing analytics over completed online donations from the last `days` days.
 * Offline donations are excluded (no card/support flow). Capped to keep the
 * query bounded; the dashboard is a trend view, not an accounting export.
 */
export async function getPricingAnalytics(days = 30): Promise<PricingAnalytics & { days: number }> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const { data } = await supabaseAdmin
    .from('donations')
    .select('amount_cents, tip_cents')
    .eq('status', 'completed')
    .eq('offline', false)
    .gte('created_at', since.toISOString())
    .limit(5000);

  const rows = (data ?? []).map((d) => ({
    amountCents: Number(d.amount_cents ?? 0),
    tipCents: Number(d.tip_cents ?? 0),
  }));

  return { ...computePricingAnalytics(rows), days };
}
