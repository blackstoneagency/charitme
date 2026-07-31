-- ─────────────────────────────────────────────────────────────────────────────
-- Proximity discovery — coordinates on campaigns.
--
-- `campaigns.location` is free text ("Austin, TX", "Leeds", "remote"). It is
-- fine to display and useless to search by distance: "within 25 miles of me"
-- cannot be answered by string matching, and the near-miss answers it gives are
-- the worst kind — plausible and wrong.
--
-- WHY PLAIN COLUMNS AND NOT POSTGIS
--
-- PostGIS would give a real `geography` type and a GiST index over it. It is
-- deliberately not used here:
--
--   1. `create extension postgis` needs privileges this project's release
--      workflow does not grant, and it is a heavy dependency to add for one
--      feature.
--   2. At CharitMe's scale the query is "campaigns within N miles of a point",
--      bounded by a bounding box on two indexed floats and then refined in the
--      application with the haversine formula. That is exact enough — the error
--      of the flat-earth box is a filter, not the answer — and it needs no
--      extension.
--
-- If proximity ever becomes a primary ranking signal over millions of rows, the
-- upgrade path is a PostGIS column alongside these, backfilled from them. These
-- columns do not block that.
--
-- NULLABLE, and most rows will stay NULL. A campaign has no obligation to have a
-- location, and an online-only fundraiser genuinely has none. Nothing may treat
-- NULL as (0, 0) — that is a real point in the Gulf of Guinea, and a bug there
-- reads as "there is a campaign 3,000 miles away" rather than as missing data.
-- ─────────────────────────────────────────────────────────────────────────────

-- One column per statement. A combined `add column a, add column b` is valid SQL
-- and is read as a single addition by the migration/schema drift checker, which
-- then reports the second column as missing from a fresh provision.
alter table public.campaigns
  add column if not exists latitude double precision;

alter table public.campaigns
  add column if not exists longitude double precision;

-- Reject impossible coordinates at the boundary. A swapped lat/long pair is the
-- single most common geocoding bug, and a longitude of 120 in the latitude
-- column would otherwise be stored happily and silently mislocate the campaign.
-- NOT VALID so the constraint applies to new writes without a full table scan on
-- deploy; existing rows are all NULL, which satisfies it anyway.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'campaigns_latitude_range'
  ) then
    alter table public.campaigns
      add constraint campaigns_latitude_range
      check (latitude is null or (latitude >= -90 and latitude <= 90)) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'campaigns_longitude_range'
  ) then
    alter table public.campaigns
      add constraint campaigns_longitude_range
      check (longitude is null or (longitude >= -180 and longitude <= 180)) not valid;
  end if;
end $$;

-- Partial: the bounding-box query always filters `latitude is not null`, and the
-- majority of rows have no coordinates, so indexing them wastes space and slows
-- writes. Composite because the box constrains both axes together.
create index if not exists campaigns_lat_lng_idx
  on public.campaigns (latitude, longitude)
  where latitude is not null and longitude is not null;

comment on column public.campaigns.latitude is
  'WGS84 latitude, NULL when the campaign has no physical location. Never treat '
  'NULL as 0 — that is a real point at sea.';
comment on column public.campaigns.longitude is
  'WGS84 longitude, NULL when the campaign has no physical location.';

select public.reload_postgrest_schema_cache();
