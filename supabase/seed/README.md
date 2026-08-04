# Cause stories — setup

"Stories from the Field" on every `/causes/[slug]` page. Authored content, not
campaigns, so the design's video cards have a real home.

## 1. Apply the migration

Supabase dashboard → **SQL Editor** → paste and run:

```
supabase/migrations/20260824000000_cause_stories.sql
```

Creates `public.cause_stories` with RLS on:

| policy | effect |
|---|---|
| `cause_stories_public_read` | anonymous `SELECT` where `published = true` |
| `cause_stories_admin_write` | all writes require `profiles.role in ('admin','super_admin')` |

Drafts (`published = false`) are never world-readable.

## 2. Seed the content

```
supabase/seed/cause_stories.sql
```

101 stories across all 20 causes. Idempotent (`on conflict do nothing`) — safe
to re-run. The first three `sports-youth` rows are the exact cards the design
draws.

## 3. Add videos (optional, and the only step that needs assets)

The seed sets **no** `video_url`, so cards render poster + chip + "Read the
story →". A placeholder URL would restore the play button and have it play
nothing, which is the fake affordance this table exists to remove.

Host the clips anywhere — the column is just a URL — then:

```sql
update public.cause_stories
   set video_url = 'https://…'
 where title = 'From Underdog to Team Captain';
```

The play control and **"Watch Story →"** appear immediately, no code change.

## Environment

Already configured for this app; no new variables.

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # server-only, never client
```

## Behaviour without the migration

The page falls back to the cause's completed campaigns. An unknown-table error
(`42P01`) is treated as "none authored", so a deployment that has not run the
migration degrades cleanly instead of 500ing.

## Guards

- `__tests__/cause-stories-seed.test.ts` — 100+ rows, unique titles, every slug
  a real cause, all 20 causes covered, the three reference cards present, no
  `video_url` seeded.
- `__tests__/cause-landing.test.ts` — the play control and "Watch Story" are
  both gated on `video_url`, and exactly one play control exists.
