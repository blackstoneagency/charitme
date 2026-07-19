-- ─────────────────────────────────────────────────────────────────────────────
-- Durable, cross-instance rate limiting.
--
-- The application's in-memory rate limiter is per-serverless-instance, so on a
-- horizontally-scaled deployment the effective limit is multiplied by the
-- instance count. This table + RPC provide one shared counter so limits hold
-- across every instance. Called from lib/rate-limit-durable.ts via the service
-- role; there are no anon/authenticated policies (RLS on, service-role only).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.rate_limit_hits (
  key       text primary key,
  count     integer not null default 0,
  reset_at  timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_reset_at_idx on public.rate_limit_hits (reset_at);

alter table public.rate_limit_hits enable row level security;
-- No anon/authenticated policies: service role bypasses RLS, everyone else denied.

-- Atomic check-and-increment. A row lock (SELECT ... FOR UPDATE) serializes
-- concurrent calls for the same key so counting is race-free.
create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := now();
  v_row public.rate_limit_hits;
begin
  select * into v_row from public.rate_limit_hits where key = p_key for update;

  if not found then
    insert into public.rate_limit_hits (key, count, reset_at, updated_at)
    values (p_key, 1, v_now + make_interval(secs => p_window_seconds), v_now)
    on conflict (key) do update
      set count = 1, reset_at = excluded.reset_at, updated_at = v_now;
    return true;
  end if;

  -- Window expired → start a fresh window.
  if v_row.reset_at <= v_now then
    update public.rate_limit_hits
      set count = 1, reset_at = v_now + make_interval(secs => p_window_seconds), updated_at = v_now
      where key = p_key;
    return true;
  end if;

  -- Within window and at/over the limit → deny.
  if v_row.count >= p_limit then
    return false;
  end if;

  update public.rate_limit_hits set count = count + 1, updated_at = v_now where key = p_key;
  return true;
end; $$;
