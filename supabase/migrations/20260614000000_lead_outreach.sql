-- ─────────────────────────────────────────────────────────────────────────────
-- Lead Outreach — Marketing → "Outreach" tab — 2026-06-14
--
-- Powers personal, 1:1 outreach to the New Customers / business-lead pipeline:
--   1. Each lead can be turned into an "outreach" with a UNIQUE tracking URL
--      (a /go/[code] short link), so we know exactly which lead clicked and
--      came back to the site.
--   2. The lead's email is validated (syntax, disposable/role-based domain,
--      MX best-effort) before we ever send.
--   3. Sends + clicks roll up onto the row so the admin sees the funnel:
--      drafted → ready → sent → clicked → converted.
--
-- Reuses the existing marketing engine: resolveContact() links the lead to a
-- marketing_contacts row, and marketing_utm_links + the /go/[code] route do the
-- click capture. This table is the per-lead outreach state on top of that.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.lead_outreach (
  id                   uuid primary key default uuid_generate_v4(),

  business_lead_id     uuid not null references public.business_leads(id) on delete cascade,
  marketing_contact_id uuid references public.marketing_contacts(id) on delete set null,
  utm_link_id          uuid references public.marketing_utm_links(id) on delete set null,
  short_code           text,

  channel              text not null default 'email',

  -- ── Composed message ──
  subject              text,
  body                 text,

  -- ── Email validation (heuristic + best-effort MX) ──
  email                text,                       -- snapshot of the address validated/sent to
  email_valid          boolean,
  email_validation     jsonb not null default '{}'::jsonb,
  email_validated_at   timestamptz,

  -- ── Funnel ──
  status               text not null default 'drafted'
                         check (status in ('drafted','ready','sent','clicked','converted','failed')),
  sent_at              timestamptz,
  first_click_at       timestamptz,
  last_click_at        timestamptz,
  click_count          integer not null default 0,

  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- One active outreach record per lead (re-preparing upserts the same row).
create unique index if not exists lead_outreach_lead_uniq on public.lead_outreach (business_lead_id);
create index if not exists lead_outreach_status_idx        on public.lead_outreach (status);
create index if not exists lead_outreach_short_code_idx     on public.lead_outreach (short_code);
create index if not exists lead_outreach_contact_idx        on public.lead_outreach (marketing_contact_id);

alter table public.lead_outreach enable row level security;

-- Admin-only: internal BD data, never exposed to donors/organizers.
drop policy if exists lead_outreach_admin_all on public.lead_outreach;
create policy lead_outreach_admin_all on public.lead_outreach for all
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists lead_outreach_set_updated_at on public.lead_outreach;
create trigger lead_outreach_set_updated_at before update on public.lead_outreach
  for each row execute function public.set_updated_at();

grant all on public.lead_outreach to anon, authenticated, service_role;
