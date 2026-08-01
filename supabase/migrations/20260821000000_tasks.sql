-- Tasks / to-do list (design #145).
--
-- A fundraiser's own checklist, optionally attached to a campaign. Deliberately
-- narrow: the design shows an "Assigned to Me" filter, so `assignee_id` exists,
-- but assignment is scoped to people who already share the campaign through
-- `team_members` — inventing a wider sharing model here would create a second,
-- competing notion of "who can see my campaign's work".
--
-- ⚠️ Not applied to production until the migrations runbook is run. Every reader
-- treats a failed query as "unknown", never as "no tasks".

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  -- Optional: a task can be general ("call the printer") or campaign-scoped.
  campaign_id uuid references public.campaigns(id) on delete cascade,
  assignee_id uuid references public.profiles(id) on delete set null,
  title text not null,
  notes text,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Same shape as incidents_resolved_consistency: a done task with no
  -- completed_at cannot be sorted or reported on, and an open one carrying a
  -- completion time claims work that is still outstanding. Both are refused.
  constraint tasks_completed_consistency check (
    (status = 'done' and completed_at is not null)
    or (status <> 'done' and completed_at is null)
  )
);

-- The list is always filtered by owner (or assignee) and ordered by due date,
-- so those are the indexes that matter.
create index if not exists tasks_owner_due_idx on public.tasks (owner_id, due_at);
create index if not exists tasks_assignee_idx on public.tasks (assignee_id)
  where assignee_id is not null;
create index if not exists tasks_campaign_idx on public.tasks (campaign_id)
  where campaign_id is not null;
-- "Overdue" is a first-class filter in the design, and it only ever looks at
-- unfinished work.
create index if not exists tasks_open_due_idx on public.tasks (due_at)
  where status <> 'done';

alter table public.tasks enable row level security;

-- Private by default. A task list is working notes — it can name a donor, a
-- problem with a beneficiary, or an unannounced plan — so unlike incidents,
-- nothing here is public.
--
-- The API routes use the service-role client and therefore BYPASS this policy;
-- lib/task-access.ts mirrors it exactly and is what actually runs. Both are
-- written together so they cannot drift.
drop policy if exists tasks_owner_or_assignee on public.tasks;
create policy tasks_owner_or_assignee on public.tasks
  using (
    auth.uid() = owner_id
    or auth.uid() = assignee_id
    or public.is_admin()
  )
  with check (
    auth.uid() = owner_id
    or public.is_admin()
  );

drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.set_updated_at();
