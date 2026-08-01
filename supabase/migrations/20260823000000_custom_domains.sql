-- Custom domains (design #150).
--
-- ⚠️ WHAT THIS DOES AND DOES NOT DO, because the distinction is the whole design:
--
--   IT DOES verify DOMAIN OWNERSHIP, for real. A token is issued per domain and
--   `status` only becomes 'verified' when a live DNS TXT lookup actually returns
--   it. There is no optimistic path and no manual override — a green tick here
--   means a resolver answered, this minute, with the token.
--
--   IT DOES NOT serve traffic on that domain. Routing and TLS issuance belong to
--   the hosting provider, and nothing in this codebase can perform them. The UI
--   says so rather than implying the domain is live once verified.
--
-- The temptation with this feature is a `verified` boolean an admin can tick,
-- which is worse than no page: it is a claim about the outside world that
-- nothing checked. Hence `verification_token`, `last_checked_at` and
-- `last_error` — the row records how the answer was obtained, not just what it
-- was.

create table if not exists public.custom_domains (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  -- Lowercased hostname, no scheme or path. Unique across the platform: two
  -- accounts claiming one domain would make "whose campaign does this serve?"
  -- depend on row order.
  domain text not null unique,
  verification_token text not null,
  status text not null default 'pending'
    check (status in ('pending','verified','failed')),
  verified_at timestamptz,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Same shape as the incidents and tasks constraints: a verified domain with no
  -- verified_at cannot be audited, and an unverified one carrying a timestamp
  -- claims a check that never passed.
  constraint custom_domains_verified_consistency check (
    (status = 'verified' and verified_at is not null)
    or (status <> 'verified' and verified_at is null)
  )
);

create index if not exists custom_domains_owner_idx on public.custom_domains (owner_id);
create index if not exists custom_domains_campaign_idx on public.custom_domains (campaign_id)
  where campaign_id is not null;

alter table public.custom_domains enable row level security;

-- Owner or admin. A domain claim is not public: knowing which domains are
-- pending verification tells an attacker exactly which TXT record to race.
drop policy if exists custom_domains_owner on public.custom_domains;
create policy custom_domains_owner on public.custom_domains
  using (auth.uid() = owner_id or public.is_admin())
  with check (auth.uid() = owner_id or public.is_admin());

drop trigger if exists custom_domains_touch on public.custom_domains;
create trigger custom_domains_touch before update on public.custom_domains
  for each row execute function public.set_updated_at();
