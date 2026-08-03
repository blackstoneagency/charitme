-- Rollback for 20260822000000_data_retention_policies.sql
--
-- ⚠️ DESTRUCTIVE. `drop table ... cascade` removes the table and every row in it,
-- along with its indexes, policies and triggers. That is what rolling back a
-- table-creating migration means, but it is not recoverable — take a dump first
-- if the table has production rows.
--
-- Written and rehearsed with `scripts/rehearse-migrations.sh`: the full
-- migration set is replayed, this script is applied, and the objects are
-- asserted gone. Cascade is deliberate — the indexes, RLS policies and touch
-- triggers created alongside each table have no independent existence.
-- Dropped child-first so a cascade is never relied on for a FK we know about.
drop table if exists public.data_retention_runs cascade;
drop table if exists public.data_retention_policies cascade;
