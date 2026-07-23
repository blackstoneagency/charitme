-- Route-aware AEO content lets each published answer support the page it describes.
alter table aeo_entries
  add column if not exists route text not null default '/faq';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'aeo_entries_public_route_check'
      and conrelid = 'aeo_entries'::regclass
  ) then
    alter table aeo_entries
      add constraint aeo_entries_public_route_check check (
        route like '/%'
        and route not like '%?%'
        and route not like '%#%'
        and route not like '/admin%'
        and route not like '/dashboard%'
        and route not like '/create%'
        and route not like '/login%'
        and route not like '/forgot-password%'
        and route not like '/profile%'
        and route not like '/donor%'
        and route not like '/beneficiary%'
      );
  end if;
end $$;

create index if not exists aeo_entries_route_pub_idx
  on aeo_entries(route, published, priority desc, created_at desc);
