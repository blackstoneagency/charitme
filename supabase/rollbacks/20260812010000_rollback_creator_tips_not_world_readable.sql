-- Rollback for 20260812010000_creator_tips_not_world_readable.sql
--
-- ⛔ DELIBERATELY IRREVERSIBLE. This file exists so the absence of a rollback
-- reads as a decision rather than an oversight, and so anyone who runs it gets
-- the reason instead of a re-opened hole.
--
-- The migration replaced `using (true)` on `creator_tips` with an owner/admin
-- policy. Rolling it back restores anonymous SELECT over `supporter_id`,
-- `amount_cents`, `message` and `stripe_payment_intent_id` — who tipped whom,
-- how much, what they said, and a Stripe payment-intent identifier per row.
--
-- The rollback for "we stopped leaking data" is "leak it again". Nothing about a
-- release going wrong makes that the right move, and the standing instruction
-- for this repository is not to weaken RLS.
--
-- If this genuinely must be reverted, do it by hand, with the owner's sign-off,
-- knowing exactly what becomes readable again. There is no safe automated form.

do $$
begin
  raise exception
    'Refusing to roll back 20260812010000_creator_tips_not_world_readable.sql: %',
    'its only effect is to make creator_tips world-readable again';
end
$$;
