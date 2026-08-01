-- =============================================================================
-- CharitMe — consolidated database schema (public schema).
--
-- GENERATED FILE — DO NOT EDIT BY HAND.
--   Faithful mirror of supabase/migrations/ (plus feature_flags and
--   admin_settings), produced by pg_dump of a migration-built database. It lets
--   the full schema be read in one place and applied to a fresh database.
--
--   To change the schema: add a migration under supabase/migrations/ and
--   regenerate this file (scripts/regen_schema.sh). Do NOT hand-edit — that is
--   what caused this file to drift from the migrations before.
--   For an existing/behind database, use supabase/catch_up.sql (idempotent).
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: audit_campaign_payment_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_campaign_payment_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  row_data jsonb := to_jsonb(new);
begin
  insert into public.campaign_payment_audit_logs (
    campaign_payment_id, campaign_id, campaign_owner_id, donor_id,
    processor, processor_account_id, processor_object_id,
    action, gross_amount, currency, status, metadata
  ) values (
    nullif(coalesce(row_data->>'campaign_payment_id', row_data->>'id'), '')::uuid,
    nullif(row_data->>'campaign_id', '')::uuid,
    nullif(row_data->>'campaign_owner_id', '')::uuid,
    nullif(row_data->>'donor_id', '')::uuid,
    coalesce(row_data->>'processor', 'stripe'),
    row_data->>'processor_account_id',
    coalesce(row_data->>'processor_object_id', row_data->>'processor_payment_intent_id', row_data->>'processor_checkout_session_id'),
    tg_table_name || '.' || lower(tg_op),
    coalesce((row_data->>'gross_amount')::bigint, 0),
    coalesce(row_data->>'currency', 'usd'),
    'recorded',
    jsonb_build_object('table', tg_table_name, 'operation', tg_op)
  );
  return new;
end;
$$;


--
-- Name: banner_settings_touch(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.banner_settings_touch() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if row(
    new.content_title,
    new.content_body,
    new.content_link_label,
    new.content_link_url
  ) is distinct from row(
    old.content_title,
    old.content_body,
    old.content_link_label,
    old.content_link_url
  ) then
    new.content_revision = old.content_revision + 1;
  end if;
  new.updated_at = now();
  return new;
end
$$;


--
-- Name: campaign_payment_owner_can_read(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.campaign_payment_owner_can_read(p_campaign_id uuid, p_campaign_owner_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select auth.uid() = p_campaign_owner_id
    or exists (
      select 1 from public.campaigns c
      where c.id = p_campaign_id and c.user_id = auth.uid()
    );
$$;


--
-- Name: campaign_wizard_drafts_touch(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.campaign_wizard_drafts_touch() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end $$;


--
-- Name: check_rate_limit(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_now timestamptz := now();
  v_row public.rate_limit_hits;
begin
  select * into v_row from public.rate_limit_hits where key = p_key for update;

  if not found then
    insert into public.rate_limit_hits (key, count, reset_at, updated_at)
    values (p_key, 1, v_now + make_interval(secs => p_window_seconds), v_now)
    on conflict (key) do update
      set count = 1, reset_at = excluded.reset_at, updated_at = v_now;
    return true;
  end if;

  -- Window expired → start a fresh window.
  if v_row.reset_at <= v_now then
    update public.rate_limit_hits
      set count = 1, reset_at = v_now + make_interval(secs => p_window_seconds), updated_at = v_now
      where key = p_key;
    return true;
  end if;

  -- Within window and at/over the limit → deny.
  if v_row.count >= p_limit then
    return false;
  end if;

  update public.rate_limit_hits set count = count + 1, updated_at = v_now where key = p_key;
  return true;
end; $$;


--
-- Name: claim_campaign_reward(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_campaign_reward(p_reward_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
  update public.campaign_rewards
  set claimed_count = claimed_count + 1
  where id = p_reward_id
    and (item_limit is null or claimed_count < item_limit);
$$;


--
-- Name: decrement_campaign_stats(uuid, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_campaign_stats(p_campaign_id uuid, p_amount_cents bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
begin
  update public.campaigns
  set raised_amount = greatest(0, raised_amount - p_amount_cents),
      backer_count  = greatest(0, backer_count  - 1),
      updated_at    = now()
  where id = p_campaign_id;
end; $$;


--
-- Name: get_admin_system_resource_usage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_system_resource_usage() RETURNS TABLE(label text, value integer, color text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
  with db as (
    select
      greatest(numbackends, 0)::numeric as active_connections,
      greatest(blks_hit, 0)::numeric as blks_hit,
      greatest(blks_read, 0)::numeric as blks_read
    from pg_stat_database
    where datname = current_database()
  ),
  limits as (
    select greatest(current_setting('max_connections')::numeric, 1) as max_connections
  ),
  webhook_health as (
    select
      count(*)::numeric as total_events,
      count(*) filter (where processing_error is null)::numeric as successful_events
    from public.webhook_events
    where created_at >= now() - interval '24 hours'
  )
  select
    'DB Connections'::text,
    least(100, round((db.active_connections / limits.max_connections) * 100)::int),
    '#6c35ff'::text
  from db, limits
  union all
  select
    'Cache Hit Rate'::text,
    case
      when db.blks_hit + db.blks_read = 0 then 100
      else least(100, round((db.blks_hit / (db.blks_hit + db.blks_read)) * 100)::int)
    end,
    '#19b86a'::text
  from db
  union all
  select
    'Webhook Success'::text,
    case
      when webhook_health.total_events = 0 then 100
      else least(100, round((webhook_health.successful_events / webhook_health.total_events) * 100)::int)
    end,
    '#2f80ed'::text
  from webhook_health;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
declare
  display_name text;
begin
  display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', '')
  );

  insert into public.profiles (id, email, full_name, avatar_url, roles)
  values (
    new.id,
    new.email,
    display_name,
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    '["donor"]'::jsonb
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();

  if new.email is not null then
    update public.marketing_contacts
    set
      user_id = new.id,
      first_name = coalesce(first_name, display_name),
      last_active_at = now()
    where lower(email) = lower(new.email)
      and user_id is null;

    if not found then
      insert into public.marketing_contacts (
        user_id, email, first_name, client_type, lifecycle_stage, status
      )
      values (new.id, new.email, display_name, 'donor', 'subscriber', 'active')
      on conflict do nothing;
    end if;

    insert into public.marketing_identities (contact_id, kind, value)
    select c.id, 'email', lower(new.email)
    from public.marketing_contacts c
    where lower(c.email) = lower(new.email)
    order by c.created_at
    limit 1
    on conflict (kind, value) do nothing;

    insert into public.marketing_identities (contact_id, kind, value)
    select c.id, 'user_id', new.id::text
    from public.marketing_contacts c
    where c.user_id = new.id
    order by c.created_at
    limit 1
    on conflict (kind, value) do nothing;
  end if;

  return new;
end;
$$;


--
-- Name: increment_campaign_stats(uuid, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_campaign_stats(p_campaign_id uuid, p_amount bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
begin
  update campaigns
  set raised_amount = raised_amount + p_amount,
      backer_count = backer_count + 1,
      updated_at = now()
  where id = p_campaign_id;
end;
$$;


--
-- Name: increment_campaign_stats_after_donation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_campaign_stats_after_donation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if new.status = 'completed' then
    update campaigns
    set raised_amount = raised_amount + new.amount_cents,
        backer_count = backer_count + 1,
        updated_at = now()
    where id = new.campaign_id;
  end if;
  return new;
end;
$$;


--
-- Name: increment_peer_fundraiser_after_donation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_peer_fundraiser_after_donation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  -- Mirrors increment_campaign_stats_after_donation's guard: only completed
  -- money counts. A pending or failed row must not move a public total.
  if new.status = 'completed' and new.peer_fundraiser_id is not null then
    update public.peer_fundraisers
    set raised_amount = raised_amount + new.amount_cents,
        updated_at    = now()
    where id = new.peer_fundraiser_id;
  end if;
  return new;
end;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and (roles ? 'admin' or roles ? 'super_admin')
  );
$$;


--
-- Name: is_campaign_team_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_campaign_team_member(p_campaign_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from team_members tm
    where tm.campaign_id = p_campaign_id
      and tm.user_id = p_user_id
  );
$$;


--
-- Name: is_org_member(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_member(target_org uuid, min_role text DEFAULT 'member'::text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((
    select case
      when auth.uid() is null then false
      else exists (
        select 1
          from organization_members m
         where m.org_id = target_org
           and m.user_id = auth.uid()
           and m.deleted_at is null
           and case min_role
                 when 'owner'  then m.role = 'owner'
                 when 'admin'  then m.role in ('owner', 'admin')
                 when 'editor' then m.role in ('owner', 'admin', 'editor')
                 else true
               end
      )
    end
  ), false);
$$;


--
-- Name: marketing_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.marketing_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end $$;


--
-- Name: owns_campaign(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.owns_campaign(cid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from campaigns c where c.id = cid and c.user_id = auth.uid());
$$;


--
-- Name: prevent_ledger_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_ledger_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  raise exception 'ledger_entries is append-only; post reversing entries instead';
end; $$;


--
-- Name: protect_profile_privileged_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_profile_privileged_fields() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
begin
  if coalesce(auth.role(), '') = 'service_role'
    or current_user in ('postgres', 'supabase_admin')
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.roles is distinct from '["donor"]'::jsonb
      or new.identity_verified is distinct from false
      or new.trust_passport_score is distinct from 0
      or coalesce(new.plan, 'free') <> 'free'
      or new.stripe_customer_id is not null
      or new.stripe_subscription_id is not null
      or new.email is distinct from nullif(auth.jwt() ->> 'email', '')
    then
      raise insufficient_privilege using
        message = 'Privileged profile fields may only be changed by the service role';
    end if;
  elsif new.roles is distinct from old.roles
    or new.identity_verified is distinct from old.identity_verified
    or new.trust_passport_score is distinct from old.trust_passport_score
    or new.plan is distinct from old.plan
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.email is distinct from old.email
  then
    raise insufficient_privilege using
      message = 'Privileged profile fields may only be changed by the service role';
  end if;

  return new;
end;
$$;


--
-- Name: record_donation(text, uuid, uuid, bigint, bigint, bigint, text, boolean, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_donation(p_stripe_event_id text, p_campaign_id uuid, p_donor_id uuid, p_amount_cents bigint, p_tip_cents bigint, p_processing_fee_cents bigint, p_message text, p_anonymous boolean, p_stripe_payment_intent_id text, p_stripe_checkout_session_id text, p_peer_fundraiser_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
declare
  v_existing uuid;
  v_lock_key text;
  v_peer_id uuid;                          -- +peer
begin
  -- Serialize concurrent processing of the SAME donation. Prefer the payment
  -- intent id, then the checkout session id, then the event id as the lock key
  -- so retried/duplicate deliveries collide while distinct donations do not.
  v_lock_key := coalesce(
    nullif(p_stripe_payment_intent_id, ''),
    nullif(p_stripe_checkout_session_id, ''),
    p_stripe_event_id
  );
  if v_lock_key is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
  end if;

  -- Idempotency check (race-safe under the advisory lock above)
  select id into v_existing from donations
  where stripe_checkout_session_id = p_stripe_checkout_session_id
     or (stripe_payment_intent_id = p_stripe_payment_intent_id and p_stripe_payment_intent_id is not null)
  limit 1;

  if v_existing is not null then
    return jsonb_build_object('status','already_processed','id', v_existing);
  end if;

  -- +peer: the id arrives from Stripe metadata, which is client-influenced —
  -- the donor picked the supporter page they gave through. Verify here rather
  -- than trusting it, because this runs SECURITY DEFINER: a peer id belonging
  -- to a DIFFERENT campaign would otherwise credit an unrelated supporter for
  -- money that campaign never received. An id that does not check out is
  -- dropped to NULL rather than raising: the donation is real and already paid
  -- for, so it must be recorded as a direct gift, never lost.
  if p_peer_fundraiser_id is not null then
    -- NOTE the column is `parent_campaign_id`, not `campaign_id`. Every other
    -- table in this schema names it `campaign_id`, so the wrong guess compiles
    -- as a plain "column does not exist" only at RUN time, inside the money
    -- path, where the handler rethrows and Stripe retries forever.
    select id into v_peer_id
    from peer_fundraisers
    where id = p_peer_fundraiser_id
      and parent_campaign_id = p_campaign_id
    limit 1;
  end if;

  -- The AFTER INSERT trigger donations_increment_campaign_stats increments
  -- campaigns.raised_amount / backer_count for this 'completed' row. Do NOT
  -- increment again here — that double-counts (see migration header).
  --
  -- +peer: donations_increment_peer_fundraiser (previous migration) rolls the
  -- same row into peer_fundraisers.raised_amount. It is a SEPARATE trigger on
  -- the same INSERT, so the parent campaign is credited exactly once and the
  -- supporter exactly once. Do not add a peer increment here either.
  insert into donations (
    campaign_id, donor_id, amount_cents, tip_cents, processing_fee_cents,
    status, anonymous, message, stripe_payment_intent_id, stripe_checkout_session_id,
    peer_fundraiser_id                                                    -- +peer
  ) values (
    p_campaign_id, p_donor_id, p_amount_cents, p_tip_cents, p_processing_fee_cents,
    'completed', p_anonymous, p_message, p_stripe_payment_intent_id, p_stripe_checkout_session_id,
    v_peer_id                                                             -- +peer
  );

  insert into webhook_events (stripe_event_id, event_type, payload, processed_at)
  values (p_stripe_event_id, 'checkout.session.completed', '{}'::jsonb, now())
  on conflict (stripe_event_id) do nothing;

  return jsonb_build_object('status','recorded');
exception when others then
  insert into webhook_events (stripe_event_id, event_type, payload, processing_error)
  values (p_stripe_event_id, 'checkout.session.completed', '{}'::jsonb, sqlerrm)
  on conflict (stripe_event_id) do nothing;
  raise;
end; $$;


--
-- Name: reload_postgrest_schema_cache(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reload_postgrest_schema_cache() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
  select pg_notify('pgrst', 'reload schema');
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: sync_donor_message_anonymity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_donor_message_anonymity() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    if new.anonymous or new.visibility = 'anonymous' then
      new.anonymous := true;
      new.visibility := 'anonymous';
    else
      new.anonymous := false;
      new.visibility := 'public';
    end if;
  elsif new.anonymous is distinct from old.anonymous then
    new.visibility := case when new.anonymous then 'anonymous' else 'public' end;
  elsif new.visibility is distinct from old.visibility then
    new.anonymous := new.visibility = 'anonymous';
  end if;

  return new;
end;
$$;


--
-- Name: volunteer_hours_guard_verification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.volunteer_hours_guard_verification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  owner_id uuid;
  actor    uuid;
begin
  if tg_op = 'UPDATE'
     and new.status is distinct from old.status
     and new.status = 'verified' then

    actor := auth.uid();

    select created_by into owner_id
      from volunteer_opportunities
     where id = new.opportunity_id;

    if actor is null then
      -- Server context (service role). RLS is bypassed here by design and the
      -- API route has already authorized the caller. Attribution is still
      -- mandatory: refuse an anonymous verification rather than record one.
      if new.verified_by is null then
        raise exception 'verified_by must be set when verifying volunteer hours from a server context'
          using errcode = 'check_violation';
      end if;
      new.verified_at := coalesce(new.verified_at, now());
    else
      -- End-user JWT. Only the opportunity owner or an admin may verify, and
      -- the attribution is stamped from the token so it cannot be forged.
      if not (coalesce(is_admin(), false) or coalesce(owner_id = actor, false)) then
        raise exception 'only the opportunity owner or an admin can verify volunteer hours'
          using errcode = 'check_violation';
      end if;
      new.verified_by := actor;
      new.verified_at := now();
    end if;
  end if;

  -- Leaving 'verified' clears the attribution so a rejected or reopened row
  -- never carries a stale verifier.
  if tg_op = 'UPDATE'
     and new.status is distinct from old.status
     and new.status <> 'verified' then
    new.verified_by := null;
    new.verified_at := null;
  end if;

  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_notes (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    author_id uuid,
    target_type text NOT NULL,
    target_id uuid NOT NULL,
    body text NOT NULL,
    internal boolean DEFAULT true NOT NULL,
    pinned boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admin_notes_target_type_check CHECK ((target_type = ANY (ARRAY['user'::text, 'campaign'::text, 'donation'::text, 'payout'::text, 'refund'::text, 'dispute'::text, 'support_case'::text, 'report'::text])))
);


--
-- Name: admin_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_reviews (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    reviewer_id uuid,
    campaign_id uuid,
    user_id uuid,
    review_type text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    action text,
    CONSTRAINT admin_reviews_action_check CHECK (((action IS NULL) OR (action = ANY (ARRAY['approved'::text, 'rejected'::text, 'flagged'::text, 'held'::text, 'released'::text]))))
);


--
-- Name: admin_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_settings (
    key text NOT NULL,
    value text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: aeo_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aeo_entries (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    topic text,
    schema_type text DEFAULT 'FAQPage'::text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    published boolean DEFAULT true NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    route text DEFAULT '/faq'::text NOT NULL,
    CONSTRAINT aeo_entries_private_routes_published_check CHECK (((published = false) OR (NOT ((route = ANY (ARRAY['/achievements'::text, '/privacy-center'::text, '/offline'::text])) OR (route = '/go'::text) OR (route ~~ '/go/%'::text) OR (route ~~ '/events/manage%'::text) OR (route ~~ '/impact/manage%'::text) OR (route ~~ '/matching/manage%'::text) OR (route ~~ '/sponsor/manage%'::text))))),
    CONSTRAINT aeo_entries_public_route_check CHECK (((route ~~ '/%'::text) AND (route !~~ '%?%'::text) AND (route !~~ '%#%'::text) AND (route !~~ '/admin%'::text) AND (route !~~ '/dashboard%'::text) AND (route !~~ '/create%'::text) AND (route !~~ '/login%'::text) AND (route !~~ '/forgot-password%'::text) AND (route !~~ '/profile%'::text) AND (route !~~ '/donor%'::text) AND (route !~~ '/beneficiary%'::text))),
    CONSTRAINT aeo_entries_schema_type_check CHECK ((schema_type = ANY (ARRAY['FAQPage'::text, 'QAPage'::text, 'HowTo'::text])))
);


--
-- Name: ai_generations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_generations (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid,
    campaign_id uuid,
    generation_type text NOT NULL,
    prompt jsonb NOT NULL,
    output jsonb NOT NULL,
    model text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: analytics_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_snapshots (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    owner_id uuid,
    campaign_id uuid,
    nonprofit_id uuid,
    creator_profile_id uuid,
    snapshot_date date DEFAULT CURRENT_DATE NOT NULL,
    metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    body text,
    level text DEFAULT 'info'::text NOT NULL,
    link_url text,
    link_label text,
    active boolean DEFAULT false NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT announcements_level_check CHECK ((level = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'critical'::text])))
);


--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    key_hash text NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auction_bids; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auction_bids (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    item_id uuid NOT NULL,
    bidder_id uuid,
    amount_cents bigint NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT auction_bids_status_check CHECK ((status = ANY (ARRAY['active'::text, 'outbid'::text, 'winning'::text, 'cancelled'::text])))
);


--
-- Name: auction_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auction_items (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    event_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    image_url text,
    starting_bid_cents bigint NOT NULL,
    current_bid_cents bigint DEFAULT 0 NOT NULL,
    closes_at timestamp with time zone,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT auction_items_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text, 'fulfilled'::text])))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    target_type text,
    target_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: banner_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banner_settings (
    id text DEFAULT 'global'::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    background_color text DEFAULT '#12b76a'::text NOT NULL,
    text_color text DEFAULT '#ffffff'::text NOT NULL,
    link_color text DEFAULT '#ffffff'::text NOT NULL,
    font_family text DEFAULT 'inherit'::text NOT NULL,
    font_size_px integer DEFAULT 14 NOT NULL,
    title_font_size_px integer DEFAULT 14 NOT NULL,
    font_weight integer DEFAULT 400 NOT NULL,
    title_font_weight integer DEFAULT 700 NOT NULL,
    text_align text DEFAULT 'left'::text NOT NULL,
    letter_spacing_em numeric DEFAULT 0 NOT NULL,
    uppercase boolean DEFAULT false NOT NULL,
    padding_y_px integer DEFAULT 9 NOT NULL,
    dismissible boolean DEFAULT true NOT NULL,
    use_level_colors boolean DEFAULT false NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    content_title text DEFAULT ''::text NOT NULL,
    content_body text DEFAULT ''::text NOT NULL,
    content_link_label text DEFAULT ''::text NOT NULL,
    content_link_url text DEFAULT ''::text NOT NULL,
    content_revision bigint DEFAULT 1 NOT NULL,
    CONSTRAINT banner_settings_align_chk CHECK ((text_align = ANY (ARRAY['left'::text, 'center'::text, 'right'::text]))),
    CONSTRAINT banner_settings_bg_chk CHECK ((background_color ~* '^#[0-9a-f]{3}([0-9a-f]{3})?$'::text)),
    CONSTRAINT banner_settings_content_body_chk CHECK ((char_length(content_body) <= 240)),
    CONSTRAINT banner_settings_content_link_label_chk CHECK ((char_length(content_link_label) <= 60)),
    CONSTRAINT banner_settings_content_link_url_chk CHECK (((char_length(content_link_url) <= 500) AND ((content_link_url = ''::text) OR (content_link_url ~ '^/($|[^/])'::text) OR (content_link_url ~* '^https://'::text)))),
    CONSTRAINT banner_settings_content_title_chk CHECK ((char_length(content_title) <= 120)),
    CONSTRAINT banner_settings_font_size_chk CHECK (((font_size_px >= 10) AND (font_size_px <= 28))),
    CONSTRAINT banner_settings_link_chk CHECK ((link_color ~* '^#[0-9a-f]{3}([0-9a-f]{3})?$'::text)),
    CONSTRAINT banner_settings_padding_chk CHECK (((padding_y_px >= 0) AND (padding_y_px <= 40))),
    CONSTRAINT banner_settings_singleton_chk CHECK ((id = 'global'::text)),
    CONSTRAINT banner_settings_text_chk CHECK ((text_color ~* '^#[0-9a-f]{3}([0-9a-f]{3})?$'::text)),
    CONSTRAINT banner_settings_tfont_size_chk CHECK (((title_font_size_px >= 10) AND (title_font_size_px <= 28))),
    CONSTRAINT banner_settings_tracking_chk CHECK (((letter_spacing_em >= '-0.05'::numeric) AND (letter_spacing_em <= 0.5))),
    CONSTRAINT banner_settings_tweight_chk CHECK ((title_font_weight = ANY (ARRAY[300, 400, 500, 600, 700, 800, 900]))),
    CONSTRAINT banner_settings_weight_chk CHECK ((font_weight = ANY (ARRAY[300, 400, 500, 600, 700, 800, 900])))
);


--
-- Name: beneficiary_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beneficiary_invites (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    invited_by uuid NOT NULL,
    email text NOT NULL,
    token text DEFAULT substr(md5(((random())::text || (clock_timestamp())::text)), 1, 32) NOT NULL,
    accepted_at timestamp with time zone,
    beneficiary_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL
);


--
-- Name: brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brands (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    org_id uuid NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    voice text,
    palette jsonb,
    logo_url text,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: business_leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_leads (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    business_name text NOT NULL,
    entity_type text,
    state text,
    filing_date date,
    filing_status text,
    registered_agent text,
    owner_name text,
    industry text,
    address text,
    source text DEFAULT 'manual'::text NOT NULL,
    source_ref text,
    website text,
    email text,
    phone text,
    enrichment_notes text,
    enrichment_model text,
    enriched_at timestamp with time zone,
    lead_score integer DEFAULT 0 NOT NULL,
    lead_grade text,
    score_breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    alerted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    marketing_contact_id uuid,
    CONSTRAINT business_leads_status_check CHECK ((status = ANY (ARRAY['new'::text, 'enriched'::text, 'contacted'::text, 'qualified'::text, 'converted'::text, 'rejected'::text])))
);


--
-- Name: campaign_analytics_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_analytics_events (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid,
    event_type text NOT NULL,
    source text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campaign_builder_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_builder_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id text NOT NULL,
    user_id uuid,
    path text DEFAULT 'guided'::text NOT NULL,
    step text NOT NULL,
    event text NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT campaign_builder_events_event_chk CHECK ((event = ANY (ARRAY['enter'::text, 'advance'::text, 'back'::text, 'publish'::text, 'save_draft'::text, 'abandon'::text]))),
    CONSTRAINT campaign_builder_events_path_chk CHECK ((path = ANY (ARRAY['guided'::text, 'ai'::text])))
);


--
-- Name: campaign_faqs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_faqs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    ai_generated boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT campaign_faqs_answer_check CHECK (((char_length(answer) >= 5) AND (char_length(answer) <= 2000))),
    CONSTRAINT campaign_faqs_question_check CHECK (((char_length(question) >= 5) AND (char_length(question) <= 300)))
);


--
-- Name: campaign_launch_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_launch_settings (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    funding_model text DEFAULT 'flexible'::text NOT NULL,
    launch_type text DEFAULT 'fundraiser'::text NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    country text DEFAULT 'US'::text NOT NULL,
    is_indemand boolean DEFAULT false NOT NULL,
    product_stage text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT campaign_launch_settings_funding_model_check CHECK ((funding_model = ANY (ARRAY['flexible'::text, 'fixed'::text]))),
    CONSTRAINT campaign_launch_settings_launch_type_check CHECK ((launch_type = ANY (ARRAY['fundraiser'::text, 'project'::text, 'product'::text, 'indemand'::text])))
);


--
-- Name: campaign_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_media (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    uploader_id uuid NOT NULL,
    media_type text NOT NULL,
    storage_path text NOT NULL,
    public_url text,
    reuse_risk_score integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT campaign_media_media_type_check CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text, 'document'::text])))
);


--
-- Name: campaign_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    target_amount bigint,
    reached_at timestamp with time zone,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campaign_owner_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_owner_payouts (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_payment_id uuid,
    payout_id uuid,
    campaign_id uuid,
    campaign_owner_id uuid,
    donor_id uuid,
    processor text DEFAULT 'stripe'::text NOT NULL,
    processor_account_id text,
    processor_object_id text,
    gross_amount bigint DEFAULT 0 NOT NULL,
    owner_net_amount bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT campaign_owner_payouts_gross_amount_check CHECK ((gross_amount >= 0)),
    CONSTRAINT campaign_owner_payouts_owner_net_amount_check CHECK ((owner_net_amount >= 0)),
    CONSTRAINT campaign_owner_payouts_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'approved'::text, 'pending'::text, 'paid'::text, 'failed'::text, 'frozen'::text, 'released'::text, 'not_applicable'::text])))
);


--
-- Name: campaign_owner_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_owner_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    donor_message_id uuid,
    owner_id uuid NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT campaign_owner_replies_message_check CHECK (((char_length(message) >= 1) AND (char_length(message) <= 5000)))
);


--
-- Name: campaign_owner_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_owner_transfers (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_payment_id uuid,
    campaign_id uuid,
    campaign_owner_id uuid,
    donor_id uuid,
    processor text DEFAULT 'stripe'::text NOT NULL,
    processor_account_id text,
    processor_object_id text,
    gross_amount bigint DEFAULT 0 NOT NULL,
    owner_net_amount bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT campaign_owner_transfers_gross_amount_check CHECK ((gross_amount >= 0)),
    CONSTRAINT campaign_owner_transfers_owner_net_amount_check CHECK ((owner_net_amount >= 0)),
    CONSTRAINT campaign_owner_transfers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'created'::text, 'paid'::text, 'failed'::text, 'canceled'::text])))
);


--
-- Name: campaign_payment_admin_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_payment_admin_notes (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_payment_id uuid,
    campaign_id uuid,
    campaign_owner_id uuid,
    donor_id uuid,
    author_id uuid,
    processor text DEFAULT 'stripe'::text NOT NULL,
    processor_account_id text,
    processor_object_id text,
    note text NOT NULL,
    gross_amount bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT campaign_payment_admin_notes_gross_amount_check CHECK ((gross_amount >= 0)),
    CONSTRAINT campaign_payment_admin_notes_note_check CHECK (((char_length(note) >= 1) AND (char_length(note) <= 5000))),
    CONSTRAINT campaign_payment_admin_notes_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])))
);


--
-- Name: campaign_payment_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_payment_audit_logs (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_payment_id uuid,
    campaign_id uuid,
    campaign_owner_id uuid,
    donor_id uuid,
    actor_id uuid,
    processor text DEFAULT 'stripe'::text NOT NULL,
    processor_account_id text,
    processor_object_id text,
    action text NOT NULL,
    gross_amount bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    status text DEFAULT 'recorded'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT campaign_payment_audit_logs_gross_amount_check CHECK ((gross_amount >= 0))
);


--
-- Name: campaign_payment_breakdowns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_payment_breakdowns (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_payment_id uuid NOT NULL,
    campaign_id uuid,
    campaign_owner_id uuid,
    donor_id uuid,
    processor text DEFAULT 'stripe'::text NOT NULL,
    processor_account_id text,
    gross_amount bigint DEFAULT 0 NOT NULL,
    tip_amount bigint DEFAULT 0 NOT NULL,
    processor_fee_amount bigint DEFAULT 0 NOT NULL,
    platform_fee_amount bigint DEFAULT 0 NOT NULL,
    owner_net_amount bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    status text DEFAULT 'current'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT campaign_payment_breakdowns_gross_amount_check CHECK ((gross_amount >= 0)),
    CONSTRAINT campaign_payment_breakdowns_owner_net_amount_check CHECK ((owner_net_amount >= 0)),
    CONSTRAINT campaign_payment_breakdowns_platform_fee_amount_check CHECK ((platform_fee_amount >= 0)),
    CONSTRAINT campaign_payment_breakdowns_processor_fee_amount_check CHECK ((processor_fee_amount >= 0)),
    CONSTRAINT campaign_payment_breakdowns_status_check CHECK ((status = ANY (ARRAY['current'::text, 'superseded'::text, 'pending_data'::text]))),
    CONSTRAINT campaign_payment_breakdowns_tip_amount_check CHECK ((tip_amount >= 0))
);


--
-- Name: campaign_payment_disputes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_payment_disputes (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_payment_id uuid,
    campaign_id uuid,
    campaign_owner_id uuid,
    donor_id uuid,
    processor text DEFAULT 'stripe'::text NOT NULL,
    processor_account_id text,
    processor_object_id text,
    gross_amount bigint DEFAULT 0 NOT NULL,
    dispute_amount bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    status text DEFAULT 'opened'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT campaign_payment_disputes_dispute_amount_check CHECK ((dispute_amount >= 0)),
    CONSTRAINT campaign_payment_disputes_gross_amount_check CHECK ((gross_amount >= 0)),
    CONSTRAINT campaign_payment_disputes_status_check CHECK ((status = ANY (ARRAY['opened'::text, 'warning_needs_response'::text, 'won'::text, 'lost'::text, 'closed'::text])))
);


--
-- Name: campaign_payment_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_payment_events (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_payment_id uuid,
    campaign_id uuid,
    campaign_owner_id uuid,
    donor_id uuid,
    processor text DEFAULT 'stripe'::text NOT NULL,
    processor_account_id text,
    processor_object_id text,
    event_type text NOT NULL,
    event_status text DEFAULT 'received'::text NOT NULL,
    amount bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT campaign_payment_events_amount_check CHECK ((amount >= 0))
);


--
-- Name: campaign_payment_exports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_payment_exports (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid,
    campaign_owner_id uuid,
    donor_id uuid,
    requested_by uuid,
    processor text DEFAULT 'stripe'::text,
    processor_account_id text,
    processor_object_id text,
    export_type text NOT NULL,
    gross_amount bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    status text DEFAULT 'requested'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT campaign_payment_exports_gross_amount_check CHECK ((gross_amount >= 0)),
    CONSTRAINT campaign_payment_exports_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'generated'::text, 'failed'::text])))
);


--
-- Name: campaign_payment_reconciliation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_payment_reconciliation (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_payment_id uuid NOT NULL,
    campaign_id uuid,
    campaign_owner_id uuid,
    donor_id uuid,
    processor text DEFAULT 'stripe'::text NOT NULL,
    processor_account_id text,
    gross_amount bigint DEFAULT 0 NOT NULL,
    processor_fee_amount bigint DEFAULT 0 NOT NULL,
    platform_fee_amount bigint DEFAULT 0 NOT NULL,
    owner_net_amount bigint DEFAULT 0 NOT NULL,
    refunded_amount bigint DEFAULT 0 NOT NULL,
    disputed_amount bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    status text DEFAULT 'pending_data'::text NOT NULL,
    issues text[] DEFAULT '{}'::text[] NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT campaign_payment_reconciliation_disputed_amount_check CHECK ((disputed_amount >= 0)),
    CONSTRAINT campaign_payment_reconciliation_gross_amount_check CHECK ((gross_amount >= 0)),
    CONSTRAINT campaign_payment_reconciliation_owner_net_amount_check CHECK ((owner_net_amount >= 0)),
    CONSTRAINT campaign_payment_reconciliation_platform_fee_amount_check CHECK ((platform_fee_amount >= 0)),
    CONSTRAINT campaign_payment_reconciliation_processor_fee_amount_check CHECK ((processor_fee_amount >= 0)),
    CONSTRAINT campaign_payment_reconciliation_refunded_amount_check CHECK ((refunded_amount >= 0)),
    CONSTRAINT campaign_payment_reconciliation_status_check CHECK ((status = ANY (ARRAY['reconciled'::text, 'pending_data'::text, 'mismatch'::text, 'failed'::text, 'needs_review'::text, 'ignored'::text])))
);


--
-- Name: campaign_payment_refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_payment_refunds (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_payment_id uuid,
    refund_id uuid,
    campaign_id uuid,
    campaign_owner_id uuid,
    donor_id uuid,
    processor text DEFAULT 'stripe'::text NOT NULL,
    processor_account_id text,
    processor_object_id text,
    gross_amount bigint DEFAULT 0 NOT NULL,
    refund_amount bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    status text DEFAULT 'requested'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT campaign_payment_refunds_gross_amount_check CHECK ((gross_amount >= 0)),
    CONSTRAINT campaign_payment_refunds_refund_amount_check CHECK ((refund_amount >= 0)),
    CONSTRAINT campaign_payment_refunds_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'pending'::text, 'processed'::text, 'failed'::text, 'declined'::text])))
);


--
-- Name: campaign_payment_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_payment_settings (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid,
    campaign_owner_id uuid,
    donor_id uuid,
    processor text DEFAULT 'stripe'::text NOT NULL,
    processor_account_id text,
    processor_object_id text,
    gross_amount bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT campaign_payment_settings_gross_amount_check CHECK ((gross_amount >= 0)),
    CONSTRAINT campaign_payment_settings_status_check CHECK ((status = ANY (ARRAY['active'::text, 'disabled'::text])))
);


--
-- Name: campaign_payment_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_payment_webhook_events (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_payment_id uuid,
    webhook_event_id uuid,
    campaign_id uuid,
    campaign_owner_id uuid,
    donor_id uuid,
    processor text DEFAULT 'stripe'::text NOT NULL,
    processor_account_id text,
    processor_object_id text,
    processor_event_id text NOT NULL,
    event_type text NOT NULL,
    gross_amount bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    status text DEFAULT 'received'::text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT campaign_payment_webhook_events_gross_amount_check CHECK ((gross_amount >= 0)),
    CONSTRAINT campaign_payment_webhook_events_status_check CHECK ((status = ANY (ARRAY['received'::text, 'processed'::text, 'duplicate'::text, 'failed'::text, 'ignored'::text])))
);


--
-- Name: campaign_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_payments (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    donation_id uuid,
    campaign_id uuid,
    campaign_owner_id uuid,
    donor_id uuid,
    business_id uuid,
    tenant_id uuid,
    processor text DEFAULT 'stripe'::text NOT NULL,
    processor_account_id text,
    processor_charge_id text,
    processor_payment_intent_id text,
    processor_checkout_session_id text,
    processor_transfer_id text,
    processor_payout_id text,
    gross_amount bigint DEFAULT 0 NOT NULL,
    tip_amount bigint DEFAULT 0 NOT NULL,
    platform_fee_amount bigint DEFAULT 0 NOT NULL,
    processor_fee_amount bigint DEFAULT 0 NOT NULL,
    campaign_owner_net_amount bigint DEFAULT 0 NOT NULL,
    refunded_amount bigint DEFAULT 0 NOT NULL,
    disputed_amount bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    transfer_status text DEFAULT 'not_applicable'::text NOT NULL,
    payout_status text DEFAULT 'not_applicable'::text NOT NULL,
    refund_status text DEFAULT 'none'::text NOT NULL,
    dispute_status text DEFAULT 'none'::text NOT NULL,
    settlement_status text DEFAULT 'pending'::text NOT NULL,
    reconciliation_status text DEFAULT 'pending_data'::text NOT NULL,
    reconciliation_reason text,
    paid_at timestamp with time zone,
    available_on timestamp with time zone,
    payout_at timestamp with time zone,
    last_webhook_event_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT campaign_payments_amounts_balance CHECK (((gross_amount + tip_amount) >= (platform_fee_amount + campaign_owner_net_amount))),
    CONSTRAINT campaign_payments_campaign_owner_net_amount_check CHECK ((campaign_owner_net_amount >= 0)),
    CONSTRAINT campaign_payments_dispute_status_check CHECK ((dispute_status = ANY (ARRAY['none'::text, 'opened'::text, 'won'::text, 'lost'::text, 'warning_needs_response'::text, 'closed'::text]))),
    CONSTRAINT campaign_payments_disputed_amount_check CHECK ((disputed_amount >= 0)),
    CONSTRAINT campaign_payments_gross_amount_check CHECK ((gross_amount >= 0)),
    CONSTRAINT campaign_payments_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'processing'::text, 'succeeded'::text, 'failed'::text, 'canceled'::text, 'refunded'::text, 'partially_refunded'::text, 'disputed'::text]))),
    CONSTRAINT campaign_payments_payout_status_check CHECK ((payout_status = ANY (ARRAY['not_applicable'::text, 'requested'::text, 'approved'::text, 'pending'::text, 'paid'::text, 'failed'::text, 'frozen'::text, 'released'::text]))),
    CONSTRAINT campaign_payments_platform_fee_amount_check CHECK ((platform_fee_amount >= 0)),
    CONSTRAINT campaign_payments_processor_check CHECK ((processor = ANY (ARRAY['stripe'::text, 'paypal'::text, 'manual'::text, 'other'::text]))),
    CONSTRAINT campaign_payments_processor_fee_amount_check CHECK ((processor_fee_amount >= 0)),
    CONSTRAINT campaign_payments_reconciliation_status_check CHECK ((reconciliation_status = ANY (ARRAY['reconciled'::text, 'pending_data'::text, 'mismatch'::text, 'failed'::text, 'needs_review'::text, 'ignored'::text]))),
    CONSTRAINT campaign_payments_refund_status_check CHECK ((refund_status = ANY (ARRAY['none'::text, 'requested'::text, 'partial'::text, 'full'::text, 'failed'::text]))),
    CONSTRAINT campaign_payments_refunded_amount_check CHECK ((refunded_amount >= 0)),
    CONSTRAINT campaign_payments_settlement_status_check CHECK ((settlement_status = ANY (ARRAY['pending'::text, 'available'::text, 'paid_out'::text, 'failed'::text, 'needs_review'::text]))),
    CONSTRAINT campaign_payments_tip_amount_check CHECK ((tip_amount >= 0)),
    CONSTRAINT campaign_payments_transfer_status_check CHECK ((transfer_status = ANY (ARRAY['not_applicable'::text, 'pending'::text, 'created'::text, 'paid'::text, 'failed'::text, 'canceled'::text])))
);


--
-- Name: campaign_platform_fees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_platform_fees (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_payment_id uuid,
    campaign_id uuid,
    campaign_owner_id uuid,
    donor_id uuid,
    processor text DEFAULT 'stripe'::text NOT NULL,
    processor_account_id text,
    processor_object_id text,
    gross_amount bigint DEFAULT 0 NOT NULL,
    platform_fee_amount bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT campaign_platform_fees_gross_amount_check CHECK ((gross_amount >= 0)),
    CONSTRAINT campaign_platform_fees_platform_fee_amount_check CHECK ((platform_fee_amount >= 0)),
    CONSTRAINT campaign_platform_fees_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'recorded'::text, 'refunded'::text, 'adjusted'::text])))
);


--
-- Name: campaign_processor_fees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_processor_fees (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_payment_id uuid,
    campaign_id uuid,
    campaign_owner_id uuid,
    donor_id uuid,
    processor text DEFAULT 'stripe'::text NOT NULL,
    processor_account_id text,
    processor_object_id text,
    gross_amount bigint DEFAULT 0 NOT NULL,
    processor_fee_amount bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT campaign_processor_fees_gross_amount_check CHECK ((gross_amount >= 0)),
    CONSTRAINT campaign_processor_fees_processor_fee_amount_check CHECK ((processor_fee_amount >= 0)),
    CONSTRAINT campaign_processor_fees_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'recorded'::text, 'unavailable'::text, 'refunded'::text, 'adjusted'::text])))
);


--
-- Name: campaign_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_reports (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    reporter_id uuid,
    reason text NOT NULL,
    details text,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT campaign_reports_status_check CHECK ((status = ANY (ARRAY['open'::text, 'triaged'::text, 'investigating'::text, 'info_requested'::text, 'action_taken'::text, 'resolved'::text, 'dismissed'::text, 'escalated'::text])))
);


--
-- Name: campaign_rewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_rewards (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    amount_cents bigint NOT NULL,
    estimated_delivery text,
    item_limit integer,
    claimed_count integer DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT campaign_rewards_amount_cents_check CHECK ((amount_cents > 0)),
    CONSTRAINT campaign_rewards_item_limit_check CHECK (((item_limit IS NULL) OR (item_limit > 0)))
);


--
-- Name: campaign_status_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_status_log (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    changed_by uuid,
    from_status text,
    to_status text NOT NULL,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campaign_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_updates (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    user_id uuid NOT NULL,
    title text,
    body text NOT NULL,
    ai_generated boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campaign_wizard_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_wizard_drafts (
    user_id uuid NOT NULL,
    step text DEFAULT 'type'::text NOT NULL,
    story_mode text DEFAULT 'guided'::text NOT NULL,
    form jsonb DEFAULT '{}'::jsonb NOT NULL,
    images jsonb DEFAULT '[]'::jsonb NOT NULL,
    client_ts bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text,
    CONSTRAINT campaign_wizard_drafts_form_is_object CHECK ((jsonb_typeof(form) = 'object'::text)),
    CONSTRAINT campaign_wizard_drafts_images_is_array CHECK ((jsonb_typeof(images) = 'array'::text))
);


--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaigns (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    beneficiary_profile_id uuid,
    slug text NOT NULL,
    title text NOT NULL,
    tagline text,
    description text NOT NULL,
    category text NOT NULL,
    goal_amount bigint NOT NULL,
    raised_amount bigint DEFAULT 0 NOT NULL,
    backer_count integer DEFAULT 0 NOT NULL,
    deadline date,
    status text DEFAULT 'draft'::text NOT NULL,
    beneficiary_name text,
    beneficiary_relationship text,
    cover_image_url text,
    trust_status text DEFAULT 'Needs More Info'::text NOT NULL,
    campaign_health_score integer DEFAULT 0 NOT NULL,
    payout_frozen boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    image_urls text[] DEFAULT '{}'::text[] NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    pinned boolean DEFAULT false NOT NULL,
    accept_donations boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    visibility text DEFAULT 'public'::text NOT NULL,
    is_demo boolean DEFAULT false NOT NULL,
    latitude double precision,
    longitude double precision,
    CONSTRAINT campaigns_category_check CHECK ((category = ANY (ARRAY['Medical'::text, 'Memorial'::text, 'Emergency'::text, 'Nonprofit'::text, 'Education'::text, 'Animal'::text, 'Environment'::text, 'Business'::text, 'Community'::text, 'Competition'::text, 'Creative'::text, 'Event'::text, 'Faith'::text, 'Family'::text, 'Sports'::text, 'Travel'::text, 'Volunteer'::text, 'Wishes'::text]))),
    CONSTRAINT campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'completed'::text, 'rejected'::text, 'frozen'::text]))),
    CONSTRAINT campaigns_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'unlisted'::text, 'private'::text])))
);


--
-- Name: challenge_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_participants (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    challenge_id uuid NOT NULL,
    user_id uuid NOT NULL,
    progress_value bigint DEFAULT 0 NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT challenge_participants_progress_value_check CHECK ((progress_value >= 0))
);


--
-- Name: challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenges (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    description text,
    metric text DEFAULT 'donation_count'::text NOT NULL,
    goal_value bigint NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT challenges_goal_value_check CHECK ((goal_value > 0)),
    CONSTRAINT challenges_metric_check CHECK ((metric = ANY (ARRAY['donation_count'::text, 'total_cents'::text, 'campaign_count'::text]))),
    CONSTRAINT challenges_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'completed'::text])))
);


--
-- Name: coach_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coach_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    campaign_id uuid,
    message_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: commission_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_requests (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    creator_profile_id uuid NOT NULL,
    requester_id uuid,
    requester_email text,
    title text NOT NULL,
    brief text NOT NULL,
    budget_cents bigint,
    status text DEFAULT 'requested'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commission_requests_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'quoted'::text, 'accepted'::text, 'in_progress'::text, 'delivered'::text, 'cancelled'::text])))
);


--
-- Name: connected_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connected_accounts (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    stripe_account_id text NOT NULL,
    charges_enabled boolean DEFAULT false NOT NULL,
    payouts_enabled boolean DEFAULT false NOT NULL,
    details_submitted boolean DEFAULT false NOT NULL,
    verification_status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contact_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_messages (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    source text DEFAULT 'contact_page'::text NOT NULL,
    ip_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contact_messages_status_check CHECK ((status = ANY (ARRAY['new'::text, 'reviewing'::text, 'closed'::text, 'spam'::text])))
);


--
-- Name: creator_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creator_profiles (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    handle text NOT NULL,
    display_name text NOT NULL,
    bio text,
    hero_image_url text,
    website_url text,
    brand_color text DEFAULT '#059669'::text,
    accepts_tips boolean DEFAULT true NOT NULL,
    accepts_commissions boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: creator_tips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creator_tips (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    creator_profile_id uuid NOT NULL,
    supporter_id uuid,
    amount_cents bigint NOT NULL,
    message text,
    stripe_payment_intent_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: digital_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.digital_products (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    creator_profile_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    price_cents bigint NOT NULL,
    storage_path text,
    preview_url text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: direct_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.direct_messages (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    sender_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    campaign_id uuid,
    body text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: donation_forms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.donation_forms (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    nonprofit_id uuid,
    campaign_id uuid,
    title text NOT NULL,
    slug text NOT NULL,
    default_amounts_cents bigint[] DEFAULT ARRAY[2500, 5000, 10000, 25000] NOT NULL,
    recurring_enabled boolean DEFAULT true NOT NULL,
    currencies text[] DEFAULT ARRAY['usd'::text] NOT NULL,
    embed_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: donation_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.donation_receipts (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    donation_id uuid NOT NULL,
    donor_id uuid,
    campaign_id uuid,
    receipt_number text DEFAULT ((('RCP-'::text || to_char(now(), 'YYYYMMDD'::text)) || '-'::text) || substr(md5((random())::text), 1, 8)) NOT NULL,
    amount_cents bigint NOT NULL,
    tip_cents bigint DEFAULT 0 NOT NULL,
    processing_fee_cents bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    is_tax_deductible boolean DEFAULT false NOT NULL,
    nonprofit_ein text,
    campaign_title text NOT NULL,
    donor_name text,
    donor_email text,
    email_sent_at timestamp with time zone,
    resent_at timestamp with time zone,
    stripe_payment_intent_id text,
    stripe_checkout_session_id text,
    receipt_type text DEFAULT 'donation'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT donation_receipts_receipt_type_check CHECK ((receipt_type = ANY (ARRAY['donation'::text, 'recurring'::text, 'refund'::text, 'tip'::text])))
);


--
-- Name: donations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.donations (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    donor_id uuid,
    amount_cents bigint NOT NULL,
    message text,
    anonymous boolean DEFAULT false NOT NULL,
    stripe_payment_intent_id text,
    status text DEFAULT 'completed'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_method text,
    source text,
    notes text,
    is_spam boolean DEFAULT false NOT NULL,
    receipt_sent_at timestamp with time zone,
    refunded_at timestamp with time zone,
    refund_reason text,
    updated_at timestamp with time zone,
    source_utm jsonb DEFAULT '{}'::jsonb NOT NULL,
    reward_id uuid,
    currency text DEFAULT 'usd'::text NOT NULL,
    is_demo boolean DEFAULT false NOT NULL,
    tip_cents bigint DEFAULT 0 NOT NULL,
    processing_fee_cents bigint DEFAULT 0 NOT NULL,
    peer_fundraiser_id uuid,
    CONSTRAINT donations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'refunded'::text, 'failed'::text])))
);


--
-- Name: donor_crm_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.donor_crm_contacts (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    nonprofit_id uuid,
    owner_id uuid NOT NULL,
    email text,
    full_name text,
    phone text,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    lifetime_value_cents bigint DEFAULT 0 NOT NULL,
    last_donated_at timestamp with time zone,
    consent_email boolean DEFAULT true NOT NULL,
    consent_sms boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: donor_message_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.donor_message_likes (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    donor_message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: donor_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.donor_messages (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    donation_id uuid,
    campaign_id uuid NOT NULL,
    donor_id uuid,
    message text NOT NULL,
    visibility text DEFAULT 'public'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    anonymous boolean DEFAULT false NOT NULL
);


--
-- Name: donor_segment_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.donor_segment_members (
    segment_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: donor_segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.donor_segments (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    nonprofit_id uuid NOT NULL,
    name text NOT NULL,
    rules jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: donor_tips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.donor_tips (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid,
    donor_id uuid,
    amount_cents bigint NOT NULL,
    stripe_payment_intent_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_campaigns (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    owner_id uuid NOT NULL,
    nonprofit_id uuid,
    campaign_id uuid,
    subject text NOT NULL,
    body text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    scheduled_at timestamp with time zone,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'sent'::text, 'cancelled'::text])))
);


--
-- Name: embedded_buttons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.embedded_buttons (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    owner_id uuid NOT NULL,
    campaign_id uuid,
    creator_profile_id uuid,
    donation_form_id uuid,
    label text DEFAULT 'Support CharitMe'::text NOT NULL,
    button_type text DEFAULT 'donate'::text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT embedded_buttons_button_type_check CHECK ((button_type = ANY (ARRAY['donate'::text, 'tip'::text, 'membership'::text, 'product'::text])))
);


--
-- Name: event_checkins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_checkins (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    registration_id uuid NOT NULL,
    event_id uuid NOT NULL,
    checked_in_by uuid,
    checked_in_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: event_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_registrations (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    event_id uuid NOT NULL,
    ticket_id uuid,
    attendee_id uuid,
    attendee_email text,
    attendee_name text,
    quantity integer DEFAULT 1 NOT NULL,
    amount_cents bigint DEFAULT 0 NOT NULL,
    stripe_payment_intent_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: event_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_tickets (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    event_id uuid NOT NULL,
    title text NOT NULL,
    price_cents bigint NOT NULL,
    quantity_limit integer,
    sold_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: exclusive_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exclusive_posts (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    creator_profile_id uuid,
    nonprofit_id uuid,
    author_id uuid NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    visibility text DEFAULT 'members'::text NOT NULL,
    minimum_tier_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exclusive_posts_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'members'::text, 'tier'::text])))
);


--
-- Name: feature_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_flags (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    key text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    description text,
    rollout_pct integer DEFAULT 100 NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT feature_flags_rollout_pct_check CHECK (((rollout_pct >= 0) AND (rollout_pct <= 100)))
);


--
-- Name: fundraising_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fundraising_events (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    nonprofit_id uuid,
    campaign_id uuid,
    title text NOT NULL,
    slug text NOT NULL,
    event_type text DEFAULT 'fundraiser'::text NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone,
    location text,
    virtual_url text,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    description text,
    capacity integer,
    cover_image_url text,
    CONSTRAINT fundraising_events_event_type_check CHECK ((event_type = ANY (ARRAY['fundraiser'::text, 'gala'::text, 'giving_day'::text, 'livestream'::text, 'auction'::text, 'registration'::text]))),
    CONSTRAINT fundraising_events_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: giving_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.giving_days (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    nonprofit_id uuid,
    title text NOT NULL,
    slug text NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    goal_amount bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: grant_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grant_applications (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    grant_id uuid NOT NULL,
    applicant_user_id uuid NOT NULL,
    campaign_id uuid,
    organization_name text,
    status text DEFAULT 'draft'::text NOT NULL,
    amount_requested bigint,
    narrative text,
    answers jsonb DEFAULT '{}'::jsonb NOT NULL,
    submitted_at timestamp with time zone,
    decision_at timestamp with time zone,
    award_amount bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT grant_applications_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'under_review'::text, 'awarded'::text, 'rejected'::text, 'withdrawn'::text])))
);


--
-- Name: grant_deadlines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grant_deadlines (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    grant_id uuid NOT NULL,
    label text NOT NULL,
    kind text DEFAULT 'application'::text NOT NULL,
    due_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT grant_deadlines_kind_check CHECK ((kind = ANY (ARRAY['loi'::text, 'application'::text, 'report'::text, 'award'::text, 'other'::text])))
);


--
-- Name: grant_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grant_documents (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    application_id uuid NOT NULL,
    uploaded_by uuid,
    file_url text NOT NULL,
    file_name text,
    doc_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: grant_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grant_matches (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    grant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    campaign_id uuid,
    score numeric(5,2) DEFAULT 0 NOT NULL,
    reasons jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grants (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    funder_name text NOT NULL,
    funder_type text DEFAULT 'foundation'::text NOT NULL,
    summary text,
    description text,
    category text,
    focus_areas text[] DEFAULT '{}'::text[] NOT NULL,
    eligibility text,
    eligible_entity_types text[] DEFAULT '{}'::text[] NOT NULL,
    amount_min bigint,
    amount_max bigint,
    currency text DEFAULT 'USD'::text NOT NULL,
    location text,
    country text,
    application_url text,
    deadline_at timestamp with time zone,
    rolling_deadline boolean DEFAULT false NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    source text,
    created_by uuid,
    verified boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT grants_amount_range CHECK (((amount_min IS NULL) OR (amount_max IS NULL) OR (amount_min <= amount_max))),
    CONSTRAINT grants_funder_type_check CHECK ((funder_type = ANY (ARRAY['foundation'::text, 'government'::text, 'corporate'::text, 'community'::text, 'individual'::text, 'other'::text]))),
    CONSTRAINT grants_status_check CHECK ((status = ANY (ARRAY['open'::text, 'upcoming'::text, 'closed'::text])))
);


--
-- Name: impact_evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.impact_evidence (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    update_id uuid NOT NULL,
    kind text DEFAULT 'image'::text NOT NULL,
    url text NOT NULL,
    caption text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT impact_evidence_kind_check CHECK ((kind = ANY (ARRAY['image'::text, 'receipt'::text, 'video'::text, 'document'::text, 'link'::text])))
);


--
-- Name: impact_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.impact_metrics (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    label text NOT NULL,
    unit text,
    target_value numeric,
    current_value numeric DEFAULT 0 NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: impact_plan_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.impact_plan_items (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    plan_id uuid NOT NULL,
    label text NOT NULL,
    category text,
    planned_amount_cents bigint DEFAULT 0 NOT NULL,
    spent_amount_cents bigint DEFAULT 0 NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT impact_plan_items_planned_amount_cents_check CHECK ((planned_amount_cents >= 0)),
    CONSTRAINT impact_plan_items_spent_amount_cents_check CHECK ((spent_amount_cents >= 0))
);


--
-- Name: impact_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.impact_plans (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    created_by uuid,
    title text DEFAULT 'Impact Plan'::text NOT NULL,
    summary text,
    total_budget_cents bigint DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT impact_plans_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text]))),
    CONSTRAINT impact_plans_total_budget_cents_check CHECK ((total_budget_cents >= 0))
);


--
-- Name: impact_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.impact_updates (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    author_id uuid,
    title text NOT NULL,
    body text NOT NULL,
    amount_spent_cents bigint,
    status text DEFAULT 'published'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT impact_updates_amount_spent_cents_check CHECK (((amount_spent_cents IS NULL) OR (amount_spent_cents >= 0))),
    CONSTRAINT impact_updates_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 12000))),
    CONSTRAINT impact_updates_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text]))),
    CONSTRAINT impact_updates_title_check CHECK (((char_length(title) >= 2) AND (char_length(title) <= 200)))
);


--
-- Name: integration_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_connections (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    owner_id uuid NOT NULL,
    provider text NOT NULL,
    status text DEFAULT 'connected'::text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT integration_connections_status_check CHECK ((status = ANY (ARRAY['connected'::text, 'paused'::text, 'revoked'::text, 'error'::text])))
);


--
-- Name: lead_outreach; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_outreach (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    business_lead_id uuid NOT NULL,
    marketing_contact_id uuid,
    utm_link_id uuid,
    short_code text,
    channel text DEFAULT 'email'::text NOT NULL,
    subject text,
    body text,
    email text,
    email_valid boolean,
    email_validation jsonb DEFAULT '{}'::jsonb NOT NULL,
    email_validated_at timestamp with time zone,
    status text DEFAULT 'drafted'::text NOT NULL,
    sent_at timestamp with time zone,
    first_click_at timestamp with time zone,
    last_click_at timestamp with time zone,
    click_count integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lead_outreach_status_check CHECK ((status = ANY (ARRAY['drafted'::text, 'ready'::text, 'sent'::text, 'clicked'::text, 'converted'::text, 'failed'::text])))
);


--
-- Name: ledger_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ledger_entries (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    entry_group_id uuid NOT NULL,
    account text NOT NULL,
    direction text NOT NULL,
    amount_cents bigint NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    event_type text NOT NULL,
    campaign_id uuid,
    donation_id uuid,
    recipient_user_id uuid,
    connected_account_id text,
    stripe_payment_intent_id text,
    stripe_charge_id text,
    stripe_application_fee_id text,
    stripe_balance_transaction_id text,
    stripe_refund_id text,
    stripe_dispute_id text,
    stripe_transfer_id text,
    stripe_payout_id text,
    idempotency_key text,
    correlation_id text,
    source text DEFAULT 'system'::text NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    effective_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ledger_entries_account_check CHECK ((account = ANY (ARRAY['donor_clearing'::text, 'recipient_payable'::text, 'platform_revenue'::text, 'processor_fees'::text, 'refunds'::text, 'disputes'::text, 'adjustments'::text]))),
    CONSTRAINT ledger_entries_amount_cents_check CHECK ((amount_cents >= 0)),
    CONSTRAINT ledger_entries_direction_check CHECK ((direction = ANY (ARRAY['debit'::text, 'credit'::text]))),
    CONSTRAINT ledger_entries_event_type_check CHECK ((event_type = ANY (ARRAY['donation'::text, 'refund'::text, 'partial_refund'::text, 'dispute'::text, 'payout'::text, 'adjustment'::text])))
);


--
-- Name: livestreams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.livestreams (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    event_id uuid,
    campaign_id uuid,
    title text NOT NULL,
    stream_url text NOT NULL,
    starts_at timestamp with time zone,
    status text DEFAULT 'scheduled'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT livestreams_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'live'::text, 'ended'::text])))
);


--
-- Name: marketing_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    entity text NOT NULL,
    entity_id uuid,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid
);


--
-- Name: marketing_automation_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_automation_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    automation_id uuid NOT NULL,
    contact_id uuid,
    status text DEFAULT 'success'::text NOT NULL,
    detail text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: marketing_automations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_automations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    trigger_event text NOT NULL,
    trigger_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    action_type text NOT NULL,
    action_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    run_count integer DEFAULT 0 NOT NULL,
    last_run_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid
);


--
-- Name: marketing_campaign_plan_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_campaign_plan_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    asset_type text NOT NULL,
    channel text NOT NULL,
    title text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketing_cpa_status_chk CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'archived'::text]))),
    CONSTRAINT marketing_cpa_type_chk CHECK ((asset_type = ANY (ARRAY['landing_page'::text, 'email'::text, 'social_post'::text, 'seo_meta'::text, 'faq'::text, 'sms'::text, 'ad'::text, 'blog_post'::text])))
);


--
-- Name: marketing_campaign_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_campaign_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    goal_id uuid,
    title text NOT NULL,
    objective text,
    audience text,
    geography text,
    category text,
    summary text,
    status text DEFAULT 'draft'::text NOT NULL,
    source text DEFAULT 'generated'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid,
    CONSTRAINT marketing_cplans_source_chk CHECK ((source = ANY (ARRAY['generated'::text, 'manual'::text]))),
    CONSTRAINT marketing_cplans_status_chk CHECK ((status = ANY (ARRAY['draft'::text, 'in_review'::text, 'approved'::text, 'archived'::text])))
);


--
-- Name: marketing_campaign_recipients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_campaign_recipients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    sent_at timestamp with time zone,
    opened_at timestamp with time zone,
    clicked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: marketing_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    campaign_type text DEFAULT 'email'::text NOT NULL,
    goal text,
    segment_id uuid,
    template_id uuid,
    subject text,
    preview_text text,
    body text,
    status text DEFAULT 'draft'::text NOT NULL,
    scheduled_at timestamp with time zone,
    sent_at timestamp with time zone,
    sent_count integer DEFAULT 0 NOT NULL,
    open_count integer DEFAULT 0 NOT NULL,
    click_count integer DEFAULT 0 NOT NULL,
    conversion_count integer DEFAULT 0 NOT NULL,
    revenue_cents bigint DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid
);


--
-- Name: marketing_consent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_consent (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    channel text NOT NULL,
    granted boolean NOT NULL,
    source text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid
);


--
-- Name: marketing_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email text,
    phone text,
    first_name text,
    last_name text,
    client_type text DEFAULT 'visitor'::text NOT NULL,
    lifecycle_stage text DEFAULT 'subscriber'::text NOT NULL,
    country text,
    region text,
    preferred_causes text[] DEFAULT '{}'::text[],
    preferred_channel text DEFAULT 'email'::text,
    first_touch_source text,
    first_touch_medium text,
    first_touch_campaign text,
    last_touch_source text,
    last_touch_medium text,
    last_touch_campaign text,
    landing_page text,
    lead_score integer DEFAULT 0 NOT NULL,
    engagement_score integer DEFAULT 0 NOT NULL,
    donor_value_cents bigint DEFAULT 0 NOT NULL,
    donation_count integer DEFAULT 0 NOT NULL,
    churn_risk text DEFAULT 'unknown'::text,
    last_active_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid
);


--
-- Name: marketing_email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    subject text DEFAULT ''::text NOT NULL,
    preview_text text,
    body text DEFAULT ''::text NOT NULL,
    variables text[] DEFAULT '{first_name,campaign_title,donation_amount}'::text[],
    is_system boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid
);


--
-- Name: marketing_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid,
    event_type text NOT NULL,
    campaign_id uuid,
    marketing_campaign_id uuid,
    amount_cents bigint,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_term text,
    utm_content text,
    url text,
    device text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid
);


--
-- Name: marketing_form_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_form_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_id uuid,
    contact_id uuid,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: marketing_forms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_forms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    form_type text DEFAULT 'lead'::text NOT NULL,
    fields jsonb DEFAULT '["email"]'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    submission_count integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid
);


--
-- Name: marketing_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    objective text,
    natural_language_input text,
    target_metric text DEFAULT 'custom'::text NOT NULL,
    baseline_value numeric,
    target_value numeric,
    unit text DEFAULT 'count'::text NOT NULL,
    deadline date,
    priority text DEFAULT 'medium'::text NOT NULL,
    geography text,
    audience text,
    category text,
    budget_cents bigint,
    channels text[] DEFAULT '{}'::text[] NOT NULL,
    autonomy_level smallint DEFAULT 1 NOT NULL,
    constraints jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    confidence numeric,
    forecast_value numeric,
    owner_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid,
    CONSTRAINT marketing_goals_autonomy_chk CHECK (((autonomy_level >= 1) AND (autonomy_level <= 4))),
    CONSTRAINT marketing_goals_budget_cents_check CHECK (((budget_cents IS NULL) OR (budget_cents >= 0))),
    CONSTRAINT marketing_goals_confidence_chk CHECK (((confidence IS NULL) OR ((confidence >= (0)::numeric) AND (confidence <= (1)::numeric)))),
    CONSTRAINT marketing_goals_metric_chk CHECK ((target_metric = ANY (ARRAY['fundraiser_starts'::text, 'donation_volume'::text, 'recurring_donors'::text, 'donation_conversion'::text, 'verified_charities'::text, 'donor_acquisition_cost'::text, 'organizer_retention'::text, 'aeo_visibility'::text, 'organic_traffic'::text, 'custom'::text]))),
    CONSTRAINT marketing_goals_priority_chk CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT marketing_goals_status_chk CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'achieved'::text, 'missed'::text, 'archived'::text]))),
    CONSTRAINT marketing_goals_unit_chk CHECK ((unit = ANY (ARRAY['count'::text, 'cents'::text, 'percent'::text, 'ratio'::text])))
);


--
-- Name: marketing_identities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    kind text NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: marketing_opportunities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_opportunities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    rationale text,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    category text,
    geography text,
    audience text,
    target_metric text DEFAULT 'custom'::text NOT NULL,
    est_impact_cents bigint,
    est_starts integer,
    confidence numeric,
    effort text DEFAULT 'medium'::text NOT NULL,
    cost_cents bigint,
    time_to_value_days integer,
    score numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    source text DEFAULT 'rule'::text NOT NULL,
    dedupe_key text,
    linked_goal_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid,
    CONSTRAINT marketing_opportunities_cost_cents_check CHECK (((cost_cents IS NULL) OR (cost_cents >= 0))),
    CONSTRAINT marketing_opps_confidence_chk CHECK (((confidence IS NULL) OR ((confidence >= (0)::numeric) AND (confidence <= (1)::numeric)))),
    CONSTRAINT marketing_opps_effort_chk CHECK ((effort = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT marketing_opps_metric_chk CHECK ((target_metric = ANY (ARRAY['fundraiser_starts'::text, 'donation_volume'::text, 'recurring_donors'::text, 'donation_conversion'::text, 'verified_charities'::text, 'donor_acquisition_cost'::text, 'organizer_retention'::text, 'aeo_visibility'::text, 'organic_traffic'::text, 'custom'::text]))),
    CONSTRAINT marketing_opps_score_chk CHECK (((score >= (0)::numeric) AND (score <= (100)::numeric))),
    CONSTRAINT marketing_opps_source_chk CHECK ((source = ANY (ARRAY['rule'::text, 'ai'::text, 'manual'::text]))),
    CONSTRAINT marketing_opps_status_chk CHECK ((status = ANY (ARRAY['new'::text, 'accepted'::text, 'rejected'::text, 'deferred'::text, 'converted'::text, 'archived'::text])))
);


--
-- Name: marketing_referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referrer_contact_id uuid,
    code text NOT NULL,
    kind text DEFAULT 'donor'::text NOT NULL,
    click_count integer DEFAULT 0 NOT NULL,
    signup_count integer DEFAULT 0 NOT NULL,
    donation_count integer DEFAULT 0 NOT NULL,
    revenue_cents bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid
);


--
-- Name: marketing_segment_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_segment_members (
    segment_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: marketing_segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_segments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    rules jsonb DEFAULT '{"logic": "and", "conditions": []}'::jsonb NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    member_count integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid
);


--
-- Name: marketing_suppression_list; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_suppression_list (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text,
    phone text,
    reason text DEFAULT 'unsubscribed'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid
);


--
-- Name: marketing_utm_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_utm_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    destination_url text NOT NULL,
    utm_source text NOT NULL,
    utm_medium text NOT NULL,
    utm_campaign text NOT NULL,
    utm_term text,
    utm_content text,
    short_code text,
    click_count integer DEFAULT 0 NOT NULL,
    conversion_count integer DEFAULT 0 NOT NULL,
    revenue_cents bigint DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    campaign_id uuid,
    org_id uuid
);


--
-- Name: matching_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matching_claims (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    campaign_id uuid,
    donation_id uuid,
    donation_amount_cents bigint NOT NULL,
    match_amount_cents bigint DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    note text,
    reviewer_id uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT matching_claims_donation_amount_cents_check CHECK ((donation_amount_cents > 0)),
    CONSTRAINT matching_claims_match_amount_cents_check CHECK ((match_amount_cents >= 0)),
    CONSTRAINT matching_claims_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text, 'paid'::text])))
);


--
-- Name: matching_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matching_programs (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    sponsor_id uuid NOT NULL,
    company_name text NOT NULL,
    description text,
    match_ratio numeric(6,2) DEFAULT 1.0 NOT NULL,
    annual_cap_cents bigint DEFAULT 0 NOT NULL,
    min_donation_cents bigint DEFAULT 0 NOT NULL,
    categories text[] DEFAULT '{}'::text[] NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT matching_programs_annual_cap_cents_check CHECK ((annual_cap_cents >= 0)),
    CONSTRAINT matching_programs_company_name_check CHECK (((char_length(company_name) >= 2) AND (char_length(company_name) <= 160))),
    CONSTRAINT matching_programs_match_ratio_check CHECK (((match_ratio > (0)::numeric) AND (match_ratio <= (100)::numeric))),
    CONSTRAINT matching_programs_min_donation_cents_check CHECK ((min_donation_cents >= 0)),
    CONSTRAINT matching_programs_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'closed'::text])))
);


--
-- Name: member_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_subscriptions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    tier_id uuid NOT NULL,
    member_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    stripe_subscription_id text,
    current_period_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT member_subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'cancelled'::text, 'past_due'::text])))
);


--
-- Name: membership_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.membership_tiers (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    creator_profile_id uuid,
    nonprofit_id uuid,
    title text NOT NULL,
    description text NOT NULL,
    amount_cents bigint NOT NULL,
    "interval" text DEFAULT 'month'::text NOT NULL,
    benefits text[] DEFAULT '{}'::text[] NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT membership_tiers_interval_check CHECK (("interval" = ANY (ARRAY['month'::text, 'year'::text])))
);


--
-- Name: message_thread_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_thread_state (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    owner_id uuid NOT NULL,
    donor_id uuid NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    last_read_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: nonprofit_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nonprofit_profiles (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    mission text,
    tax_id text,
    website_url text,
    verified boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    verification_status text DEFAULT 'unverified'::text NOT NULL,
    tax_receipt_enabled boolean DEFAULT false NOT NULL,
    country text DEFAULT 'US'::text NOT NULL,
    address text,
    public_profile_enabled boolean DEFAULT true NOT NULL,
    CONSTRAINT nonprofit_profiles_verification_status_check CHECK ((verification_status = ANY (ARRAY['unverified'::text, 'pending'::text, 'verified'::text, 'rejected'::text])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    kind text NOT NULL,
    title text NOT NULL,
    body text,
    link text,
    read_at timestamp with time zone,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_members (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    invited_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT organization_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text, 'viewer'::text, 'member'::text])))
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    website_url text,
    logo_url text,
    plan text DEFAULT 'free'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT organizations_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'starter'::text, 'pro'::text]))),
    CONSTRAINT organizations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'archived'::text])))
);


--
-- Name: organizer_sends; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizer_sends (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    organizer_id uuid NOT NULL,
    template_key text NOT NULL,
    target_group text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    recipient_count integer DEFAULT 0 NOT NULL,
    sent_count integer DEFAULT 0 NOT NULL,
    suppressed_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: outbound_webhook_endpoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outbound_webhook_endpoints (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    owner_id uuid NOT NULL,
    url text NOT NULL,
    events text[] DEFAULT '{}'::text[] NOT NULL,
    secret_hash text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_processors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_processors (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    processor text NOT NULL,
    display_name text NOT NULL,
    status text DEFAULT 'disabled'::text NOT NULL,
    dashboard_url text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT payment_processors_processor_check CHECK ((processor = ANY (ARRAY['stripe'::text, 'paypal'::text, 'manual'::text, 'other'::text]))),
    CONSTRAINT payment_processors_status_check CHECK ((status = ANY (ARRAY['enabled'::text, 'disabled'::text, 'test'::text, 'error'::text])))
);


--
-- Name: payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payouts (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    user_id uuid NOT NULL,
    connected_account_id uuid,
    amount_cents bigint NOT NULL,
    payout_speed text NOT NULL,
    fee_cents bigint DEFAULT 0 NOT NULL,
    status text DEFAULT 'requested'::text NOT NULL,
    risk_score integer DEFAULT 0 NOT NULL,
    stripe_payout_id text,
    admin_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    note text,
    stripe_transfer_id text,
    CONSTRAINT payouts_payout_speed_check CHECK ((payout_speed = ANY (ARRAY['standard'::text, 'same_day'::text, 'instant'::text]))),
    CONSTRAINT payouts_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'approved'::text, 'paid'::text, 'failed'::text, 'frozen'::text, 'released'::text])))
);


--
-- Name: peer_fundraisers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.peer_fundraisers (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    parent_campaign_id uuid NOT NULL,
    fundraiser_id uuid NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    goal_amount bigint NOT NULL,
    raised_amount bigint DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT peer_fundraisers_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text])))
);


--
-- Name: platform_fees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_fees (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid,
    amount_cents bigint NOT NULL,
    fee_type text NOT NULL,
    stripe_payment_intent_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_settings (
    id integer DEFAULT 1 NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT platform_settings_id_check CHECK ((id = 1))
);


--
-- Name: privacy_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.privacy_requests (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    note text,
    resolution_note text,
    resolver_id uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT privacy_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'rejected'::text, 'cancelled'::text]))),
    CONSTRAINT privacy_requests_type_check CHECK ((type = ANY (ARRAY['export'::text, 'deletion'::text])))
);


--
-- Name: processor_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processor_accounts (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    processor text NOT NULL,
    account_scope text DEFAULT 'campaign_owner'::text NOT NULL,
    owner_id uuid,
    connected_account_id uuid,
    processor_account_id text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    charges_enabled boolean DEFAULT false NOT NULL,
    payouts_enabled boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT processor_accounts_account_scope_check CHECK ((account_scope = ANY (ARRAY['platform'::text, 'campaign_owner'::text, 'processor'::text]))),
    CONSTRAINT processor_accounts_processor_check CHECK ((processor = ANY (ARRAY['stripe'::text, 'paypal'::text, 'manual'::text, 'other'::text]))),
    CONSTRAINT processor_accounts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'pending'::text, 'restricted'::text, 'disabled'::text, 'error'::text])))
);


--
-- Name: product_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_orders (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    product_id uuid NOT NULL,
    buyer_id uuid,
    buyer_email text,
    amount_cents bigint NOT NULL,
    stripe_payment_intent_id text,
    fulfillment_status text DEFAULT 'paid'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_orders_fulfillment_status_check CHECK ((fulfillment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'delivered'::text, 'refunded'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    full_name text,
    avatar_url text,
    roles jsonb DEFAULT '["donor"]'::jsonb NOT NULL,
    identity_verified boolean DEFAULT false NOT NULL,
    trust_passport_score integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    notification_email boolean DEFAULT true NOT NULL,
    notification_updates boolean DEFAULT true NOT NULL,
    notification_marketing boolean DEFAULT false NOT NULL,
    timezone text DEFAULT 'America/New_York'::text,
    currency text DEFAULT 'usd'::text,
    language text DEFAULT 'en'::text,
    date_format text DEFAULT 'MM/DD/YYYY'::text,
    time_format text DEFAULT '12h'::text,
    show_public_profile boolean DEFAULT true,
    campaign_recommendations boolean DEFAULT true,
    bio text,
    org_name text,
    org_tagline text,
    org_website text,
    plan text DEFAULT 'free'::text,
    stripe_customer_id text,
    stripe_subscription_id text,
    is_demo boolean DEFAULT false NOT NULL,
    locale text
);


--
-- Name: rate_limit_hits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limit_hits (
    key text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    reset_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reconciliation_exceptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reconciliation_exceptions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    kind text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    description text NOT NULL,
    campaign_id uuid,
    donation_id uuid,
    stripe_ref text,
    expected_cents bigint,
    actual_cents bigint,
    difference_cents bigint,
    assignee_id uuid,
    resolution_note text,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reconciliation_exceptions_kind_check CHECK ((kind = ANY (ARRAY['amount_mismatch'::text, 'missing_ledger'::text, 'missing_stripe'::text, 'unbalanced_group'::text, 'duplicate'::text, 'fee_mismatch'::text, 'payout_mismatch'::text, 'other'::text]))),
    CONSTRAINT reconciliation_exceptions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'assigned'::text, 'resolved'::text, 'ignored'::text])))
);


--
-- Name: recurring_donations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_donations (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    donor_id uuid,
    campaign_id uuid,
    nonprofit_id uuid,
    amount_cents bigint NOT NULL,
    cadence text DEFAULT 'monthly'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    stripe_subscription_id text,
    next_bill_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tip_cents bigint DEFAULT 0 NOT NULL,
    anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT recurring_donations_cadence_check CHECK ((cadence = ANY (ARRAY['weekly'::text, 'monthly'::text, 'quarterly'::text, 'annual'::text]))),
    CONSTRAINT recurring_donations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'cancelled'::text, 'past_due'::text]))),
    CONSTRAINT recurring_donations_tip_cents_check CHECK ((tip_cents >= 0))
);


--
-- Name: refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refunds (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    donation_id uuid NOT NULL,
    amount_cents bigint NOT NULL,
    reason text,
    status text DEFAULT 'requested'::text NOT NULL,
    stripe_refund_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT refunds_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'under_review'::text, 'approved'::text, 'declined'::text, 'processing'::text, 'processed'::text, 'failed'::text, 'canceled'::text])))
);


--
-- Name: reward_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reward_tiers (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    amount_cents bigint NOT NULL,
    quantity_limit integer,
    claimed_count integer DEFAULT 0 NOT NULL,
    estimated_delivery date,
    fulfillment_status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reward_tiers_fulfillment_status_check CHECK ((fulfillment_status = ANY (ARRAY['open'::text, 'in_progress'::text, 'fulfilled'::text, 'cancelled'::text])))
);


--
-- Name: risk_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.risk_flags (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid,
    user_id uuid,
    code text NOT NULL,
    label text NOT NULL,
    severity text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    flag_type text NOT NULL,
    description text,
    resolved boolean DEFAULT false NOT NULL,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    CONSTRAINT risk_flags_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT risk_flags_status_check CHECK ((status = ANY (ARRAY['open'::text, 'reviewing'::text, 'resolved'::text, 'dismissed'::text])))
);


--
-- Name: saved_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_campaigns (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    campaign_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: seo_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seo_settings (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    route text NOT NULL,
    title text,
    meta_description text,
    keywords text,
    og_title text,
    og_description text,
    og_image_url text,
    canonical_url text,
    noindex boolean DEFAULT false NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT seo_settings_private_routes_noindex_check CHECK (((noindex = true) OR (NOT ((route = ANY (ARRAY['/achievements'::text, '/privacy-center'::text, '/offline'::text])) OR (route = '/go'::text) OR (route ~~ '/go/%'::text) OR (route ~~ '/events/manage%'::text) OR (route ~~ '/impact/manage%'::text) OR (route ~~ '/matching/manage%'::text) OR (route ~~ '/sponsor/manage%'::text)))))
);


--
-- Name: share_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.share_events (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    sharer_id uuid,
    team_member_id uuid,
    channel text DEFAULT 'link'::text NOT NULL,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_content text,
    referrer text,
    ip_hash text,
    converted boolean DEFAULT false NOT NULL,
    donation_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT share_events_channel_check CHECK ((channel = ANY (ARRAY['link'::text, 'email'::text, 'sms'::text, 'facebook'::text, 'twitter'::text, 'instagram'::text, 'linkedin'::text, 'whatsapp'::text, 'qr'::text, 'other'::text])))
);


--
-- Name: sms_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_campaigns (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    owner_id uuid NOT NULL,
    nonprofit_id uuid,
    campaign_id uuid,
    keyword text,
    body text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    scheduled_at timestamp with time zone,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sms_campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'sent'::text, 'cancelled'::text])))
);


--
-- Name: sponsors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sponsors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    logo_url text,
    website text,
    active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sponsorship_opportunities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sponsorship_opportunities (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizer_id uuid NOT NULL,
    campaign_id uuid,
    title text NOT NULL,
    description text NOT NULL,
    category text DEFAULT 'Community'::text NOT NULL,
    benefits text,
    min_amount_cents bigint DEFAULT 0 NOT NULL,
    target_amount_cents bigint,
    raised_amount_cents bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sponsorship_opportunities_check CHECK (((target_amount_cents IS NULL) OR (target_amount_cents >= min_amount_cents))),
    CONSTRAINT sponsorship_opportunities_description_check CHECK (((char_length(description) >= 10) AND (char_length(description) <= 8000))),
    CONSTRAINT sponsorship_opportunities_min_amount_cents_check CHECK ((min_amount_cents >= 0)),
    CONSTRAINT sponsorship_opportunities_raised_amount_cents_check CHECK ((raised_amount_cents >= 0)),
    CONSTRAINT sponsorship_opportunities_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'open'::text, 'closed'::text, 'fulfilled'::text, 'cancelled'::text]))),
    CONSTRAINT sponsorship_opportunities_target_amount_cents_check CHECK (((target_amount_cents IS NULL) OR (target_amount_cents >= 0))),
    CONSTRAINT sponsorship_opportunities_title_check CHECK (((char_length(title) >= 3) AND (char_length(title) <= 140)))
);


--
-- Name: sponsorship_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sponsorship_requests (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    opportunity_id uuid NOT NULL,
    sponsor_id uuid NOT NULL,
    company_name text,
    amount_cents bigint NOT NULL,
    message text,
    benefits_requested text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sponsorship_requests_amount_cents_check CHECK ((amount_cents > 0)),
    CONSTRAINT sponsorship_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'withdrawn'::text, 'fulfilled'::text])))
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    tier text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    stripe_subscription_id text,
    current_period_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: support_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_cases (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    submitter_id uuid,
    subject text NOT NULL,
    body text,
    priority text DEFAULT 'normal'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    assigned_to uuid,
    source text DEFAULT 'web'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    campaign_id uuid,
    donation_id uuid,
    resolved_at timestamp with time zone,
    escalated_at timestamp with time zone,
    ai_triage jsonb,
    ai_generation_id uuid,
    CONSTRAINT support_cases_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT support_cases_source_check CHECK ((source = ANY (ARRAY['web'::text, 'email'::text, 'api'::text]))),
    CONSTRAINT support_cases_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text, 'escalated'::text])))
);


--
-- Name: support_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_notes (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    case_id uuid NOT NULL,
    author_id uuid,
    body text NOT NULL,
    internal boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: supported_countries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supported_countries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    flag_emoji text DEFAULT ''::text NOT NULL,
    iso_code text DEFAULT ''::text NOT NULL,
    can_fundraise boolean DEFAULT false NOT NULL,
    can_donate boolean DEFAULT true NOT NULL,
    currency_code text DEFAULT 'USD'::text NOT NULL,
    notes text,
    active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tax_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_receipts (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    donation_id uuid,
    donor_id uuid,
    nonprofit_id uuid,
    receipt_number text NOT NULL,
    amount_cents bigint NOT NULL,
    emailed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    nonprofit_name text,
    nonprofit_ein text,
    campaign_title text,
    no_goods_or_services boolean DEFAULT true NOT NULL
);


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid,
    nonprofit_id uuid,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    invite_token text DEFAULT substr(md5(((random())::text || (clock_timestamp())::text)), 1, 32),
    invite_email text,
    invite_sent_at timestamp with time zone,
    permissions jsonb DEFAULT '{"view_donors": true, "view_ledger": false, "post_updates": true, "thank_donors": true, "manage_payout": false}'::jsonb NOT NULL,
    CONSTRAINT team_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text])))
);


--
-- Name: transparency_ledger_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transparency_ledger_items (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    item_type text NOT NULL,
    title text NOT NULL,
    description text,
    category text DEFAULT 'Other'::text NOT NULL,
    amount_cents bigint,
    receipt_url text,
    status text DEFAULT 'published'::text NOT NULL,
    ai_summary text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    risk_score numeric,
    review_status text DEFAULT 'auto_approved'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    ai_generation_id uuid,
    CONSTRAINT transparency_ledger_items_item_type_check CHECK ((item_type = ANY (ARRAY['milestone'::text, 'receipt'::text, 'expense'::text, 'payout'::text, 'impact_update'::text, 'offline_donation'::text, 'other'::text]))),
    CONSTRAINT transparency_ledger_items_review_status_check CHECK ((review_status = ANY (ARRAY['auto_approved'::text, 'pending_review'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: trust_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trust_scores (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    score integer NOT NULL,
    status text NOT NULL,
    signals jsonb DEFAULT '[]'::jsonb NOT NULL,
    model text DEFAULT 'deterministic'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_badges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_badges (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    badge_id text NOT NULL,
    awarded_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: verification_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_documents (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    campaign_id uuid,
    document_type text NOT NULL,
    storage_path text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: volunteer_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.volunteer_applications (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    opportunity_id uuid NOT NULL,
    applicant_user_id uuid NOT NULL,
    message text,
    status text DEFAULT 'applied'::text NOT NULL,
    hours_logged numeric(7,2) DEFAULT 0 NOT NULL,
    hours_verified boolean DEFAULT false NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT volunteer_applications_status_check CHECK ((status = ANY (ARRAY['applied'::text, 'accepted'::text, 'declined'::text, 'withdrawn'::text, 'completed'::text])))
);


--
-- Name: volunteer_hours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.volunteer_hours (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    shift_id uuid,
    opportunity_id uuid NOT NULL,
    volunteer_user_id uuid NOT NULL,
    checked_in_at timestamp with time zone,
    checked_out_at timestamp with time zone,
    hours numeric(7,2) DEFAULT 0 NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    verified_by uuid,
    verified_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT volunteer_hours_nonneg CHECK ((hours >= (0)::numeric)),
    CONSTRAINT volunteer_hours_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'check_in'::text]))),
    CONSTRAINT volunteer_hours_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text]))),
    CONSTRAINT volunteer_hours_time_order CHECK (((checked_out_at IS NULL) OR (checked_in_at IS NULL) OR (checked_out_at >= checked_in_at)))
);


--
-- Name: volunteer_opportunities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.volunteer_opportunities (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    org_name text NOT NULL,
    summary text,
    description text,
    category text,
    skills text[] DEFAULT '{}'::text[] NOT NULL,
    location text,
    country text,
    is_remote boolean DEFAULT false NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    slots integer,
    slots_filled integer DEFAULT 0 NOT NULL,
    time_commitment text,
    contact_url text,
    campaign_id uuid,
    status text DEFAULT 'open'::text NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT volunteer_dates CHECK (((starts_at IS NULL) OR (ends_at IS NULL) OR (starts_at <= ends_at))),
    CONSTRAINT volunteer_opportunities_status_check CHECK ((status = ANY (ARRAY['open'::text, 'upcoming'::text, 'closed'::text]))),
    CONSTRAINT volunteer_slots_nonneg CHECK (((slots IS NULL) OR (slots >= 0)))
);


--
-- Name: volunteer_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.volunteer_profiles (
    user_id uuid NOT NULL,
    headline text,
    bio text,
    skills text[] DEFAULT '{}'::text[] NOT NULL,
    interests text[] DEFAULT '{}'::text[] NOT NULL,
    location text,
    country text,
    availability text,
    remote_ok boolean DEFAULT true NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: volunteer_shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.volunteer_shifts (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    opportunity_id uuid NOT NULL,
    title text NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    location text,
    is_remote boolean DEFAULT false NOT NULL,
    capacity integer,
    filled_count integer DEFAULT 0 NOT NULL,
    notes text,
    checkin_code text,
    status text DEFAULT 'scheduled'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT volunteer_shifts_capacity_nonneg CHECK (((capacity IS NULL) OR (capacity >= 0))),
    CONSTRAINT volunteer_shifts_filled_nonneg CHECK ((filled_count >= 0)),
    CONSTRAINT volunteer_shifts_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'cancelled'::text, 'completed'::text]))),
    CONSTRAINT volunteer_shifts_time_order CHECK ((ends_at > starts_at))
);


--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_events (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    stripe_event_id text NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    processed_at timestamp with time zone,
    processing_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_notes admin_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notes
    ADD CONSTRAINT admin_notes_pkey PRIMARY KEY (id);


--
-- Name: admin_reviews admin_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_reviews
    ADD CONSTRAINT admin_reviews_pkey PRIMARY KEY (id);


--
-- Name: admin_settings admin_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_settings
    ADD CONSTRAINT admin_settings_pkey PRIMARY KEY (key);


--
-- Name: aeo_entries aeo_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aeo_entries
    ADD CONSTRAINT aeo_entries_pkey PRIMARY KEY (id);


--
-- Name: ai_generations ai_generations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_generations
    ADD CONSTRAINT ai_generations_pkey PRIMARY KEY (id);


--
-- Name: analytics_snapshots analytics_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_snapshots
    ADD CONSTRAINT analytics_snapshots_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: api_keys api_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: auction_bids auction_bids_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auction_bids
    ADD CONSTRAINT auction_bids_pkey PRIMARY KEY (id);


--
-- Name: auction_items auction_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auction_items
    ADD CONSTRAINT auction_items_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: banner_settings banner_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banner_settings
    ADD CONSTRAINT banner_settings_pkey PRIMARY KEY (id);


--
-- Name: beneficiary_invites beneficiary_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiary_invites
    ADD CONSTRAINT beneficiary_invites_pkey PRIMARY KEY (id);


--
-- Name: beneficiary_invites beneficiary_invites_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiary_invites
    ADD CONSTRAINT beneficiary_invites_token_key UNIQUE (token);


--
-- Name: brands brands_org_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_org_id_slug_key UNIQUE (org_id, slug);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: business_leads business_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_leads
    ADD CONSTRAINT business_leads_pkey PRIMARY KEY (id);


--
-- Name: campaign_analytics_events campaign_analytics_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_analytics_events
    ADD CONSTRAINT campaign_analytics_events_pkey PRIMARY KEY (id);


--
-- Name: campaign_builder_events campaign_builder_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_builder_events
    ADD CONSTRAINT campaign_builder_events_pkey PRIMARY KEY (id);


--
-- Name: campaign_faqs campaign_faqs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_faqs
    ADD CONSTRAINT campaign_faqs_pkey PRIMARY KEY (id);


--
-- Name: campaign_launch_settings campaign_launch_settings_campaign_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_launch_settings
    ADD CONSTRAINT campaign_launch_settings_campaign_id_key UNIQUE (campaign_id);


--
-- Name: campaign_launch_settings campaign_launch_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_launch_settings
    ADD CONSTRAINT campaign_launch_settings_pkey PRIMARY KEY (id);


--
-- Name: campaign_media campaign_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_media
    ADD CONSTRAINT campaign_media_pkey PRIMARY KEY (id);


--
-- Name: campaign_milestones campaign_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_milestones
    ADD CONSTRAINT campaign_milestones_pkey PRIMARY KEY (id);


--
-- Name: campaign_owner_payouts campaign_owner_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_owner_payouts
    ADD CONSTRAINT campaign_owner_payouts_pkey PRIMARY KEY (id);


--
-- Name: campaign_owner_replies campaign_owner_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_owner_replies
    ADD CONSTRAINT campaign_owner_replies_pkey PRIMARY KEY (id);


--
-- Name: campaign_owner_transfers campaign_owner_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_owner_transfers
    ADD CONSTRAINT campaign_owner_transfers_pkey PRIMARY KEY (id);


--
-- Name: campaign_payment_admin_notes campaign_payment_admin_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_admin_notes
    ADD CONSTRAINT campaign_payment_admin_notes_pkey PRIMARY KEY (id);


--
-- Name: campaign_payment_audit_logs campaign_payment_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_audit_logs
    ADD CONSTRAINT campaign_payment_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: campaign_payment_breakdowns campaign_payment_breakdowns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_breakdowns
    ADD CONSTRAINT campaign_payment_breakdowns_pkey PRIMARY KEY (id);


--
-- Name: campaign_payment_disputes campaign_payment_disputes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_disputes
    ADD CONSTRAINT campaign_payment_disputes_pkey PRIMARY KEY (id);


--
-- Name: campaign_payment_disputes campaign_payment_disputes_processor_processor_object_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_disputes
    ADD CONSTRAINT campaign_payment_disputes_processor_processor_object_id_key UNIQUE (processor, processor_object_id);


--
-- Name: campaign_payment_events campaign_payment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_events
    ADD CONSTRAINT campaign_payment_events_pkey PRIMARY KEY (id);


--
-- Name: campaign_payment_events campaign_payment_events_processor_processor_object_id_event_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_events
    ADD CONSTRAINT campaign_payment_events_processor_processor_object_id_event_key UNIQUE (processor, processor_object_id, event_type);


--
-- Name: campaign_payment_exports campaign_payment_exports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_exports
    ADD CONSTRAINT campaign_payment_exports_pkey PRIMARY KEY (id);


--
-- Name: campaign_payment_reconciliation campaign_payment_reconciliation_campaign_payment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_reconciliation
    ADD CONSTRAINT campaign_payment_reconciliation_campaign_payment_id_key UNIQUE (campaign_payment_id);


--
-- Name: campaign_payment_reconciliation campaign_payment_reconciliation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_reconciliation
    ADD CONSTRAINT campaign_payment_reconciliation_pkey PRIMARY KEY (id);


--
-- Name: campaign_payment_refunds campaign_payment_refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_refunds
    ADD CONSTRAINT campaign_payment_refunds_pkey PRIMARY KEY (id);


--
-- Name: campaign_payment_settings campaign_payment_settings_campaign_id_processor_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_settings
    ADD CONSTRAINT campaign_payment_settings_campaign_id_processor_key UNIQUE (campaign_id, processor);


--
-- Name: campaign_payment_settings campaign_payment_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_settings
    ADD CONSTRAINT campaign_payment_settings_pkey PRIMARY KEY (id);


--
-- Name: campaign_payment_webhook_events campaign_payment_webhook_event_processor_processor_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_webhook_events
    ADD CONSTRAINT campaign_payment_webhook_event_processor_processor_event_id_key UNIQUE (processor, processor_event_id);


--
-- Name: campaign_payment_webhook_events campaign_payment_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_webhook_events
    ADD CONSTRAINT campaign_payment_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: campaign_payments campaign_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payments
    ADD CONSTRAINT campaign_payments_pkey PRIMARY KEY (id);


--
-- Name: campaign_platform_fees campaign_platform_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_platform_fees
    ADD CONSTRAINT campaign_platform_fees_pkey PRIMARY KEY (id);


--
-- Name: campaign_processor_fees campaign_processor_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_processor_fees
    ADD CONSTRAINT campaign_processor_fees_pkey PRIMARY KEY (id);


--
-- Name: campaign_reports campaign_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_reports
    ADD CONSTRAINT campaign_reports_pkey PRIMARY KEY (id);


--
-- Name: campaign_rewards campaign_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_rewards
    ADD CONSTRAINT campaign_rewards_pkey PRIMARY KEY (id);


--
-- Name: campaign_status_log campaign_status_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_status_log
    ADD CONSTRAINT campaign_status_log_pkey PRIMARY KEY (id);


--
-- Name: campaign_updates campaign_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_updates
    ADD CONSTRAINT campaign_updates_pkey PRIMARY KEY (id);


--
-- Name: campaign_wizard_drafts campaign_wizard_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_wizard_drafts
    ADD CONSTRAINT campaign_wizard_drafts_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_latitude_range; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.campaigns
    ADD CONSTRAINT campaigns_latitude_range CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision)))) NOT VALID;


--
-- Name: campaigns campaigns_longitude_range; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.campaigns
    ADD CONSTRAINT campaigns_longitude_range CHECK (((longitude IS NULL) OR ((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision)))) NOT VALID;


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_slug_key UNIQUE (slug);


--
-- Name: challenge_participants challenge_participants_challenge_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participants
    ADD CONSTRAINT challenge_participants_challenge_id_user_id_key UNIQUE (challenge_id, user_id);


--
-- Name: challenge_participants challenge_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participants
    ADD CONSTRAINT challenge_participants_pkey PRIMARY KEY (id);


--
-- Name: challenges challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_pkey PRIMARY KEY (id);


--
-- Name: challenges challenges_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_slug_key UNIQUE (slug);


--
-- Name: coach_sessions coach_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_sessions
    ADD CONSTRAINT coach_sessions_pkey PRIMARY KEY (id);


--
-- Name: commission_requests commission_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_requests
    ADD CONSTRAINT commission_requests_pkey PRIMARY KEY (id);


--
-- Name: connected_accounts connected_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connected_accounts
    ADD CONSTRAINT connected_accounts_pkey PRIMARY KEY (id);


--
-- Name: connected_accounts connected_accounts_stripe_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connected_accounts
    ADD CONSTRAINT connected_accounts_stripe_account_id_key UNIQUE (stripe_account_id);


--
-- Name: contact_messages contact_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_pkey PRIMARY KEY (id);


--
-- Name: creator_profiles creator_profiles_handle_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_profiles
    ADD CONSTRAINT creator_profiles_handle_key UNIQUE (handle);


--
-- Name: creator_profiles creator_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_profiles
    ADD CONSTRAINT creator_profiles_pkey PRIMARY KEY (id);


--
-- Name: creator_tips creator_tips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_tips
    ADD CONSTRAINT creator_tips_pkey PRIMARY KEY (id);


--
-- Name: digital_products digital_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_products
    ADD CONSTRAINT digital_products_pkey PRIMARY KEY (id);


--
-- Name: direct_messages direct_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_pkey PRIMARY KEY (id);


--
-- Name: donation_forms donation_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donation_forms
    ADD CONSTRAINT donation_forms_pkey PRIMARY KEY (id);


--
-- Name: donation_forms donation_forms_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donation_forms
    ADD CONSTRAINT donation_forms_slug_key UNIQUE (slug);


--
-- Name: donation_receipts donation_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donation_receipts
    ADD CONSTRAINT donation_receipts_pkey PRIMARY KEY (id);


--
-- Name: donation_receipts donation_receipts_receipt_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donation_receipts
    ADD CONSTRAINT donation_receipts_receipt_number_key UNIQUE (receipt_number);


--
-- Name: donations donations_amount_cents_positive; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.donations
    ADD CONSTRAINT donations_amount_cents_positive CHECK ((amount_cents > 0)) NOT VALID;


--
-- Name: donations donations_fee_cents_nonnegative; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.donations
    ADD CONSTRAINT donations_fee_cents_nonnegative CHECK (((tip_cents >= 0) AND (processing_fee_cents >= 0))) NOT VALID;


--
-- Name: donations donations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_pkey PRIMARY KEY (id);


--
-- Name: donor_crm_contacts donor_crm_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donor_crm_contacts
    ADD CONSTRAINT donor_crm_contacts_pkey PRIMARY KEY (id);


--
-- Name: donor_message_likes donor_message_likes_donor_message_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donor_message_likes
    ADD CONSTRAINT donor_message_likes_donor_message_id_user_id_key UNIQUE (donor_message_id, user_id);


--
-- Name: donor_message_likes donor_message_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donor_message_likes
    ADD CONSTRAINT donor_message_likes_pkey PRIMARY KEY (id);


--
-- Name: donor_messages donor_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donor_messages
    ADD CONSTRAINT donor_messages_pkey PRIMARY KEY (id);


--
-- Name: donor_segment_members donor_segment_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donor_segment_members
    ADD CONSTRAINT donor_segment_members_pkey PRIMARY KEY (segment_id, contact_id);


--
-- Name: donor_segments donor_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donor_segments
    ADD CONSTRAINT donor_segments_pkey PRIMARY KEY (id);


--
-- Name: donor_tips donor_tips_amount_cents_positive; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.donor_tips
    ADD CONSTRAINT donor_tips_amount_cents_positive CHECK ((amount_cents > 0)) NOT VALID;


--
-- Name: donor_tips donor_tips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donor_tips
    ADD CONSTRAINT donor_tips_pkey PRIMARY KEY (id);


--
-- Name: email_campaigns email_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_campaigns
    ADD CONSTRAINT email_campaigns_pkey PRIMARY KEY (id);


--
-- Name: embedded_buttons embedded_buttons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embedded_buttons
    ADD CONSTRAINT embedded_buttons_pkey PRIMARY KEY (id);


--
-- Name: event_checkins event_checkins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_checkins
    ADD CONSTRAINT event_checkins_pkey PRIMARY KEY (id);


--
-- Name: event_checkins event_checkins_registration_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_checkins
    ADD CONSTRAINT event_checkins_registration_id_key UNIQUE (registration_id);


--
-- Name: event_registrations event_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT event_registrations_pkey PRIMARY KEY (id);


--
-- Name: event_tickets event_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_tickets
    ADD CONSTRAINT event_tickets_pkey PRIMARY KEY (id);


--
-- Name: exclusive_posts exclusive_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exclusive_posts
    ADD CONSTRAINT exclusive_posts_pkey PRIMARY KEY (id);


--
-- Name: feature_flags feature_flags_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_key_key UNIQUE (key);


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (id);


--
-- Name: fundraising_events fundraising_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fundraising_events
    ADD CONSTRAINT fundraising_events_pkey PRIMARY KEY (id);


--
-- Name: fundraising_events fundraising_events_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fundraising_events
    ADD CONSTRAINT fundraising_events_slug_key UNIQUE (slug);


--
-- Name: giving_days giving_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giving_days
    ADD CONSTRAINT giving_days_pkey PRIMARY KEY (id);


--
-- Name: giving_days giving_days_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giving_days
    ADD CONSTRAINT giving_days_slug_key UNIQUE (slug);


--
-- Name: grant_applications grant_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grant_applications
    ADD CONSTRAINT grant_applications_pkey PRIMARY KEY (id);


--
-- Name: grant_deadlines grant_deadlines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grant_deadlines
    ADD CONSTRAINT grant_deadlines_pkey PRIMARY KEY (id);


--
-- Name: grant_documents grant_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grant_documents
    ADD CONSTRAINT grant_documents_pkey PRIMARY KEY (id);


--
-- Name: grant_matches grant_matches_grant_id_user_id_campaign_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grant_matches
    ADD CONSTRAINT grant_matches_grant_id_user_id_campaign_id_key UNIQUE (grant_id, user_id, campaign_id);


--
-- Name: grant_matches grant_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grant_matches
    ADD CONSTRAINT grant_matches_pkey PRIMARY KEY (id);


--
-- Name: grants grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grants
    ADD CONSTRAINT grants_pkey PRIMARY KEY (id);


--
-- Name: grants grants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grants
    ADD CONSTRAINT grants_slug_key UNIQUE (slug);


--
-- Name: impact_evidence impact_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.impact_evidence
    ADD CONSTRAINT impact_evidence_pkey PRIMARY KEY (id);


--
-- Name: impact_metrics impact_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.impact_metrics
    ADD CONSTRAINT impact_metrics_pkey PRIMARY KEY (id);


--
-- Name: impact_plan_items impact_plan_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.impact_plan_items
    ADD CONSTRAINT impact_plan_items_pkey PRIMARY KEY (id);


--
-- Name: impact_plans impact_plans_campaign_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.impact_plans
    ADD CONSTRAINT impact_plans_campaign_id_key UNIQUE (campaign_id);


--
-- Name: impact_plans impact_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.impact_plans
    ADD CONSTRAINT impact_plans_pkey PRIMARY KEY (id);


--
-- Name: impact_updates impact_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.impact_updates
    ADD CONSTRAINT impact_updates_pkey PRIMARY KEY (id);


--
-- Name: integration_connections integration_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_connections
    ADD CONSTRAINT integration_connections_pkey PRIMARY KEY (id);


--
-- Name: lead_outreach lead_outreach_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_outreach
    ADD CONSTRAINT lead_outreach_pkey PRIMARY KEY (id);


--
-- Name: ledger_entries ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: livestreams livestreams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.livestreams
    ADD CONSTRAINT livestreams_pkey PRIMARY KEY (id);


--
-- Name: marketing_audit_logs marketing_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_audit_logs
    ADD CONSTRAINT marketing_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: marketing_automation_runs marketing_automation_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_automation_runs
    ADD CONSTRAINT marketing_automation_runs_pkey PRIMARY KEY (id);


--
-- Name: marketing_automations marketing_automations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_automations
    ADD CONSTRAINT marketing_automations_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaign_plan_assets marketing_campaign_plan_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaign_plan_assets
    ADD CONSTRAINT marketing_campaign_plan_assets_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaign_plans marketing_campaign_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaign_plans
    ADD CONSTRAINT marketing_campaign_plans_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaign_recipients marketing_campaign_recipients_campaign_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaign_recipients
    ADD CONSTRAINT marketing_campaign_recipients_campaign_id_contact_id_key UNIQUE (campaign_id, contact_id);


--
-- Name: marketing_campaign_recipients marketing_campaign_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaign_recipients
    ADD CONSTRAINT marketing_campaign_recipients_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaigns marketing_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_pkey PRIMARY KEY (id);


--
-- Name: marketing_consent marketing_consent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_consent
    ADD CONSTRAINT marketing_consent_pkey PRIMARY KEY (id);


--
-- Name: marketing_contacts marketing_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_contacts
    ADD CONSTRAINT marketing_contacts_pkey PRIMARY KEY (id);


--
-- Name: marketing_email_templates marketing_email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_email_templates
    ADD CONSTRAINT marketing_email_templates_pkey PRIMARY KEY (id);


--
-- Name: marketing_events marketing_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_events
    ADD CONSTRAINT marketing_events_pkey PRIMARY KEY (id);


--
-- Name: marketing_form_submissions marketing_form_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_form_submissions
    ADD CONSTRAINT marketing_form_submissions_pkey PRIMARY KEY (id);


--
-- Name: marketing_forms marketing_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_forms
    ADD CONSTRAINT marketing_forms_pkey PRIMARY KEY (id);


--
-- Name: marketing_goals marketing_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_goals
    ADD CONSTRAINT marketing_goals_pkey PRIMARY KEY (id);


--
-- Name: marketing_identities marketing_identities_kind_value_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_identities
    ADD CONSTRAINT marketing_identities_kind_value_key UNIQUE (kind, value);


--
-- Name: marketing_identities marketing_identities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_identities
    ADD CONSTRAINT marketing_identities_pkey PRIMARY KEY (id);


--
-- Name: marketing_opportunities marketing_opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_opportunities
    ADD CONSTRAINT marketing_opportunities_pkey PRIMARY KEY (id);


--
-- Name: marketing_referrals marketing_referrals_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_referrals
    ADD CONSTRAINT marketing_referrals_code_key UNIQUE (code);


--
-- Name: marketing_referrals marketing_referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_referrals
    ADD CONSTRAINT marketing_referrals_pkey PRIMARY KEY (id);


--
-- Name: marketing_segment_members marketing_segment_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_segment_members
    ADD CONSTRAINT marketing_segment_members_pkey PRIMARY KEY (segment_id, contact_id);


--
-- Name: marketing_segments marketing_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_segments
    ADD CONSTRAINT marketing_segments_pkey PRIMARY KEY (id);


--
-- Name: marketing_suppression_list marketing_suppression_list_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_suppression_list
    ADD CONSTRAINT marketing_suppression_list_pkey PRIMARY KEY (id);


--
-- Name: marketing_utm_links marketing_utm_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_utm_links
    ADD CONSTRAINT marketing_utm_links_pkey PRIMARY KEY (id);


--
-- Name: marketing_utm_links marketing_utm_links_short_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_utm_links
    ADD CONSTRAINT marketing_utm_links_short_code_key UNIQUE (short_code);


--
-- Name: matching_claims matching_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matching_claims
    ADD CONSTRAINT matching_claims_pkey PRIMARY KEY (id);


--
-- Name: matching_programs matching_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matching_programs
    ADD CONSTRAINT matching_programs_pkey PRIMARY KEY (id);


--
-- Name: member_subscriptions member_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_subscriptions
    ADD CONSTRAINT member_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: member_subscriptions member_subscriptions_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_subscriptions
    ADD CONSTRAINT member_subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);


--
-- Name: membership_tiers membership_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership_tiers
    ADD CONSTRAINT membership_tiers_pkey PRIMARY KEY (id);


--
-- Name: message_thread_state message_thread_state_owner_id_donor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_thread_state
    ADD CONSTRAINT message_thread_state_owner_id_donor_id_key UNIQUE (owner_id, donor_id);


--
-- Name: message_thread_state message_thread_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_thread_state
    ADD CONSTRAINT message_thread_state_pkey PRIMARY KEY (id);


--
-- Name: nonprofit_profiles nonprofit_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nonprofit_profiles
    ADD CONSTRAINT nonprofit_profiles_pkey PRIMARY KEY (id);


--
-- Name: nonprofit_profiles nonprofit_profiles_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nonprofit_profiles
    ADD CONSTRAINT nonprofit_profiles_slug_key UNIQUE (slug);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: organization_members organization_members_org_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_org_id_user_id_key UNIQUE (org_id, user_id);


--
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: organizer_sends organizer_sends_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_sends
    ADD CONSTRAINT organizer_sends_pkey PRIMARY KEY (id);


--
-- Name: outbound_webhook_endpoints outbound_webhook_endpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbound_webhook_endpoints
    ADD CONSTRAINT outbound_webhook_endpoints_pkey PRIMARY KEY (id);


--
-- Name: payment_processors payment_processors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_processors
    ADD CONSTRAINT payment_processors_pkey PRIMARY KEY (id);


--
-- Name: payment_processors payment_processors_processor_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_processors
    ADD CONSTRAINT payment_processors_processor_key UNIQUE (processor);


--
-- Name: payouts payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_pkey PRIMARY KEY (id);


--
-- Name: peer_fundraisers peer_fundraisers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_fundraisers
    ADD CONSTRAINT peer_fundraisers_pkey PRIMARY KEY (id);


--
-- Name: peer_fundraisers peer_fundraisers_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_fundraisers
    ADD CONSTRAINT peer_fundraisers_slug_key UNIQUE (slug);


--
-- Name: platform_fees platform_fees_amount_cents_nonnegative; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.platform_fees
    ADD CONSTRAINT platform_fees_amount_cents_nonnegative CHECK ((amount_cents >= 0)) NOT VALID;


--
-- Name: platform_fees platform_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_fees
    ADD CONSTRAINT platform_fees_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);


--
-- Name: privacy_requests privacy_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.privacy_requests
    ADD CONSTRAINT privacy_requests_pkey PRIMARY KEY (id);


--
-- Name: processor_accounts processor_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processor_accounts
    ADD CONSTRAINT processor_accounts_pkey PRIMARY KEY (id);


--
-- Name: processor_accounts processor_accounts_processor_processor_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processor_accounts
    ADD CONSTRAINT processor_accounts_processor_processor_account_id_key UNIQUE (processor, processor_account_id);


--
-- Name: product_orders product_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_orders
    ADD CONSTRAINT product_orders_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: rate_limit_hits rate_limit_hits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limit_hits
    ADD CONSTRAINT rate_limit_hits_pkey PRIMARY KEY (key);


--
-- Name: reconciliation_exceptions reconciliation_exceptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_exceptions
    ADD CONSTRAINT reconciliation_exceptions_pkey PRIMARY KEY (id);


--
-- Name: recurring_donations recurring_donations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_donations
    ADD CONSTRAINT recurring_donations_pkey PRIMARY KEY (id);


--
-- Name: recurring_donations recurring_donations_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_donations
    ADD CONSTRAINT recurring_donations_stripe_subscription_id_key UNIQUE (stripe_subscription_id);


--
-- Name: refunds refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (id);


--
-- Name: reward_tiers reward_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_tiers
    ADD CONSTRAINT reward_tiers_pkey PRIMARY KEY (id);


--
-- Name: risk_flags risk_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_flags
    ADD CONSTRAINT risk_flags_pkey PRIMARY KEY (id);


--
-- Name: saved_campaigns saved_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_campaigns
    ADD CONSTRAINT saved_campaigns_pkey PRIMARY KEY (id);


--
-- Name: saved_campaigns saved_campaigns_user_id_campaign_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_campaigns
    ADD CONSTRAINT saved_campaigns_user_id_campaign_id_key UNIQUE (user_id, campaign_id);


--
-- Name: seo_settings seo_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seo_settings
    ADD CONSTRAINT seo_settings_pkey PRIMARY KEY (id);


--
-- Name: seo_settings seo_settings_route_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seo_settings
    ADD CONSTRAINT seo_settings_route_key UNIQUE (route);


--
-- Name: share_events share_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_events
    ADD CONSTRAINT share_events_pkey PRIMARY KEY (id);


--
-- Name: sms_campaigns sms_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_campaigns
    ADD CONSTRAINT sms_campaigns_pkey PRIMARY KEY (id);


--
-- Name: sponsors sponsors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sponsors
    ADD CONSTRAINT sponsors_pkey PRIMARY KEY (id);


--
-- Name: sponsorship_opportunities sponsorship_opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sponsorship_opportunities
    ADD CONSTRAINT sponsorship_opportunities_pkey PRIMARY KEY (id);


--
-- Name: sponsorship_requests sponsorship_requests_opportunity_id_sponsor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sponsorship_requests
    ADD CONSTRAINT sponsorship_requests_opportunity_id_sponsor_id_key UNIQUE (opportunity_id, sponsor_id);


--
-- Name: sponsorship_requests sponsorship_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sponsorship_requests
    ADD CONSTRAINT sponsorship_requests_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: support_cases support_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_cases
    ADD CONSTRAINT support_cases_pkey PRIMARY KEY (id);


--
-- Name: support_notes support_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_notes
    ADD CONSTRAINT support_notes_pkey PRIMARY KEY (id);


--
-- Name: supported_countries supported_countries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supported_countries
    ADD CONSTRAINT supported_countries_pkey PRIMARY KEY (id);


--
-- Name: tax_receipts tax_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_receipts
    ADD CONSTRAINT tax_receipts_pkey PRIMARY KEY (id);


--
-- Name: tax_receipts tax_receipts_receipt_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_receipts
    ADD CONSTRAINT tax_receipts_receipt_number_key UNIQUE (receipt_number);


--
-- Name: team_members team_members_campaign_id_nonprofit_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_campaign_id_nonprofit_id_user_id_key UNIQUE (campaign_id, nonprofit_id, user_id);


--
-- Name: team_members team_members_invite_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_invite_token_key UNIQUE (invite_token);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: transparency_ledger_items transparency_ledger_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transparency_ledger_items
    ADD CONSTRAINT transparency_ledger_items_pkey PRIMARY KEY (id);


--
-- Name: trust_scores trust_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trust_scores
    ADD CONSTRAINT trust_scores_pkey PRIMARY KEY (id);


--
-- Name: user_badges user_badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_pkey PRIMARY KEY (id);


--
-- Name: user_badges user_badges_user_id_badge_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_user_id_badge_id_key UNIQUE (user_id, badge_id);


--
-- Name: verification_documents verification_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_documents
    ADD CONSTRAINT verification_documents_pkey PRIMARY KEY (id);


--
-- Name: volunteer_applications volunteer_applications_opportunity_id_applicant_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volunteer_applications
    ADD CONSTRAINT volunteer_applications_opportunity_id_applicant_user_id_key UNIQUE (opportunity_id, applicant_user_id);


--
-- Name: volunteer_applications volunteer_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volunteer_applications
    ADD CONSTRAINT volunteer_applications_pkey PRIMARY KEY (id);


--
-- Name: volunteer_hours volunteer_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volunteer_hours
    ADD CONSTRAINT volunteer_hours_pkey PRIMARY KEY (id);


--
-- Name: volunteer_opportunities volunteer_opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volunteer_opportunities
    ADD CONSTRAINT volunteer_opportunities_pkey PRIMARY KEY (id);


--
-- Name: volunteer_opportunities volunteer_opportunities_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volunteer_opportunities
    ADD CONSTRAINT volunteer_opportunities_slug_key UNIQUE (slug);


--
-- Name: volunteer_profiles volunteer_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volunteer_profiles
    ADD CONSTRAINT volunteer_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: volunteer_shifts volunteer_shifts_checkin_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volunteer_shifts
    ADD CONSTRAINT volunteer_shifts_checkin_code_key UNIQUE (checkin_code);


--
-- Name: volunteer_shifts volunteer_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volunteer_shifts
    ADD CONSTRAINT volunteer_shifts_pkey PRIMARY KEY (id);


--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);


--
-- Name: webhook_events webhook_events_stripe_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_stripe_event_id_key UNIQUE (stripe_event_id);


--
-- Name: aeo_entries_pub_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aeo_entries_pub_idx ON public.aeo_entries USING btree (published, priority DESC);


--
-- Name: aeo_entries_route_pub_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aeo_entries_route_pub_idx ON public.aeo_entries USING btree (route, published, priority DESC, created_at DESC);


--
-- Name: analytics_snapshots_campaign_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analytics_snapshots_campaign_id_idx ON public.analytics_snapshots USING btree (campaign_id);


--
-- Name: announcements_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX announcements_active_idx ON public.announcements USING btree (active);


--
-- Name: audit_logs_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_actor_idx ON public.audit_logs USING btree (actor_id);


--
-- Name: audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at DESC);


--
-- Name: audit_logs_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_target_idx ON public.audit_logs USING btree (target_type, target_id);


--
-- Name: brand_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX brand_org_idx ON public.brands USING btree (org_id) WHERE (deleted_at IS NULL);


--
-- Name: business_leads_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_leads_created_at_idx ON public.business_leads USING btree (created_at DESC);


--
-- Name: business_leads_marketing_contact_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_leads_marketing_contact_idx ON public.business_leads USING btree (marketing_contact_id);


--
-- Name: business_leads_name_state_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX business_leads_name_state_uniq ON public.business_leads USING btree (lower(business_name), COALESCE(upper(state), ''::text));


--
-- Name: business_leads_score_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_leads_score_idx ON public.business_leads USING btree (lead_score DESC);


--
-- Name: business_leads_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_leads_state_idx ON public.business_leads USING btree (state);


--
-- Name: business_leads_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_leads_status_idx ON public.business_leads USING btree (status);


--
-- Name: campaign_analytics_events_campaign_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_analytics_events_campaign_id_idx ON public.campaign_analytics_events USING btree (campaign_id);


--
-- Name: campaign_launch_settings_campaign_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_launch_settings_campaign_id_idx ON public.campaign_launch_settings USING btree (campaign_id);


--
-- Name: campaign_owner_payouts_payment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_owner_payouts_payment_idx ON public.campaign_owner_payouts USING btree (campaign_payment_id);


--
-- Name: campaign_owner_transfers_payment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_owner_transfers_payment_idx ON public.campaign_owner_transfers USING btree (campaign_payment_id);


--
-- Name: campaign_owner_transfers_processor_object_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX campaign_owner_transfers_processor_object_uidx ON public.campaign_owner_transfers USING btree (processor, processor_object_id);


--
-- Name: campaign_payment_admin_notes_payment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_payment_admin_notes_payment_idx ON public.campaign_payment_admin_notes USING btree (campaign_payment_id, created_at DESC);


--
-- Name: campaign_payment_breakdowns_payment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_payment_breakdowns_payment_idx ON public.campaign_payment_breakdowns USING btree (campaign_payment_id);


--
-- Name: campaign_payment_disputes_payment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_payment_disputes_payment_idx ON public.campaign_payment_disputes USING btree (campaign_payment_id);


--
-- Name: campaign_payment_events_payment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_payment_events_payment_idx ON public.campaign_payment_events USING btree (campaign_payment_id, occurred_at DESC);


--
-- Name: campaign_payment_reconciliation_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_payment_reconciliation_status_idx ON public.campaign_payment_reconciliation USING btree (status, checked_at DESC);


--
-- Name: campaign_payment_refunds_payment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_payment_refunds_payment_idx ON public.campaign_payment_refunds USING btree (campaign_payment_id);


--
-- Name: campaign_payment_refunds_processor_object_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX campaign_payment_refunds_processor_object_uidx ON public.campaign_payment_refunds USING btree (processor, processor_object_id);


--
-- Name: campaign_payment_webhooks_payment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_payment_webhooks_payment_idx ON public.campaign_payment_webhook_events USING btree (campaign_payment_id, created_at DESC);


--
-- Name: campaign_payments_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_payments_campaign_idx ON public.campaign_payments USING btree (campaign_id, created_at DESC);


--
-- Name: campaign_payments_checkout_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX campaign_payments_checkout_uidx ON public.campaign_payments USING btree (processor, processor_checkout_session_id) WHERE (processor_checkout_session_id IS NOT NULL);


--
-- Name: campaign_payments_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_payments_owner_idx ON public.campaign_payments USING btree (campaign_owner_id, created_at DESC);


--
-- Name: campaign_payments_payment_intent_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX campaign_payments_payment_intent_uidx ON public.campaign_payments USING btree (processor, processor_payment_intent_id) WHERE (processor_payment_intent_id IS NOT NULL);


--
-- Name: campaign_payments_processor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_payments_processor_idx ON public.campaign_payments USING btree (processor, created_at DESC);


--
-- Name: campaign_payments_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_payments_status_idx ON public.campaign_payments USING btree (payment_status, payout_status, reconciliation_status);


--
-- Name: campaign_platform_fees_payment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_platform_fees_payment_idx ON public.campaign_platform_fees USING btree (campaign_payment_id);


--
-- Name: campaign_processor_fees_payment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_processor_fees_payment_idx ON public.campaign_processor_fees USING btree (campaign_payment_id);


--
-- Name: campaign_processor_fees_processor_object_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX campaign_processor_fees_processor_object_uidx ON public.campaign_processor_fees USING btree (processor, processor_object_id);


--
-- Name: campaigns_is_demo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaigns_is_demo_idx ON public.campaigns USING btree (is_demo) WHERE is_demo;


--
-- Name: campaigns_lat_lng_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaigns_lat_lng_idx ON public.campaigns USING btree (latitude, longitude) WHERE ((latitude IS NOT NULL) AND (longitude IS NOT NULL));


--
-- Name: campaigns_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaigns_slug_idx ON public.campaigns USING btree (slug);


--
-- Name: campaigns_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaigns_status_idx ON public.campaigns USING btree (status);


--
-- Name: campaigns_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaigns_user_id_idx ON public.campaigns USING btree (user_id);


--
-- Name: challenge_participants_challenge_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenge_participants_challenge_idx ON public.challenge_participants USING btree (challenge_id);


--
-- Name: challenge_participants_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenge_participants_user_idx ON public.challenge_participants USING btree (user_id);


--
-- Name: challenges_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenges_status_idx ON public.challenges USING btree (status);


--
-- Name: creator_profiles_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX creator_profiles_user_id_idx ON public.creator_profiles USING btree (user_id);


--
-- Name: creator_profiles_user_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX creator_profiles_user_id_unique ON public.creator_profiles USING btree (user_id);


--
-- Name: digital_products_creator_profile_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX digital_products_creator_profile_id_idx ON public.digital_products USING btree (creator_profile_id);


--
-- Name: donation_forms_nonprofit_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX donation_forms_nonprofit_id_idx ON public.donation_forms USING btree (nonprofit_id);


--
-- Name: donation_forms_slug_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX donation_forms_slug_uidx ON public.donation_forms USING btree (slug);


--
-- Name: donation_receipts_donation_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX donation_receipts_donation_id_unique ON public.donation_receipts USING btree (donation_id);


--
-- Name: donation_receipts_guest_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX donation_receipts_guest_email_idx ON public.donation_receipts USING btree (donor_email, created_at DESC) WHERE ((donor_id IS NULL) AND (donor_email IS NOT NULL));


--
-- Name: donations_campaign_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX donations_campaign_id_idx ON public.donations USING btree (campaign_id);


--
-- Name: donations_donor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX donations_donor_id_idx ON public.donations USING btree (donor_id);


--
-- Name: donations_is_demo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX donations_is_demo_idx ON public.donations USING btree (is_demo) WHERE is_demo;


--
-- Name: donations_peer_fundraiser_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX donations_peer_fundraiser_id_idx ON public.donations USING btree (peer_fundraiser_id) WHERE (peer_fundraiser_id IS NOT NULL);


--
-- Name: donations_stripe_payment_intent_id_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX donations_stripe_payment_intent_id_uidx ON public.donations USING btree (stripe_payment_intent_id) WHERE (stripe_payment_intent_id IS NOT NULL);


--
-- Name: donor_crm_contacts_nonprofit_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX donor_crm_contacts_nonprofit_id_idx ON public.donor_crm_contacts USING btree (nonprofit_id);


--
-- Name: donor_message_likes_message_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX donor_message_likes_message_id_idx ON public.donor_message_likes USING btree (donor_message_id);


--
-- Name: donor_message_likes_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX donor_message_likes_user_id_idx ON public.donor_message_likes USING btree (user_id);


--
-- Name: donor_tips_stripe_payment_intent_id_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX donor_tips_stripe_payment_intent_id_uidx ON public.donor_tips USING btree (stripe_payment_intent_id) WHERE (stripe_payment_intent_id IS NOT NULL);


--
-- Name: event_checkins_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_checkins_event_idx ON public.event_checkins USING btree (event_id);


--
-- Name: fundraising_events_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fundraising_events_created_by_idx ON public.fundraising_events USING btree (created_by);


--
-- Name: fundraising_events_nonprofit_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fundraising_events_nonprofit_id_idx ON public.fundraising_events USING btree (nonprofit_id);


--
-- Name: fundraising_events_status_starts_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fundraising_events_status_starts_idx ON public.fundraising_events USING btree (status, starts_at);


--
-- Name: grant_applications_applicant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grant_applications_applicant_idx ON public.grant_applications USING btree (applicant_user_id) WHERE (deleted_at IS NULL);


--
-- Name: grant_applications_grant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grant_applications_grant_idx ON public.grant_applications USING btree (grant_id) WHERE (deleted_at IS NULL);


--
-- Name: grant_applications_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grant_applications_status_idx ON public.grant_applications USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: grant_deadlines_grant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grant_deadlines_grant_idx ON public.grant_deadlines USING btree (grant_id);


--
-- Name: grant_documents_application_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grant_documents_application_idx ON public.grant_documents USING btree (application_id);


--
-- Name: grant_matches_grant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grant_matches_grant_idx ON public.grant_matches USING btree (grant_id);


--
-- Name: grant_matches_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grant_matches_user_idx ON public.grant_matches USING btree (user_id);


--
-- Name: grants_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grants_category_idx ON public.grants USING btree (category) WHERE (deleted_at IS NULL);


--
-- Name: grants_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grants_created_by_idx ON public.grants USING btree (created_by);


--
-- Name: grants_deadline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grants_deadline_idx ON public.grants USING btree (deadline_at) WHERE (deleted_at IS NULL);


--
-- Name: grants_focus_areas_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grants_focus_areas_gin ON public.grants USING gin (focus_areas);


--
-- Name: grants_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grants_status_idx ON public.grants USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_admin_notes_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_notes_target ON public.admin_notes USING btree (target_type, target_id, created_at DESC);


--
-- Name: idx_campaign_faqs_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_faqs_campaign_id ON public.campaign_faqs USING btree (campaign_id);


--
-- Name: idx_campaign_rewards_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_rewards_campaign ON public.campaign_rewards USING btree (campaign_id, sort_order);


--
-- Name: idx_cbe_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cbe_created ON public.campaign_builder_events USING btree (created_at);


--
-- Name: idx_cbe_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cbe_session ON public.campaign_builder_events USING btree (session_id, created_at);


--
-- Name: idx_cbe_step; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cbe_step ON public.campaign_builder_events USING btree (step, created_at);


--
-- Name: idx_coach_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coach_sessions_user_id ON public.coach_sessions USING btree (user_id);


--
-- Name: idx_cwd_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cwd_updated ON public.campaign_wizard_drafts USING btree (updated_at DESC);


--
-- Name: idx_cwd_user_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cwd_user_updated ON public.campaign_wizard_drafts USING btree (user_id, updated_at DESC);


--
-- Name: idx_donations_is_spam; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_donations_is_spam ON public.donations USING btree (is_spam) WHERE (is_spam = true);


--
-- Name: idx_marketing_cpa_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_cpa_plan ON public.marketing_campaign_plan_assets USING btree (plan_id, sort_order);


--
-- Name: idx_marketing_cplans_goal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_cplans_goal ON public.marketing_campaign_plans USING btree (goal_id);


--
-- Name: idx_marketing_cplans_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_cplans_status ON public.marketing_campaign_plans USING btree (status, created_at DESC);


--
-- Name: idx_marketing_goals_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_goals_created ON public.marketing_goals USING btree (created_at DESC);


--
-- Name: idx_marketing_goals_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_goals_deadline ON public.marketing_goals USING btree (deadline);


--
-- Name: idx_marketing_goals_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_goals_owner ON public.marketing_goals USING btree (owner_id);


--
-- Name: idx_marketing_goals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_goals_status ON public.marketing_goals USING btree (status, priority);


--
-- Name: idx_marketing_opps_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_opps_created ON public.marketing_opportunities USING btree (created_at DESC);


--
-- Name: idx_marketing_opps_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_opps_score ON public.marketing_opportunities USING btree (score DESC);


--
-- Name: idx_marketing_opps_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_opps_status ON public.marketing_opportunities USING btree (status, score DESC);


--
-- Name: idx_notifications_read_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_read_at ON public.notifications USING btree (read_at) WHERE (read_at IS NULL);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_receipts_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receipts_campaign ON public.donation_receipts USING btree (campaign_id);


--
-- Name: idx_receipts_donation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receipts_donation ON public.donation_receipts USING btree (donation_id);


--
-- Name: idx_receipts_donor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receipts_donor ON public.donation_receipts USING btree (donor_id) WHERE (donor_id IS NOT NULL);


--
-- Name: idx_share_events_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_share_events_campaign ON public.share_events USING btree (campaign_id, created_at DESC);


--
-- Name: idx_share_events_sharer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_share_events_sharer ON public.share_events USING btree (sharer_id) WHERE (sharer_id IS NOT NULL);


--
-- Name: idx_status_log_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_status_log_campaign ON public.campaign_status_log USING btree (campaign_id, created_at DESC);


--
-- Name: idx_support_cases_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_cases_created ON public.support_cases USING btree (created_at DESC);


--
-- Name: idx_support_cases_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_cases_priority ON public.support_cases USING btree (priority);


--
-- Name: idx_support_cases_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_cases_status ON public.support_cases USING btree (status);


--
-- Name: idx_support_cases_submitter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_cases_submitter ON public.support_cases USING btree (submitter_id);


--
-- Name: impact_evidence_update_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX impact_evidence_update_idx ON public.impact_evidence USING btree (update_id);


--
-- Name: impact_metrics_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX impact_metrics_campaign_idx ON public.impact_metrics USING btree (campaign_id);


--
-- Name: impact_plan_items_plan_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX impact_plan_items_plan_idx ON public.impact_plan_items USING btree (plan_id);


--
-- Name: impact_updates_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX impact_updates_campaign_idx ON public.impact_updates USING btree (campaign_id);


--
-- Name: lead_outreach_contact_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_outreach_contact_idx ON public.lead_outreach USING btree (marketing_contact_id);


--
-- Name: lead_outreach_lead_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lead_outreach_lead_uniq ON public.lead_outreach USING btree (business_lead_id);


--
-- Name: lead_outreach_short_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_outreach_short_code_idx ON public.lead_outreach USING btree (short_code);


--
-- Name: lead_outreach_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_outreach_status_idx ON public.lead_outreach USING btree (status);


--
-- Name: ledger_campaign_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ledger_campaign_id_idx ON public.transparency_ledger_items USING btree (campaign_id);


--
-- Name: ledger_entries_account_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ledger_entries_account_idx ON public.ledger_entries USING btree (account);


--
-- Name: ledger_entries_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ledger_entries_campaign_idx ON public.ledger_entries USING btree (campaign_id);


--
-- Name: ledger_entries_donation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ledger_entries_donation_idx ON public.ledger_entries USING btree (donation_id);


--
-- Name: ledger_entries_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ledger_entries_group_idx ON public.ledger_entries USING btree (entry_group_id);


--
-- Name: ledger_entries_idem_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ledger_entries_idem_uniq ON public.ledger_entries USING btree (idempotency_key, account, direction) WHERE (idempotency_key IS NOT NULL);


--
-- Name: ledger_entries_pi_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ledger_entries_pi_idx ON public.ledger_entries USING btree (stripe_payment_intent_id);


--
-- Name: ledger_review_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ledger_review_status_idx ON public.transparency_ledger_items USING btree (review_status);


--
-- Name: marketing_audit_logs_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_audit_logs_org_id_idx ON public.marketing_audit_logs USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: marketing_automations_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_automations_org_id_idx ON public.marketing_automations USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: marketing_campaign_plans_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_campaign_plans_org_id_idx ON public.marketing_campaign_plans USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: marketing_campaigns_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_campaigns_org_id_idx ON public.marketing_campaigns USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: marketing_campaigns_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_campaigns_status_idx ON public.marketing_campaigns USING btree (status);


--
-- Name: marketing_consent_contact_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_consent_contact_idx ON public.marketing_consent USING btree (contact_id, channel, created_at DESC);


--
-- Name: marketing_consent_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_consent_org_id_idx ON public.marketing_consent USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: marketing_contacts_email_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX marketing_contacts_email_uq ON public.marketing_contacts USING btree (lower(email)) WHERE (email IS NOT NULL);


--
-- Name: marketing_contacts_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_contacts_org_id_idx ON public.marketing_contacts USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: marketing_contacts_score_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_contacts_score_idx ON public.marketing_contacts USING btree (lead_score DESC);


--
-- Name: marketing_contacts_stage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_contacts_stage_idx ON public.marketing_contacts USING btree (lifecycle_stage);


--
-- Name: marketing_contacts_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_contacts_type_idx ON public.marketing_contacts USING btree (client_type);


--
-- Name: marketing_contacts_user_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX marketing_contacts_user_id_uq ON public.marketing_contacts USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: marketing_contacts_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_contacts_user_idx ON public.marketing_contacts USING btree (user_id);


--
-- Name: marketing_email_templates_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_email_templates_org_id_idx ON public.marketing_email_templates USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: marketing_events_contact_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_events_contact_idx ON public.marketing_events USING btree (contact_id, created_at DESC);


--
-- Name: marketing_events_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_events_org_id_idx ON public.marketing_events USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: marketing_events_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_events_type_idx ON public.marketing_events USING btree (event_type, created_at DESC);


--
-- Name: marketing_forms_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_forms_org_id_idx ON public.marketing_forms USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: marketing_goals_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_goals_org_id_idx ON public.marketing_goals USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: marketing_identities_contact_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_identities_contact_idx ON public.marketing_identities USING btree (contact_id);


--
-- Name: marketing_opportunities_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_opportunities_org_id_idx ON public.marketing_opportunities USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: marketing_recipients_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_recipients_campaign_idx ON public.marketing_campaign_recipients USING btree (campaign_id, status);


--
-- Name: marketing_referrals_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_referrals_org_id_idx ON public.marketing_referrals USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: marketing_runs_automation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_runs_automation_idx ON public.marketing_automation_runs USING btree (automation_id, created_at DESC);


--
-- Name: marketing_segments_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_segments_org_id_idx ON public.marketing_segments USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: marketing_submissions_form_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_submissions_form_idx ON public.marketing_form_submissions USING btree (form_id, created_at DESC);


--
-- Name: marketing_suppression_email_plain_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX marketing_suppression_email_plain_uq ON public.marketing_suppression_list USING btree (email);


--
-- Name: marketing_suppression_email_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX marketing_suppression_email_uq ON public.marketing_suppression_list USING btree (lower(email)) WHERE (email IS NOT NULL);


--
-- Name: marketing_suppression_list_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_suppression_list_org_id_idx ON public.marketing_suppression_list USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: marketing_utm_links_campaign_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX marketing_utm_links_campaign_id_key ON public.marketing_utm_links USING btree (campaign_id) WHERE (campaign_id IS NOT NULL);


--
-- Name: marketing_utm_links_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_utm_links_org_id_idx ON public.marketing_utm_links USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: matching_claims_employee_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matching_claims_employee_idx ON public.matching_claims USING btree (employee_id);


--
-- Name: matching_claims_program_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matching_claims_program_idx ON public.matching_claims USING btree (program_id);


--
-- Name: matching_claims_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matching_claims_status_idx ON public.matching_claims USING btree (status);


--
-- Name: matching_programs_sponsor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matching_programs_sponsor_idx ON public.matching_programs USING btree (sponsor_id);


--
-- Name: matching_programs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matching_programs_status_idx ON public.matching_programs USING btree (status);


--
-- Name: membership_tiers_creator_profile_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX membership_tiers_creator_profile_id_idx ON public.membership_tiers USING btree (creator_profile_id);


--
-- Name: message_thread_state_owner_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_thread_state_owner_id_idx ON public.message_thread_state USING btree (owner_id);


--
-- Name: nonprofit_profiles_owner_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nonprofit_profiles_owner_id_idx ON public.nonprofit_profiles USING btree (owner_id);


--
-- Name: org_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_created_by_idx ON public.organizations USING btree (created_by) WHERE (deleted_at IS NULL);


--
-- Name: org_member_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_member_org_idx ON public.organization_members USING btree (org_id) WHERE (deleted_at IS NULL);


--
-- Name: org_member_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_member_user_idx ON public.organization_members USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: organizer_sends_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizer_sends_campaign_idx ON public.organizer_sends USING btree (campaign_id, created_at DESC);


--
-- Name: organizer_sends_organizer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizer_sends_organizer_idx ON public.organizer_sends USING btree (organizer_id, created_at DESC);


--
-- Name: payouts_campaign_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payouts_campaign_id_idx ON public.payouts USING btree (campaign_id);


--
-- Name: payouts_stripe_transfer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payouts_stripe_transfer_id_idx ON public.payouts USING btree (stripe_transfer_id);


--
-- Name: peer_fundraisers_parent_campaign_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX peer_fundraisers_parent_campaign_id_idx ON public.peer_fundraisers USING btree (parent_campaign_id);


--
-- Name: platform_fees_stripe_payment_intent_id_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX platform_fees_stripe_payment_intent_id_uidx ON public.platform_fees USING btree (stripe_payment_intent_id) WHERE (stripe_payment_intent_id IS NOT NULL);


--
-- Name: privacy_requests_active_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX privacy_requests_active_uniq ON public.privacy_requests USING btree (user_id, type) WHERE (status = ANY (ARRAY['pending'::text, 'in_progress'::text]));


--
-- Name: privacy_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX privacy_requests_status_idx ON public.privacy_requests USING btree (status);


--
-- Name: privacy_requests_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX privacy_requests_user_idx ON public.privacy_requests USING btree (user_id);


--
-- Name: profiles_is_demo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_is_demo_idx ON public.profiles USING btree (is_demo) WHERE is_demo;


--
-- Name: rate_limit_hits_reset_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rate_limit_hits_reset_at_idx ON public.rate_limit_hits USING btree (reset_at);


--
-- Name: reconciliation_exceptions_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reconciliation_exceptions_status_idx ON public.reconciliation_exceptions USING btree (status);


--
-- Name: recurring_donations_donor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recurring_donations_donor_id_idx ON public.recurring_donations USING btree (donor_id);


--
-- Name: reward_tiers_campaign_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reward_tiers_campaign_id_idx ON public.reward_tiers USING btree (campaign_id);


--
-- Name: risk_flags_flag_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX risk_flags_flag_type_idx ON public.risk_flags USING btree (flag_type);


--
-- Name: risk_flags_resolved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX risk_flags_resolved_idx ON public.risk_flags USING btree (resolved);


--
-- Name: risk_flags_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX risk_flags_status_idx ON public.risk_flags USING btree (status);


--
-- Name: saved_campaigns_campaign_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX saved_campaigns_campaign_id_idx ON public.saved_campaigns USING btree (campaign_id);


--
-- Name: saved_campaigns_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX saved_campaigns_user_id_idx ON public.saved_campaigns USING btree (user_id);


--
-- Name: seo_settings_route_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX seo_settings_route_idx ON public.seo_settings USING btree (route);


--
-- Name: sponsorship_opportunities_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sponsorship_opportunities_campaign_idx ON public.sponsorship_opportunities USING btree (campaign_id);


--
-- Name: sponsorship_opportunities_organizer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sponsorship_opportunities_organizer_idx ON public.sponsorship_opportunities USING btree (organizer_id);


--
-- Name: sponsorship_opportunities_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sponsorship_opportunities_status_idx ON public.sponsorship_opportunities USING btree (status);


--
-- Name: sponsorship_requests_opportunity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sponsorship_requests_opportunity_idx ON public.sponsorship_requests USING btree (opportunity_id);


--
-- Name: sponsorship_requests_sponsor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sponsorship_requests_sponsor_idx ON public.sponsorship_requests USING btree (sponsor_id);


--
-- Name: sponsorship_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sponsorship_requests_status_idx ON public.sponsorship_requests USING btree (status);


--
-- Name: support_cases_assigned_to_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_cases_assigned_to_idx ON public.support_cases USING btree (assigned_to);


--
-- Name: support_cases_campaign_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_cases_campaign_id_idx ON public.support_cases USING btree (campaign_id);


--
-- Name: support_cases_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_cases_status_idx ON public.support_cases USING btree (status);


--
-- Name: supported_countries_iso_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX supported_countries_iso_code_key ON public.supported_countries USING btree (iso_code);


--
-- Name: tax_receipts_donation_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tax_receipts_donation_id_unique ON public.tax_receipts USING btree (donation_id);


--
-- Name: tax_receipts_donor_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tax_receipts_donor_created_at_idx ON public.tax_receipts USING btree (donor_id, created_at DESC);


--
-- Name: uq_marketing_opps_dedupe; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_marketing_opps_dedupe ON public.marketing_opportunities USING btree (dedupe_key);


--
-- Name: user_badges_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_badges_user_idx ON public.user_badges USING btree (user_id);


--
-- Name: vol_app_applicant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vol_app_applicant_idx ON public.volunteer_applications USING btree (applicant_user_id) WHERE (deleted_at IS NULL);


--
-- Name: vol_app_opp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vol_app_opp_idx ON public.volunteer_applications USING btree (opportunity_id) WHERE (deleted_at IS NULL);


--
-- Name: vol_hours_one_open_checkin; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX vol_hours_one_open_checkin ON public.volunteer_hours USING btree (volunteer_user_id, shift_id) WHERE ((checked_out_at IS NULL) AND (deleted_at IS NULL) AND (shift_id IS NOT NULL));


--
-- Name: vol_hours_opp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vol_hours_opp_idx ON public.volunteer_hours USING btree (opportunity_id) WHERE (deleted_at IS NULL);


--
-- Name: vol_hours_shift_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vol_hours_shift_idx ON public.volunteer_hours USING btree (shift_id) WHERE (deleted_at IS NULL);


--
-- Name: vol_hours_verified_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vol_hours_verified_idx ON public.volunteer_hours USING btree (volunteer_user_id, status, checked_in_at) WHERE (deleted_at IS NULL);


--
-- Name: vol_hours_volunteer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vol_hours_volunteer_idx ON public.volunteer_hours USING btree (volunteer_user_id) WHERE (deleted_at IS NULL);


--
-- Name: vol_opp_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vol_opp_category_idx ON public.volunteer_opportunities USING btree (category) WHERE (deleted_at IS NULL);


--
-- Name: vol_opp_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vol_opp_created_by_idx ON public.volunteer_opportunities USING btree (created_by);


--
-- Name: vol_opp_remote_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vol_opp_remote_idx ON public.volunteer_opportunities USING btree (is_remote) WHERE (deleted_at IS NULL);


--
-- Name: vol_opp_skills_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vol_opp_skills_gin ON public.volunteer_opportunities USING gin (skills);


--
-- Name: vol_opp_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vol_opp_status_idx ON public.volunteer_opportunities USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: vol_profile_skills_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vol_profile_skills_gin ON public.volunteer_profiles USING gin (skills);


--
-- Name: vol_shift_opp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vol_shift_opp_idx ON public.volunteer_shifts USING btree (opportunity_id) WHERE (deleted_at IS NULL);


--
-- Name: vol_shift_starts_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vol_shift_starts_idx ON public.volunteer_shifts USING btree (starts_at) WHERE (deleted_at IS NULL);


--
-- Name: admin_reviews admin_reviews_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER admin_reviews_set_updated_at BEFORE UPDATE ON public.admin_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: aeo_entries aeo_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER aeo_entries_updated_at BEFORE UPDATE ON public.aeo_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: announcements announcements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_payment_reconciliation audit_campaign_payment_reconciliation_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_campaign_payment_reconciliation_write AFTER INSERT OR UPDATE ON public.campaign_payment_reconciliation FOR EACH ROW EXECUTE FUNCTION public.audit_campaign_payment_change();


--
-- Name: campaign_payments audit_campaign_payments_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_campaign_payments_write AFTER INSERT OR UPDATE ON public.campaign_payments FOR EACH ROW EXECUTE FUNCTION public.audit_campaign_payment_change();


--
-- Name: banner_settings banner_settings_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER banner_settings_touch BEFORE UPDATE ON public.banner_settings FOR EACH ROW EXECUTE FUNCTION public.banner_settings_touch();


--
-- Name: business_leads business_leads_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER business_leads_set_updated_at BEFORE UPDATE ON public.business_leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_launch_settings campaign_launch_settings_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER campaign_launch_settings_set_updated_at BEFORE UPDATE ON public.campaign_launch_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_reports campaign_reports_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER campaign_reports_set_updated_at BEFORE UPDATE ON public.campaign_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_wizard_drafts campaign_wizard_drafts_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER campaign_wizard_drafts_touch BEFORE UPDATE ON public.campaign_wizard_drafts FOR EACH ROW EXECUTE FUNCTION public.campaign_wizard_drafts_touch();


--
-- Name: campaigns campaigns_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER campaigns_set_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: challenges challenges_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER challenges_updated_at BEFORE UPDATE ON public.challenges FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: connected_accounts connected_accounts_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER connected_accounts_set_updated_at BEFORE UPDATE ON public.connected_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: contact_messages contact_messages_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER contact_messages_set_updated_at BEFORE UPDATE ON public.contact_messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: creator_profiles creator_profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER creator_profiles_set_updated_at BEFORE UPDATE ON public.creator_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: digital_products digital_products_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER digital_products_set_updated_at BEFORE UPDATE ON public.digital_products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: donation_forms donation_forms_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER donation_forms_set_updated_at BEFORE UPDATE ON public.donation_forms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: donations donations_increment_campaign_stats; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER donations_increment_campaign_stats AFTER INSERT ON public.donations FOR EACH ROW EXECUTE FUNCTION public.increment_campaign_stats_after_donation();


--
-- Name: donations donations_increment_peer_fundraiser; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER donations_increment_peer_fundraiser AFTER INSERT ON public.donations FOR EACH ROW EXECUTE FUNCTION public.increment_peer_fundraiser_after_donation();


--
-- Name: donor_crm_contacts donor_crm_contacts_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER donor_crm_contacts_set_updated_at BEFORE UPDATE ON public.donor_crm_contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: donor_messages donor_messages_sync_anonymity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER donor_messages_sync_anonymity BEFORE INSERT OR UPDATE OF anonymous, visibility ON public.donor_messages FOR EACH ROW EXECUTE FUNCTION public.sync_donor_message_anonymity();


--
-- Name: fundraising_events fundraising_events_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER fundraising_events_set_updated_at BEFORE UPDATE ON public.fundraising_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: grant_applications grant_applications_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER grant_applications_set_updated_at BEFORE UPDATE ON public.grant_applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: grants grants_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER grants_set_updated_at BEFORE UPDATE ON public.grants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: impact_metrics impact_metrics_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER impact_metrics_updated_at BEFORE UPDATE ON public.impact_metrics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: impact_plans impact_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER impact_plans_updated_at BEFORE UPDATE ON public.impact_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: impact_updates impact_updates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER impact_updates_updated_at BEFORE UPDATE ON public.impact_updates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: lead_outreach lead_outreach_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lead_outreach_set_updated_at BEFORE UPDATE ON public.lead_outreach FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: ledger_entries ledger_entries_no_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ledger_entries_no_delete BEFORE DELETE ON public.ledger_entries FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_mutation();


--
-- Name: ledger_entries ledger_entries_no_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ledger_entries_no_update BEFORE UPDATE ON public.ledger_entries FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_mutation();


--
-- Name: marketing_automations marketing_automations_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER marketing_automations_touch BEFORE UPDATE ON public.marketing_automations FOR EACH ROW EXECUTE FUNCTION public.marketing_touch_updated_at();


--
-- Name: marketing_campaigns marketing_campaigns_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER marketing_campaigns_touch BEFORE UPDATE ON public.marketing_campaigns FOR EACH ROW EXECUTE FUNCTION public.marketing_touch_updated_at();


--
-- Name: marketing_contacts marketing_contacts_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER marketing_contacts_touch BEFORE UPDATE ON public.marketing_contacts FOR EACH ROW EXECUTE FUNCTION public.marketing_touch_updated_at();


--
-- Name: marketing_campaign_plan_assets marketing_cpa_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER marketing_cpa_touch BEFORE UPDATE ON public.marketing_campaign_plan_assets FOR EACH ROW EXECUTE FUNCTION public.marketing_touch_updated_at();


--
-- Name: marketing_campaign_plans marketing_cplans_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER marketing_cplans_touch BEFORE UPDATE ON public.marketing_campaign_plans FOR EACH ROW EXECUTE FUNCTION public.marketing_touch_updated_at();


--
-- Name: marketing_email_templates marketing_email_templates_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER marketing_email_templates_touch BEFORE UPDATE ON public.marketing_email_templates FOR EACH ROW EXECUTE FUNCTION public.marketing_touch_updated_at();


--
-- Name: marketing_forms marketing_forms_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER marketing_forms_touch BEFORE UPDATE ON public.marketing_forms FOR EACH ROW EXECUTE FUNCTION public.marketing_touch_updated_at();


--
-- Name: marketing_goals marketing_goals_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER marketing_goals_touch BEFORE UPDATE ON public.marketing_goals FOR EACH ROW EXECUTE FUNCTION public.marketing_touch_updated_at();


--
-- Name: marketing_opportunities marketing_opportunities_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER marketing_opportunities_touch BEFORE UPDATE ON public.marketing_opportunities FOR EACH ROW EXECUTE FUNCTION public.marketing_touch_updated_at();


--
-- Name: marketing_segments marketing_segments_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER marketing_segments_touch BEFORE UPDATE ON public.marketing_segments FOR EACH ROW EXECUTE FUNCTION public.marketing_touch_updated_at();


--
-- Name: matching_claims matching_claims_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER matching_claims_updated_at BEFORE UPDATE ON public.matching_claims FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: matching_programs matching_programs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER matching_programs_updated_at BEFORE UPDATE ON public.matching_programs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: membership_tiers membership_tiers_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER membership_tiers_set_updated_at BEFORE UPDATE ON public.membership_tiers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: nonprofit_profiles nonprofit_profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER nonprofit_profiles_set_updated_at BEFORE UPDATE ON public.nonprofit_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: payouts payouts_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER payouts_set_updated_at BEFORE UPDATE ON public.payouts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: privacy_requests privacy_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER privacy_requests_updated_at BEFORE UPDATE ON public.privacy_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles protect_profile_privileged_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_profile_privileged_fields BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_fields();


--
-- Name: reconciliation_exceptions reconciliation_exceptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reconciliation_exceptions_updated_at BEFORE UPDATE ON public.reconciliation_exceptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: recurring_donations recurring_donations_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER recurring_donations_set_updated_at BEFORE UPDATE ON public.recurring_donations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: reward_tiers reward_tiers_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reward_tiers_set_updated_at BEFORE UPDATE ON public.reward_tiers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: risk_flags risk_flags_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER risk_flags_set_updated_at BEFORE UPDATE ON public.risk_flags FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: seo_settings seo_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER seo_settings_updated_at BEFORE UPDATE ON public.seo_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_owner_payouts set_updated_at_campaign_owner_payouts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_campaign_owner_payouts BEFORE UPDATE ON public.campaign_owner_payouts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_owner_transfers set_updated_at_campaign_owner_transfers; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_campaign_owner_transfers BEFORE UPDATE ON public.campaign_owner_transfers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_payment_admin_notes set_updated_at_campaign_payment_admin_notes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_campaign_payment_admin_notes BEFORE UPDATE ON public.campaign_payment_admin_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_payment_audit_logs set_updated_at_campaign_payment_audit_logs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_campaign_payment_audit_logs BEFORE UPDATE ON public.campaign_payment_audit_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_payment_breakdowns set_updated_at_campaign_payment_breakdowns; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_campaign_payment_breakdowns BEFORE UPDATE ON public.campaign_payment_breakdowns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_payment_disputes set_updated_at_campaign_payment_disputes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_campaign_payment_disputes BEFORE UPDATE ON public.campaign_payment_disputes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_payment_events set_updated_at_campaign_payment_events; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_campaign_payment_events BEFORE UPDATE ON public.campaign_payment_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_payment_exports set_updated_at_campaign_payment_exports; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_campaign_payment_exports BEFORE UPDATE ON public.campaign_payment_exports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_payment_reconciliation set_updated_at_campaign_payment_reconciliation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_campaign_payment_reconciliation BEFORE UPDATE ON public.campaign_payment_reconciliation FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_payment_refunds set_updated_at_campaign_payment_refunds; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_campaign_payment_refunds BEFORE UPDATE ON public.campaign_payment_refunds FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_payment_settings set_updated_at_campaign_payment_settings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_campaign_payment_settings BEFORE UPDATE ON public.campaign_payment_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_payment_webhook_events set_updated_at_campaign_payment_webhook_events; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_campaign_payment_webhook_events BEFORE UPDATE ON public.campaign_payment_webhook_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_payments set_updated_at_campaign_payments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_campaign_payments BEFORE UPDATE ON public.campaign_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_platform_fees set_updated_at_campaign_platform_fees; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_campaign_platform_fees BEFORE UPDATE ON public.campaign_platform_fees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_processor_fees set_updated_at_campaign_processor_fees; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_campaign_processor_fees BEFORE UPDATE ON public.campaign_processor_fees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: payment_processors set_updated_at_payment_processors; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_payment_processors BEFORE UPDATE ON public.payment_processors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: processor_accounts set_updated_at_processor_accounts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_processor_accounts BEFORE UPDATE ON public.processor_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: support_cases set_updated_at_support; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_support BEFORE UPDATE ON public.support_cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: support_cases set_updated_at_support_cases; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_support_cases BEFORE UPDATE ON public.support_cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sponsors sponsors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sponsors_updated_at BEFORE UPDATE ON public.sponsors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sponsorship_opportunities sponsorship_opportunities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sponsorship_opportunities_updated_at BEFORE UPDATE ON public.sponsorship_opportunities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sponsorship_requests sponsorship_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sponsorship_requests_updated_at BEFORE UPDATE ON public.sponsorship_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: subscriptions subscriptions_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: volunteer_applications vol_app_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER vol_app_set_updated_at BEFORE UPDATE ON public.volunteer_applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: volunteer_opportunities vol_opp_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER vol_opp_set_updated_at BEFORE UPDATE ON public.volunteer_opportunities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: volunteer_profiles vol_profile_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER vol_profile_set_updated_at BEFORE UPDATE ON public.volunteer_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: volunteer_hours volunteer_hours_verify_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER volunteer_hours_verify_guard BEFORE UPDATE ON public.volunteer_hours FOR EACH ROW EXECUTE FUNCTION public.volunteer_hours_guard_verification();


--
-- Name: admin_notes admin_notes_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notes
    ADD CONSTRAINT admin_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: admin_reviews admin_reviews_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_reviews
    ADD CONSTRAINT admin_reviews_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: admin_reviews admin_reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_reviews
    ADD CONSTRAINT admin_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: admin_reviews admin_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_reviews
    ADD CONSTRAINT admin_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: aeo_entries aeo_entries_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aeo_entries
    ADD CONSTRAINT aeo_entries_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: ai_generations ai_generations_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_generations
    ADD CONSTRAINT ai_generations_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: ai_generations ai_generations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_generations
    ADD CONSTRAINT ai_generations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: analytics_snapshots analytics_snapshots_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_snapshots
    ADD CONSTRAINT analytics_snapshots_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: analytics_snapshots analytics_snapshots_creator_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_snapshots
    ADD CONSTRAINT analytics_snapshots_creator_profile_id_fkey FOREIGN KEY (creator_profile_id) REFERENCES public.creator_profiles(id) ON DELETE CASCADE;


--
-- Name: analytics_snapshots analytics_snapshots_nonprofit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_snapshots
    ADD CONSTRAINT analytics_snapshots_nonprofit_id_fkey FOREIGN KEY (nonprofit_id) REFERENCES public.nonprofit_profiles(id) ON DELETE CASCADE;


--
-- Name: analytics_snapshots analytics_snapshots_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_snapshots
    ADD CONSTRAINT analytics_snapshots_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: announcements announcements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: api_keys api_keys_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: auction_bids auction_bids_bidder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auction_bids
    ADD CONSTRAINT auction_bids_bidder_id_fkey FOREIGN KEY (bidder_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: auction_bids auction_bids_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auction_bids
    ADD CONSTRAINT auction_bids_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.auction_items(id) ON DELETE CASCADE;


--
-- Name: auction_items auction_items_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auction_items
    ADD CONSTRAINT auction_items_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.fundraising_events(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: banner_settings banner_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banner_settings
    ADD CONSTRAINT banner_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: beneficiary_invites beneficiary_invites_beneficiary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiary_invites
    ADD CONSTRAINT beneficiary_invites_beneficiary_id_fkey FOREIGN KEY (beneficiary_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: beneficiary_invites beneficiary_invites_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiary_invites
    ADD CONSTRAINT beneficiary_invites_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: beneficiary_invites beneficiary_invites_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiary_invites
    ADD CONSTRAINT beneficiary_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: brands brands_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: business_leads business_leads_marketing_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_leads
    ADD CONSTRAINT business_leads_marketing_contact_id_fkey FOREIGN KEY (marketing_contact_id) REFERENCES public.marketing_contacts(id) ON DELETE SET NULL;


--
-- Name: campaign_analytics_events campaign_analytics_events_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_analytics_events
    ADD CONSTRAINT campaign_analytics_events_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_builder_events campaign_builder_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_builder_events
    ADD CONSTRAINT campaign_builder_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: campaign_faqs campaign_faqs_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_faqs
    ADD CONSTRAINT campaign_faqs_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_launch_settings campaign_launch_settings_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_launch_settings
    ADD CONSTRAINT campaign_launch_settings_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_media campaign_media_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_media
    ADD CONSTRAINT campaign_media_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_media campaign_media_uploader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_media
    ADD CONSTRAINT campaign_media_uploader_id_fkey FOREIGN KEY (uploader_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: campaign_milestones campaign_milestones_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_milestones
    ADD CONSTRAINT campaign_milestones_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_owner_payouts campaign_owner_payouts_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_owner_payouts
    ADD CONSTRAINT campaign_owner_payouts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: campaign_owner_payouts campaign_owner_payouts_campaign_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_owner_payouts
    ADD CONSTRAINT campaign_owner_payouts_campaign_owner_id_fkey FOREIGN KEY (campaign_owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_owner_payouts campaign_owner_payouts_campaign_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_owner_payouts
    ADD CONSTRAINT campaign_owner_payouts_campaign_payment_id_fkey FOREIGN KEY (campaign_payment_id) REFERENCES public.campaign_payments(id) ON DELETE SET NULL;


--
-- Name: campaign_owner_payouts campaign_owner_payouts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_owner_payouts
    ADD CONSTRAINT campaign_owner_payouts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_owner_payouts campaign_owner_payouts_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_owner_payouts
    ADD CONSTRAINT campaign_owner_payouts_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_owner_payouts campaign_owner_payouts_payout_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_owner_payouts
    ADD CONSTRAINT campaign_owner_payouts_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES public.payouts(id) ON DELETE SET NULL;


--
-- Name: campaign_owner_payouts campaign_owner_payouts_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_owner_payouts
    ADD CONSTRAINT campaign_owner_payouts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_owner_replies campaign_owner_replies_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_owner_replies
    ADD CONSTRAINT campaign_owner_replies_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_owner_replies campaign_owner_replies_donor_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_owner_replies
    ADD CONSTRAINT campaign_owner_replies_donor_message_id_fkey FOREIGN KEY (donor_message_id) REFERENCES public.donor_messages(id) ON DELETE SET NULL;


--
-- Name: campaign_owner_replies campaign_owner_replies_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_owner_replies
    ADD CONSTRAINT campaign_owner_replies_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: campaign_owner_transfers campaign_owner_transfers_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_owner_transfers
    ADD CONSTRAINT campaign_owner_transfers_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: campaign_owner_transfers campaign_owner_transfers_campaign_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_owner_transfers
    ADD CONSTRAINT campaign_owner_transfers_campaign_owner_id_fkey FOREIGN KEY (campaign_owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_owner_transfers campaign_owner_transfers_campaign_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_owner_transfers
    ADD CONSTRAINT campaign_owner_transfers_campaign_payment_id_fkey FOREIGN KEY (campaign_payment_id) REFERENCES public.campaign_payments(id) ON DELETE CASCADE;


--
-- Name: campaign_owner_transfers campaign_owner_transfers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_owner_transfers
    ADD CONSTRAINT campaign_owner_transfers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_owner_transfers campaign_owner_transfers_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_owner_transfers
    ADD CONSTRAINT campaign_owner_transfers_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_owner_transfers campaign_owner_transfers_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_owner_transfers
    ADD CONSTRAINT campaign_owner_transfers_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_admin_notes campaign_payment_admin_notes_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_admin_notes
    ADD CONSTRAINT campaign_payment_admin_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_admin_notes campaign_payment_admin_notes_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_admin_notes
    ADD CONSTRAINT campaign_payment_admin_notes_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_admin_notes campaign_payment_admin_notes_campaign_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_admin_notes
    ADD CONSTRAINT campaign_payment_admin_notes_campaign_owner_id_fkey FOREIGN KEY (campaign_owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_admin_notes campaign_payment_admin_notes_campaign_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_admin_notes
    ADD CONSTRAINT campaign_payment_admin_notes_campaign_payment_id_fkey FOREIGN KEY (campaign_payment_id) REFERENCES public.campaign_payments(id) ON DELETE CASCADE;


--
-- Name: campaign_payment_admin_notes campaign_payment_admin_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_admin_notes
    ADD CONSTRAINT campaign_payment_admin_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_admin_notes campaign_payment_admin_notes_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_admin_notes
    ADD CONSTRAINT campaign_payment_admin_notes_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_admin_notes campaign_payment_admin_notes_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_admin_notes
    ADD CONSTRAINT campaign_payment_admin_notes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_audit_logs campaign_payment_audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_audit_logs
    ADD CONSTRAINT campaign_payment_audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_audit_logs campaign_payment_audit_logs_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_audit_logs
    ADD CONSTRAINT campaign_payment_audit_logs_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_audit_logs campaign_payment_audit_logs_campaign_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_audit_logs
    ADD CONSTRAINT campaign_payment_audit_logs_campaign_owner_id_fkey FOREIGN KEY (campaign_owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_audit_logs campaign_payment_audit_logs_campaign_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_audit_logs
    ADD CONSTRAINT campaign_payment_audit_logs_campaign_payment_id_fkey FOREIGN KEY (campaign_payment_id) REFERENCES public.campaign_payments(id) ON DELETE CASCADE;


--
-- Name: campaign_payment_audit_logs campaign_payment_audit_logs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_audit_logs
    ADD CONSTRAINT campaign_payment_audit_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_audit_logs campaign_payment_audit_logs_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_audit_logs
    ADD CONSTRAINT campaign_payment_audit_logs_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_audit_logs campaign_payment_audit_logs_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_audit_logs
    ADD CONSTRAINT campaign_payment_audit_logs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_breakdowns campaign_payment_breakdowns_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_breakdowns
    ADD CONSTRAINT campaign_payment_breakdowns_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_breakdowns campaign_payment_breakdowns_campaign_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_breakdowns
    ADD CONSTRAINT campaign_payment_breakdowns_campaign_owner_id_fkey FOREIGN KEY (campaign_owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_breakdowns campaign_payment_breakdowns_campaign_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_breakdowns
    ADD CONSTRAINT campaign_payment_breakdowns_campaign_payment_id_fkey FOREIGN KEY (campaign_payment_id) REFERENCES public.campaign_payments(id) ON DELETE CASCADE;


--
-- Name: campaign_payment_breakdowns campaign_payment_breakdowns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_breakdowns
    ADD CONSTRAINT campaign_payment_breakdowns_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_breakdowns campaign_payment_breakdowns_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_breakdowns
    ADD CONSTRAINT campaign_payment_breakdowns_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_breakdowns campaign_payment_breakdowns_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_breakdowns
    ADD CONSTRAINT campaign_payment_breakdowns_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_disputes campaign_payment_disputes_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_disputes
    ADD CONSTRAINT campaign_payment_disputes_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_disputes campaign_payment_disputes_campaign_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_disputes
    ADD CONSTRAINT campaign_payment_disputes_campaign_owner_id_fkey FOREIGN KEY (campaign_owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_disputes campaign_payment_disputes_campaign_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_disputes
    ADD CONSTRAINT campaign_payment_disputes_campaign_payment_id_fkey FOREIGN KEY (campaign_payment_id) REFERENCES public.campaign_payments(id) ON DELETE CASCADE;


--
-- Name: campaign_payment_disputes campaign_payment_disputes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_disputes
    ADD CONSTRAINT campaign_payment_disputes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_disputes campaign_payment_disputes_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_disputes
    ADD CONSTRAINT campaign_payment_disputes_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_disputes campaign_payment_disputes_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_disputes
    ADD CONSTRAINT campaign_payment_disputes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_events campaign_payment_events_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_events
    ADD CONSTRAINT campaign_payment_events_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_events campaign_payment_events_campaign_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_events
    ADD CONSTRAINT campaign_payment_events_campaign_owner_id_fkey FOREIGN KEY (campaign_owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_events campaign_payment_events_campaign_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_events
    ADD CONSTRAINT campaign_payment_events_campaign_payment_id_fkey FOREIGN KEY (campaign_payment_id) REFERENCES public.campaign_payments(id) ON DELETE CASCADE;


--
-- Name: campaign_payment_events campaign_payment_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_events
    ADD CONSTRAINT campaign_payment_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_events campaign_payment_events_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_events
    ADD CONSTRAINT campaign_payment_events_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_events campaign_payment_events_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_events
    ADD CONSTRAINT campaign_payment_events_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_exports campaign_payment_exports_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_exports
    ADD CONSTRAINT campaign_payment_exports_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_exports campaign_payment_exports_campaign_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_exports
    ADD CONSTRAINT campaign_payment_exports_campaign_owner_id_fkey FOREIGN KEY (campaign_owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_exports campaign_payment_exports_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_exports
    ADD CONSTRAINT campaign_payment_exports_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_exports campaign_payment_exports_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_exports
    ADD CONSTRAINT campaign_payment_exports_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_exports campaign_payment_exports_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_exports
    ADD CONSTRAINT campaign_payment_exports_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_exports campaign_payment_exports_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_exports
    ADD CONSTRAINT campaign_payment_exports_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_reconciliation campaign_payment_reconciliation_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_reconciliation
    ADD CONSTRAINT campaign_payment_reconciliation_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_reconciliation campaign_payment_reconciliation_campaign_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_reconciliation
    ADD CONSTRAINT campaign_payment_reconciliation_campaign_owner_id_fkey FOREIGN KEY (campaign_owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_reconciliation campaign_payment_reconciliation_campaign_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_reconciliation
    ADD CONSTRAINT campaign_payment_reconciliation_campaign_payment_id_fkey FOREIGN KEY (campaign_payment_id) REFERENCES public.campaign_payments(id) ON DELETE CASCADE;


--
-- Name: campaign_payment_reconciliation campaign_payment_reconciliation_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_reconciliation
    ADD CONSTRAINT campaign_payment_reconciliation_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_reconciliation campaign_payment_reconciliation_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_reconciliation
    ADD CONSTRAINT campaign_payment_reconciliation_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_reconciliation campaign_payment_reconciliation_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_reconciliation
    ADD CONSTRAINT campaign_payment_reconciliation_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_refunds campaign_payment_refunds_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_refunds
    ADD CONSTRAINT campaign_payment_refunds_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_refunds campaign_payment_refunds_campaign_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_refunds
    ADD CONSTRAINT campaign_payment_refunds_campaign_owner_id_fkey FOREIGN KEY (campaign_owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_refunds campaign_payment_refunds_campaign_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_refunds
    ADD CONSTRAINT campaign_payment_refunds_campaign_payment_id_fkey FOREIGN KEY (campaign_payment_id) REFERENCES public.campaign_payments(id) ON DELETE CASCADE;


--
-- Name: campaign_payment_refunds campaign_payment_refunds_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_refunds
    ADD CONSTRAINT campaign_payment_refunds_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_refunds campaign_payment_refunds_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_refunds
    ADD CONSTRAINT campaign_payment_refunds_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_refunds campaign_payment_refunds_refund_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_refunds
    ADD CONSTRAINT campaign_payment_refunds_refund_id_fkey FOREIGN KEY (refund_id) REFERENCES public.refunds(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_refunds campaign_payment_refunds_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_refunds
    ADD CONSTRAINT campaign_payment_refunds_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_settings campaign_payment_settings_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_settings
    ADD CONSTRAINT campaign_payment_settings_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_payment_settings campaign_payment_settings_campaign_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_settings
    ADD CONSTRAINT campaign_payment_settings_campaign_owner_id_fkey FOREIGN KEY (campaign_owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_settings campaign_payment_settings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_settings
    ADD CONSTRAINT campaign_payment_settings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_settings campaign_payment_settings_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_settings
    ADD CONSTRAINT campaign_payment_settings_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_settings campaign_payment_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_settings
    ADD CONSTRAINT campaign_payment_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_webhook_events campaign_payment_webhook_events_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_webhook_events
    ADD CONSTRAINT campaign_payment_webhook_events_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_webhook_events campaign_payment_webhook_events_campaign_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_webhook_events
    ADD CONSTRAINT campaign_payment_webhook_events_campaign_owner_id_fkey FOREIGN KEY (campaign_owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_webhook_events campaign_payment_webhook_events_campaign_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_webhook_events
    ADD CONSTRAINT campaign_payment_webhook_events_campaign_payment_id_fkey FOREIGN KEY (campaign_payment_id) REFERENCES public.campaign_payments(id) ON DELETE CASCADE;


--
-- Name: campaign_payment_webhook_events campaign_payment_webhook_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_webhook_events
    ADD CONSTRAINT campaign_payment_webhook_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_webhook_events campaign_payment_webhook_events_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_webhook_events
    ADD CONSTRAINT campaign_payment_webhook_events_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_webhook_events campaign_payment_webhook_events_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_webhook_events
    ADD CONSTRAINT campaign_payment_webhook_events_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payment_webhook_events campaign_payment_webhook_events_webhook_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payment_webhook_events
    ADD CONSTRAINT campaign_payment_webhook_events_webhook_event_id_fkey FOREIGN KEY (webhook_event_id) REFERENCES public.webhook_events(id) ON DELETE SET NULL;


--
-- Name: campaign_payments campaign_payments_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payments
    ADD CONSTRAINT campaign_payments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: campaign_payments campaign_payments_campaign_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payments
    ADD CONSTRAINT campaign_payments_campaign_owner_id_fkey FOREIGN KEY (campaign_owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payments campaign_payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payments
    ADD CONSTRAINT campaign_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payments campaign_payments_donation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payments
    ADD CONSTRAINT campaign_payments_donation_id_fkey FOREIGN KEY (donation_id) REFERENCES public.donations(id) ON DELETE SET NULL;


--
-- Name: campaign_payments campaign_payments_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payments
    ADD CONSTRAINT campaign_payments_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_payments campaign_payments_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_payments
    ADD CONSTRAINT campaign_payments_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_platform_fees campaign_platform_fees_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_platform_fees
    ADD CONSTRAINT campaign_platform_fees_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: campaign_platform_fees campaign_platform_fees_campaign_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_platform_fees
    ADD CONSTRAINT campaign_platform_fees_campaign_owner_id_fkey FOREIGN KEY (campaign_owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_platform_fees campaign_platform_fees_campaign_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_platform_fees
    ADD CONSTRAINT campaign_platform_fees_campaign_payment_id_fkey FOREIGN KEY (campaign_payment_id) REFERENCES public.campaign_payments(id) ON DELETE CASCADE;


--
-- Name: campaign_platform_fees campaign_platform_fees_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_platform_fees
    ADD CONSTRAINT campaign_platform_fees_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_platform_fees campaign_platform_fees_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_platform_fees
    ADD CONSTRAINT campaign_platform_fees_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_platform_fees campaign_platform_fees_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_platform_fees
    ADD CONSTRAINT campaign_platform_fees_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_processor_fees campaign_processor_fees_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_processor_fees
    ADD CONSTRAINT campaign_processor_fees_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: campaign_processor_fees campaign_processor_fees_campaign_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_processor_fees
    ADD CONSTRAINT campaign_processor_fees_campaign_owner_id_fkey FOREIGN KEY (campaign_owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_processor_fees campaign_processor_fees_campaign_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_processor_fees
    ADD CONSTRAINT campaign_processor_fees_campaign_payment_id_fkey FOREIGN KEY (campaign_payment_id) REFERENCES public.campaign_payments(id) ON DELETE CASCADE;


--
-- Name: campaign_processor_fees campaign_processor_fees_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_processor_fees
    ADD CONSTRAINT campaign_processor_fees_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_processor_fees campaign_processor_fees_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_processor_fees
    ADD CONSTRAINT campaign_processor_fees_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_processor_fees campaign_processor_fees_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_processor_fees
    ADD CONSTRAINT campaign_processor_fees_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_reports campaign_reports_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_reports
    ADD CONSTRAINT campaign_reports_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_reports campaign_reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_reports
    ADD CONSTRAINT campaign_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_rewards campaign_rewards_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_rewards
    ADD CONSTRAINT campaign_rewards_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_status_log campaign_status_log_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_status_log
    ADD CONSTRAINT campaign_status_log_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_status_log campaign_status_log_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_status_log
    ADD CONSTRAINT campaign_status_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_updates campaign_updates_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_updates
    ADD CONSTRAINT campaign_updates_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_updates campaign_updates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_updates
    ADD CONSTRAINT campaign_updates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: campaign_wizard_drafts campaign_wizard_drafts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_wizard_drafts
    ADD CONSTRAINT campaign_wizard_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: campaigns campaigns_beneficiary_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_beneficiary_profile_id_fkey FOREIGN KEY (beneficiary_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaigns campaigns_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: challenge_participants challenge_participants_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participants
    ADD CONSTRAINT challenge_participants_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: challenge_participants challenge_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participants
    ADD CONSTRAINT challenge_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: coach_sessions coach_sessions_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_sessions
    ADD CONSTRAINT coach_sessions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: coach_sessions coach_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_sessions
    ADD CONSTRAINT coach_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: commission_requests commission_requests_creator_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_requests
    ADD CONSTRAINT commission_requests_creator_profile_id_fkey FOREIGN KEY (creator_profile_id) REFERENCES public.creator_profiles(id) ON DELETE CASCADE;


--
-- Name: commission_requests commission_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_requests
    ADD CONSTRAINT commission_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: connected_accounts connected_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connected_accounts
    ADD CONSTRAINT connected_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: creator_profiles creator_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_profiles
    ADD CONSTRAINT creator_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: creator_tips creator_tips_creator_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_tips
    ADD CONSTRAINT creator_tips_creator_profile_id_fkey FOREIGN KEY (creator_profile_id) REFERENCES public.creator_profiles(id) ON DELETE CASCADE;


--
-- Name: creator_tips creator_tips_supporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_tips
    ADD CONSTRAINT creator_tips_supporter_id_fkey FOREIGN KEY (supporter_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: digital_products digital_products_creator_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_products
    ADD CONSTRAINT digital_products_creator_profile_id_fkey FOREIGN KEY (creator_profile_id) REFERENCES public.creator_profiles(id) ON DELETE CASCADE;


--
-- Name: direct_messages direct_messages_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: direct_messages direct_messages_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: direct_messages direct_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: donation_forms donation_forms_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donation_forms
    ADD CONSTRAINT donation_forms_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: donation_forms donation_forms_nonprofit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donation_forms
    ADD CONSTRAINT donation_forms_nonprofit_id_fkey FOREIGN KEY (nonprofit_id) REFERENCES public.nonprofit_profiles(id) ON DELETE CASCADE;


--
-- Name: donation_receipts donation_receipts_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donation_receipts
    ADD CONSTRAINT donation_receipts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: donation_receipts donation_receipts_donation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donation_receipts
    ADD CONSTRAINT donation_receipts_donation_id_fkey FOREIGN KEY (donation_id) REFERENCES public.donations(id) ON DELETE CASCADE;


--
-- Name: donation_receipts donation_receipts_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donation_receipts
    ADD CONSTRAINT donation_receipts_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: donations donations_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: donations donations_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: donations donations_peer_fundraiser_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_peer_fundraiser_id_fkey FOREIGN KEY (peer_fundraiser_id) REFERENCES public.peer_fundraisers(id) ON DELETE SET NULL;


--
-- Name: donations donations_reward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_reward_id_fkey FOREIGN KEY (reward_id) REFERENCES public.campaign_rewards(id) ON DELETE SET NULL;


--
-- Name: donor_crm_contacts donor_crm_contacts_nonprofit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donor_crm_contacts
    ADD CONSTRAINT donor_crm_contacts_nonprofit_id_fkey FOREIGN KEY (nonprofit_id) REFERENCES public.nonprofit_profiles(id) ON DELETE CASCADE;


--
-- Name: donor_crm_contacts donor_crm_contacts_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donor_crm_contacts
    ADD CONSTRAINT donor_crm_contacts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: donor_message_likes donor_message_likes_donor_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donor_message_likes
    ADD CONSTRAINT donor_message_likes_donor_message_id_fkey FOREIGN KEY (donor_message_id) REFERENCES public.donor_messages(id) ON DELETE CASCADE;


--
-- Name: donor_message_likes donor_message_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donor_message_likes
    ADD CONSTRAINT donor_message_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: donor_messages donor_messages_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donor_messages
    ADD CONSTRAINT donor_messages_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: donor_messages donor_messages_donation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donor_messages
    ADD CONSTRAINT donor_messages_donation_id_fkey FOREIGN KEY (donation_id) REFERENCES public.donations(id) ON DELETE CASCADE;


--
-- Name: donor_messages donor_messages_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donor_messages
    ADD CONSTRAINT donor_messages_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: donor_segment_members donor_segment_members_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donor_segment_members
    ADD CONSTRAINT donor_segment_members_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.donor_crm_contacts(id) ON DELETE CASCADE;


--
-- Name: donor_segment_members donor_segment_members_segment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donor_segment_members
    ADD CONSTRAINT donor_segment_members_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES public.donor_segments(id) ON DELETE CASCADE;


--
-- Name: donor_segments donor_segments_nonprofit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donor_segments
    ADD CONSTRAINT donor_segments_nonprofit_id_fkey FOREIGN KEY (nonprofit_id) REFERENCES public.nonprofit_profiles(id) ON DELETE CASCADE;


--
-- Name: donor_tips donor_tips_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donor_tips
    ADD CONSTRAINT donor_tips_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: donor_tips donor_tips_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donor_tips
    ADD CONSTRAINT donor_tips_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: email_campaigns email_campaigns_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_campaigns
    ADD CONSTRAINT email_campaigns_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: email_campaigns email_campaigns_nonprofit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_campaigns
    ADD CONSTRAINT email_campaigns_nonprofit_id_fkey FOREIGN KEY (nonprofit_id) REFERENCES public.nonprofit_profiles(id) ON DELETE CASCADE;


--
-- Name: email_campaigns email_campaigns_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_campaigns
    ADD CONSTRAINT email_campaigns_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: embedded_buttons embedded_buttons_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embedded_buttons
    ADD CONSTRAINT embedded_buttons_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: embedded_buttons embedded_buttons_creator_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embedded_buttons
    ADD CONSTRAINT embedded_buttons_creator_profile_id_fkey FOREIGN KEY (creator_profile_id) REFERENCES public.creator_profiles(id) ON DELETE CASCADE;


--
-- Name: embedded_buttons embedded_buttons_donation_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embedded_buttons
    ADD CONSTRAINT embedded_buttons_donation_form_id_fkey FOREIGN KEY (donation_form_id) REFERENCES public.donation_forms(id) ON DELETE CASCADE;


--
-- Name: embedded_buttons embedded_buttons_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embedded_buttons
    ADD CONSTRAINT embedded_buttons_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: event_checkins event_checkins_checked_in_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_checkins
    ADD CONSTRAINT event_checkins_checked_in_by_fkey FOREIGN KEY (checked_in_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: event_checkins event_checkins_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_checkins
    ADD CONSTRAINT event_checkins_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.fundraising_events(id) ON DELETE CASCADE;


--
-- Name: event_checkins event_checkins_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_checkins
    ADD CONSTRAINT event_checkins_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.event_registrations(id) ON DELETE CASCADE;


--
-- Name: event_registrations event_registrations_attendee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT event_registrations_attendee_id_fkey FOREIGN KEY (attendee_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: event_registrations event_registrations_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT event_registrations_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.fundraising_events(id) ON DELETE CASCADE;


--
-- Name: event_registrations event_registrations_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT event_registrations_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.event_tickets(id) ON DELETE SET NULL;


--
-- Name: event_tickets event_tickets_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_tickets
    ADD CONSTRAINT event_tickets_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.fundraising_events(id) ON DELETE CASCADE;


--
-- Name: exclusive_posts exclusive_posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exclusive_posts
    ADD CONSTRAINT exclusive_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: exclusive_posts exclusive_posts_creator_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exclusive_posts
    ADD CONSTRAINT exclusive_posts_creator_profile_id_fkey FOREIGN KEY (creator_profile_id) REFERENCES public.creator_profiles(id) ON DELETE CASCADE;


--
-- Name: exclusive_posts exclusive_posts_minimum_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exclusive_posts
    ADD CONSTRAINT exclusive_posts_minimum_tier_id_fkey FOREIGN KEY (minimum_tier_id) REFERENCES public.membership_tiers(id) ON DELETE SET NULL;


--
-- Name: exclusive_posts exclusive_posts_nonprofit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exclusive_posts
    ADD CONSTRAINT exclusive_posts_nonprofit_id_fkey FOREIGN KEY (nonprofit_id) REFERENCES public.nonprofit_profiles(id) ON DELETE CASCADE;


--
-- Name: feature_flags feature_flags_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: fundraising_events fundraising_events_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fundraising_events
    ADD CONSTRAINT fundraising_events_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: fundraising_events fundraising_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fundraising_events
    ADD CONSTRAINT fundraising_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: fundraising_events fundraising_events_nonprofit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fundraising_events
    ADD CONSTRAINT fundraising_events_nonprofit_id_fkey FOREIGN KEY (nonprofit_id) REFERENCES public.nonprofit_profiles(id) ON DELETE CASCADE;


--
-- Name: giving_days giving_days_nonprofit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giving_days
    ADD CONSTRAINT giving_days_nonprofit_id_fkey FOREIGN KEY (nonprofit_id) REFERENCES public.nonprofit_profiles(id) ON DELETE CASCADE;


--
-- Name: grant_applications grant_applications_applicant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grant_applications
    ADD CONSTRAINT grant_applications_applicant_user_id_fkey FOREIGN KEY (applicant_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: grant_applications grant_applications_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grant_applications
    ADD CONSTRAINT grant_applications_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: grant_applications grant_applications_grant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grant_applications
    ADD CONSTRAINT grant_applications_grant_id_fkey FOREIGN KEY (grant_id) REFERENCES public.grants(id) ON DELETE CASCADE;


--
-- Name: grant_deadlines grant_deadlines_grant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grant_deadlines
    ADD CONSTRAINT grant_deadlines_grant_id_fkey FOREIGN KEY (grant_id) REFERENCES public.grants(id) ON DELETE CASCADE;


--
-- Name: grant_documents grant_documents_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grant_documents
    ADD CONSTRAINT grant_documents_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.grant_applications(id) ON DELETE CASCADE;


--
-- Name: grant_documents grant_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grant_documents
    ADD CONSTRAINT grant_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: grant_matches grant_matches_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grant_matches
    ADD CONSTRAINT grant_matches_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: grant_matches grant_matches_grant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grant_matches
    ADD CONSTRAINT grant_matches_grant_id_fkey FOREIGN KEY (grant_id) REFERENCES public.grants(id) ON DELETE CASCADE;


--
-- Name: grant_matches grant_matches_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grant_matches
    ADD CONSTRAINT grant_matches_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: grants grants_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grants
    ADD CONSTRAINT grants_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: impact_evidence impact_evidence_update_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.impact_evidence
    ADD CONSTRAINT impact_evidence_update_id_fkey FOREIGN KEY (update_id) REFERENCES public.impact_updates(id) ON DELETE CASCADE;


--
-- Name: impact_metrics impact_metrics_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.impact_metrics
    ADD CONSTRAINT impact_metrics_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: impact_plan_items impact_plan_items_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.impact_plan_items
    ADD CONSTRAINT impact_plan_items_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.impact_plans(id) ON DELETE CASCADE;


--
-- Name: impact_plans impact_plans_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.impact_plans
    ADD CONSTRAINT impact_plans_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: impact_plans impact_plans_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.impact_plans
    ADD CONSTRAINT impact_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: impact_updates impact_updates_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.impact_updates
    ADD CONSTRAINT impact_updates_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: impact_updates impact_updates_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.impact_updates
    ADD CONSTRAINT impact_updates_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: integration_connections integration_connections_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_connections
    ADD CONSTRAINT integration_connections_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: lead_outreach lead_outreach_business_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_outreach
    ADD CONSTRAINT lead_outreach_business_lead_id_fkey FOREIGN KEY (business_lead_id) REFERENCES public.business_leads(id) ON DELETE CASCADE;


--
-- Name: lead_outreach lead_outreach_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_outreach
    ADD CONSTRAINT lead_outreach_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: lead_outreach lead_outreach_marketing_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_outreach
    ADD CONSTRAINT lead_outreach_marketing_contact_id_fkey FOREIGN KEY (marketing_contact_id) REFERENCES public.marketing_contacts(id) ON DELETE SET NULL;


--
-- Name: lead_outreach lead_outreach_utm_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_outreach
    ADD CONSTRAINT lead_outreach_utm_link_id_fkey FOREIGN KEY (utm_link_id) REFERENCES public.marketing_utm_links(id) ON DELETE SET NULL;


--
-- Name: ledger_entries ledger_entries_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: ledger_entries ledger_entries_donation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_donation_id_fkey FOREIGN KEY (donation_id) REFERENCES public.donations(id) ON DELETE SET NULL;


--
-- Name: ledger_entries ledger_entries_recipient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: livestreams livestreams_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.livestreams
    ADD CONSTRAINT livestreams_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: livestreams livestreams_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.livestreams
    ADD CONSTRAINT livestreams_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.fundraising_events(id) ON DELETE CASCADE;


--
-- Name: marketing_audit_logs marketing_audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_audit_logs
    ADD CONSTRAINT marketing_audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: marketing_audit_logs marketing_audit_logs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_audit_logs
    ADD CONSTRAINT marketing_audit_logs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_automation_runs marketing_automation_runs_automation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_automation_runs
    ADD CONSTRAINT marketing_automation_runs_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.marketing_automations(id) ON DELETE CASCADE;


--
-- Name: marketing_automation_runs marketing_automation_runs_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_automation_runs
    ADD CONSTRAINT marketing_automation_runs_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.marketing_contacts(id) ON DELETE SET NULL;


--
-- Name: marketing_automations marketing_automations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_automations
    ADD CONSTRAINT marketing_automations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: marketing_automations marketing_automations_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_automations
    ADD CONSTRAINT marketing_automations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_campaign_plan_assets marketing_campaign_plan_assets_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaign_plan_assets
    ADD CONSTRAINT marketing_campaign_plan_assets_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.marketing_campaign_plans(id) ON DELETE CASCADE;


--
-- Name: marketing_campaign_plans marketing_campaign_plans_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaign_plans
    ADD CONSTRAINT marketing_campaign_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: marketing_campaign_plans marketing_campaign_plans_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaign_plans
    ADD CONSTRAINT marketing_campaign_plans_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.marketing_goals(id) ON DELETE SET NULL;


--
-- Name: marketing_campaign_plans marketing_campaign_plans_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaign_plans
    ADD CONSTRAINT marketing_campaign_plans_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_campaign_recipients marketing_campaign_recipients_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaign_recipients
    ADD CONSTRAINT marketing_campaign_recipients_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;


--
-- Name: marketing_campaign_recipients marketing_campaign_recipients_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaign_recipients
    ADD CONSTRAINT marketing_campaign_recipients_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.marketing_contacts(id) ON DELETE CASCADE;


--
-- Name: marketing_campaigns marketing_campaigns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: marketing_campaigns marketing_campaigns_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_campaigns marketing_campaigns_segment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES public.marketing_segments(id) ON DELETE SET NULL;


--
-- Name: marketing_consent marketing_consent_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_consent
    ADD CONSTRAINT marketing_consent_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.marketing_contacts(id) ON DELETE CASCADE;


--
-- Name: marketing_consent marketing_consent_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_consent
    ADD CONSTRAINT marketing_consent_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_contacts marketing_contacts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_contacts
    ADD CONSTRAINT marketing_contacts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: marketing_contacts marketing_contacts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_contacts
    ADD CONSTRAINT marketing_contacts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_contacts marketing_contacts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_contacts
    ADD CONSTRAINT marketing_contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: marketing_email_templates marketing_email_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_email_templates
    ADD CONSTRAINT marketing_email_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: marketing_email_templates marketing_email_templates_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_email_templates
    ADD CONSTRAINT marketing_email_templates_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_events marketing_events_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_events
    ADD CONSTRAINT marketing_events_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.marketing_contacts(id) ON DELETE CASCADE;


--
-- Name: marketing_events marketing_events_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_events
    ADD CONSTRAINT marketing_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_form_submissions marketing_form_submissions_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_form_submissions
    ADD CONSTRAINT marketing_form_submissions_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.marketing_contacts(id) ON DELETE SET NULL;


--
-- Name: marketing_form_submissions marketing_form_submissions_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_form_submissions
    ADD CONSTRAINT marketing_form_submissions_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.marketing_forms(id) ON DELETE SET NULL;


--
-- Name: marketing_forms marketing_forms_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_forms
    ADD CONSTRAINT marketing_forms_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: marketing_forms marketing_forms_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_forms
    ADD CONSTRAINT marketing_forms_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_goals marketing_goals_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_goals
    ADD CONSTRAINT marketing_goals_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: marketing_goals marketing_goals_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_goals
    ADD CONSTRAINT marketing_goals_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_goals marketing_goals_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_goals
    ADD CONSTRAINT marketing_goals_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: marketing_identities marketing_identities_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_identities
    ADD CONSTRAINT marketing_identities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.marketing_contacts(id) ON DELETE CASCADE;


--
-- Name: marketing_opportunities marketing_opportunities_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_opportunities
    ADD CONSTRAINT marketing_opportunities_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: marketing_opportunities marketing_opportunities_linked_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_opportunities
    ADD CONSTRAINT marketing_opportunities_linked_goal_id_fkey FOREIGN KEY (linked_goal_id) REFERENCES public.marketing_goals(id) ON DELETE SET NULL;


--
-- Name: marketing_opportunities marketing_opportunities_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_opportunities
    ADD CONSTRAINT marketing_opportunities_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_referrals marketing_referrals_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_referrals
    ADD CONSTRAINT marketing_referrals_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_referrals marketing_referrals_referrer_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_referrals
    ADD CONSTRAINT marketing_referrals_referrer_contact_id_fkey FOREIGN KEY (referrer_contact_id) REFERENCES public.marketing_contacts(id) ON DELETE SET NULL;


--
-- Name: marketing_segment_members marketing_segment_members_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_segment_members
    ADD CONSTRAINT marketing_segment_members_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.marketing_contacts(id) ON DELETE CASCADE;


--
-- Name: marketing_segment_members marketing_segment_members_segment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_segment_members
    ADD CONSTRAINT marketing_segment_members_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES public.marketing_segments(id) ON DELETE CASCADE;


--
-- Name: marketing_segments marketing_segments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_segments
    ADD CONSTRAINT marketing_segments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: marketing_segments marketing_segments_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_segments
    ADD CONSTRAINT marketing_segments_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_suppression_list marketing_suppression_list_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_suppression_list
    ADD CONSTRAINT marketing_suppression_list_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_utm_links marketing_utm_links_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_utm_links
    ADD CONSTRAINT marketing_utm_links_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;


--
-- Name: marketing_utm_links marketing_utm_links_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_utm_links
    ADD CONSTRAINT marketing_utm_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: marketing_utm_links marketing_utm_links_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_utm_links
    ADD CONSTRAINT marketing_utm_links_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: matching_claims matching_claims_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matching_claims
    ADD CONSTRAINT matching_claims_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: matching_claims matching_claims_donation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matching_claims
    ADD CONSTRAINT matching_claims_donation_id_fkey FOREIGN KEY (donation_id) REFERENCES public.donations(id) ON DELETE SET NULL;


--
-- Name: matching_claims matching_claims_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matching_claims
    ADD CONSTRAINT matching_claims_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: matching_claims matching_claims_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matching_claims
    ADD CONSTRAINT matching_claims_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.matching_programs(id) ON DELETE CASCADE;


--
-- Name: matching_claims matching_claims_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matching_claims
    ADD CONSTRAINT matching_claims_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: matching_programs matching_programs_sponsor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matching_programs
    ADD CONSTRAINT matching_programs_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: member_subscriptions member_subscriptions_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_subscriptions
    ADD CONSTRAINT member_subscriptions_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: member_subscriptions member_subscriptions_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_subscriptions
    ADD CONSTRAINT member_subscriptions_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.membership_tiers(id) ON DELETE CASCADE;


--
-- Name: membership_tiers membership_tiers_creator_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership_tiers
    ADD CONSTRAINT membership_tiers_creator_profile_id_fkey FOREIGN KEY (creator_profile_id) REFERENCES public.creator_profiles(id) ON DELETE CASCADE;


--
-- Name: membership_tiers membership_tiers_nonprofit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership_tiers
    ADD CONSTRAINT membership_tiers_nonprofit_id_fkey FOREIGN KEY (nonprofit_id) REFERENCES public.nonprofit_profiles(id) ON DELETE CASCADE;


--
-- Name: message_thread_state message_thread_state_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_thread_state
    ADD CONSTRAINT message_thread_state_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: message_thread_state message_thread_state_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_thread_state
    ADD CONSTRAINT message_thread_state_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: nonprofit_profiles nonprofit_profiles_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nonprofit_profiles
    ADD CONSTRAINT nonprofit_profiles_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: organization_members organization_members_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: organizations organizations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: organizer_sends organizer_sends_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_sends
    ADD CONSTRAINT organizer_sends_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: organizer_sends organizer_sends_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_sends
    ADD CONSTRAINT organizer_sends_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: outbound_webhook_endpoints outbound_webhook_endpoints_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbound_webhook_endpoints
    ADD CONSTRAINT outbound_webhook_endpoints_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: payment_processors payment_processors_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_processors
    ADD CONSTRAINT payment_processors_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: payment_processors payment_processors_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_processors
    ADD CONSTRAINT payment_processors_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: payouts payouts_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: payouts payouts_connected_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_connected_account_id_fkey FOREIGN KEY (connected_account_id) REFERENCES public.connected_accounts(id) ON DELETE SET NULL;


--
-- Name: payouts payouts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: peer_fundraisers peer_fundraisers_fundraiser_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_fundraisers
    ADD CONSTRAINT peer_fundraisers_fundraiser_id_fkey FOREIGN KEY (fundraiser_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: peer_fundraisers peer_fundraisers_parent_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_fundraisers
    ADD CONSTRAINT peer_fundraisers_parent_campaign_id_fkey FOREIGN KEY (parent_campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: platform_fees platform_fees_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_fees
    ADD CONSTRAINT platform_fees_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: platform_settings platform_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: privacy_requests privacy_requests_resolver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.privacy_requests
    ADD CONSTRAINT privacy_requests_resolver_id_fkey FOREIGN KEY (resolver_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: privacy_requests privacy_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.privacy_requests
    ADD CONSTRAINT privacy_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: processor_accounts processor_accounts_connected_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processor_accounts
    ADD CONSTRAINT processor_accounts_connected_account_id_fkey FOREIGN KEY (connected_account_id) REFERENCES public.connected_accounts(id) ON DELETE SET NULL;


--
-- Name: processor_accounts processor_accounts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processor_accounts
    ADD CONSTRAINT processor_accounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: processor_accounts processor_accounts_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processor_accounts
    ADD CONSTRAINT processor_accounts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: processor_accounts processor_accounts_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processor_accounts
    ADD CONSTRAINT processor_accounts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: product_orders product_orders_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_orders
    ADD CONSTRAINT product_orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: product_orders product_orders_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_orders
    ADD CONSTRAINT product_orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.digital_products(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reconciliation_exceptions reconciliation_exceptions_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_exceptions
    ADD CONSTRAINT reconciliation_exceptions_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: reconciliation_exceptions reconciliation_exceptions_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_exceptions
    ADD CONSTRAINT reconciliation_exceptions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: reconciliation_exceptions reconciliation_exceptions_donation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_exceptions
    ADD CONSTRAINT reconciliation_exceptions_donation_id_fkey FOREIGN KEY (donation_id) REFERENCES public.donations(id) ON DELETE SET NULL;


--
-- Name: recurring_donations recurring_donations_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_donations
    ADD CONSTRAINT recurring_donations_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: recurring_donations recurring_donations_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_donations
    ADD CONSTRAINT recurring_donations_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: recurring_donations recurring_donations_nonprofit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_donations
    ADD CONSTRAINT recurring_donations_nonprofit_id_fkey FOREIGN KEY (nonprofit_id) REFERENCES public.nonprofit_profiles(id) ON DELETE CASCADE;


--
-- Name: refunds refunds_donation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_donation_id_fkey FOREIGN KEY (donation_id) REFERENCES public.donations(id) ON DELETE CASCADE;


--
-- Name: refunds refunds_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: reward_tiers reward_tiers_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_tiers
    ADD CONSTRAINT reward_tiers_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: risk_flags risk_flags_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_flags
    ADD CONSTRAINT risk_flags_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: risk_flags risk_flags_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_flags
    ADD CONSTRAINT risk_flags_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: risk_flags risk_flags_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_flags
    ADD CONSTRAINT risk_flags_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: saved_campaigns saved_campaigns_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_campaigns
    ADD CONSTRAINT saved_campaigns_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: saved_campaigns saved_campaigns_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_campaigns
    ADD CONSTRAINT saved_campaigns_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: seo_settings seo_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seo_settings
    ADD CONSTRAINT seo_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: share_events share_events_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_events
    ADD CONSTRAINT share_events_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: share_events share_events_donation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_events
    ADD CONSTRAINT share_events_donation_id_fkey FOREIGN KEY (donation_id) REFERENCES public.donations(id) ON DELETE SET NULL;


--
-- Name: share_events share_events_sharer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_events
    ADD CONSTRAINT share_events_sharer_id_fkey FOREIGN KEY (sharer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: share_events share_events_team_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_events
    ADD CONSTRAINT share_events_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE SET NULL;


--
-- Name: sms_campaigns sms_campaigns_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_campaigns
    ADD CONSTRAINT sms_campaigns_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: sms_campaigns sms_campaigns_nonprofit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_campaigns
    ADD CONSTRAINT sms_campaigns_nonprofit_id_fkey FOREIGN KEY (nonprofit_id) REFERENCES public.nonprofit_profiles(id) ON DELETE CASCADE;


--
-- Name: sms_campaigns sms_campaigns_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_campaigns
    ADD CONSTRAINT sms_campaigns_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: sponsorship_opportunities sponsorship_opportunities_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sponsorship_opportunities
    ADD CONSTRAINT sponsorship_opportunities_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: sponsorship_opportunities sponsorship_opportunities_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sponsorship_opportunities
    ADD CONSTRAINT sponsorship_opportunities_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: sponsorship_requests sponsorship_requests_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sponsorship_requests
    ADD CONSTRAINT sponsorship_requests_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.sponsorship_opportunities(id) ON DELETE CASCADE;


--
-- Name: sponsorship_requests sponsorship_requests_sponsor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sponsorship_requests
    ADD CONSTRAINT sponsorship_requests_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: support_cases support_cases_ai_generation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_cases
    ADD CONSTRAINT support_cases_ai_generation_id_fkey FOREIGN KEY (ai_generation_id) REFERENCES public.ai_generations(id) ON DELETE SET NULL;


--
-- Name: support_cases support_cases_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_cases
    ADD CONSTRAINT support_cases_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: support_cases support_cases_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_cases
    ADD CONSTRAINT support_cases_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: support_cases support_cases_donation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_cases
    ADD CONSTRAINT support_cases_donation_id_fkey FOREIGN KEY (donation_id) REFERENCES public.donations(id) ON DELETE SET NULL;


--
-- Name: support_cases support_cases_submitter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_cases
    ADD CONSTRAINT support_cases_submitter_id_fkey FOREIGN KEY (submitter_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: support_notes support_notes_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_notes
    ADD CONSTRAINT support_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: support_notes support_notes_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_notes
    ADD CONSTRAINT support_notes_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.support_cases(id) ON DELETE CASCADE;


--
-- Name: tax_receipts tax_receipts_donation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_receipts
    ADD CONSTRAINT tax_receipts_donation_id_fkey FOREIGN KEY (donation_id) REFERENCES public.donations(id) ON DELETE CASCADE;


--
-- Name: tax_receipts tax_receipts_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_receipts
    ADD CONSTRAINT tax_receipts_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: tax_receipts tax_receipts_nonprofit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_receipts
    ADD CONSTRAINT tax_receipts_nonprofit_id_fkey FOREIGN KEY (nonprofit_id) REFERENCES public.nonprofit_profiles(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_nonprofit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_nonprofit_id_fkey FOREIGN KEY (nonprofit_id) REFERENCES public.nonprofit_profiles(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: transparency_ledger_items transparency_ledger_items_ai_generation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transparency_ledger_items
    ADD CONSTRAINT transparency_ledger_items_ai_generation_id_fkey FOREIGN KEY (ai_generation_id) REFERENCES public.ai_generations(id) ON DELETE SET NULL;


--
-- Name: transparency_ledger_items transparency_ledger_items_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transparency_ledger_items
    ADD CONSTRAINT transparency_ledger_items_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: transparency_ledger_items transparency_ledger_items_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transparency_ledger_items
    ADD CONSTRAINT transparency_ledger_items_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: trust_scores trust_scores_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trust_scores
    ADD CONSTRAINT trust_scores_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: user_badges user_badges_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: verification_documents verification_documents_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_documents
    ADD CONSTRAINT verification_documents_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: verification_documents verification_documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_documents
    ADD CONSTRAINT verification_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: volunteer_applications volunteer_applications_applicant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volunteer_applications
    ADD CONSTRAINT volunteer_applications_applicant_user_id_fkey FOREIGN KEY (applicant_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: volunteer_applications volunteer_applications_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volunteer_applications
    ADD CONSTRAINT volunteer_applications_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.volunteer_opportunities(id) ON DELETE CASCADE;


--
-- Name: volunteer_hours volunteer_hours_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volunteer_hours
    ADD CONSTRAINT volunteer_hours_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.volunteer_opportunities(id) ON DELETE CASCADE;


--
-- Name: volunteer_hours volunteer_hours_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volunteer_hours
    ADD CONSTRAINT volunteer_hours_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.volunteer_shifts(id) ON DELETE SET NULL;


--
-- Name: volunteer_hours volunteer_hours_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volunteer_hours
    ADD CONSTRAINT volunteer_hours_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: volunteer_hours volunteer_hours_volunteer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volunteer_hours
    ADD CONSTRAINT volunteer_hours_volunteer_user_id_fkey FOREIGN KEY (volunteer_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: volunteer_opportunities volunteer_opportunities_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volunteer_opportunities
    ADD CONSTRAINT volunteer_opportunities_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: volunteer_opportunities volunteer_opportunities_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volunteer_opportunities
    ADD CONSTRAINT volunteer_opportunities_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: volunteer_profiles volunteer_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volunteer_profiles
    ADD CONSTRAINT volunteer_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: volunteer_shifts volunteer_shifts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volunteer_shifts
    ADD CONSTRAINT volunteer_shifts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: volunteer_shifts volunteer_shifts_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volunteer_shifts
    ADD CONSTRAINT volunteer_shifts_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.volunteer_opportunities(id) ON DELETE CASCADE;


--
-- Name: admin_reviews admin_all_reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_reviews ON public.admin_reviews USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: risk_flags admin_all_risk; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_risk ON public.risk_flags USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: webhook_events admin_all_webhooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_webhooks ON public.webhook_events USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: admin_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_notes admin_notes_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_notes_admin_all ON public.admin_notes USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: admin_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_settings admin_settings_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_settings_admin_all ON public.admin_settings USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: aeo_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.aeo_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: aeo_entries aeo_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY aeo_public_read ON public.aeo_entries FOR SELECT USING ((published = true));


--
-- Name: ai_generations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_snapshots analytics_owner_private; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY analytics_owner_private ON public.analytics_snapshots FOR SELECT USING (((auth.uid() = owner_id) OR public.is_admin()));


--
-- Name: analytics_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements announcements_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY announcements_public_read ON public.announcements FOR SELECT USING (((active = true) AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));


--
-- Name: api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: api_keys api_keys_owner_private; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY api_keys_owner_private ON public.api_keys USING (((auth.uid() = owner_id) OR public.is_admin())) WITH CHECK (((auth.uid() = owner_id) OR public.is_admin()));


--
-- Name: auction_bids; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;

--
-- Name: auction_bids auction_bids_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auction_bids_insert_own ON public.auction_bids FOR INSERT WITH CHECK (((auth.uid() = bidder_id) OR (bidder_id IS NULL) OR public.is_admin()));


--
-- Name: auction_bids auction_bids_private; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auction_bids_private ON public.auction_bids FOR SELECT USING (((auth.uid() = bidder_id) OR public.is_admin()));


--
-- Name: auction_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auction_items ENABLE ROW LEVEL SECURITY;

--
-- Name: auction_items auction_items_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auction_items_owner_write ON public.auction_items USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM (public.fundraising_events
     JOIN public.nonprofit_profiles ON ((nonprofit_profiles.id = fundraising_events.nonprofit_id)))
  WHERE ((fundraising_events.id = auction_items.event_id) AND (nonprofit_profiles.owner_id = auth.uid())))))) WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM (public.fundraising_events
     JOIN public.nonprofit_profiles ON ((nonprofit_profiles.id = fundraising_events.nonprofit_id)))
  WHERE ((fundraising_events.id = auction_items.event_id) AND (nonprofit_profiles.owner_id = auth.uid()))))));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_admin_insert ON public.audit_logs FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: audit_logs audit_logs_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_admin_read ON public.audit_logs FOR SELECT USING (public.is_admin());


--
-- Name: banner_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.banner_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: beneficiary_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.beneficiary_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: beneficiary_invites bi_own_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bi_own_insert ON public.beneficiary_invites FOR INSERT WITH CHECK (((auth.uid() = invited_by) OR public.is_admin()));


--
-- Name: beneficiary_invites bi_own_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bi_own_read ON public.beneficiary_invites FOR SELECT USING (((auth.uid() = invited_by) OR (auth.uid() = beneficiary_id) OR public.is_admin()));


--
-- Name: beneficiary_invites bi_own_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bi_own_update ON public.beneficiary_invites FOR UPDATE USING (((auth.uid() = beneficiary_id) OR public.is_admin()));


--
-- Name: brands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

--
-- Name: brands brands_editor_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brands_editor_write ON public.brands USING ((public.is_org_member(org_id, 'editor'::text) OR COALESCE(public.is_admin(), false))) WITH CHECK ((public.is_org_member(org_id, 'editor'::text) OR COALESCE(public.is_admin(), false)));


--
-- Name: brands brands_member_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brands_member_read ON public.brands FOR SELECT USING (((deleted_at IS NULL) AND (public.is_org_member(org_id) OR COALESCE(public.is_admin(), false))));


--
-- Name: business_leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_leads ENABLE ROW LEVEL SECURITY;

--
-- Name: business_leads business_leads_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY business_leads_admin_all ON public.business_leads USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: campaign_analytics_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_analytics_events ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_analytics_events campaign_analytics_owner_private; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_analytics_owner_private ON public.campaign_analytics_events FOR SELECT USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = campaign_analytics_events.campaign_id) AND (campaigns.user_id = auth.uid()))))));


--
-- Name: campaign_builder_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_builder_events ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_faqs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_faqs ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_launch_settings campaign_launch_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_launch_owner_write ON public.campaign_launch_settings USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = campaign_launch_settings.campaign_id) AND (campaigns.user_id = auth.uid())))))) WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = campaign_launch_settings.campaign_id) AND (campaigns.user_id = auth.uid()))))));


--
-- Name: campaign_launch_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_launch_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_media; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_media ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_milestones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_milestones ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_owner_payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_owner_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_owner_payouts campaign_owner_payouts_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_owner_payouts_admin_all ON public.campaign_owner_payouts USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: campaign_owner_payouts campaign_owner_payouts_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_owner_payouts_owner_read ON public.campaign_owner_payouts FOR SELECT USING (public.campaign_payment_owner_can_read(campaign_id, campaign_owner_id));


--
-- Name: campaign_owner_replies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_owner_replies ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_owner_transfers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_owner_transfers ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_owner_transfers campaign_owner_transfers_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_owner_transfers_admin_all ON public.campaign_owner_transfers USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: campaign_owner_transfers campaign_owner_transfers_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_owner_transfers_owner_read ON public.campaign_owner_transfers FOR SELECT USING (public.campaign_payment_owner_can_read(campaign_id, campaign_owner_id));


--
-- Name: campaign_payment_admin_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_payment_admin_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_payment_admin_notes campaign_payment_admin_notes_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_payment_admin_notes_admin_all ON public.campaign_payment_admin_notes USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: campaign_payment_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_payment_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_payment_audit_logs campaign_payment_audit_logs_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_payment_audit_logs_admin_all ON public.campaign_payment_audit_logs USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: campaign_payment_breakdowns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_payment_breakdowns ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_payment_breakdowns campaign_payment_breakdowns_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_payment_breakdowns_admin_all ON public.campaign_payment_breakdowns USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: campaign_payment_breakdowns campaign_payment_breakdowns_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_payment_breakdowns_owner_read ON public.campaign_payment_breakdowns FOR SELECT USING (public.campaign_payment_owner_can_read(campaign_id, campaign_owner_id));


--
-- Name: campaign_payment_disputes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_payment_disputes ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_payment_disputes campaign_payment_disputes_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_payment_disputes_admin_all ON public.campaign_payment_disputes USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: campaign_payment_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_payment_events ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_payment_events campaign_payment_events_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_payment_events_admin_all ON public.campaign_payment_events USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: campaign_payment_exports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_payment_exports ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_payment_exports campaign_payment_exports_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_payment_exports_admin_all ON public.campaign_payment_exports USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: campaign_payment_reconciliation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_payment_reconciliation ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_payment_reconciliation campaign_payment_reconciliation_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_payment_reconciliation_admin_all ON public.campaign_payment_reconciliation USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: campaign_payment_refunds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_payment_refunds ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_payment_refunds campaign_payment_refunds_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_payment_refunds_admin_all ON public.campaign_payment_refunds USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: campaign_payment_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_payment_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_payment_settings campaign_payment_settings_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_payment_settings_admin_all ON public.campaign_payment_settings USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: campaign_payment_webhook_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_payment_webhook_events ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_payment_webhook_events campaign_payment_webhook_events_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_payment_webhook_events_admin_all ON public.campaign_payment_webhook_events USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: campaign_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_payments campaign_payments_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_payments_admin_all ON public.campaign_payments USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: campaign_payments campaign_payments_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_payments_owner_read ON public.campaign_payments FOR SELECT USING (public.campaign_payment_owner_can_read(campaign_id, campaign_owner_id));


--
-- Name: campaign_platform_fees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_platform_fees ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_platform_fees campaign_platform_fees_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_platform_fees_admin_all ON public.campaign_platform_fees USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: campaign_processor_fees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_processor_fees ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_processor_fees campaign_processor_fees_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_processor_fees_admin_all ON public.campaign_processor_fees USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: campaign_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_rewards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_rewards ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_status_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_status_log ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_updates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_updates ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_wizard_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_wizard_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: campaigns campaigns_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaigns_insert_own ON public.campaigns FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: campaigns campaigns_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaigns_public_read ON public.campaigns FOR SELECT USING ((((status = 'active'::text) AND (visibility = 'public'::text) AND (deleted_at IS NULL)) OR (auth.uid() = user_id) OR public.is_admin() OR ((auth.uid() IS NOT NULL) AND public.is_campaign_team_member(id, auth.uid()))));


--
-- Name: campaigns campaigns_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaigns_update_own ON public.campaigns FOR UPDATE USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: challenge_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_participants challenge_participants_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY challenge_participants_owner_write ON public.challenge_participants USING (((auth.uid() = user_id) OR public.is_admin())) WITH CHECK (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: challenge_participants challenge_participants_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY challenge_participants_public_read ON public.challenge_participants FOR SELECT USING (true);


--
-- Name: challenges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: challenges challenges_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY challenges_admin_write ON public.challenges USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: challenges challenges_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY challenges_public_read ON public.challenges FOR SELECT USING (((status = ANY (ARRAY['active'::text, 'completed'::text])) OR public.is_admin()));


--
-- Name: coach_sessions coach_own_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY coach_own_all ON public.coach_sessions USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: coach_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coach_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: commission_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commission_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: commission_requests commission_requests_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commission_requests_insert_own ON public.commission_requests FOR INSERT WITH CHECK (((auth.uid() = requester_id) OR (requester_id IS NULL) OR public.is_admin()));


--
-- Name: commission_requests commission_requests_private; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commission_requests_private ON public.commission_requests FOR SELECT USING (((auth.uid() = requester_id) OR public.is_admin()));


--
-- Name: connected_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_messages contact_messages_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contact_messages_admin_read ON public.contact_messages FOR SELECT USING (public.is_admin());


--
-- Name: contact_messages contact_messages_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contact_messages_admin_update ON public.contact_messages FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: contact_messages contact_messages_insert_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contact_messages_insert_public ON public.contact_messages FOR INSERT WITH CHECK (true);


--
-- Name: campaign_owner_replies cor_donor_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cor_donor_read ON public.campaign_owner_replies FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.donor_messages dm
  WHERE ((dm.id = campaign_owner_replies.donor_message_id) AND (dm.donor_id = auth.uid())))));


--
-- Name: campaign_owner_replies cor_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cor_owner_all ON public.campaign_owner_replies USING (((auth.uid() = owner_id) OR public.is_admin())) WITH CHECK ((auth.uid() = owner_id));


--
-- Name: creator_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: creator_profiles creator_profiles_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY creator_profiles_owner_write ON public.creator_profiles USING (((auth.uid() = user_id) OR public.is_admin())) WITH CHECK (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: creator_tips; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.creator_tips ENABLE ROW LEVEL SECURITY;

--
-- Name: creator_tips creator_tips_private; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY creator_tips_private ON public.creator_tips FOR SELECT USING (((auth.uid() = supporter_id) OR (EXISTS ( SELECT 1
   FROM public.creator_profiles cp
  WHERE ((cp.id = creator_tips.creator_profile_id) AND (cp.user_id = auth.uid())))) OR public.is_admin()));


--
-- Name: campaign_wizard_drafts cwd_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cwd_delete_own ON public.campaign_wizard_drafts FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: campaign_wizard_drafts cwd_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cwd_insert_own ON public.campaign_wizard_drafts FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: campaign_wizard_drafts cwd_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cwd_select_own ON public.campaign_wizard_drafts FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: campaign_wizard_drafts cwd_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cwd_update_own ON public.campaign_wizard_drafts FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: digital_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.digital_products ENABLE ROW LEVEL SECURITY;

--
-- Name: digital_products digital_products_creator_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY digital_products_creator_write ON public.digital_products USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.creator_profiles
  WHERE ((creator_profiles.id = digital_products.creator_profile_id) AND (creator_profiles.user_id = auth.uid())))))) WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.creator_profiles
  WHERE ((creator_profiles.id = digital_products.creator_profile_id) AND (creator_profiles.user_id = auth.uid()))))));


--
-- Name: direct_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: direct_messages direct_messages_private; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY direct_messages_private ON public.direct_messages FOR SELECT USING (((auth.uid() = sender_id) OR (auth.uid() = recipient_id) OR public.is_admin()));


--
-- Name: direct_messages direct_messages_send; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY direct_messages_send ON public.direct_messages FOR INSERT WITH CHECK (((auth.uid() = sender_id) OR public.is_admin()));


--
-- Name: donation_forms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.donation_forms ENABLE ROW LEVEL SECURITY;

--
-- Name: donation_forms donation_forms_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY donation_forms_owner_write ON public.donation_forms USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.nonprofit_profiles np
  WHERE ((np.id = donation_forms.nonprofit_id) AND (np.owner_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.campaigns c
  WHERE ((c.id = donation_forms.campaign_id) AND (c.user_id = auth.uid())))))) WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.nonprofit_profiles np
  WHERE ((np.id = donation_forms.nonprofit_id) AND (np.owner_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.campaigns c
  WHERE ((c.id = donation_forms.campaign_id) AND (c.user_id = auth.uid()))))));


--
-- Name: donation_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.donation_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: donations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

--
-- Name: donations donations_donor_or_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY donations_donor_or_owner_read ON public.donations FOR SELECT USING (((auth.uid() = donor_id) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = donations.campaign_id) AND (campaigns.user_id = auth.uid()))))));


--
-- Name: donor_crm_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.donor_crm_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: donor_crm_contacts donor_crm_owner_private; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY donor_crm_owner_private ON public.donor_crm_contacts USING (((auth.uid() = owner_id) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.nonprofit_profiles
  WHERE ((nonprofit_profiles.id = donor_crm_contacts.nonprofit_id) AND (nonprofit_profiles.owner_id = auth.uid())))))) WITH CHECK (((auth.uid() = owner_id) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.nonprofit_profiles
  WHERE ((nonprofit_profiles.id = donor_crm_contacts.nonprofit_id) AND (nonprofit_profiles.owner_id = auth.uid()))))));


--
-- Name: donor_message_likes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.donor_message_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: donor_message_likes donor_message_likes_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY donor_message_likes_owner_write ON public.donor_message_likes USING (((auth.uid() = user_id) OR public.is_admin())) WITH CHECK (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: donor_message_likes donor_message_likes_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY donor_message_likes_read_all ON public.donor_message_likes FOR SELECT USING (true);


--
-- Name: donor_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.donor_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: donor_segment_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.donor_segment_members ENABLE ROW LEVEL SECURITY;

--
-- Name: donor_segment_members donor_segment_members_owner_private; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY donor_segment_members_owner_private ON public.donor_segment_members USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM (public.donor_segments
     JOIN public.nonprofit_profiles ON ((nonprofit_profiles.id = donor_segments.nonprofit_id)))
  WHERE ((donor_segments.id = donor_segment_members.segment_id) AND (nonprofit_profiles.owner_id = auth.uid())))))) WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM (public.donor_segments
     JOIN public.nonprofit_profiles ON ((nonprofit_profiles.id = donor_segments.nonprofit_id)))
  WHERE ((donor_segments.id = donor_segment_members.segment_id) AND (nonprofit_profiles.owner_id = auth.uid()))))));


--
-- Name: donor_segments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.donor_segments ENABLE ROW LEVEL SECURITY;

--
-- Name: donor_segments donor_segments_owner_private; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY donor_segments_owner_private ON public.donor_segments USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.nonprofit_profiles
  WHERE ((nonprofit_profiles.id = donor_segments.nonprofit_id) AND (nonprofit_profiles.owner_id = auth.uid())))))) WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.nonprofit_profiles
  WHERE ((nonprofit_profiles.id = donor_segments.nonprofit_id) AND (nonprofit_profiles.owner_id = auth.uid()))))));


--
-- Name: donor_tips; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.donor_tips ENABLE ROW LEVEL SECURITY;

--
-- Name: donor_tips donor_tips_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY donor_tips_owner_read ON public.donor_tips FOR SELECT USING (((auth.uid() = donor_id) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = donor_tips.campaign_id) AND (campaigns.user_id = auth.uid()))))));


--
-- Name: email_campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: email_campaigns email_campaigns_owner_private; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_campaigns_owner_private ON public.email_campaigns USING (((auth.uid() = owner_id) OR public.is_admin())) WITH CHECK (((auth.uid() = owner_id) OR public.is_admin()));


--
-- Name: embedded_buttons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.embedded_buttons ENABLE ROW LEVEL SECURITY;

--
-- Name: embedded_buttons embedded_buttons_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY embedded_buttons_owner_write ON public.embedded_buttons USING (((auth.uid() = owner_id) OR public.is_admin())) WITH CHECK (((auth.uid() = owner_id) OR public.is_admin()));


--
-- Name: event_checkins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_checkins ENABLE ROW LEVEL SECURITY;

--
-- Name: event_checkins event_checkins_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_checkins_owner_all ON public.event_checkins USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.fundraising_events e
  WHERE ((e.id = event_checkins.event_id) AND (e.created_by = auth.uid())))))) WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.fundraising_events e
  WHERE ((e.id = event_checkins.event_id) AND (e.created_by = auth.uid()))))));


--
-- Name: event_registrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

--
-- Name: event_registrations event_registrations_attendee_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_registrations_attendee_insert ON public.event_registrations FOR INSERT WITH CHECK (((auth.uid() = attendee_id) OR public.is_admin()));


--
-- Name: event_registrations event_registrations_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_registrations_insert_own ON public.event_registrations FOR INSERT WITH CHECK (((auth.uid() = attendee_id) OR (attendee_id IS NULL) OR public.is_admin()));


--
-- Name: event_registrations event_registrations_private; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_registrations_private ON public.event_registrations FOR SELECT USING (((auth.uid() = attendee_id) OR public.is_admin()));


--
-- Name: event_registrations event_registrations_scoped_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_registrations_scoped_read ON public.event_registrations FOR SELECT USING (((auth.uid() = attendee_id) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.fundraising_events e
  WHERE ((e.id = event_registrations.event_id) AND (e.created_by = auth.uid()))))));


--
-- Name: event_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: event_tickets event_tickets_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_tickets_owner_write ON public.event_tickets USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM (public.fundraising_events
     JOIN public.nonprofit_profiles ON ((nonprofit_profiles.id = fundraising_events.nonprofit_id)))
  WHERE ((fundraising_events.id = event_tickets.event_id) AND (nonprofit_profiles.owner_id = auth.uid())))))) WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM (public.fundraising_events
     JOIN public.nonprofit_profiles ON ((nonprofit_profiles.id = fundraising_events.nonprofit_id)))
  WHERE ((fundraising_events.id = event_tickets.event_id) AND (nonprofit_profiles.owner_id = auth.uid()))))));


--
-- Name: fundraising_events events_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_owner_write ON public.fundraising_events USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.nonprofit_profiles
  WHERE ((nonprofit_profiles.id = fundraising_events.nonprofit_id) AND (nonprofit_profiles.owner_id = auth.uid())))))) WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.nonprofit_profiles
  WHERE ((nonprofit_profiles.id = fundraising_events.nonprofit_id) AND (nonprofit_profiles.owner_id = auth.uid()))))));


--
-- Name: exclusive_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exclusive_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: exclusive_posts exclusive_posts_author_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exclusive_posts_author_write ON public.exclusive_posts USING (((auth.uid() = author_id) OR public.is_admin())) WITH CHECK (((auth.uid() = author_id) OR public.is_admin()));


--
-- Name: campaign_faqs faqs_owner_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY faqs_owner_delete ON public.campaign_faqs FOR DELETE USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = campaign_faqs.campaign_id) AND (campaigns.user_id = auth.uid()))))));


--
-- Name: campaign_faqs faqs_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY faqs_owner_update ON public.campaign_faqs FOR UPDATE USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = campaign_faqs.campaign_id) AND (campaigns.user_id = auth.uid()))))));


--
-- Name: campaign_faqs faqs_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY faqs_owner_write ON public.campaign_faqs FOR INSERT WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = campaign_faqs.campaign_id) AND (campaigns.user_id = auth.uid()))))));


--
-- Name: campaign_faqs faqs_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY faqs_public_read ON public.campaign_faqs FOR SELECT USING (((is_public = true) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = campaign_faqs.campaign_id) AND (campaigns.user_id = auth.uid()))))));


--
-- Name: feature_flags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_flags feature_flags_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY feature_flags_admin_all ON public.feature_flags USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: fundraising_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fundraising_events ENABLE ROW LEVEL SECURITY;

--
-- Name: fundraising_events fundraising_events_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fundraising_events_owner_write ON public.fundraising_events USING (((auth.uid() = created_by) OR public.is_admin())) WITH CHECK (((auth.uid() = created_by) OR public.is_admin()));


--
-- Name: giving_days; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.giving_days ENABLE ROW LEVEL SECURITY;

--
-- Name: giving_days giving_days_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY giving_days_owner_write ON public.giving_days USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.nonprofit_profiles
  WHERE ((nonprofit_profiles.id = giving_days.nonprofit_id) AND (nonprofit_profiles.owner_id = auth.uid())))))) WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.nonprofit_profiles
  WHERE ((nonprofit_profiles.id = giving_days.nonprofit_id) AND (nonprofit_profiles.owner_id = auth.uid()))))));


--
-- Name: grant_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grant_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: grant_applications grant_applications_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grant_applications_owner ON public.grant_applications USING (((applicant_user_id = auth.uid()) OR public.is_admin())) WITH CHECK (((applicant_user_id = auth.uid()) OR public.is_admin()));


--
-- Name: grant_deadlines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grant_deadlines ENABLE ROW LEVEL SECURITY;

--
-- Name: grant_deadlines grant_deadlines_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grant_deadlines_admin_all ON public.grant_deadlines USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: grant_deadlines grant_deadlines_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grant_deadlines_read ON public.grant_deadlines FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.grants g
  WHERE ((g.id = grant_deadlines.grant_id) AND (g.deleted_at IS NULL)))));


--
-- Name: grant_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grant_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: grant_documents grant_documents_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grant_documents_owner ON public.grant_documents USING (((EXISTS ( SELECT 1
   FROM public.grant_applications a
  WHERE ((a.id = grant_documents.application_id) AND (a.applicant_user_id = auth.uid())))) OR public.is_admin())) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.grant_applications a
  WHERE ((a.id = grant_documents.application_id) AND (a.applicant_user_id = auth.uid())))) OR public.is_admin()));


--
-- Name: grant_matches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grant_matches ENABLE ROW LEVEL SECURITY;

--
-- Name: grant_matches grant_matches_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grant_matches_owner ON public.grant_matches USING (((user_id = auth.uid()) OR public.is_admin())) WITH CHECK (((user_id = auth.uid()) OR public.is_admin()));


--
-- Name: grants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grants ENABLE ROW LEVEL SECURITY;

--
-- Name: grants grants_creator_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grants_creator_read ON public.grants FOR SELECT USING (((created_by = auth.uid()) OR public.is_admin()));


--
-- Name: grants grants_creator_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grants_creator_write ON public.grants USING (((created_by = auth.uid()) OR public.is_admin())) WITH CHECK (((created_by = auth.uid()) OR public.is_admin()));


--
-- Name: grants grants_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grants_public_read ON public.grants FOR SELECT USING (((deleted_at IS NULL) AND (status = ANY (ARRAY['open'::text, 'upcoming'::text]))));


--
-- Name: impact_evidence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.impact_evidence ENABLE ROW LEVEL SECURITY;

--
-- Name: impact_evidence impact_evidence_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY impact_evidence_read ON public.impact_evidence FOR SELECT USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.impact_updates u
  WHERE ((u.id = impact_evidence.update_id) AND ((u.status = 'published'::text) OR public.owns_campaign(u.campaign_id)))))));


--
-- Name: impact_evidence impact_evidence_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY impact_evidence_write ON public.impact_evidence USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.impact_updates u
  WHERE ((u.id = impact_evidence.update_id) AND public.owns_campaign(u.campaign_id)))))) WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.impact_updates u
  WHERE ((u.id = impact_evidence.update_id) AND public.owns_campaign(u.campaign_id))))));


--
-- Name: impact_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.impact_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: impact_metrics impact_metrics_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY impact_metrics_read ON public.impact_metrics FOR SELECT USING ((public.owns_campaign(campaign_id) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns c
  WHERE ((c.id = impact_metrics.campaign_id) AND (c.status = 'active'::text) AND (c.visibility = 'public'::text))))));


--
-- Name: impact_metrics impact_metrics_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY impact_metrics_write ON public.impact_metrics USING ((public.owns_campaign(campaign_id) OR public.is_admin())) WITH CHECK ((public.owns_campaign(campaign_id) OR public.is_admin()));


--
-- Name: impact_plan_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.impact_plan_items ENABLE ROW LEVEL SECURITY;

--
-- Name: impact_plan_items impact_plan_items_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY impact_plan_items_read ON public.impact_plan_items FOR SELECT USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.impact_plans p
  WHERE ((p.id = impact_plan_items.plan_id) AND ((p.status = 'published'::text) OR public.owns_campaign(p.campaign_id)))))));


--
-- Name: impact_plan_items impact_plan_items_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY impact_plan_items_write ON public.impact_plan_items USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.impact_plans p
  WHERE ((p.id = impact_plan_items.plan_id) AND public.owns_campaign(p.campaign_id)))))) WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.impact_plans p
  WHERE ((p.id = impact_plan_items.plan_id) AND public.owns_campaign(p.campaign_id))))));


--
-- Name: impact_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.impact_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: impact_plans impact_plans_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY impact_plans_read ON public.impact_plans FOR SELECT USING (((status = 'published'::text) OR public.owns_campaign(campaign_id) OR public.is_admin()));


--
-- Name: impact_plans impact_plans_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY impact_plans_write ON public.impact_plans USING ((public.owns_campaign(campaign_id) OR public.is_admin())) WITH CHECK ((public.owns_campaign(campaign_id) OR public.is_admin()));


--
-- Name: impact_updates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.impact_updates ENABLE ROW LEVEL SECURITY;

--
-- Name: impact_updates impact_updates_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY impact_updates_read ON public.impact_updates FOR SELECT USING (((status = 'published'::text) OR public.owns_campaign(campaign_id) OR public.is_admin()));


--
-- Name: impact_updates impact_updates_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY impact_updates_write ON public.impact_updates USING ((public.owns_campaign(campaign_id) OR public.is_admin())) WITH CHECK ((public.owns_campaign(campaign_id) OR public.is_admin()));


--
-- Name: integration_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: integration_connections integrations_owner_private; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY integrations_owner_private ON public.integration_connections USING (((auth.uid() = owner_id) OR public.is_admin())) WITH CHECK (((auth.uid() = owner_id) OR public.is_admin()));


--
-- Name: lead_outreach; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_outreach ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_outreach lead_outreach_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_outreach_admin_all ON public.lead_outreach USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: ledger_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: ledger_entries ledger_entries_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ledger_entries_admin_read ON public.ledger_entries FOR SELECT USING (public.is_admin());


--
-- Name: transparency_ledger_items ledger_owner_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ledger_owner_delete ON public.transparency_ledger_items FOR DELETE USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = transparency_ledger_items.campaign_id) AND (campaigns.user_id = auth.uid()))))));


--
-- Name: transparency_ledger_items ledger_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ledger_owner_update ON public.transparency_ledger_items FOR UPDATE USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = transparency_ledger_items.campaign_id) AND (campaigns.user_id = auth.uid())))))) WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = transparency_ledger_items.campaign_id) AND (campaigns.user_id = auth.uid()))))));


--
-- Name: transparency_ledger_items ledger_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ledger_owner_write ON public.transparency_ledger_items FOR INSERT WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = transparency_ledger_items.campaign_id) AND (campaigns.user_id = auth.uid()))))));


--
-- Name: transparency_ledger_items ledger_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ledger_public_read ON public.transparency_ledger_items FOR SELECT USING (((review_status = ANY (ARRAY['auto_approved'::text, 'approved'::text])) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = transparency_ledger_items.campaign_id) AND (campaigns.user_id = auth.uid()))))));


--
-- Name: livestreams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.livestreams ENABLE ROW LEVEL SECURITY;

--
-- Name: livestreams livestreams_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY livestreams_owner_write ON public.livestreams USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = livestreams.campaign_id) AND (campaigns.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM (public.fundraising_events
     JOIN public.nonprofit_profiles ON ((nonprofit_profiles.id = fundraising_events.nonprofit_id)))
  WHERE ((fundraising_events.id = livestreams.event_id) AND (nonprofit_profiles.owner_id = auth.uid())))))) WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = livestreams.campaign_id) AND (campaigns.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM (public.fundraising_events
     JOIN public.nonprofit_profiles ON ((nonprofit_profiles.id = fundraising_events.nonprofit_id)))
  WHERE ((fundraising_events.id = livestreams.event_id) AND (nonprofit_profiles.owner_id = auth.uid()))))));


--
-- Name: marketing_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_audit_logs marketing_audit_logs_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_audit_logs_admin_all ON public.marketing_audit_logs USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: marketing_automation_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_automation_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_automation_runs marketing_automation_runs_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_automation_runs_admin_all ON public.marketing_automation_runs USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: marketing_automations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_automations ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_automations marketing_automations_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_automations_admin_all ON public.marketing_automations USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: marketing_campaign_plan_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_campaign_plan_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_campaign_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_campaign_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_campaign_recipients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_campaign_recipients ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_campaign_recipients marketing_campaign_recipients_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_campaign_recipients_admin_all ON public.marketing_campaign_recipients USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: marketing_campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_campaigns marketing_campaigns_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_campaigns_admin_all ON public.marketing_campaigns USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: marketing_consent; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_consent ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_consent marketing_consent_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_consent_admin_all ON public.marketing_consent USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: marketing_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_contacts marketing_contacts_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_contacts_admin_all ON public.marketing_contacts USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: marketing_email_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_email_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_email_templates marketing_email_templates_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_email_templates_admin_all ON public.marketing_email_templates USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: marketing_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_events ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_events marketing_events_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_events_admin_all ON public.marketing_events USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: marketing_form_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_form_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_form_submissions marketing_form_submissions_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_form_submissions_admin_all ON public.marketing_form_submissions USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: marketing_forms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_forms ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_forms marketing_forms_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_forms_admin_all ON public.marketing_forms USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: marketing_goals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_goals ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_identities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_identities ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_identities marketing_identities_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_identities_admin_all ON public.marketing_identities USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: marketing_opportunities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_opportunities ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_referrals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_referrals ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_referrals marketing_referrals_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_referrals_admin_all ON public.marketing_referrals USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: marketing_segment_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_segment_members ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_segment_members marketing_segment_members_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_segment_members_admin_all ON public.marketing_segment_members USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: marketing_segments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_segments ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_segments marketing_segments_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_segments_admin_all ON public.marketing_segments USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: marketing_suppression_list; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_suppression_list ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_suppression_list marketing_suppression_list_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_suppression_list_admin_all ON public.marketing_suppression_list USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: marketing_utm_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_utm_links ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_utm_links marketing_utm_links_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_utm_links_admin_all ON public.marketing_utm_links USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: matching_claims; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matching_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: matching_claims matching_claims_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY matching_claims_insert ON public.matching_claims FOR INSERT WITH CHECK ((auth.uid() = employee_id));


--
-- Name: matching_claims matching_claims_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY matching_claims_read ON public.matching_claims FOR SELECT USING (((auth.uid() = employee_id) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.matching_programs p
  WHERE ((p.id = matching_claims.program_id) AND (p.sponsor_id = auth.uid()))))));


--
-- Name: matching_claims matching_claims_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY matching_claims_update ON public.matching_claims FOR UPDATE USING (((auth.uid() = employee_id) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.matching_programs p
  WHERE ((p.id = matching_claims.program_id) AND (p.sponsor_id = auth.uid()))))));


--
-- Name: matching_programs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matching_programs ENABLE ROW LEVEL SECURITY;

--
-- Name: matching_programs matching_programs_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY matching_programs_public_read ON public.matching_programs FOR SELECT USING (((status = ANY (ARRAY['active'::text, 'paused'::text, 'closed'::text])) OR (auth.uid() = sponsor_id) OR public.is_admin()));


--
-- Name: matching_programs matching_programs_sponsor_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY matching_programs_sponsor_write ON public.matching_programs USING (((auth.uid() = sponsor_id) OR public.is_admin())) WITH CHECK (((auth.uid() = sponsor_id) OR public.is_admin()));


--
-- Name: member_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.member_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: member_subscriptions member_subscriptions_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY member_subscriptions_insert_own ON public.member_subscriptions FOR INSERT WITH CHECK (((auth.uid() = member_id) OR public.is_admin()));


--
-- Name: member_subscriptions member_subscriptions_private; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY member_subscriptions_private ON public.member_subscriptions FOR SELECT USING (((auth.uid() = member_id) OR public.is_admin()));


--
-- Name: membership_tiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.membership_tiers ENABLE ROW LEVEL SECURITY;

--
-- Name: membership_tiers membership_tiers_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY membership_tiers_owner_write ON public.membership_tiers USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.creator_profiles
  WHERE ((creator_profiles.id = membership_tiers.creator_profile_id) AND (creator_profiles.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.nonprofit_profiles
  WHERE ((nonprofit_profiles.id = membership_tiers.nonprofit_id) AND (nonprofit_profiles.owner_id = auth.uid())))))) WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.creator_profiles
  WHERE ((creator_profiles.id = membership_tiers.creator_profile_id) AND (creator_profiles.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.nonprofit_profiles
  WHERE ((nonprofit_profiles.id = membership_tiers.nonprofit_id) AND (nonprofit_profiles.owner_id = auth.uid()))))));


--
-- Name: message_thread_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_thread_state ENABLE ROW LEVEL SECURITY;

--
-- Name: message_thread_state message_thread_state_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY message_thread_state_owner_all ON public.message_thread_state USING (((auth.uid() = owner_id) OR public.is_admin())) WITH CHECK (((auth.uid() = owner_id) OR public.is_admin()));


--
-- Name: campaign_milestones milestones_owner_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY milestones_owner_delete ON public.campaign_milestones FOR DELETE USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = campaign_milestones.campaign_id) AND (campaigns.user_id = auth.uid()))))));


--
-- Name: campaign_milestones milestones_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY milestones_owner_write ON public.campaign_milestones FOR INSERT WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = campaign_milestones.campaign_id) AND (campaigns.user_id = auth.uid()))))));


--
-- Name: campaign_milestones milestones_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY milestones_public_read ON public.campaign_milestones FOR SELECT USING (true);


--
-- Name: nonprofit_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.nonprofit_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: nonprofit_profiles nonprofit_profiles_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nonprofit_profiles_owner_write ON public.nonprofit_profiles USING (((auth.uid() = owner_id) OR public.is_admin())) WITH CHECK (((auth.uid() = owner_id) OR public.is_admin()));


--
-- Name: support_notes notes_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notes_admin_all ON public.support_notes USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: support_notes notes_own_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notes_own_read ON public.support_notes FOR SELECT USING (((NOT internal) AND (EXISTS ( SELECT 1
   FROM public.support_cases sc
  WHERE ((sc.id = support_notes.case_id) AND (sc.submitter_id = auth.uid()))))));


--
-- Name: notifications notif_own_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notif_own_all ON public.notifications USING (((auth.uid() = user_id) OR public.is_admin())) WITH CHECK (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations org_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_admin_write ON public.organizations USING ((public.is_org_member(id, 'admin'::text) OR COALESCE(public.is_admin(), false))) WITH CHECK ((public.is_org_member(id, 'admin'::text) OR COALESCE(public.is_admin(), false)));


--
-- Name: organizations org_member_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_member_read ON public.organizations FOR SELECT USING (((deleted_at IS NULL) AND (public.is_org_member(id) OR COALESCE(public.is_admin(), false))));


--
-- Name: organization_members org_members_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_members_admin_write ON public.organization_members USING ((public.is_org_member(org_id, 'admin'::text) OR COALESCE(public.is_admin(), false))) WITH CHECK ((public.is_org_member(org_id, 'admin'::text) OR COALESCE(public.is_admin(), false)));


--
-- Name: organization_members org_members_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_members_read ON public.organization_members FOR SELECT USING (((deleted_at IS NULL) AND (public.is_org_member(org_id) OR COALESCE(public.is_admin(), false))));


--
-- Name: organization_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: organizer_sends; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizer_sends ENABLE ROW LEVEL SECURITY;

--
-- Name: organizer_sends organizer_sends_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organizer_sends_select_own ON public.organizer_sends FOR SELECT USING ((auth.uid() = organizer_id));


--
-- Name: outbound_webhook_endpoints; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outbound_webhook_endpoints ENABLE ROW LEVEL SECURITY;

--
-- Name: outbound_webhook_endpoints outbound_webhooks_owner_private; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY outbound_webhooks_owner_private ON public.outbound_webhook_endpoints USING (((auth.uid() = owner_id) OR public.is_admin())) WITH CHECK (((auth.uid() = owner_id) OR public.is_admin()));


--
-- Name: ai_generations own_ai_generations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY own_ai_generations ON public.ai_generations FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: subscriptions own_subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY own_subscriptions ON public.subscriptions FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: campaign_updates owner_updates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_updates ON public.campaign_updates FOR INSERT WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = campaign_updates.campaign_id) AND (campaigns.user_id = auth.uid()))))));


--
-- Name: payment_processors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_processors ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_processors payment_processors_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_processors_admin_all ON public.payment_processors USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: payment_processors payment_processors_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_processors_owner_read ON public.payment_processors FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: payouts payouts_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payouts_admin_update ON public.payouts FOR UPDATE USING (public.is_admin());


--
-- Name: payouts payouts_owner_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payouts_owner_admin_read ON public.payouts FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: payouts payouts_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payouts_owner_insert ON public.payouts FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: peer_fundraisers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.peer_fundraisers ENABLE ROW LEVEL SECURITY;

--
-- Name: peer_fundraisers peer_fundraisers_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY peer_fundraisers_owner_write ON public.peer_fundraisers USING (((auth.uid() = fundraiser_id) OR public.is_admin())) WITH CHECK (((auth.uid() = fundraiser_id) OR public.is_admin()));


--
-- Name: platform_fees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_fees platform_fees_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_fees_owner_read ON public.platform_fees FOR SELECT USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = platform_fees.campaign_id) AND (campaigns.user_id = auth.uid()))))));


--
-- Name: platform_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_settings platform_settings_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_settings_admin_all ON public.platform_settings USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: privacy_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: privacy_requests privacy_requests_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY privacy_requests_insert ON public.privacy_requests FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: privacy_requests privacy_requests_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY privacy_requests_read ON public.privacy_requests FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: privacy_requests privacy_requests_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY privacy_requests_update ON public.privacy_requests FOR UPDATE USING (((auth.uid() = user_id) OR public.is_admin())) WITH CHECK (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: verification_documents private_owner_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY private_owner_admin ON public.verification_documents FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: verification_documents private_owner_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY private_owner_admin_insert ON public.verification_documents FOR INSERT WITH CHECK (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: processor_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.processor_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: processor_accounts processor_accounts_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY processor_accounts_admin_all ON public.processor_accounts USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: processor_accounts processor_accounts_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY processor_accounts_owner_read ON public.processor_accounts FOR SELECT USING (((owner_id = auth.uid()) OR public.is_admin()));


--
-- Name: product_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: product_orders product_orders_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_orders_insert_own ON public.product_orders FOR INSERT WITH CHECK (((auth.uid() = buyer_id) OR (buyer_id IS NULL) OR public.is_admin()));


--
-- Name: product_orders product_orders_private; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_orders_private ON public.product_orders FOR SELECT USING (((auth.uid() = buyer_id) OR public.is_admin()));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT WITH CHECK (((auth.uid() = id) OR public.is_admin()));


--
-- Name: profiles profiles_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_read ON public.profiles FOR SELECT USING (((auth.uid() = id) OR public.is_admin()));


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (((auth.uid() = id) OR public.is_admin())) WITH CHECK (((auth.uid() = id) OR public.is_admin()));


--
-- Name: auction_items public_auction_items_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_auction_items_read ON public.auction_items FOR SELECT USING (true);


--
-- Name: campaign_launch_settings public_campaign_launch_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_campaign_launch_read ON public.campaign_launch_settings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.campaigns c
  WHERE ((c.id = campaign_launch_settings.campaign_id) AND (c.deleted_at IS NULL) AND (c.status = 'active'::text) AND (c.visibility = 'public'::text)))));


--
-- Name: creator_profiles public_creator_profiles_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_creator_profiles_read ON public.creator_profiles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.campaigns c
  WHERE ((c.user_id = creator_profiles.user_id) AND (c.deleted_at IS NULL) AND (c.status = 'active'::text) AND (c.visibility = 'public'::text)))));


--
-- Name: digital_products public_digital_products_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_digital_products_read ON public.digital_products FOR SELECT USING ((active OR public.is_admin()));


--
-- Name: donation_forms public_donation_forms_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_donation_forms_read ON public.donation_forms FOR SELECT USING (true);


--
-- Name: embedded_buttons public_embedded_buttons_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_embedded_buttons_read ON public.embedded_buttons FOR SELECT USING (true);


--
-- Name: event_tickets public_event_tickets_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_event_tickets_read ON public.event_tickets FOR SELECT USING (true);


--
-- Name: fundraising_events public_events_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_events_read ON public.fundraising_events FOR SELECT USING (((status = 'published'::text) OR public.is_admin()));


--
-- Name: exclusive_posts public_exclusive_posts_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_exclusive_posts_read ON public.exclusive_posts FOR SELECT USING (((visibility = 'public'::text) OR public.is_admin()));


--
-- Name: giving_days public_giving_days_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_giving_days_read ON public.giving_days FOR SELECT USING (true);


--
-- Name: livestreams public_livestreams_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_livestreams_read ON public.livestreams FOR SELECT USING (true);


--
-- Name: membership_tiers public_membership_tiers_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_membership_tiers_read ON public.membership_tiers FOR SELECT USING ((active OR public.is_admin()));


--
-- Name: nonprofit_profiles public_nonprofit_profiles_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_nonprofit_profiles_read ON public.nonprofit_profiles FOR SELECT USING (true);


--
-- Name: peer_fundraisers public_peer_fundraisers_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_peer_fundraisers_read ON public.peer_fundraisers FOR SELECT USING (true);


--
-- Name: supported_countries public_read_countries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_countries ON public.supported_countries FOR SELECT USING (true);


--
-- Name: reward_tiers public_reward_tiers_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_reward_tiers_read ON public.reward_tiers FOR SELECT USING (true);


--
-- Name: trust_scores public_trust_scores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_trust_scores ON public.trust_scores FOR SELECT USING (true);


--
-- Name: campaign_updates public_updates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_updates ON public.campaign_updates FOR SELECT USING (true);


--
-- Name: rate_limit_hits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;

--
-- Name: donation_receipts receipts_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY receipts_admin_update ON public.donation_receipts FOR UPDATE USING (public.is_admin());


--
-- Name: donation_receipts receipts_own_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY receipts_own_read ON public.donation_receipts FOR SELECT USING (((auth.uid() = donor_id) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns c
  WHERE ((c.id = donation_receipts.campaign_id) AND (c.user_id = auth.uid()))))));


--
-- Name: reconciliation_exceptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reconciliation_exceptions ENABLE ROW LEVEL SECURITY;

--
-- Name: reconciliation_exceptions reconciliation_exceptions_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reconciliation_exceptions_admin_all ON public.reconciliation_exceptions USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: recurring_donations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recurring_donations ENABLE ROW LEVEL SECURITY;

--
-- Name: recurring_donations recurring_donations_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recurring_donations_insert_own ON public.recurring_donations FOR INSERT WITH CHECK (((auth.uid() = donor_id) OR public.is_admin()));


--
-- Name: recurring_donations recurring_donations_private; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recurring_donations_private ON public.recurring_donations FOR SELECT USING (((auth.uid() = donor_id) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.nonprofit_profiles
  WHERE ((nonprofit_profiles.id = recurring_donations.nonprofit_id) AND (nonprofit_profiles.owner_id = auth.uid()))))));


--
-- Name: refunds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_reports reports_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reports_admin_read ON public.campaign_reports FOR SELECT USING (public.is_admin());


--
-- Name: reward_tiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reward_tiers ENABLE ROW LEVEL SECURITY;

--
-- Name: reward_tiers reward_tiers_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reward_tiers_owner_write ON public.reward_tiers USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = reward_tiers.campaign_id) AND (campaigns.user_id = auth.uid())))))) WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = reward_tiers.campaign_id) AND (campaigns.user_id = auth.uid()))))));


--
-- Name: campaign_rewards rewards_owner_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rewards_owner_delete ON public.campaign_rewards FOR DELETE USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = campaign_rewards.campaign_id) AND (campaigns.user_id = auth.uid()))))));


--
-- Name: campaign_rewards rewards_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rewards_owner_update ON public.campaign_rewards FOR UPDATE USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = campaign_rewards.campaign_id) AND (campaigns.user_id = auth.uid()))))));


--
-- Name: campaign_rewards rewards_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rewards_owner_write ON public.campaign_rewards FOR INSERT WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = campaign_rewards.campaign_id) AND (campaigns.user_id = auth.uid()))))));


--
-- Name: campaign_rewards rewards_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rewards_public_read ON public.campaign_rewards FOR SELECT USING (true);


--
-- Name: risk_flags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.risk_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.saved_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_campaigns saved_campaigns_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY saved_campaigns_owner_all ON public.saved_campaigns USING (((auth.uid() = user_id) OR public.is_admin())) WITH CHECK (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: seo_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.seo_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: share_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.share_events ENABLE ROW LEVEL SECURITY;

--
-- Name: share_events share_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY share_owner_read ON public.share_events FOR SELECT USING ((public.is_admin() OR (auth.uid() = sharer_id) OR (EXISTS ( SELECT 1
   FROM public.campaigns c
  WHERE ((c.id = share_events.campaign_id) AND (c.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.team_members tm
  WHERE ((tm.campaign_id = share_events.campaign_id) AND (tm.user_id = auth.uid()))))));


--
-- Name: sms_campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_campaigns sms_campaigns_owner_private; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sms_campaigns_owner_private ON public.sms_campaigns USING (((auth.uid() = owner_id) OR public.is_admin())) WITH CHECK (((auth.uid() = owner_id) OR public.is_admin()));


--
-- Name: sponsors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

--
-- Name: sponsors sponsors admin all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "sponsors admin all" ON public.sponsors USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: sponsors sponsors public read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "sponsors public read" ON public.sponsors FOR SELECT USING ((active = true));


--
-- Name: sponsorship_opportunities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sponsorship_opportunities ENABLE ROW LEVEL SECURITY;

--
-- Name: sponsorship_opportunities sponsorship_opportunities_organizer_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sponsorship_opportunities_organizer_write ON public.sponsorship_opportunities USING (((auth.uid() = organizer_id) OR public.is_admin())) WITH CHECK (((auth.uid() = organizer_id) OR public.is_admin()));


--
-- Name: sponsorship_opportunities sponsorship_opportunities_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sponsorship_opportunities_public_read ON public.sponsorship_opportunities FOR SELECT USING (((status = ANY (ARRAY['open'::text, 'closed'::text, 'fulfilled'::text])) OR (auth.uid() = organizer_id) OR public.is_admin()));


--
-- Name: sponsorship_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sponsorship_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: sponsorship_requests sponsorship_requests_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sponsorship_requests_insert ON public.sponsorship_requests FOR INSERT WITH CHECK ((auth.uid() = sponsor_id));


--
-- Name: sponsorship_requests sponsorship_requests_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sponsorship_requests_read ON public.sponsorship_requests FOR SELECT USING (((auth.uid() = sponsor_id) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.sponsorship_opportunities o
  WHERE ((o.id = sponsorship_requests.opportunity_id) AND (o.organizer_id = auth.uid()))))));


--
-- Name: sponsorship_requests sponsorship_requests_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sponsorship_requests_update ON public.sponsorship_requests FOR UPDATE USING (((auth.uid() = sponsor_id) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.sponsorship_opportunities o
  WHERE ((o.id = sponsorship_requests.opportunity_id) AND (o.organizer_id = auth.uid()))))));


--
-- Name: campaign_status_log status_log_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY status_log_owner_read ON public.campaign_status_log FOR SELECT USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.campaigns c
  WHERE ((c.id = campaign_status_log.campaign_id) AND (c.user_id = auth.uid()))))));


--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: support_cases support_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY support_admin_all ON public.support_cases USING (public.is_admin());


--
-- Name: support_cases support_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY support_admin_update ON public.support_cases FOR UPDATE USING (public.is_admin());


--
-- Name: support_cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_cases ENABLE ROW LEVEL SECURITY;

--
-- Name: support_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: support_cases support_own_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY support_own_read ON public.support_cases FOR SELECT USING (((auth.uid() = submitter_id) OR public.is_admin()));


--
-- Name: supported_countries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.supported_countries ENABLE ROW LEVEL SECURITY;

--
-- Name: tax_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tax_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: tax_receipts tax_receipts_private; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tax_receipts_private ON public.tax_receipts FOR SELECT USING (((auth.uid() = donor_id) OR public.is_admin()));


--
-- Name: team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: team_members team_members_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_members_read_own ON public.team_members FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: transparency_ledger_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transparency_ledger_items ENABLE ROW LEVEL SECURITY;

--
-- Name: trust_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trust_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: user_badges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

--
-- Name: user_badges user_badges_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_badges_owner_write ON public.user_badges USING (((auth.uid() = user_id) OR public.is_admin())) WITH CHECK (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: user_badges user_badges_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_badges_public_read ON public.user_badges FOR SELECT USING (true);


--
-- Name: verification_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: volunteer_applications vol_app_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vol_app_owner ON public.volunteer_applications USING (((applicant_user_id = auth.uid()) OR public.is_admin())) WITH CHECK (((applicant_user_id = auth.uid()) OR public.is_admin()));


--
-- Name: volunteer_hours vol_hours_organizer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vol_hours_organizer ON public.volunteer_hours USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.volunteer_opportunities o
  WHERE ((o.id = volunteer_hours.opportunity_id) AND (o.created_by = auth.uid())))))) WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.volunteer_opportunities o
  WHERE ((o.id = volunteer_hours.opportunity_id) AND (o.created_by = auth.uid()))))));


--
-- Name: volunteer_hours vol_hours_volunteer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vol_hours_volunteer ON public.volunteer_hours USING (((volunteer_user_id = auth.uid()) OR public.is_admin())) WITH CHECK (((volunteer_user_id = auth.uid()) OR public.is_admin()));


--
-- Name: volunteer_opportunities vol_opp_creator_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vol_opp_creator_read ON public.volunteer_opportunities FOR SELECT USING (((created_by = auth.uid()) OR public.is_admin()));


--
-- Name: volunteer_opportunities vol_opp_creator_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vol_opp_creator_write ON public.volunteer_opportunities USING (((created_by = auth.uid()) OR public.is_admin())) WITH CHECK (((created_by = auth.uid()) OR public.is_admin()));


--
-- Name: volunteer_opportunities vol_opp_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vol_opp_public_read ON public.volunteer_opportunities FOR SELECT USING (((deleted_at IS NULL) AND (status = ANY (ARRAY['open'::text, 'upcoming'::text]))));


--
-- Name: volunteer_profiles vol_profile_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vol_profile_owner ON public.volunteer_profiles USING (((user_id = auth.uid()) OR public.is_admin())) WITH CHECK (((user_id = auth.uid()) OR public.is_admin()));


--
-- Name: volunteer_profiles vol_profile_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vol_profile_public_read ON public.volunteer_profiles FOR SELECT USING ((is_public = true));


--
-- Name: volunteer_shifts vol_shift_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vol_shift_owner ON public.volunteer_shifts USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.volunteer_opportunities o
  WHERE ((o.id = volunteer_shifts.opportunity_id) AND (o.created_by = auth.uid())))))) WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.volunteer_opportunities o
  WHERE ((o.id = volunteer_shifts.opportunity_id) AND (o.created_by = auth.uid()))))));


--
-- Name: volunteer_shifts vol_shift_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vol_shift_public_read ON public.volunteer_shifts FOR SELECT USING (((deleted_at IS NULL) AND (status = 'scheduled'::text) AND (EXISTS ( SELECT 1
   FROM public.volunteer_opportunities o
  WHERE ((o.id = volunteer_shifts.opportunity_id) AND (o.deleted_at IS NULL) AND (o.status = ANY (ARRAY['open'::text, 'upcoming'::text])))))));


--
-- Name: volunteer_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.volunteer_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: volunteer_hours; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.volunteer_hours ENABLE ROW LEVEL SECURITY;

--
-- Name: volunteer_opportunities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.volunteer_opportunities ENABLE ROW LEVEL SECURITY;

--
-- Name: volunteer_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.volunteer_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: volunteer_shifts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.volunteer_shifts ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

--
--


