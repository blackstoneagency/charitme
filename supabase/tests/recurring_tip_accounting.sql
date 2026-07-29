\set ON_ERROR_STOP on

create temporary table recurring_fixture_context as
select
  c.id as campaign_id,
  c.user_id as owner_id,
  p.id as donor_id,
  c.raised_amount as original_raised_amount,
  c.backer_count as original_backer_count
from public.campaigns c
cross join lateral (
  select id
  from public.profiles
  where id <> c.user_id
  order by id
  limit 1
) p
order by c.id
limit 1;

insert into public.recurring_donations (
  id,
  donor_id,
  campaign_id,
  amount_cents,
  tip_cents,
  anonymous,
  cadence,
  status,
  stripe_subscription_id
)
select
  '30000000-0000-4000-8000-000000000001',
  donor_id,
  campaign_id,
  10000,
  0,
  false,
  'monthly',
  'active',
  'sub_recurring_tip_fixture'
from recurring_fixture_context;

insert into public.donations (
  id,
  donor_id,
  campaign_id,
  amount_cents,
  tip_cents,
  status,
  anonymous,
  stripe_payment_intent_id
)
select
  '40000000-0000-4000-8000-000000000001',
  donor_id,
  campaign_id,
  11500,
  0,
  'completed',
  true,
  'pi_recurring_tip_fixture'
from recurring_fixture_context;

insert into public.campaign_payments (
  id,
  donation_id,
  campaign_id,
  campaign_owner_id,
  donor_id,
  processor,
  processor_payment_intent_id,
  gross_amount,
  tip_amount,
  platform_fee_amount,
  processor_fee_amount,
  campaign_owner_net_amount,
  payment_status,
  transfer_status,
  payout_status,
  metadata
)
select
  '50000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  campaign_id,
  owner_id,
  donor_id,
  'stripe',
  'pi_recurring_tip_fixture',
  11500,
  0,
  0,
  0,
  11500,
  'succeeded',
  'created',
  'requested',
  '{"recurring":true,"renewal":true,"subscription_id":"sub_recurring_tip_fixture"}'::jsonb
from recurring_fixture_context;

insert into public.campaign_payment_breakdowns (
  campaign_payment_id,
  gross_amount,
  tip_amount,
  platform_fee_amount,
  owner_net_amount
) values (
  '50000000-0000-4000-8000-000000000001',
  11500,
  0,
  0,
  11500
);

insert into public.campaign_platform_fees (
  campaign_payment_id,
  gross_amount,
  platform_fee_amount
) values (
  '50000000-0000-4000-8000-000000000001',
  11500,
  0
);

insert into public.campaign_processor_fees (
  campaign_payment_id,
  gross_amount,
  processor_fee_amount
) values (
  '50000000-0000-4000-8000-000000000001',
  11500,
  0
);

insert into public.campaign_payment_reconciliation (
  campaign_payment_id,
  gross_amount,
  platform_fee_amount,
  owner_net_amount
) values (
  '50000000-0000-4000-8000-000000000001',
  11500,
  0,
  11500
);

insert into public.tax_receipts (
  donation_id,
  donor_id,
  receipt_number,
  amount_cents
)
select
  '40000000-0000-4000-8000-000000000001',
  donor_id,
  'TAX-RECURRING-TIP-FIXTURE',
  11500
from recurring_fixture_context;

insert into public.donation_receipts (
  donation_id,
  donor_id,
  campaign_id,
  receipt_number,
  amount_cents,
  tip_cents,
  campaign_title
)
select
  '40000000-0000-4000-8000-000000000001',
  donor_id,
  campaign_id,
  'RCP-RECURRING-TIP-FIXTURE',
  11500,
  0,
  'Recurring tip fixture'
from recurring_fixture_context;

begin;
\ir ../migrations/20260812020000_recurring_tip_accounting.sql
commit;

do $assert_repair$
begin
  if not exists (
    select 1
    from public.donations
    where id = '40000000-0000-4000-8000-000000000001'
      and amount_cents = 10000
      and tip_cents = 1500
      and anonymous
  ) then
    raise exception 'renewal donation split was not repaired';
  end if;

  if not exists (
    select 1
    from public.campaign_payments
    where id = '50000000-0000-4000-8000-000000000001'
      and gross_amount = 10000
      and tip_amount = 1500
      and platform_fee_amount = 1500
      and campaign_owner_net_amount = 10000
      and metadata ->> 'stripe_invoice_amount_paid' = '11500'
  ) then
    raise exception 'renewal payment reporting was not repaired';
  end if;

  if not exists (
    select 1
    from public.tax_receipts
    where donation_id = '40000000-0000-4000-8000-000000000001'
      and amount_cents = 10000
  ) then
    raise exception 'tax receipt principal was not repaired';
  end if;

  if not exists (
    select 1
    from public.donation_receipts
    where donation_id = '40000000-0000-4000-8000-000000000001'
      and amount_cents = 10000
      and tip_cents = 1500
  ) then
    raise exception 'donation receipt split was not repaired';
  end if;

  if not exists (
    select 1
    from public.recurring_donations
    where id = '30000000-0000-4000-8000-000000000001'
      and tip_cents = 1500
      and anonymous
  ) then
    raise exception 'recurring tip and anonymity were not repaired';
  end if;
end;
$assert_repair$;

begin;
\ir ../migrations/20260812020000_recurring_tip_accounting.sql
commit;

do $assert_idempotent$
begin
  if not exists (
    select 1
    from public.campaign_payments
    where id = '50000000-0000-4000-8000-000000000001'
      and gross_amount = 10000
      and tip_amount = 1500
      and platform_fee_amount = 1500
      and campaign_owner_net_amount = 10000
  ) then
    raise exception 'second migration run changed the repaired split';
  end if;
end;
$assert_idempotent$;

begin;
\ir ../rollbacks/20260812020000_rollback_recurring_tip_accounting.sql
commit;

do $assert_rollback$
begin
  if not exists (
    select 1
    from public.donations
    where id = '40000000-0000-4000-8000-000000000001'
      and amount_cents = 11500
      and tip_cents = 0
  ) then
    raise exception 'rollback did not restore the prior donation representation';
  end if;

  if not exists (
    select 1
    from public.campaign_payments
    where id = '50000000-0000-4000-8000-000000000001'
      and gross_amount = 11500
      and tip_amount = 0
      and platform_fee_amount = 0
      and campaign_owner_net_amount = 11500
  ) then
    raise exception 'rollback did not restore the prior payment representation';
  end if;
end;
$assert_rollback$;

delete from public.donation_receipts
where donation_id = '40000000-0000-4000-8000-000000000001';
delete from public.tax_receipts
where donation_id = '40000000-0000-4000-8000-000000000001';
delete from public.campaign_payments
where id = '50000000-0000-4000-8000-000000000001';
delete from public.donations
where id = '40000000-0000-4000-8000-000000000001';
delete from public.recurring_donations
where id = '30000000-0000-4000-8000-000000000001';

update public.campaigns c
set
  raised_amount = fixture.original_raised_amount,
  backer_count = fixture.original_backer_count,
  updated_at = now()
from recurring_fixture_context fixture
where c.id = fixture.campaign_id;
