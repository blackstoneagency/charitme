drop trigger if exists donor_messages_sync_anonymity on public.donor_messages;
drop function if exists public.sync_donor_message_anonymity();

-- Preserve the compatibility column and backfilled privacy choices on rollback.
