-- Rollback for 20260826000000_platform_reports.sql
--
-- ⚠️ DESTRUCTIVE. `drop table ... cascade` removes the table and every row in it,
-- along with its indexes, policies and trigger. That is what rolling back a
-- table-creating migration means, but it is not recoverable — take a dump first
-- if the table has production rows.
--
-- ⚠️ The BUCKET is deliberately NOT dropped. Dropping `storage.buckets` for
-- 'reports' would delete every published PDF in it, and those files are the
-- organisation's own documents — they are not reconstructible from this schema
-- and may exist nowhere else. Rolling back the table is a schema decision;
-- deleting the charity's published annual reports is not, and must be a separate
-- deliberate act. The bucket's policies are dropped so it is not left writable
-- by a policy referring to a table that no longer exists.

drop trigger if exists platform_reports_touch_updated_at on public.platform_reports;

drop policy if exists platform_reports_public_read  on public.platform_reports;
drop policy if exists platform_reports_admin_write  on public.platform_reports;

drop table if exists public.platform_reports cascade;

drop function if exists public.touch_platform_reports_updated_at();

-- Storage policies only — the bucket and its files stay. See the note above.
drop policy if exists "reports_public_read"  on storage.objects;
drop policy if exists "reports_admin_write"  on storage.objects;
