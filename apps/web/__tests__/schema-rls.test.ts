import { describe, it, expect } from 'vitest';
import rls from './fixtures/schema-rls.json';

// ─────────────────────────────────────────────────────────────────────────────
// RLS-contract test.
//
// The app reads via the service-role client (RLS bypassed), so row-level security
// is the ONLY defense against direct reads with the public anon key (which ships
// in the client bundle). Two failure modes have real precedent here:
//   • a table with RLS DISABLED  → anyone can read every row (raw leak);
//   • a table with a public `USING (true)` read policy → same effect
//     (this was LB-006: `profiles` leaked email + Stripe ids to anon).
//
// This test pins the RLS posture snapshotted from the live DB
// (`fixtures/schema-rls.json`, refresh via `npm run schema:snapshot`) and enforces
// two invariants that must hold no matter what a future migration does:
//   1. NO public table may have RLS disabled.
//   2. NO sensitive (financial / PII) table may be publicly readable.
// A migration that regresses either — once the snapshot is refreshed — fails CI.
// ─────────────────────────────────────────────────────────────────────────────

const RLS = rls as { rlsDisabled: string[]; publicRead: string[] };

// Tables that must NEVER be anon/public-readable. A public read policy here means
// financial records or PII are exposed to anyone holding the public anon key.
const SENSITIVE_TABLES = [
  'profiles',
  'donations',
  'recurring_donations',
  'connected_accounts',
  'payouts',
  'refunds',
  'ledger_entries',
  'reconciliation_exceptions',
  'campaign_payments',
  'campaign_payment_breakdowns',
  'campaign_payment_reconciliation',
  'campaign_payment_disputes',
  'campaign_payment_refunds',
  'campaign_payment_events',
  'campaign_payment_admin_notes',
  'campaign_payment_audit_logs',
  'campaign_payment_webhook_events',
  'campaign_platform_fees',
  'campaign_processor_fees',
  'donor_crm_contacts',
  'privacy_requests',
  'audit_logs',
  'webhook_events',
  'matching_claims',
];

describe('RLS contract', () => {
  it('no public table has RLS disabled', () => {
    expect(
      RLS.rlsDisabled,
      `These tables have RLS DISABLED — anyone with the anon key can read every row:\n  ${RLS.rlsDisabled.join('\n  ')}`,
    ).toEqual([]);
  });

  it('no sensitive (financial / PII) table is publicly readable', () => {
    const leaked = SENSITIVE_TABLES.filter((t) => RLS.publicRead.includes(t));
    expect(
      leaked,
      `These sensitive tables have a public USING(true) read policy — financial/PII ` +
        `data is exposed to the anon key (see LB-006). Fix the policy:\n  ${leaked.join('\n  ')}`,
    ).toEqual([]);
  });
});
