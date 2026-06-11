-- ─────────────────────────────────────────────────────────────────────────────
-- AI Complaint Resolver + support_cases schema repair — 2026-06-11
--
-- /api/admin/support/[id] sets status='escalated' and writes resolved_at /
-- escalated_at, none of which exist on support_cases. Two competing
-- `create table if not exists support_cases` definitions also leave
-- campaign_id / donation_id / assigned_to in question depending on
-- migration order. Repair the table additively so the existing admin
-- support flow works, then add columns for AI Complaint Resolver output.
-- ─────────────────────────────────────────────────────────────────────────────

alter table support_cases
  add column if not exists campaign_id uuid references campaigns(id) on delete set null,
  add column if not exists donation_id uuid references donations(id) on delete set null,
  add column if not exists assigned_to uuid references profiles(id) on delete set null,
  add column if not exists resolved_at timestamptz,
  add column if not exists escalated_at timestamptz,
  add column if not exists source text not null default 'web',
  add column if not exists ai_triage jsonb,
  add column if not exists ai_generation_id uuid references ai_generations(id) on delete set null;

alter table support_cases drop constraint if exists support_cases_status_check;
alter table support_cases add constraint support_cases_status_check
  check (status in ('open','in_progress','resolved','closed','escalated'));

alter table support_cases drop constraint if exists support_cases_source_check;
alter table support_cases add constraint support_cases_source_check
  check (source in ('web','email','api'));

create index if not exists support_cases_campaign_id_idx on support_cases(campaign_id);
create index if not exists support_cases_assigned_to_idx on support_cases(assigned_to);
create index if not exists support_cases_status_idx on support_cases(status);
