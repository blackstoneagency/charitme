#!/usr/bin/env python3
"""Turn a raw `pg_dump --schema-only` of the public schema into supabase/schema.sql.

Removes pg_dump-only noise, keeps the file portable to Supabase (unqualified
extension functions, no forced-empty search_path), and prepends a
generated-file header. Usage: clean_schema_dump.py <dump.sql> <schema.sql>
"""
import sys

HEADER = """-- =============================================================================
-- CharitMe — consolidated database schema (public schema).
--
-- GENERATED FILE — DO NOT EDIT BY HAND.
--   Faithful mirror of supabase/migrations/ (plus feature_flags and
--   admin_settings), produced by pg_dump of a migration-built database. It lets
--   the full schema be read in one place and applied to a fresh database.
--
--   To change the schema: add a migration under supabase/migrations/ and
--   regenerate this file (scripts/regen_schema.sh). Do NOT hand-edit — that is
--   what caused this file to drift from the migrations before.
--   For an existing/behind database, use supabase/catch_up.sql (idempotent).
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
"""


def clean(raw: str) -> str:
    out = []
    for ln in raw.splitlines():
        if ln.startswith('\\restrict') or ln.startswith('\\unrestrict'):
            continue
        if ln.startswith('-- Dumped') or ln.startswith('-- PostgreSQL database dump'):
            continue
        if "set_config('search_path'" in ln:            # keep the default search_path
            continue
        if ln.strip() == "CREATE SCHEMA public;":
            out.append("CREATE SCHEMA IF NOT EXISTS public;")
            continue
        if ln.startswith("SET client_encoding"):
            out.append("SET client_encoding = 'UTF8';")
            continue
        out.append(ln)
    body = "\n".join(out)
    # extension functions live in the `extensions` schema on Supabase, not public
    body = body.replace("public.uuid_generate_v4()", "uuid_generate_v4()")
    body = body.replace("public.gen_random_uuid()", "gen_random_uuid()")
    return HEADER + body + "\n"


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    open(dst, "w").write(clean(open(src).read()))
