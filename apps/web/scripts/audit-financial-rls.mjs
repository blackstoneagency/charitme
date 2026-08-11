// ─────────────────────────────────────────────────────────────────────────────
// Can an anonymous visitor read or change the money tables?
//
//   node scripts/audit-financial-rls.mjs
//
// §5 of the payments audit: "users must not view another owner's financial data,
// modify Stripe account IDs, change fees, change transaction amounts, or modify
// ledger, transfer or payout records."
//
// Reading the policy SQL proves what was WRITTEN. This proves what the database
// ACTUALLY ENFORCES, using the public anon key exactly as a browser would.
//
// ⚠️ WRITES ARE PROBED WITH NO-OP VALUES. Every attempted UPDATE sets a column to
// the value it already holds, so if RLS is broken the probe reports it and the
// data is still unchanged. An audit that has to corrupt a row to discover it can
// corrupt a row is not one you can run against production.
//
// ⚠️ A write that SUCCEEDS is the finding. PostgREST answers a policy-blocked
// UPDATE with 200 and zero rows affected rather than an error, so "no error" is
// not "denied" — the row count is what matters, and this checks it.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(HERE, '..');

function env() {
  const merged = { ...process.env };
  const file = join(WEB_ROOT, '.env.local');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.includes('=') || line.trim().startsWith('#')) continue;
      const key = line.slice(0, line.indexOf('=')).trim();
      if (!merged[key]) merged[key] = line.slice(line.indexOf('=') + 1).trim();
    }
  }
  return merged;
}

const e = env();
const url = e.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = e.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = e.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required');
  process.exit(1);
}

class DisabledRealtimeTransport {}
const clientOptions = {
  auth: { persistSession: false },
  realtime: { transport: DisabledRealtimeTransport },
};

/** Exactly what a browser holds. */
const anon = createClient(url, anonKey, clientOptions);
/** Only to find a real row id to aim the probe at, and to confirm it is unchanged. */
const admin = serviceKey ? createClient(url, serviceKey, clientOptions) : null;

/** Tables that hold money, identity of payees, or the audit trail of both. */
const FINANCIAL_TABLES = [
  'connected_accounts',
  'payouts',
  'donations',
  'ledger_entries',
  'reconciliation_exceptions',
  'campaign_processor_fees',
  'campaign_payment_refunds',
  'campaign_owner_transfers',
  'stripe_connected_payouts',
  'stripe_connected_payout_allocations',
  'subscriptions',
  'matching_claims',
];

const findings = [];
let readsBlocked = 0;
let readsAllowed = 0;

console.log('FINANCIAL RLS — what the database actually enforces for an anonymous client\n');

for (const table of FINANCIAL_TABLES) {
  const { data, error, status } = await anon.from(table).select('*').limit(3);
  if (error) {
    console.log(`  READ  ${table.padEnd(28)} DENIED (${status} ${error.code ?? ''})`);
    readsBlocked++;
    continue;
  }
  const rows = data ?? [];
  if (rows.length === 0) {
    // RLS filtering to zero rows is a correct denial for a browser client.
    console.log(`  READ  ${table.padEnd(28)} 0 rows (policy filters everything)`);
    readsBlocked++;
    continue;
  }
  console.log(`  READ  ${table.padEnd(28)} ⚠ RETURNED ${rows.length} ROW(S)`);
  readsAllowed++;
  findings.push({
    severity: 'HIGH',
    table,
    issue: `anonymous read returned ${rows.length} row(s)`,
    sample: Object.keys(rows[0]).slice(0, 8).join(', '),
  });
}

// ── The named requirement: can a browser change a payout destination? ────────
console.log('\nWRITE probes (no-op values — a success is the finding, not the damage)\n');

if (!admin) {
  console.log('  (skipped: no service-role key to locate a target row or confirm it unchanged)');
} else {
  const { data: target } = await admin
    .from('connected_accounts')
    .select('id, stripe_account_id')
    .limit(1)
    .maybeSingle();

  if (!target) {
    console.log('  (skipped: connected_accounts is empty)');
  } else {
    // Sets stripe_account_id to the value it already has. If the policy allows
    // it, the probe reports a critical finding and the row is untouched.
    const { data: updated, error: updateError, status } = await anon
      .from('connected_accounts')
      .update({ stripe_account_id: target.stripe_account_id })
      .eq('id', target.id)
      .select('id');

    const changed = (updated ?? []).length;
    if (updateError || changed === 0) {
      console.log(`  WRITE connected_accounts.stripe_account_id  DENIED (${status}${updateError?.code ? ' ' + updateError.code : ', 0 rows'})`);
    } else {
      console.log('  WRITE connected_accounts.stripe_account_id  ⚠ ALLOWED');
      findings.push({
        severity: 'CRITICAL',
        table: 'connected_accounts',
        issue: 'an anonymous client can UPDATE stripe_account_id — a payout destination could be repointed',
      });
    }

    // Verify the row really is untouched, whatever the policy did.
    const { data: after } = await admin
      .from('connected_accounts')
      .select('stripe_account_id')
      .eq('id', target.id)
      .maybeSingle();
    console.log(`  (target row unchanged: ${after?.stripe_account_id === target.stripe_account_id})`);
  }

  // Can a browser insert a donation — i.e. invent money that was never charged?
  const { data: inserted, error: insertError } = await anon
    .from('donations')
    .insert({ amount_cents: 1, status: 'completed' })
    .select('id');
  if (insertError || (inserted ?? []).length === 0) {
    console.log(`  WRITE donations INSERT                      DENIED (${insertError?.code ?? '0 rows'})`);
  } else {
    console.log('  WRITE donations INSERT                      ⚠ ALLOWED');
    findings.push({
      severity: 'CRITICAL',
      table: 'donations',
      issue: 'an anonymous client can INSERT a donation — money could be invented in the ledger',
    });
    // Clean up immediately: this one DOES create a row.
    for (const row of inserted ?? []) await admin.from('donations').delete().eq('id', row.id);
    console.log('  (probe row deleted)');
  }
}

console.log(`\nreads denied: ${readsBlocked}/${FINANCIAL_TABLES.length}   reads allowed: ${readsAllowed}`);
if (findings.length === 0) {
  console.log('\n✅ No anonymous access to the financial tables.');
  process.exit(0);
}
console.log(`\n❌ ${findings.length} finding(s):`);
for (const f of findings) console.log(`  [${f.severity}] ${f.table}: ${f.issue}${f.sample ? `\n      columns: ${f.sample}` : ''}`);
process.exit(1);
