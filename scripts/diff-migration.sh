#!/usr/bin/env bash
# Print exactly what one migration adds, measured rather than parsed.
#
# Replays every migration up to (but not including) the target, snapshots the
# schema, applies the target, and diffs. Parsing the SQL by hand gets this wrong
# — `add column` appears in several forms, some inside DO blocks that build
# statements with format(), and those are invisible to a grep.
#
#   ./scripts/diff-migration.sh 20260817000000
#
set -euo pipefail
TARGET="${1:?usage: diff-migration.sh <version>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="$(pg_config --bindir 2>/dev/null || echo /usr/lib/postgresql/16/bin)"
PORT="${PGPORT:-55473}"
WORK="/tmp/pg-diff-$$"
cleanup() {
  su postgres -c "$PGBIN/pg_ctl -D $WORK/data stop -m immediate" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

mkdir -p "$WORK/data" "$WORK/sock" "$WORK/mig"
cp "$ROOT"/supabase/migrations/*.sql "$WORK/mig/"
chown -R postgres:postgres "$WORK"
su postgres -c "$PGBIN/initdb -D $WORK/data -U postgres --auth=trust" >/dev/null
su postgres -c "$PGBIN/pg_ctl -D $WORK/data -o \"-k $WORK/sock -p $PORT -h ''\" -w start" >/dev/null

su postgres -c "psql -h $WORK/sock -p $PORT -U postgres -q -v ON_ERROR_STOP=1" >/dev/null <<'SQL'
create extension if not exists "uuid-ossp"; create extension if not exists pgcrypto;
do $$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create schema if not exists auth; create schema if not exists storage; create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb, raw_app_meta_data jsonb, created_at timestamptz default now());
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select 'authenticated'::text $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create table if not exists storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
create or replace function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
set check_function_bodies = off;
SQL

Q_COLS="select table_name||'.'||column_name from information_schema.columns where table_schema='public' order by 1"
Q_IDX="select indexname from pg_indexes where schemaname='public' order by 1"
Q_TBL="select table_name from information_schema.tables where table_schema='public' order by 1"

cat > "$WORK/upto.sh" <<UPTO
#!/bin/bash
for f in \$(ls $WORK/mig/*.sql | sort); do
  v=\$(basename "\$f" | cut -d_ -f1)
  [ "\$v" \> "$TARGET" ] && break
  [ "\$v" = "$TARGET" ] && break
  psql -h $WORK/sock -p $PORT -U postgres -q -v ON_ERROR_STOP=1 -f "\$f" >/dev/null 2>&1 || exit 1
  psql -h $WORK/sock -p $PORT -U postgres -q -c "insert into supabase_migrations.schema_migrations(version) values ('\$v') on conflict do nothing;" >/dev/null 2>&1
done
psql -h $WORK/sock -p $PORT -U postgres -tAc "$Q_COLS" > $WORK/cols.before
psql -h $WORK/sock -p $PORT -U postgres -tAc "$Q_IDX"  > $WORK/idx.before
psql -h $WORK/sock -p $PORT -U postgres -tAc "$Q_TBL"  > $WORK/tbl.before
psql -h $WORK/sock -p $PORT -U postgres -q -v ON_ERROR_STOP=1 -f \$(ls $WORK/mig/${TARGET}_*.sql | head -1) >/dev/null 2>&1 || { echo "TARGET FAILED"; exit 1; }
psql -h $WORK/sock -p $PORT -U postgres -tAc "$Q_COLS" > $WORK/cols.after
psql -h $WORK/sock -p $PORT -U postgres -tAc "$Q_IDX"  > $WORK/idx.after
psql -h $WORK/sock -p $PORT -U postgres -tAc "$Q_TBL"  > $WORK/tbl.after
UPTO
chmod +x "$WORK/upto.sh"; chown postgres:postgres "$WORK/upto.sh"
su postgres -c "$WORK/upto.sh"

echo "── $TARGET adds ──"
echo "TABLES:";  comm -13 "$WORK/tbl.before"  "$WORK/tbl.after"  | sed 's/^/  /'
echo "COLUMNS:"; comm -13 "$WORK/cols.before" "$WORK/cols.after" | sed 's/^/  /'
echo "INDEXES:"; comm -13 "$WORK/idx.before"  "$WORK/idx.after"  | sed 's/^/  /'
