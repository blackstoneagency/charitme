-- ═══════════════════════════════════════════════════════════════════════════
-- A tombstone owner, so deleting an account cannot delete other people's money.
--
-- WHY THIS EXISTS
--
-- `profiles.id` references `auth.users(id) ON DELETE CASCADE`, and 47 tables
-- reference `profiles(id) ON DELETE CASCADE` in turn. Deleting one account
-- therefore removes rows from **87 tables**, and six of them hold money:
--
--   campaigns.user_id          -> donations, donation_receipts, refunds,
--                                 recurring_donations, transparency_ledger_items,
--                                 fundraising_events -> event_tickets, auction_bids
--   creator_profiles.user_id   -> digital_products -> product_orders,
--                                 creator_tips, membership_tiers ->
--                                 member_subscriptions, commission_requests
--   nonprofit_profiles.owner_id-> tax_receipts
--   payouts.user_id
--   matching_claims.employee_id
--   subscriptions.user_id
--
-- Those are other people's donations, receipts and refunds. Deleting a
-- fundraiser's account would erase the giving history of every donor who
-- supported them, silently: the delete succeeds and the totals are just smaller.
--
-- The closure above is COMPUTED from this schema, not hand-listed, by
-- `lib/deletion-cascade.ts`; `__tests__/deletion-cascade.test.ts` fails if a new
-- foreign key ever opens a seventh path to money.
--
-- WHAT THIS DOES
--
-- Creates one permanent profile that owns those records after their human owner
-- is gone. The application reassigns the six columns to it and only then deletes
-- the auth user, so the cascade finds nothing to take.
--
-- ⚠️ The tombstone must never be sign-in-able. It gets no password, no confirmed
-- email, and a ban far in the future. A tombstone that can be signed into is an
-- account that owns every deleted user's campaigns.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tombstone_id CONSTANT uuid := '00000000-0000-4000-8000-0000deadbeef';
BEGIN
  -- `profiles.id` is FK'd to `auth.users`, so the auth row has to exist first.
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at, banned_until,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_super_admin
  )
  VALUES (
    tombstone_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'deleted-user@charitme.invalid',
    -- Not a hash of anything. A bcrypt digest is 60 characters beginning with
    -- $2, so no password can ever verify against this literal.
    'NO_LOGIN',
    NULL,                       -- never confirmed: blocks magic-link sign-in
    -- ⚠️ A FINITE far-future timestamp, NOT 'infinity'.
    --
    -- `'infinity'::timestamptz` is valid PostgreSQL and was the obvious choice.
    -- GoTrue cannot serialise it to JSON, so the auth row becomes permanently
    -- UNREADABLE through the Auth Admin API: getUserById, updateUserById and
    -- deleteUser all return 500 for that id, forever. Measured against
    -- production after this migration was applied — a real user id returns a
    -- clean 404, a random id returns 404, and only the tombstone returns 500.
    --
    -- The row is still there and still unusable for sign-in, but it can no
    -- longer be audited or repaired with anything except raw SQL.
    '2999-12-31 00:00:00+00'::timestamptz,
    '{"provider":"tombstone","providers":["tombstone"]}'::jsonb,
    '{"tombstone":true}'::jsonb,
    now(), now(), false
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, full_name, email, created_at, updated_at)
  VALUES (
    tombstone_id,
    'Deleted User',
    'deleted-user@charitme.invalid',
    now(), now()
  )
  ON CONFLICT (id) DO NOTHING;
END $$;

COMMENT ON TABLE public.profiles IS
  'User profiles. The row 00000000-0000-4000-8000-0000deadbeef is the deletion tombstone: it owns campaigns, payouts, subscriptions, matching claims, nonprofit and creator profiles whose human owner deleted their account, so the donation records attached to them survive. It is not a real account and cannot sign in.';
