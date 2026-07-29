create temporary table recurring_renewal_rollbacks as
select
  cp.id as campaign_payment_id,
  cp.donation_id,
  cp.campaign_id,
  cp.gross_amount + cp.tip_amount as invoice_paid
from public.campaign_payments cp
where coalesce((cp.metadata ->> 'recurring_accounting_repaired')::boolean, false);

update public.donations d
set
  amount_cents = repair.invoice_paid,
  tip_cents = 0,
  updated_at = now()
from recurring_renewal_rollbacks repair
where repair.donation_id = d.id;

update public.tax_receipts tr
set amount_cents = repair.invoice_paid
from recurring_renewal_rollbacks repair
where tr.donation_id = repair.donation_id;

update public.donation_receipts dr
set
  amount_cents = repair.invoice_paid,
  tip_cents = 0
from recurring_renewal_rollbacks repair
where dr.donation_id = repair.donation_id;

update public.campaign_payment_breakdowns b
set
  gross_amount = repair.invoice_paid,
  tip_amount = 0,
  platform_fee_amount = 0,
  owner_net_amount = repair.invoice_paid,
  updated_at = now()
from recurring_renewal_rollbacks repair
where b.campaign_payment_id = repair.campaign_payment_id;

update public.campaign_platform_fees f
set
  gross_amount = repair.invoice_paid,
  platform_fee_amount = 0,
  updated_at = now()
from recurring_renewal_rollbacks repair
where f.campaign_payment_id = repair.campaign_payment_id;

update public.campaign_processor_fees f
set
  gross_amount = repair.invoice_paid,
  updated_at = now()
from recurring_renewal_rollbacks repair
where f.campaign_payment_id = repair.campaign_payment_id;

update public.campaign_payment_reconciliation pr
set
  gross_amount = repair.invoice_paid,
  platform_fee_amount = 0,
  owner_net_amount = repair.invoice_paid,
  checked_at = now(),
  updated_at = now()
from recurring_renewal_rollbacks repair
where pr.campaign_payment_id = repair.campaign_payment_id;

update public.campaign_owner_transfers ot
set
  gross_amount = repair.invoice_paid,
  owner_net_amount = repair.invoice_paid,
  updated_at = now()
from recurring_renewal_rollbacks repair
where ot.campaign_payment_id = repair.campaign_payment_id;

update public.campaign_owner_payouts op
set
  gross_amount = repair.invoice_paid,
  owner_net_amount = repair.invoice_paid,
  updated_at = now()
from recurring_renewal_rollbacks repair
where op.campaign_payment_id = repair.campaign_payment_id;

update public.campaign_payments cp
set
  gross_amount = repair.invoice_paid,
  tip_amount = 0,
  platform_fee_amount = 0,
  campaign_owner_net_amount = repair.invoice_paid,
  metadata = cp.metadata - 'recurring_accounting_repaired' - 'stripe_invoice_amount_paid',
  updated_at = now()
from recurring_renewal_rollbacks repair
where cp.id = repair.campaign_payment_id;

alter table public.recurring_donations
  drop constraint if exists recurring_donations_tip_cents_check;
alter table public.recurring_donations
  drop column if exists anonymous,
  drop column if exists tip_cents;

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
  from (select distinct campaign_id from recurring_renewal_rollbacks) affected
  left join public.donations d on d.campaign_id = affected.campaign_id
  group by affected.campaign_id
) totals
where c.id = totals.campaign_id;

select pg_notify('pgrst', 'reload schema');
