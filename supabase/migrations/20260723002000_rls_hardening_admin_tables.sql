-- ─────────────────────────────────────────────────────────────────────────────
-- RLS hardening — admin/finance/marketing tables (security audit, §6.2)
--
-- These 34 tables are accessed EXCLUSIVELY through the service-role client
-- (`supabaseAdmin`) in server-only API routes, libs, and the Stripe webhook —
-- verified: zero anon/authenticated (`createClient`/browser) access anywhere in
-- the app. Yet they had no `enable row level security` declaration, and the
-- schema-cache-reload path grants `anon`/`authenticated` broad table privileges,
-- so without RLS they could be read directly via PostgREST.
--
-- Enabling RLS with NO policies = deny-all except the service role, which BYPASSES
-- RLS. This is therefore non-breaking (every existing admin/webhook/marketing
-- path uses the service role) and closes the direct-PostgREST exposure while
-- making the intent explicit in-schema. Idempotent + guarded by table existence.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
  admin_only_tables text[] := array[
    -- Campaign payment / finance (service-role only)
    'campaign_owner_payouts',
    'campaign_owner_transfers',
    'campaign_payment_admin_notes',
    'campaign_payment_audit_logs',
    'campaign_payment_breakdowns',
    'campaign_payment_disputes',
    'campaign_payment_events',
    'campaign_payment_exports',
    'campaign_payment_reconciliation',
    'campaign_payment_refunds',
    'campaign_payment_settings',
    'campaign_payment_webhook_events',
    'campaign_payments',
    'campaign_platform_fees',
    'campaign_processor_fees',
    'payment_processors',
    'processor_accounts',
    -- Marketing engine (service-role only)
    'marketing_audit_logs',
    'marketing_automation_runs',
    'marketing_automations',
    'marketing_campaign_recipients',
    'marketing_campaigns',
    'marketing_consent',
    'marketing_contacts',
    'marketing_email_templates',
    'marketing_events',
    'marketing_form_submissions',
    'marketing_forms',
    'marketing_identities',
    'marketing_referrals',
    'marketing_segment_members',
    'marketing_segments',
    'marketing_suppression_list',
    'marketing_utm_links'
  ];
begin
  foreach t in array admin_only_tables loop
    if to_regclass('public.' || t) is not null then
      -- Idempotent: no-op if RLS is already enabled. service_role bypasses RLS
      -- (BYPASSRLS); anon/authenticated are denied by the no-policy default.
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- No policies are created intentionally: with RLS enabled and no policies, only
-- the service role (which bypasses RLS) can read/write these tables — matching
-- the verified access pattern. If a future feature needs anon/authenticated
-- access to any of these, add an explicit, scoped policy in a new migration.
