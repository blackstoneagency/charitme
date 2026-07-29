import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/20260812020000_recurring_tip_accounting.sql'),
  'utf8',
).toLowerCase();
const rollback = readFileSync(
  resolve(process.cwd(), '../../supabase/rollbacks/20260812020000_rollback_recurring_tip_accounting.sql'),
  'utf8',
).toLowerCase();

describe('recurring tip accounting migration', () => {
  it('stores recurring tip and anonymity without floating-point money', () => {
    expect(migration).toContain('add column if not exists tip_cents bigint');
    expect(migration).toContain('add column if not exists anonymous boolean');
    expect(migration).toContain('check (tip_cents >= 0)');
  });

  it('repairs donation, tax, payment, and campaign aggregates', () => {
    for (const table of [
      'public.donations',
      'public.tax_receipts',
      'public.donation_receipts',
      'public.campaign_payments',
      'public.campaign_payment_breakdowns',
      'public.campaign_platform_fees',
      'public.campaign_processor_fees',
      'public.campaign_payment_reconciliation',
      'public.campaign_owner_transfers',
      'public.campaign_owner_payouts',
      'public.campaigns',
    ]) {
      expect(migration).toContain(`update ${table}`);
    }
  });

  it('retains the original invoice total so a second run is idempotent', () => {
    expect(migration).toContain("'stripe_invoice_amount_paid'");
    expect(migration).toContain("metadata ->> 'stripe_invoice_amount_paid'");
    expect(migration).toContain("'recurring_accounting_repaired', true");
  });

  it('backfills legacy subscription anonymity from the linked donation', () => {
    expect(migration).toContain('d.anonymous');
    expect(migration).toContain('rd.anonymous is distinct from source.anonymous');
  });

  it('keeps repair tables available across auto-committed statements', () => {
    expect(migration).toContain('create temporary table recurring_renewal_repairs as');
    expect(rollback).toContain('create temporary table recurring_renewal_rollbacks as');
    expect(migration).not.toContain('on commit drop');
    expect(rollback).not.toContain('on commit drop');
  });

  it('ships an operational rollback for every repaired financial surface', () => {
    expect(rollback).toContain('recurring_renewal_rollbacks');
    expect(rollback).toContain('cp.gross_amount + cp.tip_amount as invoice_paid');
    expect(rollback).toContain("metadata - 'recurring_accounting_repaired'");
    expect(rollback).toContain('drop column if exists tip_cents');
  });
});
