-- ─────────────────────────────────────────────────────────────────────────────
-- Fix a check-then-act race in record_donation that could double-count
-- donations when Stripe delivers the same webhook event concurrently.
--
-- record_donation previously did:
--   SELECT ... (idempotency read)  →  INSERT donation  →  UPDATE campaign totals
-- Two concurrent deliveries of the same checkout.session.completed could both
-- pass the SELECT, both INSERT, and both increment raised_amount/backer_count.
--
-- Fix: take a transaction-level advisory lock keyed on the payment identifiers
-- at the top of the function. Concurrent calls for the SAME donation serialize;
-- the second caller waits, then sees the already-inserted row and returns
-- 'already_processed' without touching campaign totals. Calls for DIFFERENT
-- donations hash to different keys and never block each other.
--
-- This intentionally avoids adding a UNIQUE constraint on donations, which
-- could fail to create against pre-existing rows that have NULL or duplicate
-- payment identifiers (e.g. offline/seed donations). The advisory lock is safe
-- to apply on any existing dataset.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.record_donation(
  p_stripe_event_id          text,
  p_campaign_id              uuid,
  p_donor_id                 uuid,
  p_amount_cents             bigint,
  p_tip_cents                bigint,
  p_processing_fee_cents     bigint,
  p_message                  text,
  p_anonymous                boolean,
  p_stripe_payment_intent_id text,
  p_stripe_checkout_session_id text
) returns jsonb language plpgsql security definer as $$
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

  -- Idempotency check (now race-safe under the advisory lock above)
  select id into v_existing from donations
  where stripe_checkout_session_id = p_stripe_checkout_session_id
     or (stripe_payment_intent_id = p_stripe_payment_intent_id and p_stripe_payment_intent_id is not null)
  limit 1;

  if v_existing is not null then
    return jsonb_build_object('status','already_processed','id', v_existing);
  end if;

  insert into donations (
    campaign_id, donor_id, amount_cents, tip_cents, processing_fee_cents,
    status, anonymous, message, stripe_payment_intent_id, stripe_checkout_session_id
  ) values (
    p_campaign_id, p_donor_id, p_amount_cents, p_tip_cents, p_processing_fee_cents,
    'completed', p_anonymous, p_message, p_stripe_payment_intent_id, p_stripe_checkout_session_id
  );

  update campaigns
  set raised_amount = raised_amount + p_amount_cents,
      backer_count  = backer_count  + 1,
      updated_at    = now()
  where id = p_campaign_id;

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
