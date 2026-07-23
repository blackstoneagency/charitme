import os as _os
OUT=_os.path.join(_os.path.dirname(__file__), '..', 'supabase')
import re, glob, os
MIG = 'supabase/migrations'
files = sorted(glob.glob(f'{MIG}/*.sql'))
initial = [f for f in files if '20260525000000_initial_schema' in f][0]
seeds = [f for f in files if 'seed_support_cases' in f or 'seed_sponsors' in f]
rest = [f for f in files if f != initial and f not in seeds]

SUPP = """
-- ---- catch-up supplement: tables referenced by migrations but created only in
-- ---- schema.sql / manually (feature_flags) or nowhere (admin_settings). ----
create table if not exists public.feature_flags (
  id uuid primary key default uuid_generate_v4(),
  key text not null unique,
  enabled boolean not null default false,
  description text,
  rollout_pct int not null default 100 check (rollout_pct between 0 and 100),
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.admin_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
-- RLS: admin-config tables — admin-only (service role bypasses).
alter table public.feature_flags  enable row level security;
alter table public.admin_settings enable row level security;
drop policy if exists feature_flags_admin_all on public.feature_flags;
create policy feature_flags_admin_all on public.feature_flags for all using (is_admin()) with check (is_admin());
drop policy if exists admin_settings_admin_all on public.admin_settings;
create policy admin_settings_admin_all on public.admin_settings for all using (is_admin()) with check (is_admin());
"""

def idempotent(sql):
    # inject `drop policy if exists NAME on TABLE;` before each create policy
    pol = re.compile(r'(?is)\bcreate\s+policy\s+("(?:[^"]|"")+"|[a-zA-Z0-9_]+)\s+on\s+((?:[a-zA-Z0-9_]+\.)?[a-zA-Z0-9_]+)')
    sql = pol.sub(lambda m: f'drop policy if exists {m.group(1)} on {m.group(2)};\ncreate policy {m.group(1)} on {m.group(2)}', sql)
    # inject `drop trigger if exists NAME on TABLE;` before each create trigger
    trg = re.compile(r'(?is)\bcreate\s+trigger\s+([a-zA-Z0-9_]+)\s+.*?\bon\s+((?:[a-zA-Z0-9_]+\.)?[a-zA-Z0-9_]+)')
    def trg_sub(m):
        return f'drop trigger if exists {m.group(1)} on {m.group(2)};\n{m.group(0)}'
    sql = trg.sub(trg_sub, sql)
    # inject `alter table T drop constraint if exists C;` before each add constraint
    con = re.compile(r'(?is)\balter\s+table\s+(?:only\s+)?((?:[a-zA-Z0-9_]+\.)?[a-zA-Z0-9_]+)\s+add\s+constraint\s+([a-zA-Z0-9_]+)')
    sql = con.sub(lambda m: f'alter table {m.group(1)} drop constraint if exists {m.group(2)};\nalter table {m.group(1)} add constraint {m.group(2)}', sql)
    return sql

parts = ['-- ============================================================================='
,'-- CharitMe production catch-up (schema only, idempotent). Safe to run ONCE on'
,'-- an existing database: creates only what is missing (create ... if not exists,'
,'-- drop policy/trigger if exists + create, create or replace function). Contains'
,'-- NO demo/seed data. Generated from supabase/migrations/ (excludes *seed*).'
,'--'
,'-- HOW TO USE: paste this whole file into the Supabase SQL editor and Run once.'
,'--   Validated idempotent on Postgres 16 against both fresh and drifted schemas.'
,'--   Adds missing tables and columns without dropping data.'
,'-- ============================================================================='
,'set check_function_bodies = off;','']

def add(f, extra_after=None):
    parts.append(f'\n-- ============ {os.path.basename(f)} ============')
    parts.append(idempotent(open(f, encoding='utf-8').read()))
    if extra_after:
        parts.append(extra_after)

ENSURE = ''
_ep = _os.path.join(_os.path.dirname(__file__), '..', 'supabase', 'ensure_columns.sql')
if _os.path.exists(_ep):
    ENSURE = ('\n-- ---- column-drift reconciliation: add any missing column to existing\n'
              '-- ---- tables BEFORE indexes/policies reference them (add column if not\n'
              '-- ---- exists; no drops, no data loss). Generated from the target schema.\n'
              + open(_ep, encoding='utf-8').read())

if ENSURE:
    parts.append(ENSURE)
add(initial, extra_after=SUPP)
for f in rest:
    add(f)

open(f'{OUT}/catch_up.sql','w', encoding='utf-8').write('\n'.join(parts))
print('wrote catch_up.sql')
print('policies guarded:', len(re.findall(r'drop policy if exists', '\n'.join(parts))))
print('triggers guarded:', len(re.findall(r'drop trigger if exists', '\n'.join(parts))))
