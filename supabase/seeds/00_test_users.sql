-- =============================================================================
-- CharitMe seed · 00 · Test users  (creates 120 auth users → profiles)
-- -----------------------------------------------------------------------------
-- Many features are per-user (volunteer profiles, saved campaigns, badges,
-- challenge participation), so reaching 100+ rows for them requires 100+ users.
-- Inserting into auth.users fires the on_auth_user_created trigger, which
-- auto-creates the matching public.profiles row.
--
-- HOW TO RUN: paste into the Supabase SQL editor and run. Idempotent — re-running
-- is a no-op (emails conflict → skipped). Test users have NO password (they are
-- for data/feature testing, not for logging in); create a real login separately.
--
-- If your Supabase/GoTrue version rejects this insert, you can skip this file:
-- the feature seeds (01–04) run against whatever users already exist, they just
-- won't reach 100 rows on the strictly per-user tables until you have 100 users.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- DEMO-SEED GUARD — refuses to run unless this database is explicitly marked as
-- a disposable demo/staging target.
--
-- Why: scripts/seed-guard.mjs already protects the JS seed runners, but THESE
-- files are pasted straight into the Supabase SQL editor, which bypasses it
-- entirely — and that is the path that actually loaded demo data into
-- production. These seeds are also NOT idempotent (see the header note: "Run
-- once. Re-running appends more rows"), so an accidental re-run silently
-- duplicates campaigns and donations.
--
-- To run against a throwaway project, execute this FIRST in the same session:
--     set charitme.allow_demo_seed = 'true';
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if coalesce(current_setting('charitme.allow_demo_seed', true), '') <> 'true' then
    raise exception 'Demo seed blocked: this database is not marked as a disposable demo/staging target.'
      using hint = 'If this really is a throwaway project, run  set charitme.allow_demo_seed = ''true'';  in the SAME session, then re-run this file.';
  end if;
end $$;

do $$
begin
  if current_setting('app.charitme_allow_demo_seed', true) <> 'true' then
    raise exception 'Demo seed blocked. Set app.charitme_allow_demo_seed = true only on a disposable staging/demo project.';
  end if;
end $$;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  format('seed.user.%s@charitme.test', g),
  null,
  now(),
  now() - (g || ' hours')::interval,
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object(
    'full_name',
    (array['Alex','Sam','Jordan','Taylor','Casey','Morgan','Riley','Jamie','Avery','Quinn',
           'Drew','Reese','Skyler','Cameron','Peyton','Rowan','Sage','Hayden','Elliot','Blake']
    )[1 + (g % 20)] || ' ' ||
    (array['Rivera','Chen','Patel','Johnson','Garcia','Kim','Nguyen','Silva','Okafor','Rossi',
           'Haddad','Novak','Costa','Adeyemi','Ivanov','Torres','Walsh','Diallo','Park','Reyes']
    )[1 + ((g / 20) % 20)],
    'roles', case when g % 4 = 0 then '["organizer","donor"]'::jsonb else '["donor"]'::jsonb end
  ),
  '', '', '', ''
from generate_series(1, 120) g
where not exists (
  select 1 from auth.users u where u.email = format('seed.user.%s@charitme.test', g)
);

update public.profiles p
set roles = case mod(substring(u.email from 'seed\.user\.(\d+)@')::int, 4)
      when 0 then '["organizer","donor"]'::jsonb
      when 1 then '["beneficiary","donor"]'::jsonb
      when 2 then '["nonprofit","organizer","donor"]'::jsonb
      else '["donor"]'::jsonb
    end,
    is_demo = true
from auth.users u
where u.id = p.id
  and u.email ~ '^seed\.user\.\d+@charitme\.test$';

-- Report how many usable profiles now exist.
do $$
declare n int;
begin
  select count(*) into n from public.profiles;
  raise notice 'CharitMe seed 00: % profiles now exist (target >= 120 for full per-user coverage).', n;
end $$;
