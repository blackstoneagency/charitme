drop function if exists public.reload_postgrest_schema_cache();

select pg_notify('pgrst', 'reload schema');
