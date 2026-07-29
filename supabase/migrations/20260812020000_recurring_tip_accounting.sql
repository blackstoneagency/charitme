alter table public.recurring_donations
  add column if not exists tip_cents bigint not null default 0;

alter table public.recurring_donations
  add column if not exists anonymous boolean not null default false;

alter table public.recurring_donations
  drop constraint if exists recurring_donations_tip_cents_check;
alter table public.recurring_donations
  add constraint recurring_donations_tip_cents_check
  check (tip_cents >= 0) not valid;
alter table public.recurring_donations
  validate constraint recurring_donations_tip_cents_check;

update public.recurring_donations rd
set
  anonymous = source.anonymous,
  updated_at = now()
from (
  select distinct on (cp.metadata ->> 'subscription_id')
    cp.metadata ->> 'subscription_id' as subscription_id,
    d.anonymous
  from public.campaign_payments cp
  join public.donations d on d.id = cp.donation_id
  where coalesce(cp.metadata ->> 'subscription_id', '') <> ''
  order by
    cp.metadata ->> 'subscription_id',
    coalesce(cp.paid_at, cp.created_at),
    cp.id
) source
where rd.stripe_subscription_id = source.subscription_id
  and rd.anonymous is distinct from source.anonymous;

create temporary table recurring_renewal_repairs as
select
  cp.id as campaign_payment_id,
  cp.donation_id,
  cp.campaign_id,
  least(amounts.invoice_paid, rd.amount_cents) as principal_cents,
  greatest(amounts.invoice_paid - least(amounts.invoice_paid, rd.amount_cents), 0) as tip_cents
from public.campaign_payments cp
join public.recurring_donations rd
  on rd.stripe_subscription_id = cp.metadata ->> 'subscription_id'
cross join lateral (
  select coalesce(
    nullif(cp.metadata ->> 'stripe_invoice_amount_paid', '')::bigint,
    cp.gross_amount
  ) as invoice_paid
) amounts
where coalesce((cp.metadata ->> 'renewal')::boolean, false)
  and amounts.invoice_paid > 0
  and rd.amount_cents > 0
  and (
    cp.gross_amount <> least(amounts.invoice_paid, rd.amount_cents)
    or cp.tip_amount <> greatest(amounts.invoice_paid - least(amounts.invoice_paid, rd.amount_cents), 0)
    or cp.campaign_owner_net_amount <> least(amounts.invoice_paid, rd.amount_cents)
  );

update public.donations d
set
  amount_cents = r.principal_cents,
  tip_cents = r.tip_cents,
  updated_at = now()
from recurring_renewal_repairs r
where d.id = r.donation_id;

update public.tax_receipts tr
set amount_cents = r.principal_cents
from recurring_renewal_repairs r
where tr.donation_id = r.donation_id;

update public.donation_receipts dr
set
  amount_cents = r.principal_cents,
  tip_cents = r.tip_cents
from recurring_renewal_repairs r
where dr.donation_id = r.donation_id;

update public.campaign_payments cp
set
  gross_amount = r.principal_cents,
  tip_amount = r.tip_cents,
  platform_fee_amount = r.tip_cents,
  campaign_owner_net_amount = r.principal_cents,
  metadata = cp.metadata || jsonb_build_object(
    'recurring_accounting_repaired', true,
    'stripe_invoice_amount_paid', r.principal_cents + r.tip_cents
  ),
  updated_at = now()
from recurring_renewal_repairs r
where cp.id = r.campaign_payment_id;

update public.campaign_payment_breakdowns b
set
  gross_amount = r.principal_cents,
  tip_amount = r.tip_cents,
  platform_fee_amount = r.tip_cents,
  owner_net_amount = r.principal_cents,
  updated_at = now()
from recurring_renewal_repairs r
where b.campaign_payment_id = r.campaign_payment_id;

update public.campaign_platform_fees f
set
  gross_amount = r.principal_cents,
  platform_fee_amount = r.tip_cents,
  status = case when r.tip_cents > 0 then 'recorded' else f.status end,
  updated_at = now()
from recurring_renewal_repairs r
where f.campaign_payment_id = r.campaign_payment_id;

update public.campaign_processor_fees f
set
  gross_amount = r.principal_cents,
  updated_at = now()
from recurring_renewal_repairs r
where f.campaign_payment_id = r.campaign_payment_id;

update public.campaign_payment_reconciliation pr
set
  gross_amount = r.principal_cents,
  platform_fee_amount = r.tip_cents,
  owner_net_amount = r.principal_cents,
  checked_at = now(),
  updated_at = now()
from recurring_renewal_repairs r
where pr.campaign_payment_id = r.campaign_payment_id;

update public.campaign_owner_transfers ot
set
  gross_amount = r.principal_cents,
  owner_net_amount = r.principal_cents,
  updated_at = now()
from recurring_renewal_repairs r
where ot.campaign_payment_id = r.campaign_payment_id;

update public.campaign_owner_payouts op
set
  gross_amount = r.principal_cents,
  owner_net_amount = r.principal_cents,
  updated_at = now()
from recurring_renewal_repairs r
where op.campaign_payment_id = r.campaign_payment_id;

update public.recurring_donations rd
set
  tip_cents = repair.tip_cents,
  updated_at = now()
from (
  select
    cp.metadata ->> 'subscription_id' as subscription_id,
    max(r.tip_cents) as tip_cents
  from recurring_renewal_repairs r
  join public.campaign_payments cp on cp.id = r.campaign_payment_id
  group by cp.metadata ->> 'subscription_id'
) repair
where rd.stripe_subscription_id = repair.subscription_id;

update public.campaigns c
set
  raised_amount = totals.raised_amount,
  backer_count = totals.backer_count,
  updated_at = now()
from (
  select
    affected.campaign_id,
    coalesce(sum(d.amount_cents) filter (
      where d.status = 'completed' and coalesce(d.is_spam, false) = false
    ), 0)::bigint as raised_amount,
    count(*) filter (
      where d.status = 'completed' and coalesce(d.is_spam, false) = false
    )::integer as backer_count
  from (select distinct campaign_id from recurring_renewal_repairs) affected
  left join public.donations d on d.campaign_id = affected.campaign_id
  group by affected.campaign_id
) totals
where c.id = totals.campaign_id;

select pg_notify('pgrst', 'reload schema');
