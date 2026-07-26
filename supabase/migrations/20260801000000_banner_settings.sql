-- =============================================================================
-- Banner settings — super-admin control of the site-wide announcement banner
-- =============================================================================
-- The green bar above the header was hardcoded: its colours came from a fixed
-- level→colour map in components/AnnouncementBanner.tsx and there was no global
-- kill switch. This table gives super admins one place to (a) show/hide the
-- banner across the whole site and (b) fully control its appearance — colours,
-- font family, sizes, weights, alignment, and density.
--
-- SINGLETON: exactly one row, pinned by a constant primary key, so reads never
-- have to pick between rows and writes are a plain upsert.
--
-- Every appearance value is re-validated in the API (zod) AND at render time
-- before it reaches an inline style, because these strings end up in CSS. The
-- CHECK constraints below are the last line of defence, not the only one.
--
-- RLS: service-role only. Reads go through lib/banner-settings.ts (service role,
-- cached); writes go through /api/admin/super/banner behind guardSuperAdmin().
-- =============================================================================

create table if not exists public.banner_settings (
  id                  text primary key default 'global',

  -- Global kill switch. false → no banner renders anywhere, regardless of how
  -- many announcements are active.
  enabled             boolean not null default true,

  -- Colours (validated as #rgb / #rrggbb before they reach a style attribute)
  background_color    text not null default '#12b76a',
  text_color          text not null default '#ffffff',
  link_color          text not null default '#ffffff',

  -- Typography
  font_family         text not null default 'inherit',
  font_size_px        integer not null default 14,
  title_font_size_px  integer not null default 14,
  font_weight         integer not null default 400,
  title_font_weight   integer not null default 700,
  text_align          text not null default 'left',
  letter_spacing_em   numeric not null default 0,
  uppercase           boolean not null default false,

  -- Layout / density
  padding_y_px        integer not null default 9,
  dismissible         boolean not null default true,

  -- When true the per-announcement level colour wins over background_color, so
  -- a critical alert can still look critical without disabling customisation.
  use_level_colors    boolean not null default false,

  updated_by          uuid references auth.users(id) on delete set null,
  updated_at          timestamptz not null default now(),

  constraint banner_settings_singleton_chk  check (id = 'global'),
  constraint banner_settings_bg_chk         check (background_color ~* '^#[0-9a-f]{3}([0-9a-f]{3})?$'),
  constraint banner_settings_text_chk       check (text_color       ~* '^#[0-9a-f]{3}([0-9a-f]{3})?$'),
  constraint banner_settings_link_chk       check (link_color       ~* '^#[0-9a-f]{3}([0-9a-f]{3})?$'),
  constraint banner_settings_font_size_chk  check (font_size_px       between 10 and 28),
  constraint banner_settings_tfont_size_chk check (title_font_size_px between 10 and 28),
  constraint banner_settings_weight_chk     check (font_weight       in (300,400,500,600,700,800,900)),
  constraint banner_settings_tweight_chk    check (title_font_weight in (300,400,500,600,700,800,900)),
  constraint banner_settings_align_chk      check (text_align in ('left','center','right')),
  constraint banner_settings_tracking_chk   check (letter_spacing_em between -0.05 and 0.5),
  constraint banner_settings_padding_chk    check (padding_y_px between 0 and 40)
);

-- Seed the single row so reads always find settings (defaults reproduce today's
-- green banner exactly, so applying this migration changes nothing visually).
insert into public.banner_settings (id) values ('global') on conflict (id) do nothing;

drop trigger if exists banner_settings_touch on public.banner_settings;
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'marketing_touch_updated_at') then
    create function public.marketing_touch_updated_at()
    returns trigger language plpgsql as 'begin new.updated_at = now(); return new; end';
  end if;
end $$;
create trigger banner_settings_touch
  before update on public.banner_settings
  for each row execute function public.marketing_touch_updated_at();

alter table public.banner_settings enable row level security;
-- (no anon/authenticated policies: service role bypasses RLS, everyone else denied)

-- =============================================================================
-- Rollback (manual): drop table public.banner_settings cascade;
-- =============================================================================
