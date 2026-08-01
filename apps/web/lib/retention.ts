import 'server-only';
import { supabaseAdmin } from './supabase';

/**
 * Data retention (design #172).
 *
 * ⚠️ THE CATEGORY LIST IS A CLOSED ALLOWLIST, and that is the safety mechanism.
 *
 * Retention deletes data permanently, so the set of tables it can touch must be
 * a deliberate decision made here in code — not a table name typed into an admin
 * form. Nothing financial or identity-related appears below, because donations,
 * refunds, ledger entries, tax receipts and verification documents carry legal
 * retention requirements that outlast any preference an admin sets.
 *
 * Everything here is operational exhaust: telemetry, rate-limit counters,
 * delivery logs. Losing it costs analytics history, not a record anyone is
 * entitled to.
 */
export type RetentionCategory = {
  key: string;
  label: string;
  description: string;
  table: string;
  /** Timestamp column the cutoff is measured against. */
  column: string;
  defaultDays: number;
};

export const RETENTION_CATEGORIES: RetentionCategory[] = [
  {
    key: 'analytics_events',
    label: 'Campaign analytics events',
    description: 'Page views and interaction events used for campaign analytics.',
    table: 'campaign_analytics_events',
    column: 'created_at',
    defaultDays: 730,
  },
  {
    key: 'builder_events',
    label: 'Campaign builder telemetry',
    description: 'Step-by-step telemetry from the campaign creation wizard.',
    table: 'campaign_builder_events',
    column: 'created_at',
    defaultDays: 365,
  },
  {
    key: 'share_events',
    label: 'Share events',
    description: 'Records of campaigns being shared to social networks.',
    table: 'share_events',
    column: 'created_at',
    defaultDays: 730,
  },
  {
    key: 'rate_limit_hits',
    label: 'Rate limit counters',
    description: 'Short-lived counters backing cross-instance rate limiting.',
    table: 'rate_limit_hits',
    column: 'created_at',
    defaultDays: 30,
  },
  {
    key: 'marketing_events',
    label: 'Marketing events',
    description: 'Opens, clicks and sends recorded by the marketing engine.',
    table: 'marketing_events',
    column: 'created_at',
    defaultDays: 730,
  },
];

export function findCategory(key: string): RetentionCategory | undefined {
  return RETENTION_CATEGORIES.find((c) => c.key === key);
}

export type RetentionResult = {
  category: string;
  cutoffAt: string;
  matched: number | null;
  deleted: number;
  dryRun: boolean;
  error?: string;
};

/**
 * Applies one category's policy.
 *
 * `dryRun` is the DEFAULT and the caller must opt out of it explicitly. With it
 * on, this counts what is past the window and deletes nothing — which is the
 * useful compliance answer most of the time, and the safe one always.
 *
 * `matched` is `number | null`: null means the count could not be read, which is
 * rendered as "unknown" rather than 0. Reporting "0 records past retention"
 * because a count failed would be a false all-clear on a compliance screen.
 */
export async function applyRetention(
  category: RetentionCategory,
  retentionDays: number,
  dryRun: boolean,
): Promise<RetentionResult> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const { count, error: countErr } = await supabaseAdmin
    .from(category.table)
    .select('id', { count: 'exact', head: true })
    .lt(category.column, cutoff);

  if (countErr) {
    return {
      category: category.key,
      cutoffAt: cutoff,
      matched: null,
      deleted: 0,
      dryRun,
      error: countErr.message,
    };
  }

  if (dryRun || !count) {
    return { category: category.key, cutoffAt: cutoff, matched: count ?? 0, deleted: 0, dryRun };
  }

  const { error: delErr } = await supabaseAdmin
    .from(category.table)
    .delete()
    .lt(category.column, cutoff);

  if (delErr) {
    // Reported, never swallowed: an unreported failure here means an admin
    // believes data was removed on schedule when it was not, which is worse
    // than the deletion not happening.
    return {
      category: category.key,
      cutoffAt: cutoff,
      matched: count,
      deleted: 0,
      dryRun,
      error: delErr.message,
    };
  }

  return { category: category.key, cutoffAt: cutoff, matched: count, deleted: count, dryRun };
}
