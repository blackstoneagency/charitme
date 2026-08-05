import 'server-only';
// ─────────────────────────────────────────────────────────────────────────────
// Daily reconciliation — Supabase data access. Pure comparison logic lives in
// `reconciliation-core.ts`. This pulls captured donations + their ledger
// footprint, reconciles them, and opens de-duplicated reconciliation exceptions
// for anything that does not line up. Runs from a cron job (service role).
// ─────────────────────────────────────────────────────────────────────────────
import { supabaseAdmin } from './supabase';
import { boundedQuery } from './query-timeout';
import {
  observeLedger,
  reconcileDonations,
  isTerminalException,
  type DonationToReconcile,
  type ReconciliationSummary,
  type ExceptionStatus,
} from './reconciliation-core';

type LedgerLineRow = {
  donation_id: string | null;
  account: string;
  direction: string;
  amount_cents: number;
  entry_group_id: string;
};

const EMPTY_OBSERVATION = {
  groupCount: 0,
  recipientPayableCents: 0,
  platformRevenueCents: 0,
  processorFeesCents: 0,
  balanced: true,
} as const;

/**
 * Reconcile every online, completed donation captured in the last `days` days
 * against the ledger, and open de-duplicated exceptions for mismatches.
 * Offline donations are skipped — they never flow through Stripe or the ledger.
 */
export async function runReconciliation(
  days = 2,
): Promise<ReconciliationSummary & { opened: number; skippedExisting: number }> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceIso = since.toISOString();

  // ⚠️ Each of the three reads below dropped its `error`, and each failed in a
  // DIFFERENT wrong direction. This is the job that exists to notice money going
  // missing, so "we could not read" must never be reported as "nothing wrong".
  //
  //   donations       → rows = [] → returned { checked: 0, findings: [] }, a
  //                     CLEAN BILL OF HEALTH produced while completely blind
  //   ledger_entries  → every donation observed with no ledger footprint, so a
  //                     `missing` exception is opened for EVERY donation in the
  //                     window — up to 2000 false alarms in one run
  //   open exceptions → de-dupe set empty, so every exception is re-opened on
  //                     every run, defeating the idempotency documented below
  //
  // All three now take the caller's error branch and throw. The cron route does
  // not catch, so this surfaces as a 500 in the Vercel Cron log rather than a
  // reassuring `{ ok: true, checked: 0 }`.
  const { data: donations, error: donationsError } = await boundedQuery(() =>
    supabaseAdmin
      .from('donations')
      .select('id, campaign_id, amount_cents, tip_cents, processing_fee_cents')
      .eq('status', 'completed')
      .eq('offline', false)
      .gte('created_at', sinceIso)
      .limit(2000),
  );
  if (donationsError) {
    throw new Error(`reconciliation: donations read failed (${donationsError.message})`);
  }

  const rows = donations ?? [];
  if (rows.length === 0) {
    return { checked: 0, clean: 0, findings: [], byKind: {}, opened: 0, skippedExisting: 0 };
  }

  const donationIds = rows.map((d) => d.id);

  // One query for all ledger lines touching these donations; group in memory.
  const { data: ledgerLines, error: ledgerError } = await boundedQuery(() =>
    supabaseAdmin
      .from('ledger_entries')
      .select('donation_id, account, direction, amount_cents, entry_group_id')
      .in('donation_id', donationIds),
  );
  if (ledgerError) {
    // Without this, an unreadable ledger looks exactly like an EMPTY one.
    throw new Error(`reconciliation: ledger read failed (${ledgerError.message})`);
  }

  const byDonation = new Map<string, LedgerLineRow[]>();
  for (const l of (ledgerLines ?? []) as LedgerLineRow[]) {
    if (!l.donation_id) continue;
    const list = byDonation.get(l.donation_id) ?? [];
    list.push(l);
    byDonation.set(l.donation_id, list);
  }

  const items: DonationToReconcile[] = rows.map((d) => {
    const lines = byDonation.get(d.id);
    return {
      donationId: d.id,
      campaignId: d.campaign_id,
      expected: {
        donationCents: Number(d.amount_cents ?? 0),
        platformFeeCents: Number(d.tip_cents ?? 0),
        processorFeeCents: Number(d.processing_fee_cents ?? 0),
      },
      ledger: lines && lines.length ? observeLedger(lines) : { ...EMPTY_OBSERVATION },
    };
  });

  const summary = reconcileDonations(items);

  // De-dupe: don't re-open an exception that is already open for the same
  // (donation, kind). Keeps the daily job idempotent across runs.
  const { data: existing, error: existingError } = await boundedQuery(() =>
    supabaseAdmin
      .from('reconciliation_exceptions')
      .select('donation_id, kind')
      .eq('status', 'open')
      .in('donation_id', donationIds),
  );
  if (existingError) {
    throw new Error(`reconciliation: open-exception read failed (${existingError.message})`);
  }
  const openKeys = new Set((existing ?? []).map((e) => `${e.donation_id}:${e.kind}`));

  let opened = 0;
  let skippedExisting = 0;
  const toInsert = [];
  for (const f of summary.findings) {
    const key = `${f.donationId}:${f.kind}`;
    if (openKeys.has(key)) {
      skippedExisting += 1;
      continue;
    }
    openKeys.add(key); // avoid dupes within this run too
    const difference =
      f.expectedCents != null && f.actualCents != null ? f.expectedCents - f.actualCents : null;
    toInsert.push({
      kind: f.kind,
      description: f.description,
      campaign_id: f.campaignId ?? null,
      donation_id: f.donationId,
      expected_cents: f.expectedCents ?? null,
      actual_cents: f.actualCents ?? null,
      difference_cents: difference,
    });
    opened += 1;
  }

  if (toInsert.length) {
    const { error } = await supabaseAdmin.from('reconciliation_exceptions').insert(toInsert);
    if (error) throw new Error(`failed to open reconciliation exceptions: ${error.message}`);
  }

  return { ...summary, opened, skippedExisting };
}

// ── Admin listing + resolution ────────────────────────────────────────────────

export interface ExceptionRow {
  id: string;
  kind: string;
  status: ExceptionStatus;
  description: string;
  campaign_id: string | null;
  donation_id: string | null;
  stripe_ref: string | null;
  expected_cents: number | null;
  actual_cents: number | null;
  difference_cents: number | null;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

/** List reconciliation exceptions, newest first. Defaults to open items only. */
export async function listExceptions(status: ExceptionStatus | 'all' = 'open', limit = 200): Promise<ExceptionRow[]> {
  let q = supabaseAdmin
    .from('reconciliation_exceptions')
    .select(
      'id, kind, status, description, campaign_id, donation_id, stripe_ref, expected_cents, actual_cents, difference_cents, resolution_note, resolved_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (status !== 'all') q = q.eq('status', status);
  // A failed read used to become `[]`, which the admin reconciliation screen
  // renders as an EMPTY QUEUE — i.e. "no outstanding money discrepancies", the
  // most reassuring thing this screen can say, produced by not being able to
  // read. Throwing surfaces the outage instead; `getCampaign` sets the same
  // precedent for distinguishing "missing" from "unavailable".
  const { data, error } = await boundedQuery(() => q);
  if (error) {
    throw new Error(`reconciliation: exception list read failed (${error.message})`);
  }
  return (data ?? []) as ExceptionRow[];
}

/** Current status of one exception (for transition validation). */
export async function getExceptionStatus(id: string): Promise<ExceptionStatus | null> {
  // `.maybeSingle()` already separates "no row" from "query failed" — the caller
  // turns null into a 404, so without this an unreadable database tells an admin
  // the exception does not exist.
  const { data, error } = await boundedQuery(() =>
    supabaseAdmin
      .from('reconciliation_exceptions')
      .select('status')
      .eq('id', id)
      .maybeSingle(),
  );
  if (error) {
    throw new Error(`reconciliation: exception status read failed (${error.message})`);
  }
  return (data?.status as ExceptionStatus | undefined) ?? null;
}

/** Apply a validated status change to an exception (assignee/note optional). */
export async function updateException(
  id: string,
  patch: { status: ExceptionStatus; resolutionNote?: string | null; assigneeId?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row: Record<string, unknown> = { status: patch.status };
  if (patch.resolutionNote !== undefined) row.resolution_note = patch.resolutionNote;
  if (patch.assigneeId !== undefined) row.assignee_id = patch.assigneeId;
  if (isTerminalException(patch.status)) row.resolved_at = new Date().toISOString();
  else if (patch.status === 'open') row.resolved_at = null; // re-opening clears it
  const { error } = await supabaseAdmin.from('reconciliation_exceptions').update(row).eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
