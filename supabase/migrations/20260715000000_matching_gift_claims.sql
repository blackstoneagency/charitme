-- ─────────────────────────────────────────────────────────────────────────────
-- Corporate matching-gift claims
--
-- Turns the existing employer-match *estimator* (lib/employer-matching.ts +
-- EmployerMatchWidget) into a tracked workflow: after donating, a donor can
-- submit a matching-gift claim tied to a real donation. Organizers can see
-- claims against their campaign; admins can see all and advance status.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists matching_gift_claims (
  id uuid primary key default uuid_generate_v4(),
  donation_id uuid not null references donations(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  donor_id uuid references profiles(id) on delete set null,
  employer_name text not null,
  donation_amount_cents bigint not null check (donation_amount_cents >= 0),
  match_ratio numeric not null default 1 check (match_ratio >= 0),
  estimated_match_cents bigint not null default 0 check (estimated_match_cents >= 0),
  status text not null default 'submitted'
    check (status in ('submitted','requested_from_employer','approved','received','declined','cancelled')),
  employer_reference text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- one active claim per donation (donors can cancel and re-file)
  unique (donation_id)
);

create index if not exists matching_gift_claims_donor_id_idx on matching_gift_claims(donor_id);
create index if not exists matching_gift_claims_campaign_id_idx on matching_gift_claims(campaign_id);
create index if not exists matching_gift_claims_status_idx on matching_gift_claims(status);

drop trigger if exists matching_gift_claims_set_updated_at on matching_gift_claims;
create trigger matching_gift_claims_set_updated_at
  before update on matching_gift_claims
  for each row execute function set_updated_at();

alter table matching_gift_claims enable row level security;

-- Donors see their own claims; organizers see claims against their campaigns; admins see all.
drop policy if exists matching_gift_claims_select on matching_gift_claims;
create policy matching_gift_claims_select on matching_gift_claims for select
  using (
    auth.uid() = donor_id
    or is_admin()
    or exists (select 1 from campaigns c where c.id = matching_gift_claims.campaign_id and c.user_id = auth.uid())
  );

-- Only the donor (or an admin) may file a claim, and only for themselves.
drop policy if exists matching_gift_claims_insert on matching_gift_claims;
create policy matching_gift_claims_insert on matching_gift_claims for insert
  with check (auth.uid() = donor_id or is_admin());

-- Donor, campaign organizer, or admin may advance/annotate a claim.
drop policy if exists matching_gift_claims_update on matching_gift_claims;
create policy matching_gift_claims_update on matching_gift_claims for update
  using (
    auth.uid() = donor_id
    or is_admin()
    or exists (select 1 from campaigns c where c.id = matching_gift_claims.campaign_id and c.user_id = auth.uid())
  )
  with check (
    auth.uid() = donor_id
    or is_admin()
    or exists (select 1 from campaigns c where c.id = matching_gift_claims.campaign_id and c.user_id = auth.uid())
  );

drop policy if exists matching_gift_claims_delete on matching_gift_claims;
create policy matching_gift_claims_delete on matching_gift_claims for delete
  using (auth.uid() = donor_id or is_admin());
