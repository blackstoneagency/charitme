drop index if exists public.donation_receipts_guest_email_idx;
drop index if exists public.donation_receipts_donation_id_unique;

select pg_notify('pgrst', 'reload schema');
