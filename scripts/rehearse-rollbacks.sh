#!/usr/bin/env bash
# Rehearse rollback scripts: replay every migration, apply one rollback, and
# assert the objects it claims to remove are actually gone — and that nothing
# else disappeared with them.
#
# A rollback script nobody has run is a guess. This runs them.
#
# Each rollback is exercised against a FRESH database, because rollbacks are not
# independent: dropping `organizations` cascades into anything referencing it, so
# running them in sequence would measure the wrong thing.
#
# ⚠️ Only covers rollbacks whose inverse is unambiguous — the table-creating
# migrations. It deliberately does NOT cover:
#   * `create or replace function` migrations, whose true inverse is "restore the
#     previous definition", not `drop`. Two of them replace `record_donation`,
#     the RPC the Stripe webhook calls, so a drop-style rollback would break the
#     donation path.
#   * policy/RLS migrations, whose rollback re-exposes deliberately closed data.
#
# Requires postgresql binaries and a non-root user (initdb refuses root).
#
#   ./scripts/rehearse-rollbacks.sh
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="$(pg_config --bindir 2>/dev/null || echo /usr/lib/postgresql/16/bin)"
PORT="${PGPORT:-55472}"

# version:table,table,...  — what each rollback must remove.
CASES=(
  "20260806000000:volunteer_hours,volunteer_shifts"
  "20260807000000:brands,organization_members,organizations"
  "20260820000000:maintenance_windows,incident_updates,incidents"
  "20260821000000:tasks"
  "20260822000000:data_retention_runs,data_retention_policies"
  "20260823000000:custom_domains"
)

FAILURES=0
for case in "${CASES[@]}"; do
  VERSION="${case%%:*}"; TABLES="${case#*:}"
  RB=$(ls "$ROOT"/supabase/rollbacks/${VERSION}_*.sql 2>/dev/null | head -1)
  if [ -z "$RB" ]; then echo "MISSING rollback for $VERSION"; FAILURES=$((FAILURES+1)); continue; fi

  WORK="/tmp/pg-rb-$$-$VERSION"
  rm -rf "$WORK"; mkdir -p "$WORK/data" "$WORK/sock" "$WORK/mig"
  cp "$ROOT"/supabase/migrations/*.sql "$WORK/mig/"
  cp "$RB" "$WORK/rollback.sql"
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

  cat > "$WORK/apply.sh" <<APPLY
#!/bin/bash
for f in \$(ls $WORK/mig/*.sql | sort); do
  v=\$(basename "\$f" | cut -d_ -f1)
  psql -h $WORK/sock -p $PORT -U postgres -q -v ON_ERROR_STOP=1 -f "\$f" > $WORK/err.log 2>&1 || { echo "APPLY FAILED: \$(basename \$f)"; grep -m1 ERROR $WORK/err.log; exit 1; }
  psql -h $WORK/sock -p $PORT -U postgres -q -c "insert into supabase_migrations.schema_migrations(version) values ('\$v') on conflict do nothing;" >/dev/null 2>&1
done
APPLY
  chmod +x "$WORK/apply.sh"; chown postgres:postgres "$WORK/apply.sh"
  su postgres -c "$WORK/apply.sh"

  count() { su postgres -c "psql -h $WORK/sock -p $PORT -U postgres -tAc \"select count(*) from information_schema.tables where table_schema='public';\""; }
  # Constraints are counted separately because tables alone hid real damage: the
  # organizations rollback cascaded into 15 foreign keys across the marketing
  # subsystem while every table survived, so a table-only check reported "no
  # collateral" on a rollback that silently unpicked org scoping.
  # Counts foreign keys on tables that SURVIVE the rollback. FKs owned by the
  # dropped tables go with them by definition and are not collateral; counting
  # them made every rollback look damaging and hid the one that is.
  SURVIVOR_FILTER=$(printf "'%s'," ${TABLES//,/ } | sed 's/,$//')
  fks() { su postgres -c "psql -h $WORK/sock -p $PORT -U postgres -tAc \"select count(*) from information_schema.table_constraints where constraint_schema='public' and constraint_type='FOREIGN KEY' and table_name not in ($SURVIVOR_FILTER);\""; }
  BEFORE=$(count); FK_BEFORE=$(fks)

  # Every target must exist before the rollback, or the check below is vacuous.
  MISSING_BEFORE=""
  for t in ${TABLES//,/ }; do
    n=$(su postgres -c "psql -h $WORK/sock -p $PORT -U postgres -tAc \"select count(*) from information_schema.tables where table_schema='public' and table_name='$t';\"")
    [ "$n" = "1" ] || MISSING_BEFORE="$MISSING_BEFORE $t"
  done
  if [ -n "$MISSING_BEFORE" ]; then
    echo "✗ $VERSION — target table(s) absent BEFORE rollback:$MISSING_BEFORE (test would be vacuous)"
    FAILURES=$((FAILURES+1))
  else
    su postgres -c "psql -h $WORK/sock -p $PORT -U postgres -q -v ON_ERROR_STOP=1 -f $WORK/rollback.sql" >/dev/null
    STILL=""
    for t in ${TABLES//,/ }; do
      n=$(su postgres -c "psql -h $WORK/sock -p $PORT -U postgres -tAc \"select count(*) from information_schema.tables where table_schema='public' and table_name='$t';\"")
      [ "$n" = "0" ] || STILL="$STILL $t"
    done
    AFTER=$(count); FK_AFTER=$(fks)
    EXPECTED=$(( BEFORE - $(echo "${TABLES//,/ }" | wc -w) ))
    # FKs owned BY the dropped tables are expected to go; FKs on tables that
    # survive are not. EXPECTED_FK_LOSS records the reviewed, accepted number.
    # `|| true`: under set -o pipefail a grep with no match kills the script
    # before the :-0 default below can apply.
    ALLOWED=$(grep -oE 'EXPECTED_FK_LOSS=[0-9]+' "$WORK/rollback.sql" 2>/dev/null | head -1 | cut -d= -f2 || true)
    ALLOWED=${ALLOWED:-0}
    if [ -n "$STILL" ]; then
      echo "✗ $VERSION — still present after rollback:$STILL"; FAILURES=$((FAILURES+1))
    elif [ "$AFTER" != "$EXPECTED" ]; then
      # Catches a cascade that took more than it should have.
      echo "✗ $VERSION — collateral damage: expected $EXPECTED tables, found $AFTER"; FAILURES=$((FAILURES+1))
    elif [ "$(( FK_BEFORE - FK_AFTER ))" -gt "$ALLOWED" ]; then
      echo "✗ $VERSION — $(( FK_BEFORE - FK_AFTER )) foreign keys lost on SURVIVING tables, only $ALLOWED declared. Review them, then record EXPECTED_FK_LOSS=<n> in the rollback."
      FAILURES=$((FAILURES+1))
    else
      echo "✓ $VERSION — removed $(echo "${TABLES//,/ }" | wc -w) tables ($BEFORE → $AFTER); FKs lost on surviving tables: $(( FK_BEFORE - FK_AFTER )) (≤$ALLOWED declared)"
    fi
  fi

  su postgres -c "$PGBIN/pg_ctl -D $WORK/data stop -m immediate" >/dev/null 2>&1 || true
  rm -rf "$WORK"
done

echo "── rollbacks failing: $FAILURES ──"
[ "$FAILURES" -eq 0 ]
