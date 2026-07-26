drop trigger if exists banner_settings_touch on public.banner_settings;
drop function if exists public.banner_settings_touch();

alter table if exists public.banner_settings
  drop constraint if exists banner_settings_content_title_chk,
  drop constraint if exists banner_settings_content_body_chk,
  drop constraint if exists banner_settings_content_link_label_chk,
  drop constraint if exists banner_settings_content_link_url_chk,
  drop column if exists content_title,
  drop column if exists content_body,
  drop column if exists content_link_label,
  drop column if exists content_link_url,
  drop column if exists content_revision;
