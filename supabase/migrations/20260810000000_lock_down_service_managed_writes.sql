-- Route all public-facing service writes through validated, rate-limited APIs.

drop policy if exists contact_messages_insert on public.contact_messages;
drop policy if exists support_own_insert on public.support_cases;
drop policy if exists share_insert_any on public.share_events;
drop policy if exists receipts_svc_insert on public.donation_receipts;
drop policy if exists status_log_svc_insert on public.campaign_status_log;
drop policy if exists cbe_insert_any on public.campaign_builder_events;
drop policy if exists creator_tips_insert_public on public.creator_tips;

revoke insert, update, delete on table public.contact_messages
  from public, anon, authenticated;
revoke insert, update, delete on table public.support_cases
  from public, anon, authenticated;
revoke insert, update, delete on table public.share_events
  from public, anon, authenticated;
revoke insert, update, delete on table public.donation_receipts
  from public, anon, authenticated;
revoke insert, update, delete on table public.campaign_status_log
  from public, anon, authenticated;
revoke insert, update, delete on table public.campaign_builder_events
  from public, anon, authenticated;
revoke insert, update, delete on table public.creator_tips
  from public, anon, authenticated;

grant insert, update, delete on table public.contact_messages to service_role;
grant insert, update, delete on table public.support_cases to service_role;
grant insert, update, delete on table public.share_events to service_role;
grant insert, update, delete on table public.donation_receipts to service_role;
grant insert, update, delete on table public.campaign_status_log to service_role;
grant insert, update, delete on table public.campaign_builder_events to service_role;
grant insert, update, delete on table public.creator_tips to service_role;
