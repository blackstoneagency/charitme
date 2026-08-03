-- Rollback for 20260808000000_demo_data_labeling.sql
--
-- ⚠️ DESTRUCTIVE. `drop column` deletes the data in that column for every row.
-- That is what reverting an added column means, and it is not recoverable — take
-- a dump first if these columns hold production data.
--
-- Contents MEASURED, not parsed: `scripts/diff-migration.sh 20260808000000` replays every
-- earlier migration, snapshots the schema, applies this one and diffs. Several
-- of these columns are added inside DO blocks that build statements with
-- format(), which a grep over the SQL does not see.
-- Rehearsed by `scripts/rehearse-rollbacks.sh`.

-- Indexes are dropped with their columns automatically; listed here only where
-- the migration created one that outlives its column.
alter table if exists public.campaigns drop column if exists is_demo;
alter table if exists public.donations drop column if exists is_demo;
alter table if exists public.profiles drop column if exists is_demo;
