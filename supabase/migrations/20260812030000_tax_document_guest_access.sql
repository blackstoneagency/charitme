update public.donation_receipts
set donor_email = lower(trim(donor_email))
where donor_email is not null
  and donor_email <> lower(trim(donor_email));

delete from public.donation_receipts older
using public.donation_receipts newer
where older.donation_id = newer.donation_id
  and (
    greatest(
      coalesce(older.resent_at, '-infinity'::timestamptz),
      coalesce(older.email_sent_at, '-infinity'::timestamptz),
      older.created_at
    ),
    older.id
  ) < (
    greatest(
      coalesce(newer.resent_at, '-infinity'::timestamptz),
      coalesce(newer.email_sent_at, '-infinity'::timestamptz),
      newer.created_at
    ),
    newer.id
  );

create unique index if not exists donation_receipts_donation_id_unique
  on public.donation_receipts (donation_id);

create index if not exists donation_receipts_guest_email_idx
  on public.donation_receipts (donor_email, created_at desc)
  where donor_id is null and donor_email is not null;

select pg_notify('pgrst', 'reload schema');
