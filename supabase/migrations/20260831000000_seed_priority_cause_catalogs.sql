-- Publish a transparent, non-donatable example catalog for the three priority causes.
-- These rows are production discovery content, not fabricated fundraising activity.

do $$
declare
  catalog_owner_id constant uuid := '30000000-0000-4000-8000-000000000001';
  catalog_email constant text := 'cause-catalog@charitme.invalid';
begin
  if exists (
    select 1 from auth.users
    where id = catalog_owner_id
      and coalesce(email, '') <> catalog_email
  ) or exists (
    select 1 from auth.users
    where lower(email) = catalog_email
      and id <> catalog_owner_id
  ) then
    raise exception 'Priority cause catalog owner identity conflicts with an existing user';
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    catalog_owner_id,
    'authenticated',
    'authenticated',
    catalog_email,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"CharitMe Cause Catalog"}'::jsonb,
    now(),
    now()
  ) on conflict (id) do nothing;

  update public.profiles
  set
    full_name = 'CharitMe Cause Catalog',
    roles = '["organizer"]'::jsonb,
    is_demo = true,
    updated_at = now()
  where id = catalog_owner_id;

  if not found then
    raise exception 'Priority cause catalog profile was not created';
  end if;
end $$;

with cause_catalog as (
  select * from (values
    (
      'health-wellness'::text,
      'Medical'::text,
      array[
        'Treatment Travel Support',
        'Prescription Access Fund',
        'Family Caregiver Relief',
        'Recovery Equipment Access',
        'Counseling Access Fund',
        'Maternal Wellness Support',
        'Cancer Care Companion Fund',
        'Rural Clinic Access',
        'Mobility and Rehabilitation',
        'Pediatric Family Lodging'
      ]::text[],
      array['Local', 'Community', 'Regional', 'Inclusive', 'Neighborhood']::text[],
      'This example shows how an organizer can clearly explain a health and wellness need, its intended budget, and the people the campaign is designed to support.'::text
    ),
    (
      'education',
      'Education',
      array[
        'Classroom Supply Fund',
        'Student Device Access',
        'Literacy Tutoring Program',
        'School Meal Support',
        'Arts Learning Fund',
        'STEM Lab Access',
        'Scholarship Bridge',
        'Special Education Resources',
        'Teacher Project Fund',
        'Student Transportation Support'
      ]::text[],
      array['Local', 'Community', 'Regional', 'Inclusive', 'Neighborhood']::text[],
      'This example shows how an organizer can describe a specific education need, identify who benefits, and present a practical, reviewable use of funds.'::text
    ),
    (
      'faith-belief',
      'Faith',
      array[
        'Community Meal Ministry',
        'Winter Shelter Outreach',
        'Pastoral Care Access',
        'Refugee Welcome Program',
        'Bereavement Support',
        'Youth Service Project',
        'Interfaith Relief Fund',
        'Accessible Gathering Space',
        'Family Crisis Support',
        'Community Advice Desk'
      ]::text[],
      array['Local', 'Community', 'Regional', 'Inclusive', 'Neighborhood']::text[],
      'This example shows how a faith or interfaith organizer can describe lawful community service, identify beneficiaries, and explain how funds would be used.'::text
    )
  ) as catalog(cause_slug, category, initiatives, modifiers, description)
), generated as (
  select
    uuid_generate_v5(
      uuid_ns_url(),
      'https://www.charitme.com/catalog/' || catalog.cause_slug || '/' || lpad(series::text, 2, '0')
    ) as id,
    '30000000-0000-4000-8000-000000000001'::uuid as user_id,
    'charitme-example-' || catalog.cause_slug || '-' || lpad(series::text, 2, '0') as slug,
    catalog.modifiers[1 + ((series - 1) / 10)] || ' ' || catalog.initiatives[1 + ((series - 1) % 10)] as title,
    'A transparent campaign example for ' || catalog.modifiers[1 + ((series - 1) / 10)] || ' ' || lower(catalog.initiatives[1 + ((series - 1) % 10)]) || '.' as tagline,
    catalog.description as description,
    catalog.category,
    500000::bigint + (series::bigint * 25000::bigint) as goal_amount,
    timestamp with time zone '2026-08-08 12:00:00+00' - (series || ' minutes')::interval as created_at
  from cause_catalog catalog
  cross join generate_series(1, 50) as series
)
insert into public.campaigns (
  id,
  user_id,
  slug,
  title,
  tagline,
  description,
  category,
  goal_amount,
  raised_amount,
  backer_count,
  deadline,
  status,
  trust_status,
  campaign_health_score,
  payout_frozen,
  featured,
  pinned,
  nonprofit_verified,
  accept_donations,
  visibility,
  is_demo,
  campaign_path,
  created_at,
  updated_at
)
select
  id,
  user_id,
  slug,
  title,
  tagline,
  description,
  category,
  goal_amount,
  0,
  0,
  null,
  'active',
  'Needs More Info',
  0,
  false,
  false,
  false,
  false,
  false,
  'public',
  true,
  'nonprofit',
  created_at,
  created_at
from generated
on conflict (id) do nothing;

with entries(route, question, answer, topic, priority) as (
  values
    ('/causes/health-wellness', 'What can a Health & Wellness fundraiser cover?', 'A health fundraiser can explain a specific need such as treatment, prescriptions, rehabilitation, accessible equipment, travel to care, temporary lodging, or essential household costs during recovery.', 'Health & Wellness', 220),
    ('/causes/health-wellness', 'Can I start a health fundraiser for someone else?', 'Yes. The campaign builder records who is organizing, who benefits, and the organizer''s relationship to that person so supporters can understand how the fundraiser is connected to the need.', 'Health & Wellness', 219),
    ('/causes/health-wellness', 'How should a medical need be documented?', 'Share only the evidence needed to support the campaign while protecting private health information. CharitMe may request identity, beneficiary, payout, or supporting documentation during trust and safety review.', 'Health & Wellness', 218),
    ('/causes/health-wellness', 'Are donations to health campaigns tax deductible?', 'Not automatically. Tax deductibility depends on the recipient and campaign structure. Look for the tax-deductible indicator and use the receipt or annual tax statement provided for an eligible donation.', 'Health & Wellness', 217),
    ('/causes/health-wellness', 'Can a donor give to a health campaign anonymously?', 'Donors can choose the privacy options offered at checkout. Payment and compliance records are still retained securely even when a public donor name is hidden.', 'Health & Wellness', 216),
    ('/causes/education', 'What can an Education fundraiser support?', 'Education campaigns can fund tuition, books, classroom materials, devices, connectivity, transportation, meals, tutoring, accessible learning resources, and other clearly explained learning needs.', 'Education', 220),
    ('/causes/education', 'Who can start an Education campaign?', 'Students, families, teachers, teams, community groups, and eligible organizations can start a campaign when they can accurately describe the need, beneficiary, budget, and intended use of funds.', 'Education', 219),
    ('/causes/education', 'Can a campaign raise money for tuition or scholarships?', 'Yes. The campaign should identify who will receive the support, what the funds cover, and how money will be delivered or managed. Organizers should avoid promising tax treatment that has not been verified.', 'Education', 218),
    ('/causes/education', 'Are donations to school campaigns tax deductible?', 'Tax deductibility depends on the receiving organization and campaign structure. A school-related purpose alone does not make a gift deductible; check the campaign indicator and donation receipt.', 'Education', 217),
    ('/causes/education', 'How can supporters follow an Education campaign?', 'Organizers can publish updates, milestones, photos, and outcomes. Supporters can return to the campaign page and use their account history to review eligible receipts and campaign activity.', 'Education', 216),
    ('/causes/faith-belief', 'Which faith communities can fundraise on CharitMe?', 'Campaigns may represent different faiths, beliefs, and interfaith efforts when they follow CharitMe''s terms, prohibited-use rules, financial requirements, and trust and safety standards.', 'Faith & Belief', 220),
    ('/causes/faith-belief', 'What can a Faith & Belief campaign support?', 'Campaigns can explain needs such as community meals, shelter, pastoral care, youth service, accessibility, emergency relief, outreach, or repairs to spaces used for community support.', 'Faith & Belief', 219),
    ('/causes/faith-belief', 'Can a campaign fund worship or religious activities?', 'Permitted fundraising must remain lawful, transparent, and consistent with CharitMe policies. Campaigns cannot support hate, coercion, discrimination, violence, fraud, or another prohibited use.', 'Faith & Belief', 218),
    ('/causes/faith-belief', 'Are donations to faith campaigns tax deductible?', 'Not every faith campaign is tax deductible. Eligibility depends on the receiving organization and campaign structure, so donors should rely on the campaign indicator and their issued receipt or statement.', 'Faith & Belief', 217),
    ('/causes/faith-belief', 'Can interfaith community projects use this cause?', 'Yes. Interfaith and community-service projects can use Faith & Belief when that category accurately describes the organizers and work, while clearly explaining who benefits and how funds will be used.', 'Faith & Belief', 216)
)
insert into public.aeo_entries (
  id,
  route,
  question,
  answer,
  topic,
  schema_type,
  priority,
  published
)
select
  uuid_generate_v5(uuid_ns_url(), 'https://www.charitme.com/aeo' || route || '/' || question),
  route,
  question,
  answer,
  topic,
  'FAQPage',
  priority,
  true
from entries
on conflict (id) do nothing;

do $$
declare
  category_name text;
  row_count integer;
begin
  foreach category_name in array array['Medical', 'Education', 'Faith'] loop
    select count(*) into row_count
    from public.campaigns
    where user_id = '30000000-0000-4000-8000-000000000001'::uuid
      and category = category_name
      and slug like 'charitme-example-%';

    if row_count <> 50 then
      raise exception 'Priority cause catalog expected 50 % campaigns, found %', category_name, row_count;
    end if;
  end loop;

  if exists (
    select 1 from public.campaigns
    where user_id = '30000000-0000-4000-8000-000000000001'::uuid
      and (
        not is_demo
        or accept_donations
        or raised_amount <> 0
        or backer_count <> 0
        or nonprofit_verified
        or featured
        or pinned
        or trust_status <> 'Needs More Info'
      )
  ) then
    raise exception 'Priority cause catalog contains a row that is not a safe, non-donatable example';
  end if;

  if (
    select count(*) from public.aeo_entries
    where route in (
      '/causes/health-wellness',
      '/causes/education',
      '/causes/faith-belief'
    )
      and id = uuid_generate_v5(uuid_ns_url(), 'https://www.charitme.com/aeo' || route || '/' || question)
      and published
      and schema_type = 'FAQPage'
  ) <> 15 then
    raise exception 'Priority cause catalog expected 15 published AEO entries';
  end if;
end $$;
