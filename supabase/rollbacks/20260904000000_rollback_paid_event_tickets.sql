drop function if exists public.create_event_with_tickets(uuid, uuid, text, text, text, text, timestamptz, timestamptz, text, text, text, integer, text, jsonb);
drop function if exists public.apply_event_ticket_refund(text, bigint);
drop function if exists public.apply_event_ticket_dispute(text, text, text);
drop function if exists public.confirm_event_ticket_registration(uuid, text, text);
drop function if exists public.release_event_ticket_reservation(uuid, text);
drop function if exists public.attach_event_ticket_checkout(uuid, uuid, text);
drop function if exists public.reserve_event_ticket(uuid, uuid, uuid, text, text, integer, uuid);
drop function if exists public.release_expired_event_ticket_reservations();

drop policy if exists event_tickets_creator_write on public.event_tickets;
drop policy if exists event_registrations_free_insert on public.event_registrations;
create policy event_registrations_attendee_insert on public.event_registrations
  for insert with check (auth.uid() = attendee_id or is_admin());
create policy event_registrations_insert_own on public.event_registrations
  for insert with check (auth.uid() = attendee_id or attendee_id is null or is_admin());

drop index if exists public.event_registrations_pending_expiry_idx;
drop index if exists public.event_registrations_attendee_status_idx;
drop index if exists public.event_registrations_ticket_code_uidx;
drop index if exists public.event_registrations_stripe_dispute_uidx;
drop index if exists public.event_registrations_stripe_session_uidx;
drop index if exists public.event_registrations_checkout_token_uidx;

alter table public.event_tickets
  drop constraint if exists event_tickets_inventory_check,
  drop constraint if exists event_tickets_price_check;

alter table public.event_registrations
  drop constraint if exists event_registrations_quantity_check,
  drop constraint if exists event_registrations_amounts_check,
  drop constraint if exists event_registrations_dispute_status_check,
  drop constraint if exists event_registrations_status_check,
  drop column if exists dispute_closed_at,
  drop column if exists dispute_status,
  drop column if exists stripe_dispute_id,
  drop column if exists refunded_at,
  drop column if exists cancelled_at,
  drop column if exists confirmed_at,
  drop column if exists refunded_cents,
  drop column if exists ticket_code,
  drop column if exists currency,
  drop column if exists reservation_expires_at,
  drop column if exists checkout_token,
  drop column if exists stripe_checkout_session_id,
  drop column if exists status;
