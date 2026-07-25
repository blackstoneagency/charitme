-- ─────────────────────────────────────────────────────────────────────────────
-- Security: stop leaking admin configuration to anonymous callers (CHAR-0012)
--
-- `platform_settings` and `feature_flags` are ADMIN configuration tables, but
-- both carried a `*_public_read` SELECT policy with `using (true)`. Because the
-- Supabase anon key ships to every browser, ANY visitor could read:
--   platform_settings.config -> donationFeePercent, platformFeePercent,
--     supportEmail/Phone, stripeLiveMode, maintenanceMode, allowNewRegistrations
--   feature_flags            -> every flag incl. disabled/unreleased features
--     (e.g. referral_program=false), i.e. the unshipped product roadmap
--
-- No credentials were exposed, but neither table has any reason to be world
-- readable. Every application read of these tables goes through `supabaseAdmin`
-- (service role), which bypasses RLS entirely — verified across all 12
-- referencing files (admin pages + API routes); none use the browser client and
-- none read these tables through the cookie/anon server client. Admin access is
-- preserved by the pre-existing is_admin() policies.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists settings_public_read on public.platform_settings;
drop policy if exists flags_public_read on public.feature_flags;

-- Defensive: RLS must stay on so the remaining is_admin() policies are enforced.
alter table if exists public.platform_settings enable row level security;
alter table if exists public.feature_flags     enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix latent infinite RLS recursion in is_admin() (surfaced by the change above)
--
-- is_admin() selects from public.profiles, and profiles' own SELECT policy is
--   (auth.uid() = id) OR is_admin()
-- so is_admin() -> profiles -> is_admin() -> ... until Postgres aborts with
-- 54001 "stack depth limit exceeded". This was previously masked wherever a
-- permissive `using (true)` policy short-circuited the OR; removing the public
-- read policies above exposed it. It affects EVERY table whose only applicable
-- policy is is_admin() — those queries error instead of denying cleanly.
--
-- SECURITY DEFINER makes the profiles lookup run as the function owner, so it
-- is not subject to profiles' RLS and cannot recurse. The predicate is
-- unchanged (`id = auth.uid() and roles ? 'admin'`), so it still only reports
-- whether the CURRENT caller is an admin — no privilege is widened.
-- search_path is pinned so the definer context cannot be hijacked.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and roles ? 'admin'
  );
$$;
