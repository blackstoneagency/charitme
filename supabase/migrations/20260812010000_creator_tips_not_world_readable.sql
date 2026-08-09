-- `creator_tips` was readable by anyone, including unauthenticated visitors.
--
--   create policy public_creator_tips_read on creator_tips for select using (true);
--
-- The row carries `supporter_id`, `amount_cents`, `message` and
-- `stripe_payment_intent_id`. So an anonymous caller could enumerate who tipped
-- whom, how much, what they said — and pull a Stripe payment intent identifier
-- for each one.
--
-- This reads as an oversight rather than a decision, because the same migration
-- (20260525002000_competitor_parity_features.sql) locks down both of its
-- siblings on the adjacent lines:
--
--   create policy product_orders_private on product_orders for select
--     using (auth.uid() = buyer_id or is_admin());
--   create policy commission_requests_private on commission_requests for select
--     using (auth.uid() = requester_id or is_admin());
--   create policy public_creator_tips_read on creator_tips for select
--     using (true);                                  -- ← the odd one out
--
-- Same shape (a payer, an amount, a payment reference), same file, opposite
-- policy — and `creator_tips` is the only one of the three exposing a Stripe
-- identifier at all.
--
-- Safe to tighten: no application code queries `creator_tips` (it appears only
-- as a table NAME in lib/feature-catalog.ts), and `anon`/`authenticated` hold
-- only SELECT on it — every write already goes through `service_role`, which
-- bypasses RLS. So nothing that works today stops working.
--
-- The replacement follows the siblings, plus the one grant the product plainly
-- needs: a creator can see the tips they received.

drop policy if exists public_creator_tips_read on public.creator_tips;
drop policy if exists creator_tips_private on public.creator_tips;

create policy creator_tips_private on public.creator_tips
  for select using (
    auth.uid() = supporter_id
    or exists (
      select 1 from public.creator_profiles cp
      where cp.id = creator_tips.creator_profile_id
        and cp.user_id = auth.uid()
    )
    or is_admin()
  );
