import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../../..');
const donationsPage = readFileSync(resolve(__dirname, '../app/dashboard/donations/page.tsx'), 'utf8');
const payoutsPage = readFileSync(resolve(__dirname, '../app/dashboard/payouts/page.tsx'), 'utf8');
const migration = readFileSync(
  resolve(ROOT, 'supabase/migrations/20260904010000_dashboard_financial_reporting.sql'),
  'utf8',
);

describe('dashboard financial pagination', () => {
  it('uses exact aggregate RPCs instead of deriving totals from display windows', () => {
    expect(donationsPage).toContain("rpc('organizer_donation_summary'");
    expect(payoutsPage).toContain("rpc('organizer_payout_summary'");
    expect(donationsPage).not.toContain('.limit(200)');
    expect(payoutsPage).not.toContain('.limit(100)');
  });

  it('uses stable timestamp-plus-id cursors on both history pages', () => {
    expect(donationsPage).toContain('decodeKeysetCursor(params.cursor)');
    expect(payoutsPage).toContain('decodeKeysetCursor(params.cursor)');
    expect(migration).toContain('(owned.created_at, owned.id) < (p_before_created_at, p_before_id)');
    expect(migration).toContain('(p.created_at, p.id) < (p_before_created_at, p_before_id)');
  });

  it('binds authenticated reporting RPCs to the caller identity', () => {
    expect(donationsPage).not.toContain('supabaseAdmin');
    expect(payoutsPage).not.toContain('supabaseAdmin');
    expect(migration).toContain("auth.role() = 'service_role' or auth.uid() = p_user_id");
    for (const name of [
      'organizer_donation_summary',
      'organizer_donation_page',
      'organizer_top_donors',
      'organizer_payout_summary',
      'organizer_payout_page',
    ]) {
      expect(migration).toMatch(new RegExp(`revoke all on function public\\.${name}\\(`));
      expect(migration).toMatch(new RegExp(`grant execute on function public\\.${name}\\(`));
    }
    expect(migration.match(/to authenticated;/g)).toHaveLength(5);
  });
});
