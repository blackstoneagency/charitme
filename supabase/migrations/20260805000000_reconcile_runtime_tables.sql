create table if not exists public.campaign_faqs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  question text not null check (char_length(question) between 5 and 300),
  answer text not null check (char_length(answer) between 5 and 2000),
  sort_order integer not null default 0,
  is_public boolean not null default true,
  ai_generated boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_campaign_faqs_campaign_id
  on public.campaign_faqs (campaign_id);

alter table public.campaign_faqs enable row level security;

drop policy if exists faqs_public_read on public.campaign_faqs;
create policy faqs_public_read on public.campaign_faqs
  for select
  using (
    is_public = true
    or public.is_admin()
    or exists (
      select 1 from public.campaigns
      where campaigns.id = campaign_faqs.campaign_id
        and campaigns.user_id = auth.uid()
    )
  );

drop policy if exists faqs_owner_write on public.campaign_faqs;
create policy faqs_owner_write on public.campaign_faqs
  for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.campaigns
      where campaigns.id = campaign_faqs.campaign_id
        and campaigns.user_id = auth.uid()
    )
  );

drop policy if exists faqs_owner_update on public.campaign_faqs;
create policy faqs_owner_update on public.campaign_faqs
  for update
  using (
    public.is_admin()
    or exists (
      select 1 from public.campaigns
      where campaigns.id = campaign_faqs.campaign_id
        and campaigns.user_id = auth.uid()
    )
  );

drop policy if exists faqs_owner_delete on public.campaign_faqs;
create policy faqs_owner_delete on public.campaign_faqs
  for delete
  using (
    public.is_admin()
    or exists (
      select 1 from public.campaigns
      where campaigns.id = campaign_faqs.campaign_id
        and campaigns.user_id = auth.uid()
    )
  );

create table if not exists public.campaign_owner_replies (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  donor_message_id uuid references public.donor_messages(id) on delete set null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 5000),
  created_at timestamptz not null default now()
);

alter table public.campaign_owner_replies enable row level security;

drop policy if exists cor_donor_read on public.campaign_owner_replies;
create policy cor_donor_read on public.campaign_owner_replies
  for select
  using (
    exists (
      select 1 from public.donor_messages dm
      where dm.id = campaign_owner_replies.donor_message_id
        and dm.donor_id = auth.uid()
    )
  );

drop policy if exists cor_owner_all on public.campaign_owner_replies;
create policy cor_owner_all on public.campaign_owner_replies
  for all
  using (auth.uid() = owner_id or public.is_admin())
  with check (auth.uid() = owner_id);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  enabled boolean not null default false,
  description text,
  rollout_pct integer not null default 100 check (rollout_pct between 0 and 100),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

drop policy if exists flags_public_read on public.feature_flags;
drop policy if exists flags_admin_write on public.feature_flags;
drop policy if exists feature_flags_admin_all on public.feature_flags;
create policy feature_flags_admin_all on public.feature_flags
  for all
  using (public.is_admin())
  with check (public.is_admin());

grant all on table public.campaign_faqs to anon, authenticated, service_role;
grant all on table public.campaign_owner_replies to anon, authenticated, service_role;
grant all on table public.feature_flags to anon, authenticated, service_role;

create table if not exists public.campaign_milestones (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  title text not null,
  description text,
  target_amount bigint,
  reached_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.campaign_milestones enable row level security;

drop policy if exists milestones_public_read on public.campaign_milestones;
create policy milestones_public_read on public.campaign_milestones
  for select
  using (true);

drop policy if exists milestones_owner_write on public.campaign_milestones;
create policy milestones_owner_write on public.campaign_milestones
  for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.campaigns
      where campaigns.id = campaign_milestones.campaign_id
        and campaigns.user_id = auth.uid()
    )
  );

drop policy if exists milestones_owner_delete on public.campaign_milestones;
create policy milestones_owner_delete on public.campaign_milestones
  for delete
  using (
    public.is_admin()
    or exists (
      select 1 from public.campaigns
      where campaigns.id = campaign_milestones.campaign_id
        and campaigns.user_id = auth.uid()
    )
  );

grant all on table public.campaign_milestones to anon, authenticated, service_role;

create table if not exists public.admin_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table public.admin_settings enable row level security;

drop policy if exists admin_settings_admin_all on public.admin_settings;
create policy admin_settings_admin_all on public.admin_settings
  for all
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.coach_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  message_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_coach_sessions_user_id
  on public.coach_sessions (user_id);

alter table public.coach_sessions enable row level security;

drop policy if exists coach_own_all on public.coach_sessions;
create policy coach_own_all on public.coach_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all on table public.admin_settings to anon, authenticated, service_role;
grant all on table public.coach_sessions to anon, authenticated, service_role;
