#!/usr/bin/env bash
# Rehearse every migration against a throwaway Postgres, in order, stopping on
# the first error — then report what the resulting schema actually contains.
#
# WHY THIS EXISTS SEPARATELY FROM regen_schema.sh
#
# `regen_schema.sh` runs psql with `ON_ERROR_STOP=0` and sends both stdout and
# stderr to /dev/null, because its job is to produce a schema mirror and it
# tolerates partial failures to do so. That means **it cannot fail on a broken
# migration** — a migration that errors is silently skipped and the mirror is
# still written. It is not, and was never meant to be, a verification tool.
#
# This script is the verification tool. It applies each migration individually
# with `ON_ERROR_STOP=1` and names the exact file that fails.
#
# WHY THE CLI LEDGER STUB MATTERS
#
# `supabase_migrations.schema_migrations` is the Supabase CLI's own ledger. It
# exists on every real project. Without it, `20260607900000_prepare_support_
# policy_hardening.sql` — a compatibility shim that reads the ledger to decide
# whether later hardening already ran — aborts, and its abort cascades into
# `20260608000000_production_hardening.sql` failing with "policy already exists".
# Both look like migration bugs and are not. This script creates the ledger and
# inserts each version after applying it, exactly as `supabase db push` does.
#
# Requires: postgresql binaries, and a non-root user (initdb refuses to run as
# root — it is invoked via `su postgres` below).
#
#   ./scripts/rehearse-migrations.sh
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="$(pg_config --bindir 2>/dev/null || echo /usr/lib/postgresql/16/bin)"
# Short path on purpose: a unix socket path over 107 bytes is rejected, and the
# obvious choice of a scratch directory under the repo blows that limit.
WORK="/tmp/pg-rehearse-$$"
PORT="${PGPORT:-55471}"
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
PSQL="psql -h $WORK/sock -p $PORT -U postgres -q -v ON_ERROR_STOP=1"

su postgres -c "$PSQL" >/dev/null <<'SQL'
create extension if not exists "uuid-ossp"; create extension if not exists pgcrypto;
do $$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists supabase_migrations;
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

cat > "$WORK/run.sh" <<RUNNER
#!/bin/bash
ok=0; bad=0
for f in \$(ls $WORK/mig/*.sql | sort); do
  v=\$(basename "\$f" | cut -d_ -f1)
  if psql -h $WORK/sock -p $PORT -U postgres -q -v ON_ERROR_STOP=1 -f "\$f" > $WORK/last.log 2>&1; then
    ok=\$((ok+1))
    psql -h $WORK/sock -p $PORT -U postgres -q -c \
      "insert into supabase_migrations.schema_migrations(version) values ('\$v') on conflict do nothing;" >/dev/null 2>&1
  else
    bad=\$((bad+1))
    echo "FAILED: \$(basename \$f)"
    grep -m2 ERROR $WORK/last.log || true
  fi
done
echo "applied=\$ok failed=\$bad"
[ "\$bad" -eq 0 ]
RUNNER
chmod +x "$WORK/run.sh"; chown postgres:postgres "$WORK/run.sh"

echo "── replaying $(ls "$WORK"/mig/*.sql | wc -l) migrations ──"
su postgres -c "$WORK/run.sh"

echo "── resulting schema ──"
su postgres -c "psql -h $WORK/sock -p $PORT -U postgres -tAc \"
  select 'tables            ' || count(*) from information_schema.tables where table_schema='public'
  union all select 'tables with RLS  ' || count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relrowsecurity
  union all select 'RLS policies     ' || count(*) from pg_policies where schemaname='public';\""

# A clean replay that leaves RLS off somewhere is not a pass: this schema is
# service-role-heavy and an unprotected table is the failure mode that matters.
UNPROTECTED=$(su postgres -c "psql -h $WORK/sock -p $PORT -U postgres -tAc \"
  select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;\"")
echo "── tables WITHOUT RLS: $UNPROTECTED ──"
[ "$UNPROTECTED" -eq 0 ] || { echo "FAIL: every public table must have RLS enabled"; exit 1; }
echo "OK"
