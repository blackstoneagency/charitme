drop function if exists public.reserve_admin_donation_refund(uuid, bigint, text, uuid);
drop function if exists public.apply_campaign_refund_stats(uuid);
drop table if exists public.stripe_connected_payout_allocations;
drop table if exists public.stripe_connected_payouts;
drop index if exists public.refunds_stripe_refund_uidx;
alter table if exists public.campaign_payments
  drop column if exists processor_application_fee_amount;
alter table if exists public.refunds
  drop column if exists stats_reversed_at,
  drop column if exists gross_amount_cents;
alter table if exists public.donations
  drop column if exists refund_stats_reversed_at;
