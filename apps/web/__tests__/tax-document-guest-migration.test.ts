import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/20260812030000_tax_document_guest_access.sql'),
  'utf8',
).toLowerCase();
const rollback = readFileSync(
  resolve(process.cwd(), '../../supabase/rollbacks/20260812030000_rollback_tax_document_guest_access.sql'),
  'utf8',
).toLowerCase();

describe('guest tax document migration', () => {
  it('normalizes guest email ownership and enforces one ledger row per donation', () => {
    expect(migration).toContain('set donor_email = lower(trim(donor_email))');
    expect(migration).toContain('delete from public.donation_receipts older');
    expect(migration).toContain('donation_receipts_donation_id_unique');
    expect(migration).toContain('where donor_id is null and donor_email is not null');
  });

  it('ships an operational index rollback', () => {
    expect(rollback).toContain('drop index if exists public.donation_receipts_guest_email_idx');
    expect(rollback).toContain('drop index if exists public.donation_receipts_donation_id_unique');
  });
});
