-- CharitMe rebrand migration
-- Safe: only renames columns/values, no data loss

-- Update default support email in admin_settings if it exists
update public.admin_settings
set value = replace(value::text, 'eli54u.com', 'charitme.com')::jsonb
where key in ('supportEmail', 'fromEmail', 'siteUrl', 'appUrl')
  and value::text ilike '%eli54u%';

-- Update any hardcoded GiveRise/eli54u references in branding settings
update public.admin_settings
set value = replace(replace(value::text, 'GiveRise', 'CharitMe'), 'eli54u.com', 'charitme.com')::jsonb
where value::text ilike '%GiveRise%' or value::text ilike '%eli54u%';

-- Update company_name in settings
insert into public.admin_settings (key, value, updated_at)
values
  ('companyName',    '"CharitMe"'::jsonb,                          now()),
  ('domain',         '"charitme.com"'::jsonb,                      now()),
  ('tagline',        '"The AI Fundraising Platform"'::jsonb,       now()),
  ('primaryMessage', '"Raise More. Faster. With AI."'::jsonb,      now()),
  ('supportEmail',   '"support@charitme.com"'::jsonb,              now()),
  ('fromEmail',      '"CharitMe <hello@charitme.com>"'::jsonb,     now()),
  ('siteUrl',        '"https://www.charitme.com"'::jsonb,          now())
on conflict (key) do update
  set value = excluded.value, updated_at = excluded.updated_at;
