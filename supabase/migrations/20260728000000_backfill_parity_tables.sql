-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill creator_profiles + campaign_launch_settings from REAL existing rows
--
-- 20260727000000_reconcile_competitor_parity_tables.sql created these two
-- tables with public-read policies, but left them empty. campaign_launch_settings
-- is read by 10+ live routes (donations, recurring, analytics, settings,
-- rewards, qr-poster, AI assistant), so every real campaign was falling back to
-- implicit defaults instead of having a settings row.
--
-- This is a BACKFILL, not seed data: every row is derived from an existing
-- campaign or an existing profile that actually owns a campaign. No fictional
-- people, campaigns, bios, or imagery are invented — bio is deliberately left
-- NULL rather than fabricated, since creator_profiles is publicly readable on a
-- live fundraising site.
--
-- Idempotent: safe to re-run (unique indexes + ON CONFLICT DO NOTHING).
-- ─────────────────────────────────────────────────────────────────────────────

-- One creator profile per user. Also makes the backfill below re-runnable.
create unique index if not exists creator_profiles_user_id_unique
  on public.creator_profiles (user_id);

-- ── campaign_launch_settings: one row per live campaign ──────────────────────
-- Non-default columns are left to the schema defaults (flexible / fundraiser /
-- usd / US) because `campaigns` carries no currency or country column to source.
insert into public.campaign_launch_settings (campaign_id)
select c.id
from public.campaigns c
where c.deleted_at is null
on conflict (campaign_id) do nothing;

-- ── creator_profiles: one row per profile that actually owns a campaign ──────
-- handle: slug of the real display name (or email local-part), suffixed with a
-- short slice of the user id so it is deterministic AND collision-free.
-- display_name / hero_image_url come from the profile's real values.
insert into public.creator_profiles (user_id, handle, display_name, hero_image_url)
select
  p.id,
  coalesce(
    nullif(
      trim(both '-' from regexp_replace(
        lower(coalesce(nullif(trim(p.full_name), ''), split_part(coalesce(p.email, ''), '@', 1))),
        '[^a-z0-9]+', '-', 'g'
      )),
      ''
    ),
    'creator'
  ) || '-' || left(replace(p.id::text, '-', ''), 6) as handle,
  coalesce(nullif(trim(p.full_name), ''), nullif(split_part(coalesce(p.email, ''), '@', 1), ''), 'CharitMe Creator') as display_name,
  p.avatar_url
from public.profiles p
where exists (
  select 1 from public.campaigns c
  where c.user_id = p.id and c.deleted_at is null
)
on conflict (user_id) do nothing;
