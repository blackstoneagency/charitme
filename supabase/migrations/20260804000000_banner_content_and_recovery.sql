create table if not exists public.banner_settings (
  id text primary key default 'global',
  enabled boolean not null default true,
  content_title text not null default '',
  content_body text not null default '',
  content_link_label text not null default '',
  content_link_url text not null default '',
  content_revision bigint not null default 1,
  background_color text not null default '#08763b',
  text_color text not null default '#ffffff',
  link_color text not null default '#ffffff',
  font_family text not null default 'inherit',
  font_size_px integer not null default 14,
  title_font_size_px integer not null default 14,
  font_weight integer not null default 400,
  title_font_weight integer not null default 700,
  text_align text not null default 'left',
  letter_spacing_em numeric not null default 0,
  uppercase boolean not null default false,
  padding_y_px integer not null default 9,
  dismissible boolean not null default true,
  use_level_colors boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint banner_settings_singleton_chk check (id = 'global'),
  constraint banner_settings_bg_chk check (background_color ~* '^#[0-9a-f]{3}([0-9a-f]{3})?$'),
  constraint banner_settings_text_chk check (text_color ~* '^#[0-9a-f]{3}([0-9a-f]{3})?$'),
  constraint banner_settings_link_chk check (link_color ~* '^#[0-9a-f]{3}([0-9a-f]{3})?$'),
  constraint banner_settings_font_size_chk check (font_size_px between 10 and 28),
  constraint banner_settings_tfont_size_chk check (title_font_size_px between 10 and 28),
  constraint banner_settings_weight_chk check (font_weight in (300,400,500,600,700,800,900)),
  constraint banner_settings_tweight_chk check (title_font_weight in (300,400,500,600,700,800,900)),
  constraint banner_settings_align_chk check (text_align in ('left','center','right')),
  constraint banner_settings_tracking_chk check (letter_spacing_em between -0.05 and 0.5),
  constraint banner_settings_padding_chk check (padding_y_px between 0 and 40)
);

alter table public.banner_settings add column if not exists content_title text not null default '';
alter table public.banner_settings add column if not exists content_body text not null default '';
alter table public.banner_settings add column if not exists content_link_label text not null default '';
alter table public.banner_settings add column if not exists content_link_url text not null default '';
alter table public.banner_settings add column if not exists content_revision bigint not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.banner_settings'::regclass
      and conname = 'banner_settings_content_title_chk'
  ) then
    alter table public.banner_settings
      add constraint banner_settings_content_title_chk check (char_length(content_title) <= 120);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.banner_settings'::regclass
      and conname = 'banner_settings_content_body_chk'
  ) then
    alter table public.banner_settings
      add constraint banner_settings_content_body_chk check (char_length(content_body) <= 240);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.banner_settings'::regclass
      and conname = 'banner_settings_content_link_label_chk'
  ) then
    alter table public.banner_settings
      add constraint banner_settings_content_link_label_chk check (char_length(content_link_label) <= 60);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.banner_settings'::regclass
      and conname = 'banner_settings_content_link_url_chk'
  ) then
    alter table public.banner_settings
      add constraint banner_settings_content_link_url_chk check (
        char_length(content_link_url) <= 500
        and (
          content_link_url = ''
          or content_link_url ~ '^/($|[^/])'
          or content_link_url ~* '^https://'
        )
      );
  end if;
end
$$;

create or replace function public.banner_settings_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if row(
    new.content_title,
    new.content_body,
    new.content_link_label,
    new.content_link_url
  ) is distinct from row(
    old.content_title,
    old.content_body,
    old.content_link_label,
    old.content_link_url
  ) then
    new.content_revision = old.content_revision + 1;
  end if;
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists banner_settings_touch on public.banner_settings;
create trigger banner_settings_touch
  before update on public.banner_settings
  for each row execute function public.banner_settings_touch();

insert into public.banner_settings (id)
values ('global')
on conflict (id) do nothing;

alter table public.banner_settings enable row level security;
revoke all on table public.banner_settings from anon, authenticated;
grant all on table public.banner_settings to service_role;
