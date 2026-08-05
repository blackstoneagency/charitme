-- ─────────────────────────────────────────────────────────────────────────────
-- cause_stories — editorial "Stories from the Field" for a cause landing page.
--
-- WHY THIS TABLE EXISTS
--
-- The Sports & Youth design draws three VIDEO cards: a poster image with a play
-- control, a coloured category chip ("YOUTH EMPOWERMENT", "GIRLS IN SPORTS",
-- "COMMUNITY IMPACT"), an editorial title ("From Underdog to Team Captain") and
-- a "Watch Story →" link.
--
-- None of that is a campaign. The page previously approximated it with the
-- cause's most-funded COMPLETED campaigns, which is why it read "Read the story"
-- and carried no play button: every `campaign_media` row of type `video` points
-- at `storage.CharitMe.example`, a reserved TLD that cannot resolve, so a play
-- control would have been a dead affordance.
--
-- This gives the design a real home. A story is authored content with its own
-- poster, chip and optional video, optionally linked to the campaign it is about.
--
-- The play control renders only when `video_url` is present, so the affordance
-- appears exactly when there is something to play and the card degrades to a
-- read link otherwise. That is the whole point of the nullable column.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.cause_stories (
  id           uuid primary key default gen_random_uuid(),

  -- The cause slug from lib/causes.ts (e.g. 'sports-youth'). Deliberately NOT a
  -- foreign key: causes are a TypeScript vocabulary mapped onto campaign
  -- categories, not a table. A FK here would require mirroring that list into
  -- the database, which is the fourth-copy drift this repo has been bitten by.
  cause_slug   text        not null,

  title        text        not null,
  blurb        text,

  -- Chip label as drawn ("YOUTH EMPOWERMENT"). Free text so editorial can name
  -- a story's theme without a migration; `chip_accent` picks the colour.
  chip_label   text,
  chip_accent  smallint    not null default 0 check (chip_accent between 0 and 2),

  poster_url   text,
  -- NULL means "no video" and the card renders as a read link. Non-null makes
  -- the play control appear.
  video_url    text,

  -- Optional: the campaign this story is about, so a reader can go and give.
  -- ON DELETE SET NULL — losing the campaign must not delete the story.
  campaign_id  uuid        references public.campaigns(id) on delete set null,

  -- Editorial ordering; lower sorts first, then newest.
  sort_order   smallint    not null default 0,
  published    boolean     not null default false,
  published_at timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- The page's only query shape: published stories for one cause, in order.
create index if not exists cause_stories_cause_published_idx
  on public.cause_stories (cause_slug, published, sort_order, published_at desc);

create index if not exists cause_stories_campaign_idx
  on public.cause_stories (campaign_id) where campaign_id is not null;

alter table public.cause_stories enable row level security;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Secure by default: anonymous readers see PUBLISHED rows only. An unpublished
-- draft is editorial work in progress and must not be world-readable — the same
-- rule the campaign visibility work in this repo enforces elsewhere.
drop policy if exists cause_stories_public_read on public.cause_stories;
create policy cause_stories_public_read
  on public.cause_stories for select
  using (published = true);

-- Writes are admin-only. There is no per-user ownership model for editorial
-- content, so anything that is not an admin gets no insert/update/delete at all.
-- `profiles.role` is this repo's existing admin marker.
drop policy if exists cause_stories_admin_write on public.cause_stories;
create policy cause_stories_admin_write
  on public.cause_stories for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'super_admin')
    )
  );

-- Keep `updated_at` honest without relying on the client to send it.
create or replace function public.touch_cause_stories_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists cause_stories_touch_updated_at on public.cause_stories;
create trigger cause_stories_touch_updated_at
  before update on public.cause_stories
  for each row execute function public.touch_cause_stories_updated_at();
