-- Route-aware AEO content lets each published answer support the page it describes.
alter table aeo_entries
  add column if not exists route text not null default '/faq';

create index if not exists aeo_entries_route_pub_idx
  on aeo_entries(route, published, priority desc, created_at desc);
