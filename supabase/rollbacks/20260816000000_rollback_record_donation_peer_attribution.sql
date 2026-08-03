-- Rollback for 20260816000000 — RESTORES THE PREVIOUS FUNCTION BODY.
--
-- ⚠️ Generated, not written. The inverse of `create or replace function` is
-- the previous definition, and a near-miss compiles fine and behaves
-- differently. This body came from `pg_get_functiondef()` on a database
-- replayed to the migration immediately before 20260816000000, and
-- `scripts/generate-function-rollback.sh` re-derives and byte-compares it.
--
-- Regenerate:  ./scripts/generate-function-rollback.sh 20260816000000 record_donation

-- Drop the signatures the target migration leaves behind, so a changed
-- parameter list cannot leave two overloads resolvable.
drop function if exists public.record_donation(p_stripe_event_id text, p_campaign_id uuid, p_donor_id uuid, p_amount_cents bigint, p_tip_cents bigint, p_processing_fee_cents bigint, p_message text, p_anonymous boolean, p_stripe_payment_intent_id text, p_stripe_checkout_session_id text, p_peer_fundraiser_id uuid) cascade;

CREATE OR REPLACE FUNCTION public.record_donation(p_stripe_event_id text, p_campaign_id uuid, p_donor_id uuid, p_amount_cents bigint, p_tip_cents bigint, p_processing_fee_cents bigint, p_message text, p_anonymous boolean, p_stripe_payment_intent_id text, p_stripe_checkout_session_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  v_existing uuid;
  v_lock_key text;
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

  -- The AFTER INSERT trigger donations_increment_campaign_stats increments
  -- campaigns.raised_amount / backer_count for this 'completed' row. Do NOT
  -- increment again here — that double-counts (see migration header).
  insert into donations (
    campaign_id, donor_id, amount_cents, tip_cents, processing_fee_cents,
    status, anonymous, message, stripe_payment_intent_id, stripe_checkout_session_id
  ) values (
    p_campaign_id, p_donor_id, p_amount_cents, p_tip_cents, p_processing_fee_cents,
    'completed', p_anonymous, p_message, p_stripe_payment_intent_id, p_stripe_checkout_session_id
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
end; $function$
;
