\set ON_ERROR_STOP on

begin;

\ir ../rollbacks/20260812030000_rollback_tax_document_guest_access.sql

create temporary table tax_guest_fixture as
select
  d.id as donation_id,
  d.campaign_id,
  d.amount_cents,
  d.tip_cents,
  d.processing_fee_cents,
  d.currency,
  c.title as campaign_title
from public.donations d
join public.campaigns c on c.id = d.campaign_id
order by d.created_at
limit 1;

insert into public.donation_receipts (
  donation_id,
  campaign_id,
  receipt_number,
  amount_cents,
  tip_cents,
  processing_fee_cents,
  currency,
  campaign_title,
  donor_email,
  email_sent_at
)
select
  donation_id,
  campaign_id,
  'RCP-GUEST-OLDER',
  amount_cents,
  tip_cents,
  processing_fee_cents,
  currency,
  campaign_title,
  ' Guest.Donor@Example.COM ',
  now() - interval '1 hour'
from tax_guest_fixture;

insert into public.donation_receipts (
  donation_id,
  campaign_id,
  receipt_number,
  amount_cents,
  tip_cents,
  processing_fee_cents,
  currency,
  campaign_title,
  donor_email,
  email_sent_at
)
select
  donation_id,
  campaign_id,
  'RCP-GUEST-NEWER',
  amount_cents,
  tip_cents,
  processing_fee_cents,
  currency,
  campaign_title,
  ' Guest.Donor@Example.COM ',
  now()
from tax_guest_fixture;

\ir ../migrations/20260812030000_tax_document_guest_access.sql

do $assert_guest_tax_access$
declare
  fixture_donation_id uuid;
begin
  select donation_id into fixture_donation_id from tax_guest_fixture;

  if (
    select count(*)
    from public.donation_receipts
    where donation_id = fixture_donation_id
  ) <> 1 then
    raise exception 'duplicate receipt rows were not reconciled';
  end if;

  if not exists (
    select 1
    from public.donation_receipts
    where donation_id = fixture_donation_id
      and donor_email = 'guest.donor@example.com'
      and receipt_number = 'RCP-GUEST-NEWER'
  ) then
    raise exception 'guest receipt email or newest ledger row was not preserved';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'donation_receipts_donation_id_unique'
  ) then
    raise exception 'receipt donation uniqueness index is missing';
  end if;
end;
$assert_guest_tax_access$;

\ir ../migrations/20260812030000_tax_document_guest_access.sql

rollback;
