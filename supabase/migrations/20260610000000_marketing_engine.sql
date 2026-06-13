-- ═══════════════════════════════════════════════════════════════
-- CharitMe Marketing Engine — core schema
-- Contacts, identity resolution, events, segments, campaigns,
-- automations, templates, referrals, UTM, forms, consent, audit.
-- ═══════════════════════════════════════════════════════════════

-- ── Contacts: one row per person (identity-resolved) ──
create table if not exists public.marketing_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  phone text,
  first_name text,
  last_name text,
  client_type text not null default 'visitor',          -- visitor|donor|repeat_donor|recurring_donor|high_value_donor|organizer|draft_organizer|beneficiary|nonprofit|newsletter|support|lead
  lifecycle_stage text not null default 'subscriber',   -- subscriber|lead|engaged|customer|champion|dormant
  country text,
  region text,
  preferred_causes text[] default '{}',
  preferred_channel text default 'email',
  first_touch_source text,
  first_touch_medium text,
  first_touch_campaign text,
  last_touch_source text,
  last_touch_medium text,
  last_touch_campaign text,
  landing_page text,
  lead_score int not null default 0,
  engagement_score int not null default 0,
  donor_value_cents bigint not null default 0,
  donation_count int not null default 0,
  churn_risk text default 'unknown',                    -- low|medium|high|unknown
  last_active_at timestamptz,
  status text not null default 'active',                -- active|unsubscribed|suppressed|archived
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists marketing_contacts_email_uq on public.marketing_contacts (lower(email)) where email is not null;
create index if not exists marketing_contacts_user_idx on public.marketing_contacts (user_id);
create index if not exists marketing_contacts_type_idx on public.marketing_contacts (client_type);
create index if not exists marketing_contacts_stage_idx on public.marketing_contacts (lifecycle_stage);
create index if not exists marketing_contacts_score_idx on public.marketing_contacts (lead_score desc);

-- ── Identities: every identifier that maps to a contact (stitching) ──
create table if not exists public.marketing_identities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.marketing_contacts(id) on delete cascade,
  kind text not null,                                   -- email|phone|user_id|device_id|cookie_id
  value text not null,
  created_at timestamptz not null default now(),
  unique (kind, value)
);
create index if not exists marketing_identities_contact_idx on public.marketing_identities (contact_id);

-- ── Events: behavioral stream feeding segments/scores/attribution ──
create table if not exists public.marketing_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.marketing_contacts(id) on delete cascade,
  event_type text not null,                             -- page_viewed|campaign_viewed|donation_started|donation_abandoned|donation_completed|...
  campaign_id uuid,                                     -- fundraising campaign (campaigns.id)
  marketing_campaign_id uuid,                           -- marketing campaign
  amount_cents bigint,
  utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text,
  url text,
  device text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists marketing_events_contact_idx on public.marketing_events (contact_id, created_at desc);
create index if not exists marketing_events_type_idx on public.marketing_events (event_type, created_at desc);

-- ── Segments: dynamic rule-based audiences ──
create table if not exists public.marketing_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  rules jsonb not null default '{"logic":"and","conditions":[]}',
  is_system boolean not null default false,
  member_count int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_segment_members (
  segment_id uuid not null references public.marketing_segments(id) on delete cascade,
  contact_id uuid not null references public.marketing_contacts(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (segment_id, contact_id)
);

-- ── Marketing campaigns (email/sms/social/multichannel) ──
create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  campaign_type text not null default 'email',          -- email|sms|social|multichannel
  goal text,                                            -- reactivation|abandoned_donation|organizer_activation|...
  segment_id uuid references public.marketing_segments(id) on delete set null,
  template_id uuid,
  subject text,
  preview_text text,
  body text,
  status text not null default 'draft',                 -- draft|scheduled|sending|sent|paused|archived
  scheduled_at timestamptz,
  sent_at timestamptz,
  sent_count int not null default 0,
  open_count int not null default 0,
  click_count int not null default 0,
  conversion_count int not null default 0,
  revenue_cents bigint not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_campaigns_status_idx on public.marketing_campaigns (status);

create table if not exists public.marketing_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  contact_id uuid not null references public.marketing_contacts(id) on delete cascade,
  status text not null default 'pending',               -- pending|sent|opened|clicked|converted|bounced|suppressed
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, contact_id)
);
create index if not exists marketing_recipients_campaign_idx on public.marketing_campaign_recipients (campaign_id, status);

-- ── Automations: trigger → action workflows ──
create table if not exists public.marketing_automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_event text not null,                          -- donation_abandoned|campaign_published|payout_setup_incomplete|...
  trigger_config jsonb not null default '{}',           -- e.g. {"inactive_days": 30}
  action_type text not null,                            -- send_email|send_sms|create_task|add_to_segment|update_score|notify_admin
  action_config jsonb not null default '{}',            -- e.g. {"template_id": "..."}
  enabled boolean not null default false,
  run_count int not null default 0,
  last_run_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.marketing_automations(id) on delete cascade,
  contact_id uuid references public.marketing_contacts(id) on delete set null,
  status text not null default 'success',               -- success|skipped|failed
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists marketing_runs_automation_idx on public.marketing_automation_runs (automation_id, created_at desc);

-- ── Email templates ──
create table if not exists public.marketing_email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'general',             -- welcome|abandoned|reactivation|receipt_followup|seasonal|...
  subject text not null default '',
  preview_text text,
  body text not null default '',
  variables text[] default '{first_name,campaign_title,donation_amount}',
  is_system boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── UTM links + referrals ──
create table if not exists public.marketing_utm_links (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  destination_url text not null,
  utm_source text not null,
  utm_medium text not null,
  utm_campaign text not null,
  utm_term text, utm_content text,
  short_code text unique,
  click_count int not null default 0,
  conversion_count int not null default 0,
  revenue_cents bigint not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_contact_id uuid references public.marketing_contacts(id) on delete set null,
  code text not null unique,
  kind text not null default 'donor',                   -- donor|organizer|ambassador|corporate
  click_count int not null default 0,
  signup_count int not null default 0,
  donation_count int not null default 0,
  revenue_cents bigint not null default 0,
  created_at timestamptz not null default now()
);

-- ── Forms + submissions ──
create table if not exists public.marketing_forms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  form_type text not null default 'lead',               -- lead|newsletter|organizer_interest|nonprofit_interest|survey|popup
  fields jsonb not null default '["email"]',
  status text not null default 'active',
  submission_count int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references public.marketing_forms(id) on delete set null,
  contact_id uuid references public.marketing_contacts(id) on delete set null,
  data jsonb not null default '{}',
  url text,
  created_at timestamptz not null default now()
);
create index if not exists marketing_submissions_form_idx on public.marketing_form_submissions (form_id, created_at desc);

-- ── Consent + suppression ──
create table if not exists public.marketing_consent (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.marketing_contacts(id) on delete cascade,
  channel text not null,                                -- email|sms
  granted boolean not null,
  source text,                                          -- form|checkout|preference_page|unsubscribe_link
  created_at timestamptz not null default now()
);
create index if not exists marketing_consent_contact_idx on public.marketing_consent (contact_id, channel, created_at desc);

create table if not exists public.marketing_suppression_list (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  reason text not null default 'unsubscribed',          -- unsubscribed|bounced|complaint|manual
  created_at timestamptz not null default now()
);
create unique index if not exists marketing_suppression_email_uq on public.marketing_suppression_list (lower(email)) where email is not null;

-- ── Audit log ──
create table if not exists public.marketing_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ── updated_at triggers ──
create or replace function public.marketing_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['marketing_contacts','marketing_segments','marketing_campaigns','marketing_automations','marketing_email_templates','marketing_forms']
  loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.marketing_touch_updated_at()', t, t);
  end loop;
end $$;

-- ── RLS: marketing data is admin/service-role only; public writes go
--    through API routes using the service role after validation. ──
do $$
declare t text;
begin
  foreach t in array array[
    'marketing_contacts','marketing_identities','marketing_events','marketing_segments',
    'marketing_segment_members','marketing_campaigns','marketing_campaign_recipients',
    'marketing_automations','marketing_automation_runs','marketing_email_templates',
    'marketing_utm_links','marketing_referrals','marketing_forms','marketing_form_submissions',
    'marketing_consent','marketing_suppression_list','marketing_audit_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    -- No anon/authenticated policies: service role bypasses RLS, everyone else is denied.
  end loop;
end $$;

-- ── Seed: system segments ──
insert into public.marketing_segments (name, description, rules, is_system)
values
  ('Donors (one-time)', 'Contacts with exactly one completed donation',
   '{"logic":"and","conditions":[{"field":"donation_count","op":"eq","value":1}]}', true),
  ('Repeat donors', 'Contacts with 2+ completed donations',
   '{"logic":"and","conditions":[{"field":"donation_count","op":"gte","value":2}]}', true),
  ('High-value donors', 'Lifetime giving of $500+',
   '{"logic":"and","conditions":[{"field":"donor_value_cents","op":"gte","value":50000}]}', true),
  ('Abandoned donations', 'Started but never completed a donation',
   '{"logic":"and","conditions":[{"field":"event","op":"has","value":"donation_started"},{"field":"event","op":"not_has","value":"donation_completed"}]}', true),
  ('Draft organizers', 'Created a campaign draft but never published',
   '{"logic":"and","conditions":[{"field":"client_type","op":"eq","value":"draft_organizer"}]}', true),
  ('Dormant contacts', 'No activity in 60+ days',
   '{"logic":"and","conditions":[{"field":"inactive_days","op":"gte","value":60}]}', true),
  ('Newsletter subscribers', 'Opted in to the newsletter',
   '{"logic":"and","conditions":[{"field":"client_type","op":"eq","value":"newsletter"}]}', true)
on conflict do nothing;

-- ── Seed: system email templates ──
insert into public.marketing_email_templates (name, category, subject, preview_text, body, is_system)
values
  ('Welcome donor', 'welcome', 'Thank you for your generosity, {{first_name}}!', 'Your donation is already making a difference.',
   'Hi {{first_name}},\n\nThank you for supporting {{campaign_title}}. Your gift of {{donation_amount}} is on its way to the people who need it.\n\nFollow the campaign for updates — and know that 100% of your donation goes directly to the cause.\n\nWith gratitude,\nThe CharitMe Team', true),
  ('Abandoned donation reminder', 'abandoned', 'Your donation to {{campaign_title}} is waiting', 'It takes 30 seconds to finish.',
   'Hi {{first_name}},\n\nYou were about to support {{campaign_title}} — your donation is still waiting. It takes less than a minute to complete, and every dollar goes directly to the cause.\n\nFinish your donation: {{campaign_url}}\n\nThe CharitMe Team', true),
  ('Dormant donor reactivation', 'reactivation', 'The causes you care about still need you', 'See what changed since your last gift.',
   'Hi {{first_name}},\n\nIt has been a while! The {{preferred_cause}} campaigns you supported have new updates — and new neighbors who need help.\n\nSee campaigns near you: {{browse_url}}\n\nThe CharitMe Team', true),
  ('Campaign update reminder', 'organizer', 'Campaigns with updates raise 3x more', 'Post a 2-minute update today.',
   'Hi {{first_name}},\n\nYour campaign {{campaign_title}} has supporters waiting to hear from you. Campaigns that post weekly updates raise about 3x more.\n\nPost an update: {{update_url}}\n\nThe CharitMe Team', true),
  ('Payout setup reminder', 'beneficiary', 'Finish payout setup to receive your funds', 'Your money is ready — connect an account.',
   'Hi {{first_name}},\n\n{{campaign_title}} has raised funds for you, but your payout method is not connected yet. Connect a bank account, Venmo, Google Pay, or PayPal in under 2 minutes.\n\nFinish setup: {{payout_url}}\n\nThe CharitMe Team', true),
  ('Recurring upgrade ask', 'recurring', 'Make your impact monthly, {{first_name}}', '0% fees on monthly giving.',
   'Hi {{first_name}},\n\nYou have supported {{campaign_title}} before — a monthly gift of even $10 provides steady support organizers can count on, with 0% platform fees.\n\nGive monthly: {{campaign_url}}\n\nThe CharitMe Team', true),
  ('Seasonal giving appeal', 'seasonal', 'This season, your kindness goes further', 'Local campaigns that need help right now.',
   'Hi {{first_name}},\n\nThe giving season is here. These campaigns near you need a final push to reach their goals before the end of the year.\n\nBrowse campaigns: {{browse_url}}\n\nThe CharitMe Team', true)
on conflict do nothing;

-- ── Seed: starter automations (disabled until admin enables) ──
insert into public.marketing_automations (name, trigger_event, trigger_config, action_type, action_config, enabled)
values
  ('Abandoned donation rescue', 'donation_abandoned', '{"delay_hours": 4}', 'send_email', '{"template_category": "abandoned"}', false),
  ('Welcome new donors', 'donation_completed', '{"first_donation_only": true}', 'send_email', '{"template_category": "welcome"}', false),
  ('Dormant donor reactivation', 'donor_inactive', '{"inactive_days": 60}', 'send_email', '{"template_category": "reactivation"}', false),
  ('Organizer update nudge', 'no_update_posted', '{"days_since_update": 7}', 'send_email', '{"template_category": "organizer"}', false),
  ('Payout setup chaser', 'payout_setup_incomplete', '{"delay_hours": 24}', 'send_email', '{"template_category": "beneficiary"}', false),
  ('Recurring upgrade prompt', 'donation_completed', '{"min_donations": 2}', 'send_email', '{"template_category": "recurring"}', false)
on conflict do nothing;
