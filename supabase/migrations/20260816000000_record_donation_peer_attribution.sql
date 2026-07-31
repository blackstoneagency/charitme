-- ─────────────────────────────────────────────────────────────────────────────
-- Carry peer attribution through the money path.
--
-- `20260815000000_peer_fundraiser_attribution.sql` added
-- `donations.peer_fundraiser_id` and the trigger that rolls an attributed gift
-- into the supporter's total, then deliberately stopped: `record_donation` —
-- the RPC the Stripe webhook calls — has a fixed INSERT column list that does
-- not include the new column. Until this file runs, a donation made through a
-- supporter page is recorded with `peer_fundraiser_id` NULL and the supporter's
-- progress bar never moves.
--
-- ⚠️ THE TRAP, restated from that migration's header because it is the whole
-- reason this is a drop-and-create rather than a `create or replace`:
--
--   `create or replace function record_donation(…, p_peer_fundraiser_id uuid
--   default null)` does NOT replace the existing function. A different argument
--   list makes it an OVERLOAD. The caller uses NAMED arguments
--   (`supabase.rpc('record_donation', { p_stripe_event_id: … })`), which then
--   match BOTH the 10-arg and the 11-arg signature, and Postgres fails the call
--   with "function record_donation(…) is not unique". Every donation webhook
--   would start erroring — and since the handler rethrows so Stripe retries, it
--   would keep erroring, on the money path, until someone noticed.
--
-- So: DROP the exact 10-argument signature, then CREATE the 11-argument one, in
-- a single transaction (migrations run in one by default) so no window exists
-- where the function is missing and a webhook could 404 the RPC.
--
-- The body below is the existing function VERBATIM apart from three additions,
-- marked `-- +peer`. Copying it wholesale is deliberate: the advisory lock, the
-- idempotency check, the "do not increment here" note and the exception handler
-- that records the failure before re-raising are all load-bearing, and
-- paraphrasing them while transcribing is exactly how one of them would be lost.
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.record_donation(
  text, uuid, uuid, bigint, bigint, bigint, text, boolean, text, text
);

create function public.record_donation(
  p_stripe_event_id text,
  p_campaign_id uuid,
  p_donor_id uuid,
  p_amount_cents bigint,
  p_tip_cents bigint,
  p_processing_fee_cents bigint,
  p_message text,
  p_anonymous boolean,
  p_stripe_payment_intent_id text,
  p_stripe_checkout_session_id text,
  p_peer_fundraiser_id uuid default null   -- +peer
) returns jsonb
  language plpgsql security definer
  set search_path to 'pg_catalog', 'public', 'pg_temp'
  as $$
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

comment on function public.record_donation(
  text, uuid, uuid, bigint, bigint, bigint, text, boolean, text, text, uuid
) is
  'Idempotent on the Stripe event/intent/session. p_peer_fundraiser_id is '
  'VERIFIED against p_campaign_id before use and dropped to NULL when it does '
  'not belong to that campaign — never trusted from metadata as given.';

-- PostgREST caches the function signature; without this the next RPC call still
-- resolves against the dropped 10-arg form and fails until the pool recycles.
select public.reload_postgrest_schema_cache();
