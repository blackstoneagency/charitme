create or replace function public.get_admin_system_resource_usage()
returns table(label text, value int, color text)
language sql
security definer
set search_path = public, pg_catalog
as $$
  with db as (
    select
      greatest(numbackends, 0)::numeric as active_connections,
      greatest(blks_hit, 0)::numeric as blks_hit,
      greatest(blks_read, 0)::numeric as blks_read
    from pg_stat_database
    where datname = current_database()
  ),
  limits as (
    select greatest(current_setting('max_connections')::numeric, 1) as max_connections
  ),
  webhook_health as (
    select
      count(*)::numeric as total_events,
      count(*) filter (where processing_error is null)::numeric as successful_events
    from public.webhook_events
    where created_at >= now() - interval '24 hours'
  )
  select
    'DB Connections'::text,
    least(100, round((db.active_connections / limits.max_connections) * 100)::int),
    '#6c35ff'::text
  from db, limits
  union all
  select
    'Cache Hit Rate'::text,
    case
      when db.blks_hit + db.blks_read = 0 then 100
      else least(100, round((db.blks_hit / (db.blks_hit + db.blks_read)) * 100)::int)
    end,
    '#19b86a'::text
  from db
  union all
  select
    'Webhook Success'::text,
    case
      when webhook_health.total_events = 0 then 100
      else least(100, round((webhook_health.successful_events / webhook_health.total_events) * 100)::int)
    end,
    '#2f80ed'::text
  from webhook_health;
$$;

grant execute on function public.get_admin_system_resource_usage() to authenticated;
grant execute on function public.get_admin_system_resource_usage() to service_role;
