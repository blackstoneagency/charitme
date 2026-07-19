import 'server-only';
// ─────────────────────────────────────────────────────────────────────────────
// Daily reconciliation — Supabase data access. Pure comparison logic lives in
// `reconciliation-core.ts`. This pulls captured donations + their ledger
// footprint, reconciles them, and opens de-duplicated reconciliation exceptions
// for anything that does not line up. Runs from a cron job (service role).
// ─────────────────────────────────────────────────────────────────────────────
import { supabaseAdmin } from './supabase';
import {
  observeLedger,
  reconcileDonations,
  type DonationToReconcile,
  type ReconciliationSummary,
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

  const { data: donations } = await supabaseAdmin
    .from('donations')
    .select('id, campaign_id, amount_cents, tip_cents, processing_fee_cents')
    .eq('status', 'completed')
    .eq('offline', false)
    .gte('created_at', sinceIso)
    .limit(2000);

  const rows = donations ?? [];
  if (rows.length === 0) {
    return { checked: 0, clean: 0, findings: [], byKind: {}, opened: 0, skippedExisting: 0 };
  }

  const donationIds = rows.map((d) => d.id);

  // One query for all ledger lines touching these donations; group in memory.
  const { data: ledgerLines } = await supabaseAdmin
    .from('ledger_entries')
    .select('donation_id, account, direction, amount_cents, entry_group_id')
    .in('donation_id', donationIds);

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
  const { data: existing } = await supabaseAdmin
    .from('reconciliation_exceptions')
    .select('donation_id, kind')
    .eq('status', 'open')
    .in('donation_id', donationIds);
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
