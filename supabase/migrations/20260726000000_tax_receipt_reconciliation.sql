-- Keep one official tax receipt per completed donation so email delivery,
-- annual donor statements, and admin re-sends reconcile to the same record.
alter table if exists public.tax_receipts
  add column if not exists currency text not null default 'usd',
  add column if not exists nonprofit_name text,
  add column if not exists nonprofit_ein text,
  add column if not exists campaign_title text,
  add column if not exists no_goods_or_services boolean not null default true;

delete from public.tax_receipts older
using public.tax_receipts newer
where older.donation_id is not null
  and older.donation_id = newer.donation_id
  and (older.created_at, older.id) < (newer.created_at, newer.id);

create unique index if not exists tax_receipts_donation_id_unique
  on public.tax_receipts (donation_id)
  where donation_id is not null;

create index if not exists tax_receipts_donor_created_at_idx
  on public.tax_receipts (donor_id, created_at desc);
