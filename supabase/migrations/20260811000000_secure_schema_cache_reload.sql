create or replace function public.reload_postgrest_schema_cache()
returns void
language sql
security definer
set search_path = pg_catalog
as $$
  select pg_notify('pgrst', 'reload schema');
$$;

revoke all on function public.reload_postgrest_schema_cache()
  from public, anon, authenticated;
grant execute on function public.reload_postgrest_schema_cache()
  to service_role;

select pg_notify('pgrst', 'reload schema');
