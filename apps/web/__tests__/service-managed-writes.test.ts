import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/20260810000000_lock_down_service_managed_writes.sql'),
  'utf8',
).toLowerCase();
const supportRoute = readFileSync(
  resolve(process.cwd(), 'app/api/support-tickets/route.ts'),
  'utf8',
).toLowerCase();
const applySchema = readFileSync(
  resolve(process.cwd(), 'app/api/admin/apply-schema/route.ts'),
  'utf8',
).toLowerCase();

const TABLES = [
  'contact_messages',
  'support_cases',
  'share_events',
  'donation_receipts',
  'campaign_status_log',
  'campaign_builder_events',
  'creator_tips',
];

describe('service-managed write boundaries', () => {
  it('revokes browser mutations and preserves service-role writes', () => {
    for (const table of TABLES) {
      expect(migration).toMatch(
        new RegExp(
          `revoke insert, update, delete on table public\\.${table}\\s+from public, anon, authenticated`,
        ),
      );
      expect(migration).toContain(
        `grant insert, update, delete on table public.${table} to service_role`,
      );
    }
  });

  it('removes every permissive insert policy', () => {
    for (const policy of [
      'contact_messages_insert',
      'support_own_insert',
      'share_insert_any',
      'receipts_svc_insert',
      'status_log_svc_insert',
      'cbe_insert_any',
      'creator_tips_insert_public',
    ]) {
      expect(migration).toContain(`drop policy if exists ${policy}`);
    }
  });

  it('rate limits anonymous support requests before parsing or writing', () => {
    const rateLimitIndex = supportRoute.indexOf('checkratelimitdurable(');
    const jsonIndex = supportRoute.indexOf('request.json()');
    const insertIndex = supportRoute.indexOf(".from('support_cases')");

    expect(rateLimitIndex).toBeGreaterThan(-1);
    expect(rateLimitIndex).toBeLessThan(jsonIndex);
    expect(rateLimitIndex).toBeLessThan(insertIndex);
    expect(supportRoute).toContain("code: 'rate_limited'");
  });

  it('keeps schema repair fail-closed after broad legacy grants', () => {
    expect(applySchema).toContain("name: 'final service-managed write enforcement'");
    for (const table of TABLES) {
      expect(applySchema).toContain(`'${table}'`);
    }
    expect(applySchema).toContain(
      "'revoke insert, update, delete on table public.%i from public, anon, authenticated'",
    );
  });
});
