-- ─────────────────────────────────────────────────────────────────────────────
-- Security fix — two live-DB RLS defects found during anon-persona RLS
-- certification (2026-07-20). NOT auto-applied; apply deliberately after review.
--
-- FINDING A (HIGH — live PII/billing leak): profiles_read was `USING (true)`, so
--   any unauthenticated caller holding the public anon key (which ships in the
--   client bundle) could dump EVERY profile row — email, stripe_customer_id,
--   stripe_subscription_id, roles, plan, notification prefs — via
--   GET /rest/v1/profiles?select=email,... (502 rows returned in prod).
--   The app renders all public profile data via the service-role client
--   (supabaseAdmin), which bypasses RLS, so tightening the base-table policy to
--   own-or-admin does not change what the app displays; it only closes the
--   anon dump. If any TRULY public per-column profile surface is needed later,
--   add a dedicated view exposing only safe columns gated on show_public_profile.
--
-- FINDING B (MED — broken RLS / 500 landmine): campaigns_public_read recursed.
--   It did EXISTS(... team_members ...) while team_members.team_campaign_read
--   does EXISTS(... campaigns ...) → mutual recursion → 42P17 "infinite
--   recursion detected in policy for relation campaigns" on ANY RLS-enforced
--   SELECT of campaigns (anon or logged-in user). The app's public campaign
--   pages read via supabaseAdmin (RLS bypassed), so this is not a current
--   outage, but campaigns RLS is effectively non-functional and every anon/user
--   -key read of campaigns 500s. The subquery also had a bug:
--   `tm.campaign_id = tm.id` (should correlate to `campaigns.id`).
--   Fix: evaluate team membership through a SECURITY DEFINER helper (owner-
--   privileged, does not re-enter RLS), mirroring the existing is_admin() pattern.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── FINDING A ────────────────────────────────────────────────────────────────
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select
  using (auth.uid() = id or is_admin());

-- ── FINDING B ────────────────────────────────────────────────────────────────
create or replace function public.is_campaign_team_member(p_campaign_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from team_members tm
    where tm.campaign_id = p_campaign_id
      and tm.user_id = p_user_id
  );
$$;

drop policy if exists campaigns_public_read on campaigns;
create policy campaigns_public_read on campaigns for select
  using (
    (status = 'active' and visibility = 'public' and deleted_at is null)
    or auth.uid() = user_id
    or is_admin()
    or (auth.uid() is not null and public.is_campaign_team_member(id, auth.uid()))
  );
