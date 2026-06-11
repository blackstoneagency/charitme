-- Likes/reactions on donor wall comments (donor_messages).
create table if not exists donor_message_likes (
  id                uuid primary key default uuid_generate_v4(),
  donor_message_id  uuid not null references donor_messages(id) on delete cascade,
  user_id           uuid not null references profiles(id) on delete cascade,
  created_at        timestamptz not null default now(),
  unique (donor_message_id, user_id)
);

create index if not exists donor_message_likes_message_id_idx on donor_message_likes(donor_message_id);
create index if not exists donor_message_likes_user_id_idx on donor_message_likes(user_id);

alter table donor_message_likes enable row level security;

drop policy if exists donor_message_likes_read_all on donor_message_likes;
create policy donor_message_likes_read_all on donor_message_likes for select using (true);

drop policy if exists donor_message_likes_owner_write on donor_message_likes;
create policy donor_message_likes_owner_write on donor_message_likes for all
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());
