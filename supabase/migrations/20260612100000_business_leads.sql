-- ─────────────────────────────────────────────────────────────────────────────
-- New Customers / Business Lead pipeline — 2026-06-12
--
-- Powers the Admin → "New Customers" page. Implements the lead pipeline:
--   New LLC filed → store here → AI enriches website/email/phone →
--   score lead → alert admin (via notifications).
--
-- 100% free: data is ingested from free sources (manual paste, the free
-- OpenCorporates tier, or generated sample filings) and enrichment uses the
-- platform's existing OpenAI integration with a deterministic free fallback.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.business_leads (
  id                uuid primary key default uuid_generate_v4(),

  -- ── Filing facts (from Secretary of State / free aggregators) ──
  business_name     text not null,
  entity_type       text,                       -- LLC, Corporation, etc.
  state             text,                       -- 2-letter state code
  filing_date       date,
  filing_status     text,                       -- Active, Pending, etc.
  registered_agent  text,
  owner_name        text,                       -- member / manager
  industry          text,
  address           text,
  source            text not null default 'manual',  -- manual | opencorporates | sample | api
  source_ref        text,                       -- external id / URL when available

  -- ── AI-enriched contact info ──
  website           text,
  email             text,
  phone             text,
  enrichment_notes  text,
  enrichment_model  text,                       -- 'fallback' or the OpenAI model id
  enriched_at       timestamptz,

  -- ── Lead scoring ──
  lead_score        integer not null default 0, -- 0-100
  lead_grade        text,                        -- A/B/C/D
  score_breakdown   jsonb not null default '{}'::jsonb,

  -- ── Pipeline workflow ──
  status            text not null default 'new'
                      check (status in ('new','enriched','contacted','qualified','converted','rejected')),
  alerted           boolean not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Prevent duplicate filings for the same business in the same state.
create unique index if not exists business_leads_name_state_uniq
  on public.business_leads (lower(business_name), coalesce(upper(state), ''));

create index if not exists business_leads_status_idx      on public.business_leads (status);
create index if not exists business_leads_score_idx       on public.business_leads (lead_score desc);
create index if not exists business_leads_state_idx       on public.business_leads (state);
create index if not exists business_leads_created_at_idx  on public.business_leads (created_at desc);

alter table public.business_leads enable row level security;

-- Admin-only: this is internal BD data, never exposed to donors/organizers.
drop policy if exists business_leads_admin_all on public.business_leads;
create policy business_leads_admin_all on public.business_leads for all
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists business_leads_set_updated_at on public.business_leads;
create trigger business_leads_set_updated_at before update on public.business_leads
  for each row execute function public.set_updated_at();

grant all on public.business_leads to anon, authenticated, service_role;
