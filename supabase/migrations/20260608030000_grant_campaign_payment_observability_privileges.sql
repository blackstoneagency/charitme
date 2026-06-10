-- Migration 20260608020000_campaign_payment_observability.sql created the campaign payment
-- observability tables but never granted table-level privileges to anon/authenticated/service_role
-- (unlike the base schema, which grants `all on all tables in schema public` once at setup time —
-- that grant does not retroactively apply to tables created by later migrations).
--
-- Result: supabaseAdmin (service_role) queries against these tables fail with
-- "permission denied for table campaign_payments" (42501), which payment-admin-data.ts
-- silently swallows (`const { data } = await query`), making /admin/payments/campaign-flows
-- render an all-zero empty state even when rows exist.
--
-- This grants the same privileges the base schema grants to existing tables, and sets
-- default privileges so future tables created by `postgres` are not affected by this gap again.

grant all on table
  public.payment_processors,
  public.processor_accounts,
  public.campaign_payments,
  public.campaign_payment_breakdowns,
  public.campaign_payment_events,
  public.campaign_processor_fees,
  public.campaign_platform_fees,
  public.campaign_owner_transfers,
  public.campaign_owner_payouts,
  public.campaign_payment_refunds,
  public.campaign_payment_disputes,
  public.campaign_payment_reconciliation,
  public.campaign_payment_webhook_events,
  public.campaign_payment_audit_logs,
  public.campaign_payment_admin_notes,
  public.campaign_payment_exports,
  public.campaign_payment_settings
to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on routines to anon, authenticated, service_role;
