-- ─────────────────────────────────────────────────────────────────────────────
-- Gamification persistence — earned badges + community challenges.
--
-- The badge CATALOG stays in code (`lib/gamification.ts` DONOR_BADGES); this
-- persists which badges each user has EARNED, plus joinable challenges and
-- per-user progress. Badges/challenges are public recognition (public read).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── user_badges ──────────────────────────────────────────────────────────────
create table if not exists user_badges (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references profiles(id) on delete cascade,
  badge_id   text not null,               -- matches DONOR_BADGES[].id in code
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_id)
);
create index if not exists user_badges_user_idx on user_badges(user_id);

-- ── challenges ───────────────────────────────────────────────────────────────
create table if not exists challenges (
  id          uuid primary key default uuid_generate_v4(),
  slug        text not null unique,
  title       text not null,
  description text,
  metric      text not null default 'donation_count'
                check (metric in ('donation_count','total_cents','campaign_count')),
  goal_value  bigint not null check (goal_value > 0),
  starts_at   timestamptz,
  ends_at     timestamptz,
  status      text not null default 'active' check (status in ('draft','active','completed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists challenges_status_idx on challenges(status);

-- ── challenge_participants ───────────────────────────────────────────────────
create table if not exists challenge_participants (
  id             uuid primary key default uuid_generate_v4(),
  challenge_id   uuid not null references challenges(id) on delete cascade,
  user_id        uuid not null references profiles(id) on delete cascade,
  progress_value bigint not null default 0 check (progress_value >= 0),
  joined_at      timestamptz not null default now(),
  completed_at   timestamptz,
  unique (challenge_id, user_id)
);
create index if not exists challenge_participants_challenge_idx on challenge_participants(challenge_id);
create index if not exists challenge_participants_user_idx on challenge_participants(user_id);

drop trigger if exists challenges_updated_at on challenges;
create trigger challenges_updated_at before update on challenges
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
alter table user_badges            enable row level security;
alter table challenges             enable row level security;
alter table challenge_participants enable row level security;

-- Badges are public recognition; the owner (and admin) manage their own rows.
drop policy if exists user_badges_public_read on user_badges;
create policy user_badges_public_read on user_badges for select using (true);
drop policy if exists user_badges_owner_write on user_badges;
create policy user_badges_owner_write on user_badges for all
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

-- Challenges: public read of listed ones; admin-managed.
drop policy if exists challenges_public_read on challenges;
create policy challenges_public_read on challenges for select
  using (status in ('active','completed') or is_admin());
drop policy if exists challenges_admin_write on challenges;
create policy challenges_admin_write on challenges for all
  using (is_admin()) with check (is_admin());

-- Participation is public (for leaderboards); the participant manages their row.
drop policy if exists challenge_participants_public_read on challenge_participants;
create policy challenge_participants_public_read on challenge_participants for select using (true);
drop policy if exists challenge_participants_owner_write on challenge_participants;
create policy challenge_participants_owner_write on challenge_participants for all
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

-- ── Seed a few starter challenges (idempotent by slug) ───────────────────────
insert into challenges (slug, title, description, metric, goal_value, status)
values
  ('first-five-gifts', 'Give Five', 'Make five donations to any causes you care about.', 'donation_count', 5, 'active'),
  ('hundred-dollar-hero', '$100 Hero', 'Donate $100 in total across the community.', 'total_cents', 10000, 'active'),
  ('three-cause-champion', 'Three-Cause Champion', 'Support three different campaigns.', 'campaign_count', 3, 'active')
on conflict (slug) do nothing;
