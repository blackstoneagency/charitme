-- Per-user left-navigation customization.
--
-- The platform-wide shape of the signed-in sidebar is a Super Admin setting and
-- lives in `platform_settings.config.navigation` alongside every other platform
-- setting. THIS table is the other half: one person's own sidebar, so an admin
-- can reorder or hide items on their individual page without changing anyone
-- else's.
--
-- ⚠️ Deliberately NOT a general-purpose preferences table. `hidden` and `order`
-- are lists of HREFs that must already exist in the persona's navigation —
-- lib/nav-customization-core.ts can only reorder or hide, never introduce a
-- link. A nav override is presentation; it is not an authorization surface, and
-- nothing here should ever be able to reveal a route the role does not grant.

create table if not exists public.user_nav_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- hrefs to hide, and hrefs in display order. Unknown entries are ignored by
  -- the reader, so a nav item that is later renamed or removed degrades to "no
  -- customization for that item" instead of a broken sidebar.
  hidden jsonb not null default '[]'::jsonb,
  item_order jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  -- Both columns are LISTS. A jsonb object here would silently produce an empty
  -- override (the parser rejects non-arrays), which looks like "the user saved
  -- nothing" rather than an error.
  constraint user_nav_preferences_hidden_is_array check (jsonb_typeof(hidden) = 'array'),
  constraint user_nav_preferences_order_is_array check (jsonb_typeof(item_order) = 'array')
);

alter table public.user_nav_preferences enable row level security;

-- A person may read and write exactly their own row, and nobody else's. There is
-- deliberately no admin-read policy: this is one person's sidebar layout, it is
-- not moderation surface, and the platform-wide control already exists for the
-- cases an admin legitimately needs.
drop policy if exists user_nav_preferences_select_own on public.user_nav_preferences;
create policy user_nav_preferences_select_own
  on public.user_nav_preferences for select
  using (user_id = auth.uid());

drop policy if exists user_nav_preferences_insert_own on public.user_nav_preferences;
create policy user_nav_preferences_insert_own
  on public.user_nav_preferences for insert
  with check (user_id = auth.uid());

drop policy if exists user_nav_preferences_update_own on public.user_nav_preferences;
create policy user_nav_preferences_update_own
  on public.user_nav_preferences for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists user_nav_preferences_delete_own on public.user_nav_preferences;
create policy user_nav_preferences_delete_own
  on public.user_nav_preferences for delete
  using (user_id = auth.uid());

create or replace function public.touch_user_nav_preferences_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_nav_preferences_touch on public.user_nav_preferences;
create trigger user_nav_preferences_touch
  before update on public.user_nav_preferences
  for each row execute function public.touch_user_nav_preferences_updated_at();
