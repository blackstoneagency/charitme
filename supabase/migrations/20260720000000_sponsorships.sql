-- ─────────────────────────────────────────────────────────────────────────────
-- Sponsorship marketplace
--
-- Extends the admin-managed `sponsors` (logos/carousel) into a two-sided
-- marketplace: organizers/nonprofits post sponsorship opportunities (packages
-- with benefits); sponsors send requests that move through a
-- pending→accepted→agreed→fulfilled lifecycle.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists sponsorship_opportunities (
  id uuid primary key default uuid_generate_v4(),
  organizer_id uuid not null references profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  title text not null,
  description text,
  benefits text[] not null default '{}',
  min_amount_cents bigint not null default 0 check (min_amount_cents >= 0),
  currency text not null default 'usd',
  slots integer not null default 1 check (slots >= 1),
  status text not null default 'open' check (status in ('draft','open','closed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sponsorship_opportunities_organizer_idx on sponsorship_opportunities(organizer_id);
create index if not exists sponsorship_opportunities_campaign_idx on sponsorship_opportunities(campaign_id);
create index if not exists sponsorship_opportunities_status_idx on sponsorship_opportunities(status);

create table if not exists sponsorship_requests (
  id uuid primary key default uuid_generate_v4(),
  opportunity_id uuid not null references sponsorship_opportunities(id) on delete cascade,
  sponsor_id uuid not null references profiles(id) on delete cascade,
  sponsor_name text,
  amount_cents bigint not null check (amount_cents >= 0),
  message text,
  deliverables text,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','withdrawn','agreed','fulfilled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, sponsor_id)
);

create index if not exists sponsorship_requests_opportunity_idx on sponsorship_requests(opportunity_id);
create index if not exists sponsorship_requests_sponsor_idx on sponsorship_requests(sponsor_id);
create index if not exists sponsorship_requests_status_idx on sponsorship_requests(status);

drop trigger if exists sponsorship_opportunities_set_updated_at on sponsorship_opportunities;
create trigger sponsorship_opportunities_set_updated_at before update on sponsorship_opportunities
  for each row execute function set_updated_at();
drop trigger if exists sponsorship_requests_set_updated_at on sponsorship_requests;
create trigger sponsorship_requests_set_updated_at before update on sponsorship_requests
  for each row execute function set_updated_at();

-- RLS ─────────────────────────────────────────────────────────────────────────
alter table sponsorship_opportunities enable row level security;
alter table sponsorship_requests enable row level security;

-- Opportunities: open/closed public; drafts to owner/admin; owner/admin write.
drop policy if exists sponsorship_opportunities_read on sponsorship_opportunities;
create policy sponsorship_opportunities_read on sponsorship_opportunities for select
  using (status in ('open','closed') or auth.uid() = organizer_id or is_admin());
drop policy if exists sponsorship_opportunities_write on sponsorship_opportunities;
create policy sponsorship_opportunities_write on sponsorship_opportunities for all
  using (auth.uid() = organizer_id or is_admin())
  with check (auth.uid() = organizer_id or is_admin());

-- Requests: the sponsor and the opportunity's organizer (and admin) see them.
drop policy if exists sponsorship_requests_select on sponsorship_requests;
create policy sponsorship_requests_select on sponsorship_requests for select
  using (
    auth.uid() = sponsor_id
    or is_admin()
    or exists (select 1 from sponsorship_opportunities o where o.id = sponsorship_requests.opportunity_id and o.organizer_id = auth.uid())
  );
drop policy if exists sponsorship_requests_insert on sponsorship_requests;
create policy sponsorship_requests_insert on sponsorship_requests for insert
  with check (auth.uid() = sponsor_id or is_admin());
drop policy if exists sponsorship_requests_update on sponsorship_requests;
create policy sponsorship_requests_update on sponsorship_requests for update
  using (
    auth.uid() = sponsor_id
    or is_admin()
    or exists (select 1 from sponsorship_opportunities o where o.id = sponsorship_requests.opportunity_id and o.organizer_id = auth.uid())
  )
  with check (
    auth.uid() = sponsor_id
    or is_admin()
    or exists (select 1 from sponsorship_opportunities o where o.id = sponsorship_requests.opportunity_id and o.organizer_id = auth.uid())
  );
drop policy if exists sponsorship_requests_delete on sponsorship_requests;
create policy sponsorship_requests_delete on sponsorship_requests for delete
  using (auth.uid() = sponsor_id or is_admin());
