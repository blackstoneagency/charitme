-- One durable campaign model for both the AI and guided creation paths.

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'video/mp4']
where id = 'campaign-media';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'campaign-source-documents',
  'campaign-source-documents',
  false,
  5242880,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.campaigns
  add column if not exists builder_path text not null default 'guided',
  add column if not exists beneficiary_type text not null default 'self',
  add column if not exists use_of_funds jsonb not null default '[]'::jsonb,
  add column if not exists donation_tiers jsonb not null default '[]'::jsonb,
  add column if not exists allow_recurring boolean not null default true,
  add column if not exists allow_anonymous boolean not null default true,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists social_title text,
  add column if not exists social_description text,
  add column if not exists cover_image_guidance text,
  add column if not exists builder_schema_version integer not null default 1,
  add column if not exists policy_accepted_at timestamptz;

alter table public.campaigns drop constraint if exists campaigns_builder_path_check;
alter table public.campaigns
  add constraint campaigns_builder_path_check check (builder_path in ('ai', 'guided'));
alter table public.campaigns drop constraint if exists campaigns_beneficiary_type_check;
alter table public.campaigns
  add constraint campaigns_beneficiary_type_check check (beneficiary_type in ('self', 'other', 'organization'));
alter table public.campaigns drop constraint if exists campaigns_use_of_funds_array_check;
alter table public.campaigns
  add constraint campaigns_use_of_funds_array_check check (jsonb_typeof(use_of_funds) = 'array');
alter table public.campaigns drop constraint if exists campaigns_donation_tiers_array_check;
alter table public.campaigns
  add constraint campaigns_donation_tiers_array_check check (jsonb_typeof(donation_tiers) = 'array');
alter table public.campaigns drop constraint if exists campaigns_builder_schema_version_check;
alter table public.campaigns
  add constraint campaigns_builder_schema_version_check check (builder_schema_version between 1 and 1000);

create index if not exists campaigns_builder_path_created_idx
  on public.campaigns (builder_path, created_at desc);

create table if not exists public.campaign_source_documents (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (campaign_id, storage_path)
);

create table if not exists public.campaign_source_links (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  source_url text not null,
  created_at timestamptz not null default now(),
  unique (campaign_id, source_url)
);

create index if not exists campaign_source_documents_campaign_idx
  on public.campaign_source_documents (campaign_id, created_at);
create index if not exists campaign_source_links_campaign_idx
  on public.campaign_source_links (campaign_id, created_at);

alter table public.campaign_source_documents enable row level security;
alter table public.campaign_source_links enable row level security;

drop policy if exists campaign_source_documents_owner_read on public.campaign_source_documents;
create policy campaign_source_documents_owner_read
  on public.campaign_source_documents for select to authenticated
  using (uploader_id = auth.uid());
drop policy if exists campaign_source_links_owner_read on public.campaign_source_links;
create policy campaign_source_links_owner_read
  on public.campaign_source_links for select to authenticated
  using (uploader_id = auth.uid());

revoke all on table public.campaign_source_documents from anon, authenticated;
revoke all on table public.campaign_source_links from anon, authenticated;
grant select on table public.campaign_source_documents to authenticated;
grant select on table public.campaign_source_links to authenticated;
grant all on table public.campaign_source_documents to service_role;
grant all on table public.campaign_source_links to service_role;

alter table public.campaign_wizard_drafts
  add column if not exists builder_path text not null default 'guided',
  add column if not exists schema_version integer not null default 1,
  add column if not exists source_context jsonb not null default '{}'::jsonb;

alter table public.campaign_wizard_drafts drop constraint if exists campaign_wizard_drafts_builder_path_check;
alter table public.campaign_wizard_drafts
  add constraint campaign_wizard_drafts_builder_path_check check (builder_path in ('ai', 'guided'));
alter table public.campaign_wizard_drafts drop constraint if exists campaign_wizard_drafts_schema_version_check;
alter table public.campaign_wizard_drafts
  add constraint campaign_wizard_drafts_schema_version_check check (schema_version between 1 and 1000);
alter table public.campaign_wizard_drafts drop constraint if exists campaign_wizard_drafts_source_context_object_check;
alter table public.campaign_wizard_drafts
  add constraint campaign_wizard_drafts_source_context_object_check check (jsonb_typeof(source_context) = 'object');

create table if not exists public.campaign_wizard_draft_versions (
  id bigint generated always as identity primary key,
  draft_id uuid not null references public.campaign_wizard_drafts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  schema_version integer not null,
  builder_path text not null,
  step text not null,
  story_mode text not null,
  form jsonb not null,
  images jsonb not null,
  source_context jsonb not null,
  client_ts bigint not null,
  created_at timestamptz not null default now(),
  constraint campaign_wizard_draft_versions_form_object_check check (jsonb_typeof(form) = 'object'),
  constraint campaign_wizard_draft_versions_images_array_check check (jsonb_typeof(images) = 'array'),
  constraint campaign_wizard_draft_versions_source_object_check check (jsonb_typeof(source_context) = 'object')
);

create index if not exists campaign_wizard_draft_versions_draft_created_idx
  on public.campaign_wizard_draft_versions (draft_id, created_at desc);
create index if not exists campaign_wizard_draft_versions_user_created_idx
  on public.campaign_wizard_draft_versions (user_id, created_at desc);

alter table public.campaign_wizard_draft_versions enable row level security;
drop policy if exists campaign_wizard_draft_versions_read_own on public.campaign_wizard_draft_versions;
create policy campaign_wizard_draft_versions_read_own
  on public.campaign_wizard_draft_versions for select to authenticated
  using (auth.uid() = user_id);

revoke all on table public.campaign_wizard_draft_versions from anon, authenticated;
grant select on table public.campaign_wizard_draft_versions to authenticated;
grant all on table public.campaign_wizard_draft_versions to service_role;
grant usage, select on sequence public.campaign_wizard_draft_versions_id_seq to service_role;

create or replace function public.capture_campaign_wizard_draft_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.form is distinct from old.form
     or new.images is distinct from old.images
     or new.step is distinct from old.step
     or new.source_context is distinct from old.source_context then
    insert into public.campaign_wizard_draft_versions (
      draft_id, user_id, schema_version, builder_path, step, story_mode,
      form, images, source_context, client_ts
    ) values (
      new.id, new.user_id, new.schema_version, new.builder_path, new.step, new.story_mode,
      new.form, new.images, new.source_context, new.client_ts
    );

    delete from public.campaign_wizard_draft_versions
    where id in (
      select id
      from public.campaign_wizard_draft_versions
      where draft_id = new.id
      order by created_at desc, id desc
      offset 25
    );
  end if;
  return new;
end;
$$;

revoke all on function public.capture_campaign_wizard_draft_version() from public, anon, authenticated;
grant execute on function public.capture_campaign_wizard_draft_version() to service_role;

drop trigger if exists campaign_wizard_drafts_capture_version on public.campaign_wizard_drafts;
create trigger campaign_wizard_drafts_capture_version
  after insert or update on public.campaign_wizard_drafts
  for each row execute function public.capture_campaign_wizard_draft_version();

create or replace function public.create_campaign_from_builder(
  p_user_id uuid,
  p_slug text,
  p_payload jsonb
)
returns table (campaign_id uuid, campaign_slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_status text := coalesce(nullif(p_payload->>'status', ''), 'active');
  v_visibility text := coalesce(nullif(p_payload->>'visibility', ''), 'public');
begin
  if p_user_id is null or p_slug is null or btrim(p_slug) = '' then
    raise exception 'invalid campaign identity';
  end if;

  insert into public.campaigns (
    user_id, slug, title, tagline, description, category, goal_amount,
    raised_amount, backer_count, deadline, status, beneficiary_name,
    beneficiary_relationship, cover_image_url, image_urls, location,
    visibility, accept_donations, campaign_path, builder_path,
    beneficiary_type, use_of_funds, donation_tiers, allow_recurring,
    allow_anonymous, seo_title, seo_description, social_title,
    social_description, cover_image_guidance, builder_schema_version,
    policy_accepted_at, video_url
  ) values (
    p_user_id,
    p_slug,
    p_payload->>'title',
    nullif(p_payload->>'tagline', ''),
    p_payload->>'description',
    p_payload->>'category',
    (p_payload->>'goal_amount')::bigint,
    0,
    0,
    nullif(p_payload->>'deadline', '')::date,
    v_status,
    nullif(p_payload->>'beneficiary_name', ''),
    nullif(p_payload->>'beneficiary_relationship', ''),
    nullif(p_payload->>'cover_image_url', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'image_urls', '[]'::jsonb))), '{}'::text[]),
    nullif(p_payload->>'location', ''),
    v_visibility,
    coalesce((p_payload->>'accept_donations')::boolean, false),
    coalesce(nullif(p_payload->>'campaign_path', ''), 'personal'),
    coalesce(nullif(p_payload->>'builder_path', ''), 'guided'),
    coalesce(nullif(p_payload->>'beneficiary_type', ''), 'self'),
    coalesce(p_payload->'use_of_funds', '[]'::jsonb),
    coalesce(p_payload->'donation_tiers', '[]'::jsonb),
    coalesce((p_payload->>'allow_recurring')::boolean, true),
    coalesce((p_payload->>'allow_anonymous')::boolean, true),
    nullif(p_payload->>'seo_title', ''),
    nullif(p_payload->>'seo_description', ''),
    nullif(p_payload->>'social_title', ''),
    nullif(p_payload->>'social_description', ''),
    nullif(p_payload->>'cover_image_guidance', ''),
    coalesce((p_payload->>'schema_version')::integer, 1),
    nullif(p_payload->>'policy_accepted_at', '')::timestamptz,
    nullif(p_payload->>'video_url', '')
  )
  returning id into v_campaign_id;

  insert into public.campaign_launch_settings (
    campaign_id, funding_model, launch_type, currency, country
  ) values (
    v_campaign_id,
    coalesce(nullif(p_payload->>'funding_model', ''), 'flexible'),
    'fundraiser',
    lower(coalesce(nullif(p_payload->>'currency', ''), 'usd')),
    upper(coalesce(nullif(p_payload->>'country_code', ''), 'US'))
  );

  insert into public.campaign_faqs (
    campaign_id, question, answer, sort_order, is_public, ai_generated
  )
  select
    v_campaign_id, btrim(item.value->>'question'), btrim(item.value->>'answer'), item.ordinality - 1,
    true, coalesce((item.value->>'ai_generated')::boolean, false)
  from jsonb_array_elements(coalesce(p_payload->'faqs', '[]'::jsonb))
    with ordinality as item(value, ordinality)
  where char_length(btrim(item.value->>'question')) between 5 and 300
    and char_length(btrim(item.value->>'answer')) between 5 and 2000;

  insert into public.campaign_milestones (
    campaign_id, title, description, target_amount, sort_order
  )
  select
    v_campaign_id, btrim(item.value->>'title'), nullif(btrim(item.value->>'description'), ''),
    (item.value->>'target_cents')::bigint, item.ordinality - 1
  from jsonb_array_elements(coalesce(p_payload->'milestones', '[]'::jsonb))
    with ordinality as item(value, ordinality)
  where char_length(btrim(item.value->>'title')) between 2 and 160
    and (item.value->>'target_cents')::bigint > 0;

  insert into public.campaign_media (
    campaign_id, uploader_id, media_type, storage_path, public_url,
    alt_text, sort_order
  )
  select
    v_campaign_id, p_user_id, item.value->>'media_type', item.value->>'storage_path',
    nullif(item.value->>'public_url', ''), nullif(item.value->>'alt_text', ''), item.ordinality - 1
  from jsonb_array_elements(coalesce(p_payload->'media', '[]'::jsonb))
    with ordinality as item(value, ordinality)
  where item.value->>'media_type' = 'image'
    and item.value->>'storage_path' like ('campaigns/' || p_user_id::text || '/%');

  insert into public.campaign_source_documents (
    campaign_id, uploader_id, file_name, mime_type, size_bytes, storage_path
  )
  select
    v_campaign_id, p_user_id, item.value->>'name', item.value->>'mime_type',
    (item.value->>'size_bytes')::bigint, item.value->>'storage_path'
  from jsonb_array_elements(coalesce(p_payload->'source_documents', '[]'::jsonb)) item(value)
  where item.value->>'storage_path' like ('campaigns/' || p_user_id::text || '/sources/%')
    and (item.value->>'size_bytes')::bigint between 1 and 5242880;

  insert into public.campaign_source_links (campaign_id, uploader_id, source_url)
  select v_campaign_id, p_user_id, item.value #>> '{}'
  from jsonb_array_elements(coalesce(p_payload->'source_links', '[]'::jsonb)) item(value)
  where item.value #>> '{}' ~ '^https?://';

  if nullif(btrim(p_payload->>'evidence_note'), '') is not null then
    insert into public.transparency_ledger_items (
      campaign_id, item_type, title, description, category, status
    ) values (
      v_campaign_id, 'milestone', 'Organizer evidence note',
      btrim(p_payload->>'evidence_note'), 'Trust', 'published'
    );
  end if;

  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (
    p_user_id,
    case when v_status = 'active' then 'campaign.published' else 'campaign.draft_created' end,
    'campaign',
    v_campaign_id::text,
    jsonb_build_object('builder_path', p_payload->>'builder_path', 'schema_version', p_payload->>'schema_version')
  );

  return query select v_campaign_id, p_slug;
end;
$$;

revoke all on function public.create_campaign_from_builder(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_campaign_from_builder(uuid, text, jsonb)
  to service_role;
