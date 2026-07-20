#!/usr/bin/env bash
# Regenerate supabase/schema.sql from supabase/migrations/ so the consolidated
# schema can never silently drift from the migrations again.
#
# It spins up a throwaway local Postgres, replays every migration into it, adds
# the feature_flags/admin_settings supplement (via catch_up's generator), dumps
# the public schema, and cleans the dump into supabase/schema.sql.
#
# Requirements: postgresql (initdb/pg_ctl/pg_dump/psql) on PATH, python3, and a
# non-root user (initdb refuses to run as root). Run from the repo root:
#   ./scripts/regen_schema.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="$(pg_config --bindir 2>/dev/null || echo /usr/lib/postgresql/16/bin)"
WORK="$(mktemp -d)"; PGDATA="$WORK/data"; SOCK="$WORK/sock"; PORT="${PGPORT:-55470}"
mkdir -p "$SOCK"
cleanup() { "$PGBIN/pg_ctl" -D "$PGDATA" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$PGDATA" -o "-k $SOCK -p $PORT -c listen_addresses=''" -w start >/dev/null
PSQL="psql -h $SOCK -p $PORT -U postgres -q -v ON_ERROR_STOP=0"

# Supabase-compatible stubs so the migrations load locally.
$PSQL >/dev/null 2>&1 <<'SQL'
create extension if not exists "uuid-ossp"; create extension if not exists pgcrypto;
do $$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create schema if not exists auth; create schema if not exists storage;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb, raw_app_meta_data jsonb, created_at timestamptz default now());
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select 'authenticated'::text $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create table if not exists storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
create or replace function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
set check_function_bodies = off;
SQL

# Build the complete schema via the validated catch-up (migrations + supplement).
python3 "$ROOT/scripts/build_catchup.py" >/dev/null
$PSQL -f "$ROOT/supabase/catch_up.sql" >/dev/null 2>&1

# Dump + clean into supabase/schema.sql.
"$PGBIN/pg_dump" -h "$SOCK" -p "$PORT" -U postgres --schema=public --schema-only \
  --no-owner --no-privileges --no-comments -f "$WORK/dump.sql"
python3 "$ROOT/scripts/clean_schema_dump.py" "$WORK/dump.sql" "$ROOT/supabase/schema.sql"
echo "Regenerated supabase/schema.sql ($(grep -c 'CREATE TABLE' "$ROOT/supabase/schema.sql") tables)."
