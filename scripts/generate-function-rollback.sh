#!/usr/bin/env bash
# Generate — and then PROVE — a rollback for a `create or replace function`
# migration.
#
# The inverse of `create or replace` is "restore the previous body", which is the
# one rollback shape you cannot write by hand with confidence: the previous body
# lives in some earlier migration, may have been replaced several times, and a
# near-miss compiles fine and behaves differently. Two of these functions are
# `record_donation`, the RPC the Stripe webhook calls, so a near-miss is a
# money bug.
#
# So nothing here is transcribed. The script replays every migration up to (not
# including) the target, asks Postgres for the exact definition with
# `pg_get_functiondef()`, and writes THAT. Then it applies the target, applies
# the generated rollback, and re-reads the definition — the rollback is only
# accepted if the text matches the pre-target snapshot byte for byte.
#
#   ./scripts/generate-function-rollback.sh <version> <fn> [fn...]
#
set -euo pipefail
TARGET="${1:?usage: generate-function-rollback.sh <version> <fn> [fn...]}"; shift
FNS=("$@")
[ ${#FNS[@]} -gt 0 ] || { echo "name at least one function"; exit 2; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="$(pg_config --bindir 2>/dev/null || echo /usr/lib/postgresql/16/bin)"
PORT="${PGPORT:-55476}"
WORK="/tmp/pg-fnrb-$$"
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

# `pg_get_functiondef` per overload, ordered so the text is comparable run to run.
NAME_LIST=$(printf "'%s'," "${FNS[@]}" | sed 's/,$//')
Q_DEF="select pg_get_functiondef(p.oid)||';' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ($NAME_LIST) order by p.proname, pg_get_function_identity_arguments(p.oid)"
Q_SIG="select 'drop function if exists public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||') cascade;' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ($NAME_LIST) order by 1"
# Triggers matter: dropping a function CASCADEs to every trigger that calls it,
# so restoring only the body leaves the trigger gone. Measured on
# volunteer_hours_guard_verification, whose guard trigger vanished silently while
# the function comparison reported a perfect match.
Q_TRG="select pg_get_triggerdef(t.oid)||';' from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid where n.nspname='public' and not t.tgisinternal and p.proname in ($NAME_LIST) order by 1"

cat > "$WORK/run.sh" <<RUNNER
#!/bin/bash
set -e
apply_upto() {
  for f in \$(ls $WORK/mig/*.sql | sort); do
    v=\$(basename "\$f" | cut -d_ -f1)
    [ "\$v" \\> "$TARGET" ] && break
    [ "\$v" = "$TARGET" ] && [ "\$1" = "before" ] && break
    psql -h $WORK/sock -p $PORT -U postgres -q -v ON_ERROR_STOP=1 -f "\$f" >/dev/null 2>&1 || { echo "APPLY FAILED \$(basename \$f)"; exit 1; }
    psql -h $WORK/sock -p $PORT -U postgres -q -c "insert into supabase_migrations.schema_migrations(version) values ('\$v') on conflict do nothing;" >/dev/null 2>&1
    [ "\$v" = "$TARGET" ] && break
  done
}
apply_upto before
psql -h $WORK/sock -p $PORT -U postgres -tA -c "$Q_DEF" > $WORK/def.before
psql -h $WORK/sock -p $PORT -U postgres -tA -c "$Q_SIG" > $WORK/sig.before
psql -h $WORK/sock -p $PORT -U postgres -tA -c "$Q_TRG" > $WORK/trg.before
psql -h $WORK/sock -p $PORT -U postgres -q -v ON_ERROR_STOP=1 -f \$(ls $WORK/mig/${TARGET}_*.sql|head -1) >/dev/null 2>&1
psql -h $WORK/sock -p $PORT -U postgres -tA -c "$Q_SIG" > $WORK/sig.after
RUNNER
chmod +x "$WORK/run.sh"; chown postgres:postgres "$WORK/run.sh"
su postgres -c "$WORK/run.sh"

if [ ! -s "$WORK/def.before" ]; then
  echo "✗ no prior definition found for ${FNS[*]} before $TARGET — nothing to restore"
  exit 1
fi

OUT="$WORK/rollback.sql"
{
  echo "-- Rollback for ${TARGET} — RESTORES THE PREVIOUS FUNCTION BODY."
  echo "--"
  echo "-- ⚠️ Generated, not written. The inverse of \`create or replace function\` is"
  echo "-- the previous definition, and a near-miss compiles fine and behaves"
  echo "-- differently. This body came from \`pg_get_functiondef()\` on a database"
  echo "-- replayed to the migration immediately before ${TARGET}, and"
  echo "-- \`scripts/generate-function-rollback.sh\` re-derives and byte-compares it."
  echo "--"
  echo "-- Regenerate:  ./scripts/generate-function-rollback.sh ${TARGET} ${FNS[*]}"
  echo ""
  echo "-- Drop the signatures the target migration leaves behind, so a changed"
  echo "-- parameter list cannot leave two overloads resolvable."
  cat "$WORK/sig.after"
  echo ""
  cat "$WORK/def.before"
  if [ -s "$WORK/trg.before" ]; then
    echo ""
    echo "-- Triggers that called these functions. The drops above cascade them"
    echo "-- away, so restoring the body alone would silently remove the guard."
    cat "$WORK/trg.before"
  fi
} > "$OUT"

# ── Prove it: apply the rollback and require byte-identical definitions ───────
cp "$OUT" "$WORK/verify.sql"; chown postgres:postgres "$WORK/verify.sql"
su postgres -c "psql -h $WORK/sock -p $PORT -U postgres -q -v ON_ERROR_STOP=1 -f $WORK/verify.sql" >/dev/null
su postgres -c "psql -h $WORK/sock -p $PORT -U postgres -tA -c \"$Q_DEF\"" > "$WORK/def.restored"
su postgres -c "psql -h $WORK/sock -p $PORT -U postgres -tA -c \"$Q_TRG\"" > "$WORK/trg.restored"

if diff -q "$WORK/def.before" "$WORK/def.restored" >/dev/null && diff -q "$WORK/trg.before" "$WORK/trg.restored" >/dev/null; then
  DEST="$ROOT/supabase/rollbacks/${TARGET}_rollback_$(ls "$ROOT"/supabase/migrations/${TARGET}_*.sql | head -1 | xargs basename | sed "s/^${TARGET}_//;s/\.sql$//").sql"
  cp "$OUT" "$DEST"
  echo "✓ $TARGET — definition AND triggers byte-identical to pre-migration state ($(wc -l < "$WORK/trg.before") trigger(s))"
  echo "  wrote $(basename "$DEST")"
else
  echo "✗ $TARGET — restored state DIFFERS from pre-migration state; not written"
  diff "$WORK/def.before" "$WORK/def.restored" | head -12
  diff "$WORK/trg.before" "$WORK/trg.restored" | head -12
  exit 1
fi
