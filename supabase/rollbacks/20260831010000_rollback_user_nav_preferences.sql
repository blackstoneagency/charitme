begin;

drop trigger if exists user_nav_preferences_touch on public.user_nav_preferences;
drop function if exists public.touch_user_nav_preferences_updated_at();
drop table if exists public.user_nav_preferences;

commit;
