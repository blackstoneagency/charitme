do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'seo_settings_private_routes_noindex_check'
      and conrelid = 'seo_settings'::regclass
  ) then
    alter table seo_settings
      add constraint seo_settings_private_routes_noindex_check check (
        noindex = true
        or not (
          route in ('/achievements', '/privacy-center', '/offline')
          or route = '/go'
          or route like '/go/%'
          or route like '/events/manage%'
          or route like '/impact/manage%'
          or route like '/matching/manage%'
          or route like '/sponsor/manage%'
        )
      );
  end if;
end $$;
