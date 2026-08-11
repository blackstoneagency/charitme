-- ═══════════════════════════════════════════════════════════════════════════
-- A tombstone GoTrue can actually read — and a repair for every row it cannot.
--
-- ⚠️ THE DIAGNOSIS IN `20260904030000_deleted_user_tombstone.sql` IS WRONG, and
-- acting on it would not have fixed anything.
--
-- That migration blames `banned_until = 'infinity'` for the tombstone's auth row
-- returning 500 from every Admin API call, and prescribes:
--
--     update auth.users set banned_until = '2999-12-31 00:00:00+00' where id = …
--
-- Measured against production on 2026-08-11, that is not the cause:
--
--   · `30000000-0000-4000-8000-000000000001` (the cause-catalog owner, from
--     `20260831000000_seed_priority_cause_catalogs.sql`) sets **no
--     `banned_until` at all** and returns exactly the same 500.
--   · So do 500 `collector###@cardscan.test` rows.
--   · All of them answer with GoTrue's `"Database error loading user"`, which is
--     its generic row-SCAN failure, not a value-range complaint.
--
-- The common factor is not the value in `banned_until`. It is that all of these
-- rows were inserted by **raw SQL** rather than through the Auth API. GoTrue
-- models `confirmation_token`, `recovery_token`, `email_change`, the phone-change
-- pair and friends as non-nullable Go strings, while the columns themselves are
-- nullable with no default. An INSERT that omits them stores NULL, and every
-- subsequent read of that row fails to scan. A row created through
-- `auth.admin.createUser` carries `''` in each — visible as `"phone": ""` in any
-- healthy user's JSON.
--
-- CONSEQUENCE, and it is bigger than one row: `listUsers` loads a PAGE, so a
-- single unreadable row 500s the whole call. 502 of production's 1139 profiles
-- are affected, which is why `/admin/donations` and `/admin/payouts` — both of
-- which call `auth.admin.listUsers({ perPage: 200 })` — get `null` back.
--
-- WHAT THIS DOES
--
--   1. Provisions the tombstone at a NEW id, with every column GoTrue requires
--      populated, so the row is readable the moment it exists.
--   2. Repairs the existing unreadable rows in place — NULL → '', which is what
--      the Auth API would have written.
--
-- ⚠️ (1) uses a new id rather than repairing the old one because production
-- could not be repaired remotely: the poisoned row cannot be read, updated or
-- deleted through the Auth API, and applying SQL needs an access token that the
-- deploy does not have. The replacement was provisioned through
-- `scripts/ensure-tombstone.mjs --id … --commit`, which works with the
-- service-role key alone. This migration exists so every other database
-- converges on the same id rather than on whatever its history happens to hold.
--
-- The old row is left in place and inert: it owns nothing (verified — 0 rows
-- across all 167 foreign keys that reference `profiles`) and cannot be signed
-- into. Step 2 makes it readable again; nothing points at it.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tombstone_id CONSTANT uuid := '00000000-0000-4000-8000-00000000dead';
  -- Emails are UNIQUE in auth.users and the old row still holds
  -- `deleted-user@charitme.invalid`, so the replacement needs its own. Kept
  -- identical to what `scripts/ensure-tombstone.mjs` derives for this id, so the
  -- script and this migration converge instead of fighting.
  tombstone_email CONSTANT text := 'deleted-user-0000dead@charitme.invalid';
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at, banned_until,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_super_admin,
    -- ⚠️ These are the whole point of this migration. Omitting them is what
    -- made every earlier hand-written auth row unreadable. `''`, never NULL.
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token,
    reauthentication_token
  )
  VALUES (
    tombstone_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    tombstone_email,
    -- Not a hash of anything. A bcrypt digest is 60 characters beginning with
    -- $2, so no password can ever verify against this literal.
    'NO_LOGIN',
    NULL,                       -- never confirmed: blocks magic-link sign-in
    -- A FINITE far-future timestamp. `'infinity'::timestamptz` is valid
    -- PostgreSQL and is NOT what broke the original row, but it is still not
    -- worth sending to a Go `time.Time`.
    '2999-12-31 00:00:00+00'::timestamptz,
    '{"provider":"tombstone","providers":["tombstone"]}'::jsonb,
    '{"tombstone":true}'::jsonb,
    now(), now(), false,
    '', '', '', '', '', '', '', ''
  )
  ON CONFLICT (id) DO NOTHING;

  -- ⚠️ DO UPDATE, not DO NOTHING.
  --
  -- The INSERT above fires `handle_new_user`, which creates the profile row
  -- first — so a DO NOTHING here writes no name at all. That is exactly what
  -- happened to the original tombstone in production: `full_name` is NULL, and a
  -- reassigned campaign would render its organiser as blank rather than as
  -- "Deleted User".
  INSERT INTO public.profiles (id, full_name, email, created_at, updated_at)
  VALUES (tombstone_id, 'Deleted User', tombstone_email, now(), now())
  ON CONFLICT (id) DO UPDATE
    SET full_name = 'Deleted User',
        email = EXCLUDED.email,
        updated_at = now();
END $$;

-- ── Repair every row GoTrue cannot load ──────────────────────────────────────
--
-- NULL → '', which is what the Auth API writes. Touches only rows that are
-- already unreadable, so it cannot change the behaviour of a working account.
--
-- Column-by-column and guarded on existence, because this set has grown across
-- GoTrue versions and a missing column would abort the whole migration on an
-- older project.
DO $$
DECLARE
  col text;
  repaired integer;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'confirmation_token', 'recovery_token', 'email_change',
    'email_change_token_new', 'email_change_token_current',
    'phone_change', 'phone_change_token', 'reauthentication_token'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = col
    ) THEN
      EXECUTE format('UPDATE auth.users SET %I = %L WHERE %I IS NULL', col, '', col);
      GET DIAGNOSTICS repaired = ROW_COUNT;
      IF repaired > 0 THEN
        RAISE NOTICE 'auth.users.% : repaired % NULL row(s)', col, repaired;
      END IF;
    END IF;
  END LOOP;

  -- Belt and braces: the original migration's `'infinity'` is not what broke the
  -- row, but an unbounded timestamp still has no business in a Go time.Time.
  UPDATE auth.users
     SET banned_until = '2999-12-31 00:00:00+00'::timestamptz
   WHERE banned_until = 'infinity'::timestamptz;
END $$;

COMMENT ON TABLE public.profiles IS
  'User profiles. The row 00000000-0000-4000-8000-00000000dead is the deletion tombstone: it owns campaigns, payouts, subscriptions, matching claims, nonprofit and creator profiles whose human owner deleted their account, so the donation records attached to them survive. It is not a real account and cannot sign in. It replaces 00000000-0000-4000-8000-0000deadbeef, whose auth row was left unreadable by a raw-SQL insert that stored NULL in the token columns GoTrue scans as non-nullable strings.';
