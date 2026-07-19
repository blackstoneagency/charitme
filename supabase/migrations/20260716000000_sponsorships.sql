-- ─────────────────────────────────────────────────────────────────────────────
-- Sponsorship marketplace — organizers post sponsorship opportunities; sponsors
-- (companies/individuals) send sponsorship requests with an offered amount.
--
-- Distinct from the admin-managed `sponsors` table (homepage logo strip). This is
-- a two-sided marketplace. Fully wired to Supabase with RLS + updated_at triggers.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── sponsorship_opportunities ────────────────────────────────────────────────
create table if not exists sponsorship_opportunities (
  id                  uuid primary key default uuid_generate_v4(),
  organizer_id        uuid not null references profiles(id) on delete cascade,
  campaign_id         uuid references campaigns(id) on delete set null,
  title               text not null check (char_length(title) between 3 and 140),
  description         text not null check (char_length(description) between 10 and 8000),
  category            text not null default 'Community',
  benefits            text,
  min_amount_cents    bigint not null default 0 check (min_amount_cents >= 0),
  target_amount_cents bigint check (target_amount_cents is null or target_amount_cents >= 0),
  raised_amount_cents bigint not null default 0 check (raised_amount_cents >= 0),
  currency            text not null default 'USD',
  status              text not null default 'open'
                        check (status in ('draft','open','closed','fulfilled','cancelled')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (target_amount_cents is null or target_amount_cents >= min_amount_cents)
);

create index if not exists sponsorship_opportunities_status_idx    on sponsorship_opportunities(status);
create index if not exists sponsorship_opportunities_organizer_idx on sponsorship_opportunities(organizer_id);
create index if not exists sponsorship_opportunities_campaign_idx  on sponsorship_opportunities(campaign_id);

-- ── sponsorship_requests ─────────────────────────────────────────────────────
create table if not exists sponsorship_requests (
  id                 uuid primary key default uuid_generate_v4(),
  opportunity_id     uuid not null references sponsorship_opportunities(id) on delete cascade,
  sponsor_id         uuid not null references profiles(id) on delete cascade,
  company_name       text,
  amount_cents       bigint not null check (amount_cents > 0),
  message            text,
  benefits_requested text,
  status             text not null default 'pending'
                       check (status in ('pending','accepted','declined','withdrawn','fulfilled')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (opportunity_id, sponsor_id)
);

create index if not exists sponsorship_requests_opportunity_idx on sponsorship_requests(opportunity_id);
create index if not exists sponsorship_requests_sponsor_idx     on sponsorship_requests(sponsor_id);
create index if not exists sponsorship_requests_status_idx      on sponsorship_requests(status);

-- ── updated_at triggers ──────────────────────────────────────────────────────
drop trigger if exists sponsorship_opportunities_updated_at on sponsorship_opportunities;
create trigger sponsorship_opportunities_updated_at before update on sponsorship_opportunities
  for each row execute function public.set_updated_at();

drop trigger if exists sponsorship_requests_updated_at on sponsorship_requests;
create trigger sponsorship_requests_updated_at before update on sponsorship_requests
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
alter table sponsorship_opportunities enable row level security;
alter table sponsorship_requests      enable row level security;

-- opportunities: anyone may read publicly-listed ones; organizer/admin manage.
drop policy if exists sponsorship_opportunities_public_read on sponsorship_opportunities;
create policy sponsorship_opportunities_public_read on sponsorship_opportunities for select
  using (
    status in ('open','closed','fulfilled')
    or auth.uid() = organizer_id
    or is_admin()
  );

drop policy if exists sponsorship_opportunities_organizer_write on sponsorship_opportunities;
create policy sponsorship_opportunities_organizer_write on sponsorship_opportunities for all
  using (auth.uid() = organizer_id or is_admin())
  with check (auth.uid() = organizer_id or is_admin());

-- requests: readable by the sponsor, the opportunity's organizer, and admins.
drop policy if exists sponsorship_requests_read on sponsorship_requests;
create policy sponsorship_requests_read on sponsorship_requests for select
  using (
    auth.uid() = sponsor_id
    or is_admin()
    or exists (
      select 1 from sponsorship_opportunities o
      where o.id = opportunity_id and o.organizer_id = auth.uid()
    )
  );

drop policy if exists sponsorship_requests_insert on sponsorship_requests;
create policy sponsorship_requests_insert on sponsorship_requests for insert
  with check (auth.uid() = sponsor_id);

drop policy if exists sponsorship_requests_update on sponsorship_requests;
create policy sponsorship_requests_update on sponsorship_requests for update
  using (
    auth.uid() = sponsor_id
    or is_admin()
    or exists (
      select 1 from sponsorship_opportunities o
      where o.id = opportunity_id and o.organizer_id = auth.uid()
    )
  );
