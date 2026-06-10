-- ─────────────────────────────────────────────────────────────────────────────
-- Multi-currency expansion
-- Date: 2026-06-10
-- Adds: donations.currency so each donation records the currency it was
--       charged in (campaign currency comes from campaign_launch_settings).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.donations
  add column if not exists currency text not null default 'usd';

comment on column public.donations.currency is
  'ISO 4217 currency (lowercase) the donation was charged in via Stripe.';

-- ── feature flag ──────────────────────────────────────────────────────────────
insert into public.feature_flags (key, enabled, description, rollout_pct) values
  ('multi_currency', true, 'Campaign-level currency selection across 24 currencies', 100)
on conflict (key) do nothing;

-- ── Re-grant to PostgREST roles ───────────────────────────────────────────────
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;
select pg_notify('pgrst', 'reload schema');
