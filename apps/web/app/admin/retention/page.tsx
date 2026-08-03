import { boundedQuery } from '../../../lib/query-timeout';
import 'server-only';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { RETENTION_CATEGORIES } from '../../../lib/retention';
import RetentionClient, { type Policy, type RetentionRun } from './RetentionClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Data Retention | CharitMe Admin' };

// ─────────────────────────────────────────────────────────────────────────────
// Data Retention (design #172). Tables ship in 20260822000000.
//
// Unlike the webhook page, this configuration drives something real:
// /api/cron/apply-retention reads these policies and acts on them. It was worth
// building the enforcement rather than the screen alone, because a retention
// policy nobody applies is a compliance claim with nothing behind it — the same
// defect as a delivery log for webhooks that are never sent.
//
// ⚠️ Deletion needs TWO opt-ins, neither of them default: `auto_delete` on the
// category AND `?dryRun=false` on the run. Without both, the job counts and
// deletes nothing. The categories themselves are a closed allowlist in
// lib/retention.ts holding only operational telemetry — nothing financial or
// identity-related, which carry legal retention that outlasts any setting here.
// ─────────────────────────────────────────────────────────────────────────────

export default async function RetentionPage() {
  const [policiesRes, runsRes] = await Promise.all([
    boundedQuery(() => supabaseAdmin
      .from('data_retention_policies')
      .select('id, category, retention_days, auto_delete, updated_at')
      .order('category', { ascending: true })),
    boundedQuery(() => supabaseAdmin
      .from('data_retention_runs')
      .select('id, category, cutoff_at, matched_count, deleted_count, dry_run, error, ran_at')
      .order('ran_at', { ascending: false })
      .limit(25)),
  ]);

  const policies: Policy[] | null = policiesRes.error ? null : ((policiesRes.data ?? []) as Policy[]);
  const runs: RetentionRun[] | null = runsRes.error ? null : ((runsRes.data ?? []) as RetentionRun[]);

  return (
    <RetentionClient
      categories={RETENTION_CATEGORIES.map((c) => ({
        key: c.key,
        label: c.label,
        description: c.description,
        table: c.table,
        defaultDays: c.defaultDays,
      }))}
      initialPolicies={policies}
      initialRuns={runs}
    />
  );
}
