-- Tax reporting foundation for every completed donation.
-- A receipt record is created for registered, guest, anonymous, and offline
-- donations. Only verified nonprofit gifts are marked tax deductible.

alter table if exists public.campaigns
  add column if not exists nonprofit_id uuid references public.nonprofit_profiles(id) on delete set null;

alter table if exists public.nonprofit_profiles
  add column if not exists ein text,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists tax_receipt_enabled boolean not null default false;

alter table if exists public.donations
  add column if not exists tip_cents bigint not null default 0,
  add column if not exists processing_fee_cents bigint not null default 0,
  add column if not exists offline boolean not null default false,
  add column if not exists offline_method text,
  add column if not exists offline_donor_name text,
  add column if not exists offline_donor_email text,
  add column if not exists stripe_checkout_session_id text;

alter table if exists public.tax_receipts
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null,
  add column if not exists campaign_title text,
  add column if not exists recipient_name text,
  add column if not exists recipient_ein text,
  add column if not exists currency text not null default 'usd',
  add column if not exists tip_cents bigint not null default 0,
  add column if not exists processing_fee_cents bigint not null default 0,
  add column if not exists tax_deductible boolean not null default false,
  add column if not exists tax_deductible_amount_cents bigint not null default 0,
  add column if not exists tax_year integer,
  add column if not exists donor_name text,
  add column if not exists donor_email text,
  add column if not exists donation_date timestamptz,
  add column if not exists status text not null default 'issued',
  add column if not exists refunded_at timestamptz;

create unique index if not exists tax_receipts_donation_id_uidx
  on public.tax_receipts(donation_id) where donation_id is not null;
create index if not exists tax_receipts_donor_year_idx
  on public.tax_receipts(donor_id, tax_year, created_at desc);
create index if not exists tax_receipts_campaign_year_idx
  on public.tax_receipts(campaign_id, tax_year, created_at desc);

create or replace function public.sync_tax_receipt_for_donation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign campaigns%rowtype;
  v_nonprofit nonprofit_profiles%rowtype;
  v_tax_deductible boolean := false;
  v_recipient_name text;
  v_recipient_ein text;
  v_donor_name text;
  v_donor_email text;
  v_receipt_number text;
begin
  if new.status not in ('completed', 'refunded') then
    return new;
  end if;

  select * into v_campaign from campaigns where id = new.campaign_id;
  if v_campaign.nonprofit_id is not null then
    select * into v_nonprofit from nonprofit_profiles where id = v_campaign.nonprofit_id;
  elsif v_campaign.user_id is not null then
    select * into v_nonprofit from nonprofit_profiles where owner_id = v_campaign.user_id order by created_at asc limit 1;
  end if;

  v_recipient_name := nullif(v_nonprofit.name, '');
  v_recipient_ein := coalesce(nullif(v_nonprofit.ein, ''), nullif(v_nonprofit.tax_id, ''));
  v_tax_deductible := coalesce(v_nonprofit.verified, false)
    and coalesce(v_nonprofit.tax_receipt_enabled, false)
    and coalesce(v_nonprofit.verification_status, 'unverified') in ('verified', 'approved');

  if new.donor_id is not null then
    select full_name, email into v_donor_name, v_donor_email from profiles where id = new.donor_id;
  else
    v_donor_name := new.offline_donor_name;
    v_donor_email := new.offline_donor_email;
  end if;

  v_receipt_number := 'CHM-' || replace(new.id::text, '-', '');

  insert into tax_receipts (
    donation_id, donor_id, nonprofit_id, campaign_id, receipt_number,
    amount_cents, tip_cents, processing_fee_cents, currency,
    is_tax_deductible, tax_deductible, tax_deductible_amount_cents,
    tax_year, campaign_title, recipient_name, recipient_ein,
    donor_name, donor_email, donation_date, status, refunded_at, emailed_at
  ) values (
    new.id, new.donor_id, nullif(v_nonprofit.id, '00000000-0000-0000-0000-000000000000'),
    new.campaign_id, v_receipt_number, new.amount_cents,
    coalesce(new.tip_cents, 0), coalesce(new.processing_fee_cents, 0),
    coalesce(new.currency, 'usd'), v_tax_deductible, v_tax_deductible,
    case when v_tax_deductible and new.status = 'completed' then new.amount_cents else 0 end,
    extract(year from new.created_at)::integer, v_campaign.title,
    v_recipient_name, v_recipient_ein, v_donor_name, v_donor_email,
    new.created_at,
    case when new.status = 'refunded' then 'refunded' else 'issued' end,
    case when new.status = 'refunded' then coalesce(new.refunded_at, now()) else null end,
    null
  )
  on conflict (donation_id) do update set
    donor_id = excluded.donor_id,
    nonprofit_id = excluded.nonprofit_id,
    campaign_id = excluded.campaign_id,
    amount_cents = excluded.amount_cents,
    tip_cents = excluded.tip_cents,
    processing_fee_cents = excluded.processing_fee_cents,
    currency = excluded.currency,
    is_tax_deductible = excluded.is_tax_deductible,
    tax_deductible = excluded.tax_deductible,
    tax_deductible_amount_cents = excluded.tax_deductible_amount_cents,
    tax_year = excluded.tax_year,
    campaign_title = excluded.campaign_title,
    recipient_name = excluded.recipient_name,
    recipient_ein = excluded.recipient_ein,
    donor_name = excluded.donor_name,
    donor_email = excluded.donor_email,
    donation_date = excluded.donation_date,
    status = excluded.status,
    refunded_at = excluded.refunded_at;

  return new;
end;
$$;

drop trigger if exists donations_tax_receipt_sync on public.donations;
create trigger donations_tax_receipt_sync
after insert or update of status, refunded_at on public.donations
for each row execute function public.sync_tax_receipt_for_donation();

-- Backfill historical completed/refunded donations without changing donation
-- totals or payment state. The unique donation index makes this idempotent.
insert into public.tax_receipts (
  donation_id, donor_id, nonprofit_id, campaign_id, receipt_number,
  amount_cents, tip_cents, processing_fee_cents, currency,
  is_tax_deductible, tax_deductible, tax_deductible_amount_cents,
  tax_year, campaign_title, recipient_name, recipient_ein,
  donor_name, donor_email, donation_date, status, refunded_at
)
select
  d.id, d.donor_id, np.id, d.campaign_id,
  'CHM-' || replace(d.id::text, '-', ''), d.amount_cents,
  coalesce(d.tip_cents, 0), coalesce(d.processing_fee_cents, 0),
  coalesce(d.currency, 'usd'),
  coalesce(np.verified, false) and coalesce(np.tax_receipt_enabled, false)
    and coalesce(np.verification_status, 'unverified') in ('verified', 'approved'),
  coalesce(np.verified, false) and coalesce(np.tax_receipt_enabled, false)
    and coalesce(np.verification_status, 'unverified') in ('verified', 'approved'),
  case when coalesce(np.verified, false) and coalesce(np.tax_receipt_enabled, false)
    and coalesce(np.verification_status, 'unverified') in ('verified', 'approved')
    and d.status = 'completed' then d.amount_cents else 0 end,
  extract(year from d.created_at)::integer, c.title, np.name,
  coalesce(nullif(np.ein, ''), nullif(np.tax_id, '')),
  coalesce(p.full_name, d.offline_donor_name), coalesce(p.email, d.offline_donor_email),
  d.created_at,
  case when d.status = 'refunded' then 'refunded' else 'issued' end,
  d.refunded_at
from public.donations d
join public.campaigns c on c.id = d.campaign_id
left join lateral (
  select np.*
  from public.nonprofit_profiles np
  where np.id = c.nonprofit_id
     or (c.nonprofit_id is null and np.owner_id = c.user_id)
  order by case when np.id = c.nonprofit_id then 0 else 1 end, np.created_at asc
  limit 1
) np on true
left join public.profiles p on p.id = d.donor_id
where d.status in ('completed', 'refunded')
on conflict (donation_id) do nothing;

comment on table public.tax_receipts is
  'One auditable tax record per completed/refunded donation. Tax deductibility is explicit and requires a verified nonprofit receipt setting.';
