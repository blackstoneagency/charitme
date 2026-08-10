alter table public.event_registrations
  add column if not exists status text not null default 'confirmed';
alter table public.event_registrations
  add column if not exists stripe_checkout_session_id text;
alter table public.event_registrations
  add column if not exists checkout_token uuid;
alter table public.event_registrations
  add column if not exists reservation_expires_at timestamptz;
alter table public.event_registrations
  add column if not exists currency text not null default 'usd';
alter table public.event_registrations
  add column if not exists ticket_code uuid not null default uuid_generate_v4();
alter table public.event_registrations
  add column if not exists refunded_cents bigint not null default 0;
alter table public.event_registrations
  add column if not exists stripe_dispute_id text;
alter table public.event_registrations
  add column if not exists dispute_status text not null default 'none';
alter table public.event_registrations
  add column if not exists dispute_closed_at timestamptz;
alter table public.event_registrations
  add column if not exists confirmed_at timestamptz;
alter table public.event_registrations
  add column if not exists cancelled_at timestamptz;
alter table public.event_registrations
  add column if not exists refunded_at timestamptz;

alter table public.event_registrations
  drop constraint if exists event_registrations_status_check,
  add constraint event_registrations_status_check
    check (status in ('pending', 'confirmed', 'refund_pending', 'partially_refunded', 'refunded', 'cancelled', 'disputed')),
  drop constraint if exists event_registrations_amounts_check,
  add constraint event_registrations_amounts_check
    check (amount_cents >= 0 and refunded_cents >= 0 and refunded_cents <= amount_cents),
  drop constraint if exists event_registrations_dispute_status_check,
  add constraint event_registrations_dispute_status_check
    check (dispute_status in ('none', 'opened', 'won', 'lost')),
  drop constraint if exists event_registrations_quantity_check,
  add constraint event_registrations_quantity_check check (quantity between 1 and 20);

alter table public.event_tickets
  drop constraint if exists event_tickets_price_check,
  add constraint event_tickets_price_check check (price_cents >= 0),
  drop constraint if exists event_tickets_inventory_check,
  add constraint event_tickets_inventory_check
    check (sold_count >= 0 and (quantity_limit is null or quantity_limit >= 0));

create unique index if not exists event_registrations_checkout_token_uidx
  on public.event_registrations (checkout_token)
  where checkout_token is not null;

create unique index if not exists event_registrations_stripe_session_uidx
  on public.event_registrations (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists event_registrations_ticket_code_uidx
  on public.event_registrations (ticket_code);

create unique index if not exists event_registrations_stripe_dispute_uidx
  on public.event_registrations (stripe_dispute_id)
  where stripe_dispute_id is not null;

create index if not exists event_registrations_attendee_status_idx
  on public.event_registrations (attendee_id, status, created_at desc);

create index if not exists event_registrations_pending_expiry_idx
  on public.event_registrations (reservation_expires_at)
  where status = 'pending';

create or replace function public.release_expired_event_ticket_reservations()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with expired as (
    update public.event_registrations
       set status = 'cancelled', cancelled_at = now()
     where status = 'pending'
       and reservation_expires_at <= now()
    returning ticket_id, quantity
  ), released as (
    select ticket_id, sum(quantity)::integer as quantity
      from expired
     where ticket_id is not null
     group by ticket_id
  )
  update public.event_tickets t
     set sold_count = greatest(0, t.sold_count - released.quantity)
    from released
   where t.id = released.ticket_id;
end;
$$;

create or replace function public.reserve_event_ticket(
  p_event_id uuid,
  p_ticket_id uuid,
  p_attendee_id uuid,
  p_attendee_email text,
  p_attendee_name text,
  p_quantity integer,
  p_checkout_token uuid
)
returns table (
  registration_id uuid,
  unit_price_cents bigint,
  total_cents bigint,
  currency text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.fundraising_events%rowtype;
  v_ticket public.event_tickets%rowtype;
  v_existing public.event_registrations%rowtype;
  v_registered integer;
  v_registration_id uuid;
begin
  if p_quantity < 1 or p_quantity > 20 then
    raise exception 'invalid ticket quantity' using errcode = '22023';
  end if;

  perform public.release_expired_event_ticket_reservations();

  select * into v_existing
    from public.event_registrations
   where checkout_token = p_checkout_token;

  if found then
    if v_existing.attendee_id <> p_attendee_id then
      raise exception 'checkout token is already in use' using errcode = '23505';
    end if;
    return query
      select v_existing.id, t.price_cents, v_existing.amount_cents, v_existing.currency
        from public.event_tickets t
       where t.id = v_existing.ticket_id;
    return;
  end if;

  select * into v_event
    from public.fundraising_events
   where id = p_event_id
   for update;

  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  if v_event.status <> 'published' or coalesce(v_event.ends_at, v_event.starts_at) < now() then
    raise exception 'event registration is closed' using errcode = 'P0001';
  end if;

  if exists (
    select 1
      from public.event_registrations r
     where r.event_id = p_event_id
       and r.attendee_id = p_attendee_id
       and r.status in ('pending', 'confirmed', 'refund_pending', 'partially_refunded', 'disputed')
  ) then
    raise exception 'attendee is already registered' using errcode = '23505';
  end if;

  select coalesce(sum(r.quantity), 0)::integer into v_registered
    from public.event_registrations r
   where r.event_id = p_event_id
     and r.status in ('pending', 'confirmed', 'refund_pending', 'partially_refunded', 'disputed');

  if v_event.capacity is not null and v_registered + p_quantity > v_event.capacity then
    raise exception 'event capacity exceeded' using errcode = 'P0001';
  end if;

  select * into v_ticket
    from public.event_tickets
   where id = p_ticket_id and event_id = p_event_id
   for update;

  if not found then
    raise exception 'ticket not found' using errcode = 'P0002';
  end if;
  if v_ticket.price_cents <= 0 then
    raise exception 'ticket does not require checkout' using errcode = '22023';
  end if;
  if v_ticket.quantity_limit is not null
     and v_ticket.sold_count + p_quantity > v_ticket.quantity_limit then
    raise exception 'ticket inventory exceeded' using errcode = 'P0001';
  end if;

  insert into public.event_registrations (
    event_id,
    ticket_id,
    attendee_id,
    attendee_email,
    attendee_name,
    quantity,
    amount_cents,
    status,
    checkout_token,
    reservation_expires_at,
    currency
  ) values (
    p_event_id,
    p_ticket_id,
    p_attendee_id,
    nullif(trim(p_attendee_email), ''),
    nullif(trim(p_attendee_name), ''),
    p_quantity,
    v_ticket.price_cents * p_quantity,
    'pending',
    p_checkout_token,
    now() + interval '30 minutes',
    'usd'
  ) returning id into v_registration_id;

  update public.event_tickets
     set sold_count = sold_count + p_quantity
   where id = p_ticket_id;

  return query
    select v_registration_id, v_ticket.price_cents,
           v_ticket.price_cents * p_quantity, 'usd'::text;
end;
$$;

create or replace function public.attach_event_ticket_checkout(
  p_registration_id uuid,
  p_checkout_token uuid,
  p_stripe_checkout_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.event_registrations
     set stripe_checkout_session_id = p_stripe_checkout_session_id
   where id = p_registration_id
     and checkout_token = p_checkout_token
     and status = 'pending'
     and (stripe_checkout_session_id is null or stripe_checkout_session_id = p_stripe_checkout_session_id);
  return found;
end;
$$;

create or replace function public.release_event_ticket_reservation(
  p_registration_id uuid,
  p_stripe_checkout_session_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.event_registrations%rowtype;
begin
  select * into v_registration
    from public.event_registrations
   where id = p_registration_id
   for update;

  if not found or v_registration.status <> 'pending' then
    return false;
  end if;
  if p_stripe_checkout_session_id is not null
     and v_registration.stripe_checkout_session_id <> p_stripe_checkout_session_id then
    return false;
  end if;

  update public.event_registrations
     set status = 'cancelled', cancelled_at = now()
   where id = p_registration_id;

  if v_registration.ticket_id is not null then
    update public.event_tickets
       set sold_count = greatest(0, sold_count - v_registration.quantity)
     where id = v_registration.ticket_id;
  end if;
  return true;
end;
$$;

create or replace function public.confirm_event_ticket_registration(
  p_registration_id uuid,
  p_stripe_checkout_session_id text,
  p_stripe_payment_intent_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.event_registrations%rowtype;
begin
  select * into v_registration
    from public.event_registrations
   where id = p_registration_id
   for update;

  if not found then
    return false;
  end if;
  if v_registration.status = 'confirmed'
     and v_registration.stripe_checkout_session_id = p_stripe_checkout_session_id then
    return true;
  end if;
  if v_registration.status <> 'pending'
     or v_registration.stripe_checkout_session_id <> p_stripe_checkout_session_id then
    return false;
  end if;

  update public.event_registrations
     set status = 'confirmed',
         stripe_payment_intent_id = p_stripe_payment_intent_id,
         confirmed_at = now(),
         reservation_expires_at = null
   where id = p_registration_id;
  return true;
end;
$$;

create or replace function public.apply_event_ticket_refund(
  p_stripe_payment_intent_id text,
  p_refunded_cents bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.event_registrations%rowtype;
  v_full boolean;
begin
  select * into v_registration
    from public.event_registrations
   where stripe_payment_intent_id = p_stripe_payment_intent_id
   for update;

  if not found then
    return false;
  end if;

  v_full := p_refunded_cents >= v_registration.amount_cents;
  if v_full and v_registration.status <> 'refunded' and v_registration.ticket_id is not null then
    update public.event_tickets
       set sold_count = greatest(0, sold_count - v_registration.quantity)
     where id = v_registration.ticket_id;
  end if;

  update public.event_registrations
     set refunded_cents = least(amount_cents, greatest(refunded_cents, p_refunded_cents)),
         status = case when v_full then 'refunded' else 'partially_refunded' end,
         refunded_at = case when v_full then now() else refunded_at end
   where id = v_registration.id;
  return true;
end;
$$;

create or replace function public.apply_event_ticket_dispute(
  p_stripe_payment_intent_id text,
  p_stripe_dispute_id text,
  p_outcome text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.event_registrations%rowtype;
begin
  if p_outcome not in ('opened', 'won', 'lost') then
    raise exception 'invalid dispute outcome' using errcode = '22023';
  end if;

  select * into v_registration
    from public.event_registrations
   where stripe_payment_intent_id = p_stripe_payment_intent_id
   for update;

  if not found then
    return false;
  end if;
  if v_registration.stripe_dispute_id is not null
     and v_registration.stripe_dispute_id <> p_stripe_dispute_id then
    raise exception 'payment intent has a different dispute' using errcode = '23505';
  end if;

  if p_outcome = 'opened' then
    update public.event_registrations
       set status = case
                      when status in ('refunded', 'cancelled') then status
                      else 'disputed'
                    end,
           stripe_dispute_id = p_stripe_dispute_id,
           dispute_status = 'opened',
           dispute_closed_at = null
     where id = v_registration.id;
    return true;
  end if;

  if p_outcome = 'lost'
     and v_registration.status not in ('refunded', 'cancelled')
     and v_registration.ticket_id is not null then
    update public.event_tickets
       set sold_count = greatest(0, sold_count - v_registration.quantity)
     where id = v_registration.ticket_id;
  end if;

  update public.event_registrations
     set status = case
                    when p_outcome = 'lost' then 'cancelled'
                    when refunded_cents >= amount_cents then 'refunded'
                    when refunded_cents > 0 then 'partially_refunded'
                    else 'confirmed'
                  end,
         stripe_dispute_id = p_stripe_dispute_id,
         dispute_status = p_outcome,
         dispute_closed_at = now(),
         cancelled_at = case when p_outcome = 'lost' then coalesce(cancelled_at, now()) else cancelled_at end
   where id = v_registration.id;
  return true;
end;
$$;

create or replace function public.create_event_with_tickets(
  p_created_by uuid,
  p_campaign_id uuid,
  p_title text,
  p_slug text,
  p_description text,
  p_event_type text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_location text,
  p_virtual_url text,
  p_cover_image_url text,
  p_capacity integer,
  p_status text,
  p_tickets jsonb
)
returns table (event_id uuid, event_slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_ticket record;
begin
  insert into public.fundraising_events (
    created_by, campaign_id, title, slug, description, event_type, starts_at,
    ends_at, location, virtual_url, cover_image_url, capacity, status
  ) values (
    p_created_by, p_campaign_id, p_title, p_slug, p_description, p_event_type,
    p_starts_at, p_ends_at, p_location, p_virtual_url, p_cover_image_url,
    p_capacity, p_status
  ) returning id into v_event_id;

  for v_ticket in
    select *
      from jsonb_to_recordset(coalesce(p_tickets, '[]'::jsonb))
        as ticket(title text, price_cents bigint, quantity_limit integer)
  loop
    if nullif(trim(v_ticket.title), '') is null
       or v_ticket.price_cents < 0
       or (v_ticket.quantity_limit is not null and v_ticket.quantity_limit < 1) then
      raise exception 'invalid event ticket' using errcode = '22023';
    end if;
    insert into public.event_tickets (event_id, title, price_cents, quantity_limit)
    values (v_event_id, trim(v_ticket.title), v_ticket.price_cents, v_ticket.quantity_limit);
  end loop;

  return query select v_event_id, p_slug;
end;
$$;

drop policy if exists event_registrations_insert_own on public.event_registrations;
drop policy if exists event_registrations_attendee_insert on public.event_registrations;
drop policy if exists event_registrations_free_insert on public.event_registrations;
create policy event_registrations_free_insert on public.event_registrations
  for insert to authenticated
  with check (
    auth.uid() = attendee_id
    and amount_cents = 0
    and status = 'confirmed'
    and (
      ticket_id is null
      or exists (
        select 1 from public.event_tickets t
         where t.id = ticket_id and t.event_id = event_id and t.price_cents = 0
      )
    )
  );

drop policy if exists event_tickets_creator_write on public.event_tickets;
create policy event_tickets_creator_write on public.event_tickets
  for all to authenticated
  using (
    is_admin()
    or exists (
      select 1 from public.fundraising_events e
       where e.id = event_id and e.created_by = auth.uid()
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from public.fundraising_events e
       where e.id = event_id and e.created_by = auth.uid()
    )
  );

revoke all on function public.release_expired_event_ticket_reservations() from public, anon, authenticated;
revoke all on function public.reserve_event_ticket(uuid, uuid, uuid, text, text, integer, uuid) from public, anon, authenticated;
revoke all on function public.attach_event_ticket_checkout(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.release_event_ticket_reservation(uuid, text) from public, anon, authenticated;
revoke all on function public.confirm_event_ticket_registration(uuid, text, text) from public, anon, authenticated;
revoke all on function public.apply_event_ticket_refund(text, bigint) from public, anon, authenticated;
revoke all on function public.apply_event_ticket_dispute(text, text, text) from public, anon, authenticated;
revoke all on function public.create_event_with_tickets(uuid, uuid, text, text, text, text, timestamptz, timestamptz, text, text, text, integer, text, jsonb) from public, anon, authenticated;

grant execute on function public.release_expired_event_ticket_reservations() to service_role;
grant execute on function public.reserve_event_ticket(uuid, uuid, uuid, text, text, integer, uuid) to service_role;
grant execute on function public.attach_event_ticket_checkout(uuid, uuid, text) to service_role;
grant execute on function public.release_event_ticket_reservation(uuid, text) to service_role;
grant execute on function public.confirm_event_ticket_registration(uuid, text, text) to service_role;
grant execute on function public.apply_event_ticket_refund(text, bigint) to service_role;
grant execute on function public.apply_event_ticket_dispute(text, text, text) to service_role;
grant execute on function public.create_event_with_tickets(uuid, uuid, text, text, text, text, timestamptz, timestamptz, text, text, text, integer, text, jsonb) to service_role;
