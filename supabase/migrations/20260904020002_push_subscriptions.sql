-- Web Push subscriptions.
--
-- Mitigation for the App Store "minimum functionality" risk recorded in
-- mobileGo.md: donation alerts are the one capability an organiser actually
-- wants and the website cannot deliver on its own. This is the SERVER half —
-- native @capacitor/push-notifications would reuse the same table shape.
--
-- ⚠️ A push subscription is a CAPABILITY URL. Anyone holding the endpoint plus
-- the p256dh/auth pair can deliver a notification to that person's device. It is
-- therefore treated like a credential: RLS scopes every row to its owner, and no
-- policy grants SELECT to anyone else. The send path runs as service role.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- The push service URL. UNIQUE because re-subscribing on the same device
  -- returns the same endpoint, and a duplicate row would deliver the same
  -- notification twice to one device.
  endpoint text not null unique,

  -- Encryption material from PushSubscription.getKey(). Without both, a payload
  -- cannot be encrypted and the send is refused rather than sent empty.
  p256dh text not null,
  auth text not null,

  -- Diagnostics only. Never used to decide whether to send.
  user_agent text,

  created_at timestamptz not null default now(),
  last_used_at timestamptz,

  -- Set when a push service answers 404/410 (subscription gone). Kept rather
  -- than deleted so a device that unsubscribes and resubscribes does not look
  -- like a brand-new device, and so the send path can report how many
  -- subscriptions it skipped instead of silently shrinking.
  expired_at timestamptz
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id)
  where expired_at is null;

alter table public.push_subscriptions enable row level security;

-- Owner-only. Deliberately no policy for other authenticated users and none for
-- anon: a subscription is a send capability, so "readable by anyone signed in"
-- would let any account push to any other account's phone.
drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete using (auth.uid() = user_id);

comment on table public.push_subscriptions is
  'Web Push subscriptions, one row per device. Rows are send capabilities: RLS is owner-only and the send path runs as service role.';
