import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/20260830000000_protect_verification_and_campaign_integrity.sql'),
  'utf8',
);

describe('database integrity guards', () => {
  it('keeps nonprofit approval and tax receipt eligibility service-managed', () => {
    expect(migration).toContain('protect_nonprofit_verification_fields');
    expect(migration).toContain('new.verified is distinct from old.verified');
    expect(migration).toContain('new.verification_status is distinct from old.verification_status');
    expect(migration).toContain('new.tax_receipt_enabled is distinct from old.tax_receipt_enabled');
    expect(migration).toContain("coalesce(auth.role(), '') = 'service_role'");
  });

  it('prevents uploaded documents from approving or publishing themselves', () => {
    expect(migration).toContain('protect_verification_document_fields');
    expect(migration).toContain("new.status is distinct from 'pending'");
    expect(migration).toContain('new.verified_by is not null');
    expect(migration).toContain('new.is_public is distinct from false');
    expect(migration).toContain('new.public_url is not null');
  });

  it('keeps money, trust, publication, and paid placement fields service-managed', () => {
    expect(migration).toContain('protect_campaign_integrity_fields');
    for (const field of [
      'user_id',
      'raised_amount',
      'backer_count',
      'status',
      'trust_status',
      'campaign_health_score',
      'payout_frozen',
      'featured',
      'pinned',
      'nonprofit_verified',
      'deleted_at',
    ]) {
      expect(migration).toContain(`new.${field} is distinct from old.${field}`);
    }
  });
});
