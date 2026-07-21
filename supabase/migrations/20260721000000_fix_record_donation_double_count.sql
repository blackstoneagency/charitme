-- ─────────────────────────────────────────────────────────────────────────────
-- FIX (CRITICAL, financial accuracy): record_donation double-counted campaign
-- totals.
--
-- The original schema (20260525000000_initial_schema) defines an AFTER INSERT
-- trigger on `donations` — `donations_increment_campaign_stats` →
-- `increment_campaign_stats_after_donation()` — which already increments
-- `campaigns.raised_amount` (+ amount_cents) and `campaigns.backer_count` (+1)
-- for every row inserted with status = 'completed'.
--
-- A later change (20260719120000_record_donation_idempotency_lock) ADDED a manual
-- `update campaigns set raised_amount = raised_amount + p_amount_cents,
-- backer_count = backer_count + 1` inside record_donation — not realizing the
-- trigger already does this. Net effect, proven live: one record_donation call
-- inserts ONE donation row but increments raised_amount by 2× the amount and
-- backer_count by 2. Every webhook donation (one-time + recurring) was inflated.
--
-- Fix: recreate record_donation WITHOUT the manual campaign update. The trigger
-- remains the single source of truth for stat increments (it fires on the INSERT
-- below). Idempotency advisory lock, duplicate check, donation insert, and the
-- webhook_events bookkeeping are unchanged.
--
-- Non-destructive: CREATE OR REPLACE FUNCTION only — no data is modified. Existing
-- rows are untouched; this only corrects go-forward accounting.
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
end; $$;
