-- Donor-facing email/notification preferences on profiles.
alter table profiles
  add column if not exists notification_email      boolean not null default true,
  add column if not exists notification_updates    boolean not null default true,
  add column if not exists notification_marketing  boolean not null default false;
