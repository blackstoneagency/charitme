-- ─────────────────────────────────────────────────────────────────────────────
-- cause_impact_stats — the four figures in a cause page's "Real Impact" band.
--
-- WHY THIS TABLE EXISTS
--
-- The design shows "125K+ Youth Impacted", "68K+ Athletes Supported", "1,250+
-- Programs Funded", "250+ Communities Reached". None of those is an entity in
-- this schema: nothing records "youth impacted" or "athletes supported", and the
-- country figure beside them is already recorded in docs/ as a fabricated
-- statistic this platform published once and had to retract.
--
-- Two bad options were on the table. Hardcoding the numbers puts unverifiable
-- impact claims in front of donors with an engineer as their only author.
-- Refusing them leaves the page not matching its own design.
--
-- This is the third option, and it is the one a production platform actually
-- wants: the figures are EDITORIAL CONTENT the owner authors, owns and can
-- change without a deploy. Whoever runs the charity is the right author of a
-- claim about its impact — not a hardcoded literal, and not a query that cannot
-- express the claim.
--
-- When a cause has no rows here the band falls back to live measured counts, so
-- an unseeded deployment shows real numbers rather than an empty band.
--
-- `value` is TEXT on purpose: "125K+", "1,250+" and "98%" are display strings,
-- not quantities to arithmetic on. Storing them as numbers would force the
-- formatting decision into code and lose the "+".
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.cause_impact_stats (
  id          uuid primary key default gen_random_uuid(),

  -- Cause slug from lib/causes.ts. Not a foreign key, for the same reason as
  -- cause_stories: causes are a TypeScript vocabulary over campaign categories,
  -- and mirroring that list into the database is the drift this repo has been
  -- bitten by before.
  cause_slug  text        not null,

  -- Display string exactly as it should render, e.g. '125K+'.
  value       text        not null,
  label       text        not null,

  -- Which glyph sits above the figure. Matches the band's existing four icons.
  icon        smallint    not null default 0 check (icon between 0 and 3),
  sort_order  smallint    not null default 0,

  -- ⚠️ Provenance, and the reason this table is defensible.
  -- A published impact claim should be attributable. `source_note` is shown to
  -- admins editing the row, not to visitors — it exists so the person changing
  -- "125K+" has to record where it came from.
  source_note text,

  published   boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- One row per slot per cause; makes the seed idempotent and stops a duplicate
  -- silently rendering five tiles.
  unique (cause_slug, sort_order)
);

create index if not exists cause_impact_stats_cause_idx
  on public.cause_impact_stats (cause_slug, published, sort_order);

alter table public.cause_impact_stats enable row level security;

-- Published rows are public; drafts are not. Same posture as cause_stories.
drop policy if exists cause_impact_stats_public_read on public.cause_impact_stats;
create policy cause_impact_stats_public_read
  on public.cause_impact_stats for select
  using (published = true);

-- Writes are admin-only. An impact claim is not user-generated content.
drop policy if exists cause_impact_stats_admin_write on public.cause_impact_stats;
create policy cause_impact_stats_admin_write
  on public.cause_impact_stats for all
  using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'super_admin'))
  )
  with check (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'super_admin'))
  );

drop trigger if exists cause_impact_stats_touch_updated_at on public.cause_impact_stats;
create trigger cause_impact_stats_touch_updated_at
  before update on public.cause_impact_stats
  for each row execute function public.touch_cause_stories_updated_at();
