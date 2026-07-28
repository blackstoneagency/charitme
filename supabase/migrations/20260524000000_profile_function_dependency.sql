-- The original schema defines is_admin() before it creates profiles.
-- Pre-create the exact profile contract so fresh databases can compile that function.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  roles jsonb not null default '["donor"]'::jsonb,
  identity_verified boolean not null default false,
  trust_passport_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
