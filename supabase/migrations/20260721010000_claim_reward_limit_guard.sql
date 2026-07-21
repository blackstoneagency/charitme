-- ─────────────────────────────────────────────────────────────────────────────
-- Harden claim_campaign_reward against over-claiming a limited reward.
--
-- The donations route pre-checks `claimed_count < item_limit` before creating the
-- Checkout Session, but that is a check-then-act: two donors can both pass the
-- check, both complete payment, and the webhook's unconditional
-- `claimed_count = claimed_count + 1` then pushes claimed_count past item_limit.
--
-- Fix: the increment now only applies while the reward is under its limit (or
-- has no limit). The single-statement UPDATE is atomic, so concurrent claims
-- cannot exceed item_limit. A claim that arrives after the reward is exhausted
-- simply matches 0 rows (the donation itself still stands — the perk is just no
-- longer available, which the fulfillment UI already reflects via claimed_count).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.claim_campaign_reward(p_reward_id uuid)
returns void language sql security definer set search_path to 'public' as $$
  update public.campaign_rewards
  set claimed_count = claimed_count + 1
  where id = p_reward_id
    and (item_limit is null or claimed_count < item_limit);
$$;
