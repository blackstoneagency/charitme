-- ─────────────────────────────────────────────────────────────────────────────
-- Gamification persistence: earned badges + giving challenges
--
-- The badge *catalog* and evaluators already live in lib/gamification.ts; this
-- persists which badges a donor has actually earned (so they're durable and
-- notifiable) and adds time-boxed giving challenges donors can join.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists user_badges (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  badge_id text not null,               -- matches DONOR_BADGES[].id in lib/gamification.ts
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

create index if not exists user_badges_user_idx on user_badges(user_id);

create table if not exists challenges (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  title text not null,
  description text,
  goal_type text not null default 'donation_total' check (goal_type in ('donation_total','donation_count')),
  goal_target_cents bigint not null default 0 check (goal_target_cents >= 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status text not null default 'active' check (status in ('draft','active','ended','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists challenges_status_idx on challenges(status);

create table if not exists challenge_participants (
  id uuid primary key default uuid_generate_v4(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  progress_cents bigint not null default 0 check (progress_cents >= 0),
  joined_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);

create index if not exists challenge_participants_challenge_idx on challenge_participants(challenge_id);
create index if not exists challenge_participants_user_idx on challenge_participants(user_id);

drop trigger if exists challenges_set_updated_at on challenges;
create trigger challenges_set_updated_at before update on challenges for each row execute function set_updated_at();

-- RLS ─────────────────────────────────────────────────────────────────────────
alter table user_badges enable row level security;
alter table challenges enable row level security;
alter table challenge_participants enable row level security;

-- Badges: a user reads their own; awarding happens server-side (service role).
drop policy if exists user_badges_select on user_badges;
create policy user_badges_select on user_badges for select using (auth.uid() = user_id or is_admin());

-- Challenges: active/ended are public; drafts + writes are admin-only.
drop policy if exists challenges_read on challenges;
create policy challenges_read on challenges for select using (status in ('active','ended') or is_admin());
drop policy if exists challenges_write on challenges;
create policy challenges_write on challenges for all using (is_admin()) with check (is_admin());

-- Participation: participants are publicly visible (leaderboards); users join for themselves.
drop policy if exists challenge_participants_read on challenge_participants;
create policy challenge_participants_read on challenge_participants for select using (true);
drop policy if exists challenge_participants_insert on challenge_participants;
create policy challenge_participants_insert on challenge_participants for insert
  with check (auth.uid() = user_id or is_admin());
drop policy if exists challenge_participants_update on challenge_participants;
create policy challenge_participants_update on challenge_participants for update
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());
