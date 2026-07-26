-- ─────────────────────────────────────────────────────────────────────────────
-- Gate the parity tables' public reads to match campaign visibility
--
-- 20260727001000_reconcile_competitor_parity_tables.sql gave both tables blanket
-- `using (true)` SELECT policies. That is inconsistent with campaigns_public_read,
-- which only publishes `status='active' AND visibility='public' AND deleted_at IS NULL`.
--
-- Measured on production before this change: 500 campaigns, of which only 350 are
-- publicly visible — so 150 rows (50 draft, 50 paused, 50 completed) were readable
-- by anonymous callers. Draft campaigns are the real problem: an anonymous user
-- could enumerate campaign_launch_settings and learn that an unpublished campaign
-- exists, along with its funding_model / launch_type / product_stage, even though
-- the campaign row itself is hidden.
--
-- Owners and admins keep full access through the existing *_owner_write ALL
-- policies (ALL covers SELECT), so dashboards and drafts are unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

-- campaign_launch_settings: publish only for publicly visible campaigns.
drop policy if exists public_campaign_launch_read on public.campaign_launch_settings;
create policy public_campaign_launch_read on public.campaign_launch_settings
  for select
  using (
    exists (
      select 1
      from public.campaigns c
      where c.id = campaign_launch_settings.campaign_id
        and c.deleted_at is null
        and c.status = 'active'
        and c.visibility = 'public'
    )
  );

-- creator_profiles: publish only creators who already have a public campaign.
-- Their display name is public on that campaign page anyway, so this exposes
-- nothing new — while keeping creators whose only campaigns are drafts private.
drop policy if exists public_creator_profiles_read on public.creator_profiles;
create policy public_creator_profiles_read on public.creator_profiles
  for select
  using (
    exists (
      select 1
      from public.campaigns c
      where c.user_id = creator_profiles.user_id
        and c.deleted_at is null
        and c.status = 'active'
        and c.visibility = 'public'
    )
  );
