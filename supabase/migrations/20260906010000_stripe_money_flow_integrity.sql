alter table public.refunds
  add column if not exists gross_amount_cents bigint not null default 0 check (gross_amount_cents >= 0);

alter table public.refunds
  add column if not exists stats_reversed_at timestamptz;

alter table public.donations
  add column if not exists refund_stats_reversed_at timestamptz;

alter table public.campaign_payments
  add column if not exists processor_application_fee_amount bigint not null default 0
    check (processor_application_fee_amount >= 0);

with ranked as (
  select id,
         row_number() over (partition by stripe_refund_id order by created_at, id) as position
  from public.refunds
  where stripe_refund_id is not null
)
update public.refunds r
set stripe_refund_id = null
from ranked
where ranked.id = r.id
  and ranked.position > 1;

create unique index if not exists refunds_stripe_refund_uidx on public.refunds (stripe_refund_id);

create table if not exists public.stripe_connected_payouts (
  id uuid primary key default uuid_generate_v4(),
  stripe_payout_id text not null unique,
  stripe_account_id text not null,
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null,
  status text not null check (status in ('pending','in_transit','paid','failed','canceled')),
  arrival_at timestamptz,
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_connected_payout_allocations (
  id uuid primary key default uuid_generate_v4(),
  connected_payout_id uuid not null references public.stripe_connected_payouts(id) on delete cascade,
  campaign_payment_id uuid not null references public.campaign_payments(id) on delete cascade,
  stripe_transfer_id text not null,
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null,
  created_at timestamptz not null default now(),
  unique (connected_payout_id, campaign_payment_id, stripe_transfer_id)
);

create index if not exists stripe_connected_payouts_account_idx
  on public.stripe_connected_payouts (stripe_account_id, created_at desc);
create index if not exists stripe_connected_payout_allocations_payment_idx
  on public.stripe_connected_payout_allocations (campaign_payment_id);

alter table public.stripe_connected_payouts enable row level security;
alter table public.stripe_connected_payout_allocations enable row level security;

drop policy if exists stripe_connected_payouts_admin_all on public.stripe_connected_payouts;
create policy stripe_connected_payouts_admin_all
  on public.stripe_connected_payouts for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists stripe_connected_payout_allocations_admin_all on public.stripe_connected_payout_allocations;
create policy stripe_connected_payout_allocations_admin_all
  on public.stripe_connected_payout_allocations for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists stripe_connected_payout_allocations_owner_read on public.stripe_connected_payout_allocations;
create policy stripe_connected_payout_allocations_owner_read
  on public.stripe_connected_payout_allocations for select
  using (
    exists (
      select 1
      from public.campaign_payments payment
      where payment.id = stripe_connected_payout_allocations.campaign_payment_id
        and public.campaign_payment_owner_can_read(payment.campaign_id, payment.campaign_owner_id)
    )
  );

revoke all on public.stripe_connected_payouts from public, anon, authenticated;
revoke all on public.stripe_connected_payout_allocations from public, anon, authenticated;
grant select on public.stripe_connected_payouts to authenticated;
grant select on public.stripe_connected_payout_allocations to authenticated;
grant all on public.stripe_connected_payouts to service_role;
grant all on public.stripe_connected_payout_allocations to service_role;

create or replace function public.reserve_admin_donation_refund(
  p_donation_id uuid,
  p_requested_cents bigint,
  p_reason text,
  p_requested_by uuid
)
returns table (
  refund_id uuid,
  refund_cents bigint,
  donation_cents bigint,
  already_refunded_cents bigint,
  is_full_refund boolean,
  stripe_payment_intent_id text,
  campaign_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  donation_row public.donations%rowtype;
  reserved_cents bigint;
  remaining_cents bigint;
  final_cents bigint;
  reservation_id uuid;
begin
  select * into donation_row
  from public.donations
  where id = p_donation_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'DONATION_NOT_FOUND';
  end if;

  select coalesce(sum(amount_cents), 0) into reserved_cents
  from public.refunds
  where donation_id = p_donation_id
    and status not in ('declined', 'failed', 'canceled');

  remaining_cents := donation_row.amount_cents - reserved_cents;
  if donation_row.status = 'refunded' or remaining_cents <= 0 then
    raise exception using errcode = 'P0001', message = 'ALREADY_REFUNDED';
  end if;
  if p_requested_cents is null or p_requested_cents <= 0 then
    raise exception using errcode = '22023', message = 'INVALID_REFUND_AMOUNT';
  end if;

  final_cents := least(p_requested_cents, remaining_cents);

  insert into public.refunds (
    donation_id, amount_cents, gross_amount_cents, reason, notes,
    status, requested_by
  ) values (
    p_donation_id, final_cents, 0, p_reason, 'Reserved by the admin refund workflow',
    'processing', p_requested_by
  ) returning id into reservation_id;

  return query select
    reservation_id,
    final_cents,
    donation_row.amount_cents,
    reserved_cents,
    reserved_cents + final_cents >= donation_row.amount_cents,
    donation_row.stripe_payment_intent_id,
    donation_row.campaign_id;
end;
$$;

revoke all on function public.reserve_admin_donation_refund(uuid, bigint, text, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_admin_donation_refund(uuid, bigint, text, uuid)
  to service_role;

create or replace function public.apply_campaign_refund_stats(p_refund_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  refund_row public.refunds%rowtype;
  donation_row public.donations%rowtype;
  total_refunded_cents bigint;
  is_full boolean;
begin
  select * into refund_row
  from public.refunds
  where id = p_refund_id
  for update;

  if not found or refund_row.stats_reversed_at is not null then
    return false;
  end if;

  select * into donation_row
  from public.donations
  where id = refund_row.donation_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'DONATION_NOT_FOUND';
  end if;

  update public.campaigns
  set raised_amount = greatest(0, raised_amount - refund_row.amount_cents),
      updated_at = now()
  where id = donation_row.campaign_id;

  select coalesce(sum(amount_cents), 0) into total_refunded_cents
  from public.refunds
  where donation_id = donation_row.id
    and status = 'processed';

  is_full := total_refunded_cents >= donation_row.amount_cents;
  if is_full and donation_row.refund_stats_reversed_at is null then
    update public.campaigns
    set backer_count = greatest(0, backer_count - 1),
        updated_at = now()
    where id = donation_row.campaign_id;

    update public.donations
    set status = 'refunded',
        refunded_at = coalesce(refunded_at, now()),
        refund_stats_reversed_at = now(),
        updated_at = now()
    where id = donation_row.id;
  end if;

  update public.refunds
  set stats_reversed_at = now()
  where id = p_refund_id;

  return true;
end;
$$;

revoke all on function public.apply_campaign_refund_stats(uuid)
  from public, anon, authenticated;
grant execute on function public.apply_campaign_refund_stats(uuid)
  to service_role;
