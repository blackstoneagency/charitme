-- Rollback for 20260819000000_donation_forms_slug_and_campaign_owner.sql
--
-- ⛔ DELIBERATELY IRREVERSIBLE. This file exists so the absence of a rollback
-- reads as a decision rather than an oversight, and so anyone who runs it gets
-- the reason instead of a re-opened hole.
--
-- Same shape as the creator_tips case: the migration tightened who can read
-- `donation_forms` and tied forms to their campaign owner. Reverting re-opens
-- that access.
--
-- Note the slug/owner columns it also adds are load-bearing for routing; a
-- partial revert that drops them while leaving the policy would break form URLs
-- rather than restore anything.
--
-- If this genuinely must be reverted, do it by hand, with the owner's sign-off,
-- knowing exactly what becomes readable again. There is no safe automated form.

do $$
begin
  raise exception
    'Refusing to roll back 20260819000000_donation_forms_slug_and_campaign_owner.sql: %',
    'it re-opens donation_forms access that was deliberately scoped';
end
$$;
