do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'aeo_entries_private_routes_published_check'
      and conrelid = 'aeo_entries'::regclass
  ) then
    alter table aeo_entries
      add constraint aeo_entries_private_routes_published_check check (
        published = false
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

insert into aeo_entries (question, answer, topic, schema_type, priority, published, route)
select
  'What fundraising activities are prohibited on CharitMe?',
  'CharitMe prohibits illegal activity, fraud, hate or abuse, regulated goods, deceptive fundraising, and campaigns that violate our trust and safety rules. Review the full policy before launching a campaign.',
  'Trust and safety',
  'FAQPage',
  80,
  true,
  '/prohibited-use'
where not exists (
  select 1 from aeo_entries where route = '/prohibited-use' and published = true
);
