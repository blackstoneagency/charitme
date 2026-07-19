-- ─────────────────────────────────────────────────────────────────────────────
-- Grants platform — grant discovery, AI matching, and application workflow
-- CHAR-0001. Additive: references existing profiles/campaigns only.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Grant opportunities (public listings) ──────────────────────────────────────
create table if not exists grants (
  id                    uuid primary key default uuid_generate_v4(),
  slug                  text not null unique,
  title                 text not null,
  funder_name           text not null,
  funder_type           text not null default 'foundation'
                          check (funder_type in ('foundation','government','corporate','community','individual','other')),
  summary               text,
  description           text,
  category              text,
  focus_areas           text[] not null default '{}',
  eligibility           text,
  eligible_entity_types text[] not null default '{}',
  amount_min            bigint,           -- cents; null = unspecified
  amount_max            bigint,           -- cents; null = unspecified
  currency              text not null default 'USD',
  location              text,             -- human-readable geographic scope
  country               text,
  application_url       text,
  deadline_at           timestamptz,
  rolling_deadline      boolean not null default false,
  status                text not null default 'open'
                          check (status in ('open','upcoming','closed')),
  source                text,             -- provenance (import source / manual)
  created_by            uuid references profiles(id) on delete set null,
  verified              boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  constraint grants_amount_range check (amount_min is null or amount_max is null or amount_min <= amount_max)
);

create index if not exists grants_status_idx        on grants(status) where deleted_at is null;
create index if not exists grants_category_idx      on grants(category) where deleted_at is null;
create index if not exists grants_deadline_idx      on grants(deadline_at) where deleted_at is null;
create index if not exists grants_created_by_idx    on grants(created_by);
create index if not exists grants_focus_areas_gin   on grants using gin (focus_areas);

-- ── Additional deadlines / milestones per grant (LOI, full app, report) ─────────
create table if not exists grant_deadlines (
  id          uuid primary key default uuid_generate_v4(),
  grant_id    uuid not null references grants(id) on delete cascade,
  label       text not null,
  kind        text not null default 'application'
                check (kind in ('loi','application','report','award','other')),
  due_at      timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists grant_deadlines_grant_idx on grant_deadlines(grant_id);

-- ── Computed matches between a grant and a prospective applicant ────────────────
create table if not exists grant_matches (
  id          uuid primary key default uuid_generate_v4(),
  grant_id    uuid not null references grants(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  score       numeric(5,2) not null default 0,   -- 0..100
  reasons     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  unique (grant_id, user_id, campaign_id)
);
create index if not exists grant_matches_user_idx  on grant_matches(user_id);
create index if not exists grant_matches_grant_idx on grant_matches(grant_id);

-- ── Grant applications ──────────────────────────────────────────────────────────
create table if not exists grant_applications (
  id                uuid primary key default uuid_generate_v4(),
  grant_id          uuid not null references grants(id) on delete cascade,
  applicant_user_id uuid not null references profiles(id) on delete cascade,
  campaign_id       uuid references campaigns(id) on delete set null,
  organization_name text,
  status            text not null default 'draft'
                      check (status in ('draft','submitted','under_review','awarded','rejected','withdrawn')),
  amount_requested  bigint,             -- cents
  narrative         text,
  answers           jsonb not null default '{}'::jsonb,
  submitted_at      timestamptz,
  decision_at       timestamptz,
  award_amount      bigint,             -- cents
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index if not exists grant_applications_applicant_idx on grant_applications(applicant_user_id) where deleted_at is null;
create index if not exists grant_applications_grant_idx     on grant_applications(grant_id) where deleted_at is null;
create index if not exists grant_applications_status_idx    on grant_applications(status) where deleted_at is null;

-- ── Documents attached to an application ────────────────────────────────────────
create table if not exists grant_documents (
  id             uuid primary key default uuid_generate_v4(),
  application_id uuid not null references grant_applications(id) on delete cascade,
  uploaded_by    uuid references profiles(id) on delete set null,
  file_url       text not null,
  file_name      text,
  doc_type       text,
  created_at     timestamptz not null default now()
);
create index if not exists grant_documents_application_idx on grant_documents(application_id);

-- ── updated_at triggers ─────────────────────────────────────────────────────────
drop trigger if exists grants_set_updated_at on grants;
create trigger grants_set_updated_at before update on grants
  for each row execute function set_updated_at();

drop trigger if exists grant_applications_set_updated_at on grant_applications;
create trigger grant_applications_set_updated_at before update on grant_applications
  for each row execute function set_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────────────────
alter table grants             enable row level security;
alter table grant_deadlines    enable row level security;
alter table grant_matches      enable row level security;
alter table grant_applications enable row level security;
alter table grant_documents    enable row level security;

-- grants: anyone may read open/upcoming, non-deleted grants; creators manage their
-- own drafts/closed; admins manage everything.
drop policy if exists grants_public_read on grants;
create policy grants_public_read on grants for select
  using (deleted_at is null and status in ('open','upcoming'));

drop policy if exists grants_creator_read on grants;
create policy grants_creator_read on grants for select
  using (created_by = auth.uid() or is_admin());

drop policy if exists grants_creator_write on grants;
create policy grants_creator_write on grants for all
  using (created_by = auth.uid() or is_admin())
  with check (created_by = auth.uid() or is_admin());

-- grant_deadlines: readable when the parent grant is visible; admin writes.
drop policy if exists grant_deadlines_read on grant_deadlines;
create policy grant_deadlines_read on grant_deadlines for select
  using (exists (select 1 from grants g where g.id = grant_id and g.deleted_at is null));

drop policy if exists grant_deadlines_admin_all on grant_deadlines;
create policy grant_deadlines_admin_all on grant_deadlines for all
  using (is_admin()) with check (is_admin());

-- grant_matches: an applicant sees their own matches; admins see all.
drop policy if exists grant_matches_owner on grant_matches;
create policy grant_matches_owner on grant_matches for all
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

-- grant_applications: applicant fully manages own; admins all.
drop policy if exists grant_applications_owner on grant_applications;
create policy grant_applications_owner on grant_applications for all
  using (applicant_user_id = auth.uid() or is_admin())
  with check (applicant_user_id = auth.uid() or is_admin());

-- grant_documents: owner (via application) manages; admins all.
drop policy if exists grant_documents_owner on grant_documents;
create policy grant_documents_owner on grant_documents for all
  using (
    exists (
      select 1 from grant_applications a
      where a.id = application_id and a.applicant_user_id = auth.uid()
    ) or is_admin()
  )
  with check (
    exists (
      select 1 from grant_applications a
      where a.id = application_id and a.applicant_user_id = auth.uid()
    ) or is_admin()
  );
