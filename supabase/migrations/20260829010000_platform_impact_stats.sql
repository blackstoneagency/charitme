-- ─────────────────────────────────────────────────────────────────────────────
-- platform_impact_stats + platform_fund_allocation — the /impact page's figures.
--
-- WHY THESE TABLES EXIST
--
-- The /impact reference design shows five headline tiles ("2.3M+ People Helped",
-- "68K+ Lives Transformed", "1,250+ Programs Funded", "120+ Countries Reached",
-- "98% Funds to Programs") and a Funds Distribution donut ("Programs & Services
-- 82%, Fundraising 10%, Operations 6%, Other 2%").
--
-- NONE of that is derivable from this schema. Nothing records a person helped or
-- a life transformed, and there is no expense ledger from which a spend breakdown
-- could be computed. The page therefore had two bad options and took neither:
-- hardcoding the numbers (an unverifiable impact claim, and in the donut's case a
-- fabricated FINANCIAL DISCLOSURE, on a site that takes real donations — this
-- platform published a fabricated statistic once already and had to retract it),
-- or omitting the sections and not matching its own design.
--
-- This is the third option, and it is what a production charity platform actually
-- needs: the figures are EDITORIAL CONTENT the owner authors, owns, and can change
-- without a deploy. Whoever runs the organisation is the right author of a claim
-- about its impact and its spending — not an engineer, and not a literal in a TSX
-- file.
--
-- ⚠️ SEEDED UNPUBLISHED ON PURPOSE. supabase/seed/platform_impact.sql carries the
-- design's exact values with `published = false`. Publishing them is a deliberate
-- act by someone who can stand behind the numbers. Until then the page falls back
-- to figures it can actually measure, so an unseeded deployment shows real data
-- rather than an empty band.
--
-- `value` is TEXT because "2.3M+", "1,250+" and "98%" are display strings, not
-- quantities to do arithmetic on. Storing them as numbers would force the
-- formatting decision into code and lose the "+".
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.platform_impact_stats (
  id          uuid primary key default gen_random_uuid(),

  -- Display string exactly as it should render, e.g. '2.3M+'.
  value       text        not null,
  label       text        not null,

  -- Which glyph sits beside the figure, matching the reference's five icons:
  -- 0 people, 1 heart, 2 gift, 3 globe, 4 leaf.
  icon        smallint    not null default 0 check (icon between 0 and 4),
  sort_order  smallint    not null default 0,

  -- ⚠️ Provenance, and the reason this table is defensible.
  -- A published impact claim should be attributable. `source_note` is shown to
  -- admins editing the row, never to visitors — it exists so the person who
  -- publishes "2.3M+ People Helped" has to record where the number came from.
  source_note text,

  published   boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- One row per slot; makes the seed idempotent and stops a duplicate silently
  -- rendering a sixth tile in a five-tile strip.
  unique (sort_order)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- The donut. Held apart from the tiles above because it is a different KIND of
-- claim: how the organisation spends money, not how many people it reached. A
-- reviewer should be able to publish impact figures without also publishing a
-- spend breakdown, and vice versa.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.platform_fund_allocation (
  id          uuid primary key default gen_random_uuid(),

  label       text        not null,
  -- Whole percent. Numeric here (unlike `value` above) because these are summed
  -- and drawn as arc lengths — they ARE quantities.
  percent     smallint    not null check (percent >= 0 and percent <= 100),

  -- Segment colour slot, so the palette lives in CSS rather than the database.
  color_index smallint    not null default 0 check (color_index between 0 and 5),
  sort_order  smallint    not null default 0,

  source_note text,
  published   boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (sort_order)
);

create index if not exists platform_impact_stats_published_idx
  on public.platform_impact_stats (published, sort_order);
create index if not exists platform_fund_allocation_published_idx
  on public.platform_fund_allocation (published, sort_order);

alter table public.platform_impact_stats   enable row level security;
alter table public.platform_fund_allocation enable row level security;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Published rows are public; drafts are not. An unpublished figure is a claim
-- nobody has signed off on yet, and must not be world-readable.
drop policy if exists platform_impact_stats_public_read on public.platform_impact_stats;
create policy platform_impact_stats_public_read
  on public.platform_impact_stats for select
  using (published = true);

drop policy if exists platform_fund_allocation_public_read on public.platform_fund_allocation;
create policy platform_fund_allocation_public_read
  on public.platform_fund_allocation for select
  using (published = true);

-- Writes are admin-only. An impact or spending claim is not user-generated content.
--
-- ⚠️ `public.is_admin()`, NOT `profiles.role in (...)`. There is no `role` column:
-- 20260823500000 added one only as a replay bridge and 20260828000000 drops it
-- again, so a `p.role` predicate raises 42703 on a database provisioned from
-- scratch — which is precisely how the replay job caught this. Canonical roles
-- live in `profiles.roles`, and `is_admin()` is the SECURITY DEFINER predicate
-- the rest of the platform's editorial tables already use.
drop policy if exists platform_impact_stats_admin_write on public.platform_impact_stats;
create policy platform_impact_stats_admin_write
  on public.platform_impact_stats for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists platform_fund_allocation_admin_write on public.platform_fund_allocation;
create policy platform_fund_allocation_admin_write
  on public.platform_fund_allocation for all
  using (public.is_admin())
  with check (public.is_admin());

-- Reuses the touch function the cause editorial tables already install.
create or replace function public.touch_platform_editorial_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists platform_impact_stats_touch on public.platform_impact_stats;
create trigger platform_impact_stats_touch
  before update on public.platform_impact_stats
  for each row execute function public.touch_platform_editorial_updated_at();

drop trigger if exists platform_fund_allocation_touch on public.platform_fund_allocation;
create trigger platform_fund_allocation_touch
  before update on public.platform_fund_allocation
  for each row execute function public.touch_platform_editorial_updated_at();

comment on table public.platform_impact_stats is
  'Owner-authored headline figures for /impact. Unpublished by default; the page '
  'falls back to measured counts until an admin publishes a row and records its source.';
comment on table public.platform_fund_allocation is
  'Owner-authored spend breakdown for the /impact donut. A FINANCIAL DISCLOSURE — '
  'publishing a row asserts how donated money is used, so source_note is expected.';
