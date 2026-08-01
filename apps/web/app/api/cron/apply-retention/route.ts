import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdmin } from '../../admin/users/_auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { RETENTION_CATEGORIES, findCategory, applyRetention, type RetentionResult } from '../../../../lib/retention';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// GET /api/cron/apply-retention[?dryRun=false]
//
// Applies the configured retention policies. Same auth as the other cron routes:
// `Authorization: Bearer ${CRON_SECRET}`, or an admin session for a manual run.
//
// ⚠️ DELETION REQUIRES TWO INDEPENDENT OPT-INS, and neither defaults on:
//
//   1. `?dryRun=false` on the request, and
//   2. `auto_delete = true` on that category's policy row.
//
// With either missing the run only counts what is past its window. This is not
// belt-and-braces for its own sake: a scheduled job that permanently destroys
// production data is the single most dangerous thing in this codebase, the
// damage is unrecoverable, and "someone toggled a switch in an admin screen" is
// not enough evidence of intent to act on unattended, at 3am, forever.
//
// Every run is written to `data_retention_runs`, dry runs included, because the
// only question anyone asks afterwards is "what happened to that record?"
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCron) {
    const admin = await verifyAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Opt OUT of dry run, never into it: a typo'd or missing parameter must leave
  // the safe behaviour in place.
  const dryRunRequested = new URL(request.url).searchParams.get('dryRun') !== 'false';

  const { data: policies, error } = await supabaseAdmin
    .from('data_retention_policies')
    .select('category, retention_days, auto_delete');

  if (error) {
    return NextResponse.json(
      { error: 'Could not load retention policies', code: 'POLICIES_UNAVAILABLE' },
      { status: 503 },
    );
  }

  const results: RetentionResult[] = [];

  for (const p of (policies ?? []) as { category: string; retention_days: number; auto_delete: boolean }[]) {
    const category = findCategory(p.category);
    // A policy naming a category that no longer exists in the allowlist is
    // skipped rather than guessed at — the allowlist is what bounds which tables
    // this job may ever touch.
    if (!category) continue;

    const dryRun = dryRunRequested || !p.auto_delete;
    const result = await applyRetention(category, p.retention_days, dryRun);
    results.push(result);

    const { error: logErr } = await supabaseAdmin.from('data_retention_runs').insert({
      category: result.category,
      cutoff_at: result.cutoffAt,
      matched_count: result.matched ?? 0,
      deleted_count: result.deleted,
      dry_run: result.dryRun,
      error: result.error ?? null,
    });
    if (logErr) {
      console.error('[cron/apply-retention] run log insert failed', {
        category: result.category,
        deleted: result.deleted,
        message: logErr.message,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    dryRunRequested,
    configuredCategories: (policies ?? []).length,
    availableCategories: RETENTION_CATEGORIES.length,
    results,
  });
}
