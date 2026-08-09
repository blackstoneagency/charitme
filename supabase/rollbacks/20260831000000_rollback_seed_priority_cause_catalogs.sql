delete from public.aeo_entries
where route in (
  '/causes/health-wellness',
  '/causes/education',
  '/causes/faith-belief'
)
  and id = uuid_generate_v5(uuid_ns_url(), 'https://www.charitme.com/aeo' || route || '/' || question);

delete from public.campaigns
where user_id = '30000000-0000-4000-8000-000000000001'::uuid
  and slug like 'charitme-example-%';

delete from auth.users
where id = '30000000-0000-4000-8000-000000000001'::uuid
  and email = 'cause-catalog@charitme.invalid'
  and not exists (
    select 1 from public.campaigns
    where user_id = '30000000-0000-4000-8000-000000000001'::uuid
  );
