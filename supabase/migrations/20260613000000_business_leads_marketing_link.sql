-- ─────────────────────────────────────────────────────────────────────────────
-- Tie New Customers business leads into the Marketing engine — 2026-06-13
--
-- When a lead is AI-enriched and a contact email is found, the lead gets
-- linked to a marketing_contacts row (client_type='lead', lifecycle_stage=
-- 'lead') so it can be targeted by Marketing → Campaigns. This migration:
--   1. adds business_leads.marketing_contact_id (set by lib/lead-enrichment),
--   2. seeds a system segment "New Business Leads" matching client_type='lead'.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.business_leads
  add column if not exists marketing_contact_id uuid references public.marketing_contacts(id) on delete set null;

create index if not exists business_leads_marketing_contact_idx on public.business_leads (marketing_contact_id);

insert into public.marketing_segments (name, description, rules, is_system)
values (
  'New Business Leads',
  'Newly-formed businesses discovered via state registry feeds and enriched with contact info — ready for outreach campaigns.',
  '{"logic":"and","conditions":[{"field":"client_type","op":"eq","value":"lead"}]}',
  true
)
on conflict do nothing;
