-- ─────────────────────────────────────────────────────────────────────────────
-- platform_reports — the downloadable impact / financial / annual reports shown
-- on /transparency and /reports.
--
-- WHY THIS MIGRATION EXISTS
--
-- The reference design for the transparency page shows dated report cards —
-- "2024 Impact Report · PDF · 4.3 MB · Download" — with a list of previous
-- years beneath. This was the ONE element of that page with no table and no
-- storage bucket behind it, and it was recorded as an open blocker rather than
-- faked: a downloads UI over a table that does not exist is a page that appears
-- complete and is not.
--
-- This migration removes that blocker. It is written but NOT applied here — the
-- sandbox has no credentials for the live database — so applying it is a single
-- owner action rather than an open engineering task.
--
-- WHY A TABLE RATHER THAN HARDCODED LINKS
--
-- Same reasoning as cause_impact_stats: a published report is EDITORIAL content
-- the organisation authors and owns. Its title, period and file change without a
-- deploy, and whoever runs the charity is the right author of it — not a literal
-- in a component.
--
-- WHY byte_size IS NULLABLE
--
-- The design prints a file size. We can only print one we actually know, and a
-- row may be created before its file is uploaded. NULL means "not known yet",
-- which the reader renders as nothing at all — never as "0 MB", which would read
-- as a broken file.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.platform_reports (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  -- 'impact' | 'financial' | 'annual' — the three tabs in the design.
  kind          text not null,
  -- Human period label as published ("2024", "FY2023–24"), because a report's
  -- own cover is the authority on what it covers, not a derived date range.
  period_label  text not null,
  summary       text,
  -- Path within the `reports` storage bucket. NULL until the file is uploaded,
  -- so a row can be drafted first.
  file_path     text,
  byte_size     bigint,
  published     boolean not null default false,
  published_at  timestamptz,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  constraint platform_reports_kind_check
    check (kind in ('impact', 'financial', 'annual')),
  -- A negative or zero size is not a smaller file, it is a wrong one. NULL is
  -- the way to say "unknown".
  constraint platform_reports_byte_size_check
    check (byte_size is null or byte_size > 0),
  -- A published report must have a file to download. Publishing a row with no
  -- file would put a dead Download button on a public page — the exact defect
  -- class this repo keeps finding.
  constraint platform_reports_published_needs_file
    check (published = false or file_path is not null)
);

comment on table public.platform_reports is
  'Downloadable platform reports for /transparency and /reports. Editorial content authored by the organisation; see the migration header for why this is a table and not hardcoded links.';

create index if not exists platform_reports_published_idx
  on public.platform_reports (published, sort_order, published_at desc)
  where deleted_at is null;

alter table public.platform_reports enable row level security;

-- Published, non-deleted rows are public. Everything else is invisible to
-- anonymous readers, so a draft cannot leak an unreleased financial report.
drop policy if exists platform_reports_public_read on public.platform_reports;
create policy platform_reports_public_read
  on public.platform_reports for select
  using (published = true and deleted_at is null);

-- Writes are admin-only. A financial report is not user-generated content.
drop policy if exists platform_reports_admin_write on public.platform_reports;
create policy platform_reports_admin_write
  on public.platform_reports for all
  using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'super_admin'))
  )
  with check (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'super_admin'))
  );

create or replace function public.touch_platform_reports_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists platform_reports_touch_updated_at on public.platform_reports;
create trigger platform_reports_touch_updated_at
  before update on public.platform_reports
  for each row execute function public.touch_platform_reports_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage bucket.
--
-- PUBLIC read is correct here and only here: these are documents the
-- organisation publishes deliberately. The RLS policy above still governs which
-- ROWS are visible, so an unpublished report is not discoverable through the
-- application even though the bucket itself serves public URLs.
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('reports', 'reports', true)
on conflict (id) do nothing;

-- Only admins may write into the bucket; anyone may read a published file.
drop policy if exists "reports_public_read" on storage.objects;
create policy "reports_public_read"
  on storage.objects for select
  using (bucket_id = 'reports');

drop policy if exists "reports_admin_write" on storage.objects;
create policy "reports_admin_write"
  on storage.objects for all
  using (
    bucket_id = 'reports'
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role in ('admin', 'super_admin'))
  )
  with check (
    bucket_id = 'reports'
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role in ('admin', 'super_admin'))
  );
