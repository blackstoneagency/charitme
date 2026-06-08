import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Management API — the ONLY external endpoint that accepts raw SQL
// against a hosted Supabase project.
//
// Requires: SUPABASE_ACCESS_TOKEN (personal access token from
//   app.supabase.com → Account → Access Tokens)
//
// /pg-meta/v1/query is blocked by Kong for external access.
// ─────────────────────────────────────────────────────────────────────────────
function getProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  // https://yanexccimwooursawynm.supabase.co → yanexccimwooursawynm
  const match = url.match(/https?:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

async function execSQL(sql: string): Promise<{ ok: boolean; error?: string }> {
  const ref   = getProjectRef();
  const token = process.env.SUPABASE_ACCESS_TOKEN;

  if (!ref)   return { ok: false, error: 'Cannot extract project ref from NEXT_PUBLIC_SUPABASE_URL' };
  if (!token) return { ok: false, error: 'SUPABASE_ACCESS_TOKEN not set — see instructions below' };

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  // Always parse the body — Supabase Management API returns HTTP 200
  // even when SQL execution fails, with error details in the response body.
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    const text = await res.text().catch(() => res.statusText);
    return { ok: false, error: `${res.status}: ${text.slice(0, 300)}` };
  }

  // Check for error in response body (multiple possible formats)
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    // Format 1: { "error": "..." }
    if (typeof b.error === 'string' && b.error) {
      // "already exists" errors are idempotency warnings, not failures
      const alreadyExists = b.error.includes('already exists') ||
                            b.error.includes('duplicate') ||
                            b.error.includes('42P07') ||
                            b.error.includes('42710');
      if (alreadyExists) return { ok: true };
      return { ok: false, error: b.error.slice(0, 300) };
    }
    // Format 2: { "message": "..." } with non-2xx
    if (!res.ok && typeof b.message === 'string') {
      return { ok: false, error: b.message.slice(0, 300) };
    }
  }

  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}` };
  }

  return { ok: true };
}

// ─── Schema chunks (CREATE TABLE IF NOT EXISTS — safe to run multiple times) ─
const SCHEMA_CHUNKS: { name: string; sql: string }[] = [
  { name: 'Extensions', sql: `
    create extension if not exists "uuid-ossp";
    create extension if not exists "pg_trgm";
  ` },
  { name: 'set_updated_at + handle_new_user', sql: `
    create or replace function public.set_updated_at()
    returns trigger language plpgsql as $$
    begin new.updated_at = now(); return new; end; $$;

    create or replace function public.handle_new_user()
    returns trigger language plpgsql security definer set search_path = public as $$
    declare v_roles jsonb;
    begin
      v_roles := coalesce(new.raw_user_meta_data -> 'roles', '["donor"]'::jsonb);
      if jsonb_typeof(v_roles) <> 'array' then v_roles := '["donor"]'::jsonb; end if;
      insert into public.profiles (id, email, full_name, avatar_url, roles)
      values (new.id, new.email,
        coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
        new.raw_user_meta_data ->> 'avatar_url', v_roles)
      on conflict (id) do update
        set email = excluded.email,
            full_name = coalesce(public.profiles.full_name, excluded.full_name),
            updated_at = now();
      return new;
    end; $$;
  ` },
  { name: 'profiles table', sql: `
    create table if not exists public.profiles (
      id                       uuid primary key references auth.users(id) on delete cascade,
      email                    text, full_name text, avatar_url text, bio text,
      roles                    jsonb    not null default '["donor"]'::jsonb,
      plan                     text     not null default 'free' check (plan in ('free','starter','pro','enterprise')),
      identity_verified        boolean  not null default false,
      trust_passport_score     int      not null default 0,
      stripe_customer_id       text, stripe_subscription_id text,
      org_name text, org_website text, org_tagline text,
      timezone text not null default 'America/New_York',
      currency text not null default 'usd',
      language text not null default 'en',
      date_format text not null default 'MM/DD/YYYY',
      time_format text not null default '12h',
      show_public_profile boolean not null default true,
      campaign_recommendations boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  ` },
  { name: 'is_admin function', sql: `
    create or replace function public.is_admin()
    returns boolean language sql stable security definer set search_path = public as $$
      select exists (select 1 from public.profiles where id = auth.uid() and roles ? 'admin');
    $$;
  ` },
  { name: 'connected_accounts', sql: `
    create table if not exists public.connected_accounts (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references profiles(id) on delete cascade,
      stripe_account_id text not null unique,
      charges_enabled boolean not null default false,
      payouts_enabled boolean not null default false,
      details_submitted boolean not null default false,
      verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
      first_payout_hold_until timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  ` },
  { name: 'campaigns', sql: `
    create table if not exists public.campaigns (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references profiles(id) on delete cascade,
      beneficiary_profile_id uuid references profiles(id) on delete set null,
      slug text not null unique, title text not null, tagline text,
      description text not null, category text not null,
      goal_amount bigint not null check (goal_amount > 0),
      raised_amount bigint not null default 0 check (raised_amount >= 0),
      backer_count int not null default 0 check (backer_count >= 0),
      deadline date,
      status text not null default 'draft' check (status in ('draft','active','paused','completed','rejected','frozen')),
      beneficiary_name text, beneficiary_relationship text,
      cover_image_url text, video_url text,
      image_urls text[] not null default '{}',
      location text,
      trust_status text not null default 'Needs More Info',
      campaign_health_score int not null default 0 check (campaign_health_score between 0 and 100),
      payout_frozen boolean not null default false,
      featured boolean not null default false,
      pinned boolean not null default false,
      nonprofit_verified boolean not null default false,
      thank_donors_sent_at timestamptz,
      ai_generated boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  ` },
  { name: 'campaign sub-tables', sql: `
    create table if not exists public.campaign_media (
      id uuid primary key default uuid_generate_v4(),
      campaign_id uuid not null references campaigns(id) on delete cascade,
      uploader_id uuid not null references profiles(id) on delete cascade,
      media_type text not null check (media_type in ('image','video','document')),
      storage_path text not null, public_url text, caption text, alt_text text,
      sort_order int not null default 0, created_at timestamptz not null default now()
    );
    create table if not exists public.campaign_updates (
      id uuid primary key default uuid_generate_v4(),
      campaign_id uuid not null references campaigns(id) on delete cascade,
      user_id uuid references profiles(id) on delete set null,
      title text, body text not null, ai_generated boolean not null default false,
      scheduled_at timestamptz, published_at timestamptz,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table if not exists public.campaign_milestones (
      id uuid primary key default uuid_generate_v4(),
      campaign_id uuid not null references campaigns(id) on delete cascade,
      title text not null, description text, target_amount bigint,
      reached_at timestamptz, sort_order int not null default 0,
      created_at timestamptz not null default now()
    );
  ` },
  { name: 'donations', sql: `
    create table if not exists public.donations (
      id uuid primary key default uuid_generate_v4(),
      campaign_id uuid not null references campaigns(id) on delete cascade,
      donor_id uuid references profiles(id) on delete set null,
      amount_cents bigint not null check (amount_cents > 0),
      tip_cents bigint not null default 0, processing_fee_cents bigint not null default 0,
      status text not null default 'pending' check (status in ('pending','completed','refunded','failed','disputed')),
      anonymous boolean not null default false, message text,
      stripe_payment_intent_id text, stripe_checkout_session_id text,
      refunded_at timestamptz, refund_reason text,
      offline boolean not null default false, offline_method text,
      offline_donor_name text, offline_donor_email text,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
  ` },
  { name: 'recurring_donations', sql: `
    create table if not exists public.recurring_donations (
      id uuid primary key default uuid_generate_v4(),
      donor_id uuid references profiles(id) on delete set null,
      campaign_id uuid references campaigns(id) on delete cascade,
      amount_cents bigint not null check (amount_cents > 0),
      cadence text not null default 'monthly' check (cadence in ('weekly','monthly','quarterly','annual')),
      status text not null default 'active' check (status in ('active','paused','cancelled','past_due')),
      stripe_subscription_id text unique, next_bill_at timestamptz, cancelled_at timestamptz,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
  ` },
  { name: 'donor_messages + replies + payouts', sql: `
    create table if not exists public.donor_messages (
      id uuid primary key default uuid_generate_v4(),
      campaign_id uuid not null references campaigns(id) on delete cascade,
      donor_id uuid references profiles(id) on delete set null,
      message text not null check (char_length(message) between 1 and 1000),
      anonymous boolean not null default false, created_at timestamptz not null default now()
    );
    create table if not exists public.campaign_owner_replies (
      id uuid primary key default uuid_generate_v4(),
      campaign_id uuid not null references campaigns(id) on delete cascade,
      donor_message_id uuid references donor_messages(id) on delete set null,
      owner_id uuid not null references profiles(id) on delete cascade,
      message text not null check (char_length(message) between 1 and 5000),
      created_at timestamptz not null default now()
    );
    create table if not exists public.payouts (
      id uuid primary key default uuid_generate_v4(),
      campaign_id uuid not null references campaigns(id) on delete cascade,
      user_id uuid not null references profiles(id) on delete cascade,
      amount_cents bigint not null check (amount_cents > 0),
      fee_cents bigint not null default 0,
      payout_speed text not null default 'standard' check (payout_speed in ('standard','same_day','instant')),
      status text not null default 'requested' check (status in ('requested','approved','paid','failed','frozen','released')),
      stripe_payout_id text, note text,
      requested_at timestamptz not null default now(), paid_at timestamptz,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
  ` },
  { name: 'transparency + trust + docs', sql: `
    create table if not exists public.transparency_ledger_items (
      id uuid primary key default uuid_generate_v4(),
      campaign_id uuid not null references campaigns(id) on delete cascade,
      item_type text not null default 'expense' check (item_type in ('expense','income','milestone','receipt','payout','offline_donation','other')),
      title text not null, amount_cents bigint, category text,
      status text not null default 'pending' check (status in ('pending','received','paid','verified')),
      receipt_url text, created_at timestamptz not null default now()
    );
    create table if not exists public.trust_scores (
      id uuid primary key default uuid_generate_v4(),
      campaign_id uuid not null references campaigns(id) on delete cascade,
      score int not null default 0 check (score between 0 and 100),
      identity_score int not null default 0, story_score int not null default 0,
      activity_score int not null default 0, transparency_score int not null default 0,
      computed_at timestamptz not null default now()
    );
    create table if not exists public.verification_documents (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references profiles(id) on delete cascade,
      campaign_id uuid references campaigns(id) on delete cascade,
      doc_type text not null check (doc_type in ('id','medical','financial','legal','nonprofit','other')),
      storage_path text not null, public_url text,
      is_public boolean not null default false, verified boolean not null default false,
      verified_by uuid references profiles(id) on delete set null,
      verified_at timestamptz, notes text, created_at timestamptz not null default now()
    );
  ` },
  { name: 'admin + compliance tables', sql: `
    create table if not exists public.risk_flags (
      id uuid primary key default uuid_generate_v4(),
      campaign_id uuid references campaigns(id) on delete cascade,
      user_id uuid references profiles(id) on delete cascade,
      flag_type text not null,
      severity text not null default 'low' check (severity in ('low','medium','high','critical')),
      description text, resolved boolean not null default false,
      resolved_by uuid references profiles(id) on delete set null,
      resolved_at timestamptz, created_at timestamptz not null default now()
    );
    create table if not exists public.admin_reviews (
      id uuid primary key default uuid_generate_v4(),
      campaign_id uuid not null references campaigns(id) on delete cascade,
      reviewer_id uuid references profiles(id) on delete set null,
      action text not null check (action in ('approved','rejected','flagged','held','released')),
      notes text, created_at timestamptz not null default now()
    );
    create table if not exists public.refunds (
      id uuid primary key default uuid_generate_v4(),
      donation_id uuid not null references donations(id) on delete cascade,
      amount_cents bigint not null check (amount_cents > 0),
      reason text, notes text,
      status text not null default 'requested' check (status in ('requested','approved','declined','processed')),
      requested_by uuid references profiles(id) on delete set null,
      stripe_refund_id text, processed_at timestamptz,
      created_at timestamptz not null default now()
    );
    create table if not exists public.campaign_reports (
      id uuid primary key default uuid_generate_v4(),
      campaign_id uuid not null references campaigns(id) on delete cascade,
      reporter_id uuid references profiles(id) on delete set null,
      reason text not null, details text,
      status text not null default 'open' check (status in ('open','investigating','resolved','dismissed')),
      resolved_by uuid references profiles(id) on delete set null,
      resolved_at timestamptz, created_at timestamptz not null default now()
    );
  ` },
  { name: 'webhook_events + ai_generations + subscriptions', sql: `
    create table if not exists public.webhook_events (
      id uuid primary key default uuid_generate_v4(),
      stripe_event_id text not null unique, event_type text not null,
      payload jsonb not null default '{}'::jsonb,
      processed_at timestamptz, processing_error text,
      created_at timestamptz not null default now()
    );
    create table if not exists public.ai_generations (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid references profiles(id) on delete set null,
      campaign_id uuid references campaigns(id) on delete set null,
      generation_type text not null,
      prompt jsonb not null default '{}'::jsonb,
      result jsonb not null default '{}'::jsonb,
      tokens_used int, model text,
      created_at timestamptz not null default now()
    );
    create table if not exists public.subscriptions (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references profiles(id) on delete cascade,
      plan text not null check (plan in ('free','starter','pro','enterprise')),
      status text not null default 'active' check (status in ('active','trialing','cancelled','past_due','paused')),
      stripe_subscription_id text unique, stripe_customer_id text,
      current_period_start timestamptz, current_period_end timestamptz,
      cancel_at_period_end boolean not null default false,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
  ` },
  { name: 'platform_settings + feature_flags + audit + integration + team + nonprofit + misc', sql: `
    create table if not exists public.platform_settings (
      id int primary key default 1 check (id = 1),
      config jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table if not exists public.feature_flags (
      id uuid primary key default uuid_generate_v4(),
      key text not null unique, enabled boolean not null default false,
      description text, rollout_pct int not null default 100,
      updated_by uuid references profiles(id) on delete set null,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table if not exists public.audit_logs (
      id uuid primary key default uuid_generate_v4(),
      actor_id uuid references profiles(id) on delete set null,
      action text not null, target_type text, target_id uuid,
      metadata jsonb not null default '{}'::jsonb,
      ip_address text, user_agent text,
      created_at timestamptz not null default now()
    );
    create table if not exists public.integration_connections (
      id uuid primary key default uuid_generate_v4(),
      owner_id uuid not null references profiles(id) on delete cascade,
      provider text not null,
      status text not null default 'connected' check (status in ('connected','paused','disconnected')),
      config jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      unique (owner_id, provider)
    );
    create table if not exists public.team_members (
      id uuid primary key default uuid_generate_v4(),
      campaign_id uuid not null references campaigns(id) on delete cascade,
      user_id uuid not null references profiles(id) on delete cascade,
      role text not null default 'editor' check (role in ('owner','admin','editor','viewer','finance')),
      invited_by uuid references profiles(id) on delete set null,
      accepted_at timestamptz, created_at timestamptz not null default now(),
      unique (campaign_id, user_id)
    );
    create table if not exists public.nonprofit_profiles (
      id uuid primary key default uuid_generate_v4(),
      owner_id uuid not null references profiles(id) on delete cascade,
      name text not null, slug text not null unique, mission text, ein text unique,
      website_url text, logo_url text, verified boolean not null default false,
      verified_at timestamptz,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table if not exists public.coach_sessions (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references profiles(id) on delete cascade,
      campaign_id uuid references campaigns(id) on delete set null,
      message_count int not null default 0,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table if not exists public.donor_crm_contacts (
      id uuid primary key default uuid_generate_v4(),
      owner_id uuid not null references profiles(id) on delete cascade,
      donor_id uuid references profiles(id) on delete set null,
      email text, full_name text, phone text,
      tags text[] not null default '{}',
      lifetime_value_cents bigint not null default 0,
      last_donated_at timestamptz, notes text,
      consent_email boolean not null default true,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table if not exists public.support_tickets (
      id uuid primary key default uuid_generate_v4(),
      submitter_id uuid references profiles(id) on delete set null,
      name text not null, email text not null, subject text not null, message text not null,
      category text not null default 'general', priority text not null default 'normal',
      status text not null default 'open',
      campaign_id uuid references campaigns(id) on delete set null,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
  ` },
  { name: 'Indexes', sql: `
    create index if not exists idx_profiles_email on profiles(email);
    create index if not exists idx_profiles_roles on profiles using gin(roles);
    create index if not exists idx_campaigns_user_id on campaigns(user_id);
    create index if not exists idx_campaigns_status on campaigns(status);
    create index if not exists idx_campaigns_category on campaigns(category);
    create index if not exists idx_campaigns_slug on campaigns(slug);
    create index if not exists idx_campaigns_raised on campaigns(raised_amount desc);
    create index if not exists idx_campaigns_created on campaigns(created_at desc);
    create index if not exists idx_campaigns_title_trgm on campaigns using gin(title gin_trgm_ops);
    create index if not exists idx_donations_campaign_id on donations(campaign_id);
    create index if not exists idx_donations_donor_id on donations(donor_id);
    create index if not exists idx_donations_status on donations(status);
    create index if not exists idx_recurring_donor_id on recurring_donations(donor_id);
    create index if not exists idx_recurring_campaign_id on recurring_donations(campaign_id);
    create index if not exists idx_payouts_user_id on payouts(user_id);
    create index if not exists idx_ledger_campaign_id on transparency_ledger_items(campaign_id);
    create index if not exists idx_webhook_stripe_id on webhook_events(stripe_event_id);
    create index if not exists idx_audit_logs_created on audit_logs(created_at desc);
  ` },
  { name: 'Enable RLS', sql: `
    alter table profiles enable row level security;
    alter table connected_accounts enable row level security;
    alter table campaigns enable row level security;
    alter table campaign_media enable row level security;
    alter table campaign_updates enable row level security;
    alter table campaign_milestones enable row level security;
    alter table donations enable row level security;
    alter table recurring_donations enable row level security;
    alter table donor_messages enable row level security;
    alter table campaign_owner_replies enable row level security;
    alter table payouts enable row level security;
    alter table transparency_ledger_items enable row level security;
    alter table trust_scores enable row level security;
    alter table verification_documents enable row level security;
    alter table risk_flags enable row level security;
    alter table admin_reviews enable row level security;
    alter table refunds enable row level security;
    alter table campaign_reports enable row level security;
    alter table webhook_events enable row level security;
    alter table ai_generations enable row level security;
    alter table subscriptions enable row level security;
    alter table platform_settings enable row level security;
    alter table feature_flags enable row level security;
    alter table audit_logs enable row level security;
    alter table integration_connections enable row level security;
    alter table team_members enable row level security;
    alter table nonprofit_profiles enable row level security;
    alter table coach_sessions enable row level security;
    alter table donor_crm_contacts enable row level security;
    alter table support_tickets enable row level security;
  ` },
  { name: 'RLS Policies', sql: `
    do $policy_block$ begin
      if not exists (select 1 from pg_policies where tablename='profiles' and policyname='profiles_read') then
        create policy profiles_read on profiles for select using (true); end if;
      if not exists (select 1 from pg_policies where tablename='profiles' and policyname='profiles_insert_self') then
        create policy profiles_insert_self on profiles for insert with check (auth.uid() = id or is_admin()); end if;
      if not exists (select 1 from pg_policies where tablename='profiles' and policyname='profiles_update_own') then
        create policy profiles_update_own on profiles for update using (auth.uid() = id or is_admin()); end if;
      if not exists (select 1 from pg_policies where tablename='campaigns' and policyname='campaigns_public_read') then
        create policy campaigns_public_read on campaigns for select using (status = 'active' or auth.uid() = user_id or is_admin()); end if;
      if not exists (select 1 from pg_policies where tablename='campaigns' and policyname='campaigns_insert_own') then
        create policy campaigns_insert_own on campaigns for insert with check (auth.uid() = user_id); end if;
      if not exists (select 1 from pg_policies where tablename='campaigns' and policyname='campaigns_update_own') then
        create policy campaigns_update_own on campaigns for update using (auth.uid() = user_id or is_admin()); end if;
      if not exists (select 1 from pg_policies where tablename='donations' and policyname='donations_read') then
        create policy donations_read on donations for select using (auth.uid() = donor_id or is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid())); end if;
      if not exists (select 1 from pg_policies where tablename='donations' and policyname='donations_insert_svc') then
        create policy donations_insert_svc on donations for insert with check (true); end if;
      if not exists (select 1 from pg_policies where tablename='recurring_donations' and policyname='recurring_own_read') then
        create policy recurring_own_read on recurring_donations for select using (auth.uid() = donor_id or is_admin()); end if;
      if not exists (select 1 from pg_policies where tablename='recurring_donations' and policyname='recurring_own_insert') then
        create policy recurring_own_insert on recurring_donations for insert with check (auth.uid() = donor_id or is_admin()); end if;
      if not exists (select 1 from pg_policies where tablename='recurring_donations' and policyname='recurring_own_update') then
        create policy recurring_own_update on recurring_donations for update using (auth.uid() = donor_id or is_admin()); end if;
      if not exists (select 1 from pg_policies where tablename='payouts' and policyname='payouts_own_read') then
        create policy payouts_own_read on payouts for select using (auth.uid() = user_id or is_admin()); end if;
      if not exists (select 1 from pg_policies where tablename='payouts' and policyname='payouts_own_insert') then
        create policy payouts_own_insert on payouts for insert with check (auth.uid() = user_id); end if;
      if not exists (select 1 from pg_policies where tablename='webhook_events' and policyname='webhooks_admin_all') then
        create policy webhooks_admin_all on webhook_events for all using (is_admin()) with check (is_admin()); end if;
      if not exists (select 1 from pg_policies where tablename='platform_settings' and policyname='settings_public_read') then
        create policy settings_public_read on platform_settings for select using (true); end if;
      if not exists (select 1 from pg_policies where tablename='platform_settings' and policyname='settings_admin_all') then
        create policy settings_admin_all on platform_settings for all using (is_admin()) with check (is_admin()); end if;
      if not exists (select 1 from pg_policies where tablename='feature_flags' and policyname='flags_public_read') then
        create policy flags_public_read on feature_flags for select using (true); end if;
      if not exists (select 1 from pg_policies where tablename='audit_logs' and policyname='audit_admin_read') then
        create policy audit_admin_read on audit_logs for select using (is_admin()); end if;
      if not exists (select 1 from pg_policies where tablename='transparency_ledger_items' and policyname='ledger_public_read') then
        create policy ledger_public_read on transparency_ledger_items for select using (true); end if;
      if not exists (select 1 from pg_policies where tablename='campaign_updates' and policyname='updates_public_read') then
        create policy updates_public_read on campaign_updates for select using (true); end if;
      if not exists (select 1 from pg_policies where tablename='donor_messages' and policyname='dm_public_read') then
        create policy dm_public_read on donor_messages for select using (true); end if;
      if not exists (select 1 from pg_policies where tablename='donor_messages' and policyname='dm_insert_any') then
        create policy dm_insert_any on donor_messages for insert with check (true); end if;
      if not exists (select 1 from pg_policies where tablename='integration_connections' and policyname='integrations_own_all') then
        create policy integrations_own_all on integration_connections for all using (auth.uid() = owner_id or is_admin()) with check (auth.uid() = owner_id or is_admin()); end if;
      if not exists (select 1 from pg_policies where tablename='refunds' and policyname='refunds_own_read') then
        create policy refunds_own_read on refunds for select using (auth.uid() = requested_by or is_admin()); end if;
      if not exists (select 1 from pg_policies where tablename='refunds' and policyname='refunds_own_insert') then
        create policy refunds_own_insert on refunds for insert with check (auth.uid() = requested_by); end if;
      if not exists (select 1 from pg_policies where tablename='campaign_reports' and policyname='reports_insert_public') then
        create policy reports_insert_public on campaign_reports for insert with check (true); end if;
      if not exists (select 1 from pg_policies where tablename='campaign_reports' and policyname='reports_admin_read') then
        create policy reports_admin_read on campaign_reports for select using (is_admin()); end if;
      if not exists (select 1 from pg_policies where tablename='support_tickets' and policyname='support_tickets_insert') then
        create policy support_tickets_insert on support_tickets for insert with check (true); end if;
    end $policy_block$;
  ` },
  { name: 'Triggers', sql: `
    drop trigger if exists set_updated_at_profiles on profiles;
    create trigger set_updated_at_profiles before update on profiles for each row execute function set_updated_at();
    drop trigger if exists set_updated_at_campaigns on campaigns;
    create trigger set_updated_at_campaigns before update on campaigns for each row execute function set_updated_at();
    drop trigger if exists set_updated_at_donations on donations;
    create trigger set_updated_at_donations before update on donations for each row execute function set_updated_at();
    drop trigger if exists set_updated_at_recurring on recurring_donations;
    create trigger set_updated_at_recurring before update on recurring_donations for each row execute function set_updated_at();
    drop trigger if exists set_updated_at_payouts on payouts;
    create trigger set_updated_at_payouts before update on payouts for each row execute function set_updated_at();
    drop trigger if exists set_updated_at_platform on platform_settings;
    create trigger set_updated_at_platform before update on platform_settings for each row execute function set_updated_at();
    drop trigger if exists on_auth_user_created on auth.users;
    create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
  ` },
  { name: 'record_donation RPC', sql: `
    create or replace function public.record_donation(
      p_stripe_event_id text, p_campaign_id uuid, p_donor_id uuid,
      p_amount_cents bigint, p_tip_cents bigint, p_processing_fee_cents bigint,
      p_message text, p_anonymous boolean,
      p_stripe_payment_intent_id text, p_stripe_checkout_session_id text
    ) returns jsonb language plpgsql security definer as $$
    declare v_existing uuid;
    begin
      select id into v_existing from donations
      where stripe_checkout_session_id = p_stripe_checkout_session_id
         or (stripe_payment_intent_id = p_stripe_payment_intent_id and p_stripe_payment_intent_id is not null)
      limit 1;
      if v_existing is not null then
        return jsonb_build_object('status','already_processed','id', v_existing);
      end if;
      insert into donations (campaign_id, donor_id, amount_cents, tip_cents, processing_fee_cents, status, anonymous, message, stripe_payment_intent_id, stripe_checkout_session_id)
      values (p_campaign_id, p_donor_id, p_amount_cents, p_tip_cents, p_processing_fee_cents, 'completed', p_anonymous, p_message, p_stripe_payment_intent_id, p_stripe_checkout_session_id);
      update campaigns set raised_amount = raised_amount + p_amount_cents, backer_count = backer_count + 1, updated_at = now() where id = p_campaign_id;
      insert into webhook_events (stripe_event_id, event_type, payload, processed_at) values (p_stripe_event_id, 'checkout.session.completed', '{}'::jsonb, now()) on conflict (stripe_event_id) do nothing;
      return jsonb_build_object('status','recorded');
    exception when others then
      insert into webhook_events (stripe_event_id, event_type, payload, processing_error) values (p_stripe_event_id, 'checkout.session.completed', '{}'::jsonb, sqlerrm) on conflict (stripe_event_id) do nothing;
      raise;
    end; $$;
  ` },
  // ── THIS IS THE CRITICAL MISSING PIECE ───────────────────────────────────
  // When tables are created via the Management API (not Supabase dashboard),
  // Postgres does NOT auto-grant access to the PostgREST roles.
  // Without these grants, ALL supabaseAdmin queries return empty errors
  // even though the tables exist and are visible in the Table Editor.
  { name: 'Role grants (CRITICAL — fixes supabaseAdmin access)', sql: `
    grant usage on schema public to anon, authenticated, service_role;
    grant all   on all tables    in schema public to anon, authenticated, service_role;
    grant all   on all sequences in schema public to anon, authenticated, service_role;
    grant all   on all routines  in schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant all on routines  to anon, authenticated, service_role;
    select pg_notify('pgrst', 'reload schema');
  ` },
  { name: 'GRANT ALL to PostgREST roles', sql: `
    grant usage on schema public to anon, authenticated, service_role;
    grant all on all tables    in schema public to anon, authenticated, service_role;
    grant all on all sequences in schema public to anon, authenticated, service_role;
    grant all on all routines  in schema public to anon, authenticated, service_role;
    alter default privileges in schema public
      grant all on tables    to anon, authenticated, service_role;
    alter default privileges in schema public
      grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public
      grant all on routines  to anon, authenticated, service_role;
    select pg_notify('pgrst', 'reload schema');
  ` },
  { name: 'Bootstrap data', sql: `
    insert into public.platform_settings (id, config) values (1, '{
      "platformName":"CharitMe","tagline":"Fundraising that thinks for you.",
      "supportEmail":"hello@charitme.com","currency":"USD",
      "platformFeePercent":0,"donationFeePercent":2.9,
      "stripeLiveMode":true,"allowNewRegistrations":true,"maintenanceMode":false
    }'::jsonb) on conflict (id) do nothing;
    insert into public.feature_flags (key, enabled, description, rollout_pct) values
      ('ai_growth_plan',true,'AI Growth Plan',100),
      ('ai_coach',true,'AI Coach',100),
      ('recurring_donations',true,'Recurring donations',100),
      ('campaign_analytics',true,'Campaign analytics',100),
      ('team_fundraising',true,'Team fundraising',100)
    on conflict (key) do nothing;
  ` },
  { name: 'Admin profile', sql: `
    do $$ declare v_uid uuid;
    begin
      select id into v_uid from auth.users where email = 'blackstoneagencyllc@gmail.com' limit 1;
      if v_uid is not null then
        insert into public.profiles (id, email, roles) values (v_uid, 'blackstoneagencyllc@gmail.com', '["admin","donor"]'::jsonb)
        on conflict (id) do update set roles = (select jsonb_agg(distinct role) from (select jsonb_array_elements_text(profiles.roles) as role union select 'admin') m), updated_at = now();
      end if;
    end; $$;
  ` },
  { name: 'Seed support_cases (500 rows, idempotent)', sql: `
    do $$
    declare
      profile_ids uuid[];
      subjects text[] := array['Unable to withdraw my campaign funds','My donation did not go through','How do I edit my campaign after publishing?','Stripe account verification stuck','My campaign was flagged — need review','Refund request for duplicate donation','Can I transfer campaign ownership?','Photo upload not working on mobile','Campaign not showing in search results','I did not receive my donation receipt','How do I add a co-organizer?','Connect a different bank account','Campaign goal amount is wrong','My account is locked — need help','Withdraw payout to international account','Donation shows pending for 5 days','AI campaign builder produced incorrect content','How do I close a completed campaign?','Supporter left an inappropriate comment','I cannot log in with Google SSO','Payout sent but not received','CharitScore is lower than expected','How do I extend my campaign deadline?','Campaign video thumbnail not displaying','Where is my 1099 tax form?','How do I set up team fundraising?','My campaign was duplicated by someone else','Mobile app crashes when uploading photos','Donation matching not calculating correctly','How do I pause my campaign?','I need to update my legal name','Can I fundraise for an international charity?','Notification emails are going to spam','How do I delete my account?','Campaign analytics not loading','I cannot add a new payment method','My campaign URL changed after editing','Two donations were charged instead of one','How to get verified badge on my campaign?','Donor reported they cannot donate on mobile','Payout declined what do I do?','I did not get an email confirmation','How do I apply for fee waivers?','Feature request: recurring donations','Campaign description formatting is broken','My beneficiary is not receiving funds','Stripe identity verification failed','Account flagged for suspicious activity','How long does payout take?','Donation was charged in the wrong currency'];
      bodies    text[] := array['I have been waiting for over a week and the issue is still not resolved. Please help urgently.','This has caused significant stress for my family. We depend on these funds.','I followed all the steps but the problem persists. Screenshots attached in a follow-up email.','I appreciate the platform but this issue is blocking my campaign completely.','A quick response would be greatly appreciated. The campaign deadline is approaching.','I tried contacting support before but never heard back. Trying again here.','My donors are asking me about this and I have no answer for them.','This happened after the recent update. It may be a bug introduced in the latest release.','Everything was working fine yesterday. The issue started this morning.','I have already tried clearing my browser cache and logging in on a different device.','I am a long-time user and this is the first time I have had an issue.','The error message I receive is: Something went wrong. Please try again.','I noticed this issue on both desktop and mobile. It appears to be platform-wide.','I would like a refund or credit if this cannot be resolved within 24 hours.','My campaign ends in 3 days. This is time-sensitive.','I am raising funds for a medical emergency and need this resolved ASAP.','I checked the FAQ and help center but could not find an answer.','A friend who also uses CharitMe is having the same issue.','I am happy to provide additional details or screenshots if needed.','Please escalate this if the first-level support cannot solve it.'];
      priorities text[] := array['low','normal','normal','normal','high','high','urgent'];
      statuses   text[] := array['open','open','open','in_progress','in_progress','resolved','resolved','closed'];
      sources    text[] := array['web','web','web','email','api'];
      i int; sub_id uuid;
    begin
      if (select count(*) from public.support_cases) > 0 then return; end if;
      select array_agg(id) into profile_ids from (select id from public.profiles limit 50) t;
      for i in 1..500 loop
        if profile_ids is not null and array_length(profile_ids,1) > 0 and (i % 4 != 0) then
          sub_id := profile_ids[1 + ((i-1) % array_length(profile_ids,1))];
        else sub_id := null; end if;
        insert into public.support_cases (submitter_id, subject, body, priority, status, created_at, updated_at)
        values (sub_id, subjects[1+((i-1)%50)], bodies[1+((i-1)%20)], priorities[1+((i-1)%7)], statuses[1+((i-1)%8)], now()-(random()*interval '730 days'), now()-(random()*interval '730 days'));
      end loop;
    end $$;
  ` },
  { name: 'Seed sponsors (50 rows, idempotent)', sql: `
    do $$
    begin
      if (select count(*) from public.sponsors) > 0 then return; end if;
      insert into public.sponsors (name, logo_url, website, active, sort_order) values
        ('Google.org','https://logo.clearbit.com/google.org','https://google.org',true,1),('Salesforce','https://logo.clearbit.com/salesforce.com','https://salesforce.com',true,2),('Microsoft','https://logo.clearbit.com/microsoft.com','https://microsoft.com',true,3),('Apple','https://logo.clearbit.com/apple.com','https://apple.com',true,4),('Amazon','https://logo.clearbit.com/amazon.com','https://amazon.com',true,5),('Meta','https://logo.clearbit.com/meta.com','https://meta.com',true,6),('Stripe','https://logo.clearbit.com/stripe.com','https://stripe.com',true,7),('Shopify','https://logo.clearbit.com/shopify.com','https://shopify.com',true,8),('Airbnb','https://logo.clearbit.com/airbnb.com','https://airbnb.com',true,9),('PayPal','https://logo.clearbit.com/paypal.com','https://paypal.com',true,10),('Visa','https://logo.clearbit.com/visa.com','https://visa.com',true,11),('Mastercard','https://logo.clearbit.com/mastercard.com','https://mastercard.com',true,12),('Twilio','https://logo.clearbit.com/twilio.com','https://twilio.com',true,13),('HubSpot','https://logo.clearbit.com/hubspot.com','https://hubspot.com',true,14),('Mailchimp','https://logo.clearbit.com/mailchimp.com','https://mailchimp.com',true,15),('Slack','https://logo.clearbit.com/slack.com','https://slack.com',true,16),('Zoom','https://logo.clearbit.com/zoom.us','https://zoom.us',true,17),('Dropbox','https://logo.clearbit.com/dropbox.com','https://dropbox.com',true,18),('Atlassian','https://logo.clearbit.com/atlassian.com','https://atlassian.com',true,19),('Notion','https://logo.clearbit.com/notion.so','https://notion.so',true,20),('Figma','https://logo.clearbit.com/figma.com','https://figma.com',false,21),('GitHub','https://logo.clearbit.com/github.com','https://github.com',true,22),('Vercel','https://logo.clearbit.com/vercel.com','https://vercel.com',true,23),('Supabase','https://logo.clearbit.com/supabase.com','https://supabase.com',true,24),('Cloudflare','https://logo.clearbit.com/cloudflare.com','https://cloudflare.com',true,25),('Intercom','https://logo.clearbit.com/intercom.com','https://intercom.com',false,26),('Zendesk','https://logo.clearbit.com/zendesk.com','https://zendesk.com',true,27),('DocuSign','https://logo.clearbit.com/docusign.com','https://docusign.com',true,28),('Adobe','https://logo.clearbit.com/adobe.com','https://adobe.com',true,29),('Canva','https://logo.clearbit.com/canva.com','https://canva.com',true,30),('Typeform','https://logo.clearbit.com/typeform.com','https://typeform.com',false,31),('Airtable','https://logo.clearbit.com/airtable.com','https://airtable.com',true,32),('Monday.com','https://logo.clearbit.com/monday.com','https://monday.com',true,33),('Asana','https://logo.clearbit.com/asana.com','https://asana.com',false,34),('Linear','https://logo.clearbit.com/linear.app','https://linear.app',true,35),('Loom','https://logo.clearbit.com/loom.com','https://loom.com',true,36),('Calendly','https://logo.clearbit.com/calendly.com','https://calendly.com',true,37),('Webflow','https://logo.clearbit.com/webflow.com','https://webflow.com',false,38),('Squarespace','https://logo.clearbit.com/squarespace.com','https://squarespace.com',true,39),('Wix','https://logo.clearbit.com/wix.com','https://wix.com',false,40),('Klaviyo','https://logo.clearbit.com/klaviyo.com','https://klaviyo.com',true,41),('Brex','https://logo.clearbit.com/brex.com','https://brex.com',true,42),('Rippling','https://logo.clearbit.com/rippling.com','https://rippling.com',false,43),('Gusto','https://logo.clearbit.com/gusto.com','https://gusto.com',true,44),('QuickBooks','https://logo.clearbit.com/quickbooks.intuit.com','https://quickbooks.intuit.com',false,45),('Plaid','https://logo.clearbit.com/plaid.com','https://plaid.com',true,46),('Segment','https://logo.clearbit.com/segment.com','https://segment.com',false,47),('Mixpanel','https://logo.clearbit.com/mixpanel.com','https://mixpanel.com',true,48),('Amplitude','https://logo.clearbit.com/amplitude.com','https://amplitude.com',false,49),('Datadog','https://logo.clearbit.com/datadoghq.com','https://datadoghq.com',true,50);
    end $$;
  ` },
];

export async function POST(_request: NextRequest) {
  await requireAdmin();

  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({
      ok: false,
      needsToken: true,
      message: 'SUPABASE_ACCESS_TOKEN not set in Vercel environment variables.',
      instructions: [
        '1. Go to https://supabase.com/dashboard/account/tokens',
        '2. Click "Generate new token" and name it "CharitMe Deploy"',
        '3. Copy the token',
        '4. Go to Vercel → your project → Settings → Environment Variables',
        '5. Add: SUPABASE_ACCESS_TOKEN = (your token)',
        '6. Click Save and wait for Vercel to redeploy (~2 min)',
        '7. Come back here and click Apply Schema again',
      ],
    }, { status: 400 });
  }

  const results: { name: string; ok: boolean; error?: string }[] = [];

  for (const chunk of SCHEMA_CHUNKS) {
    const result = await execSQL(chunk.sql);
    results.push({ name: chunk.name, ...result });
    if (!result.ok) {
      // "already exists" warnings are fine — not real failures
      const isWarning = result.error?.includes('already exists') ||
                        result.error?.includes('duplicate') ||
                        result.error?.includes('42P07') ||
                        result.error?.includes('42710');
      if (!isWarning) {
        return NextResponse.json({
          ok: false,
          message: `Failed at: ${chunk.name} — ${result.error}`,
          results,
        }, { status: 500 });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    message: `✅ Schema applied! ${SCHEMA_CHUNKS.length} chunks executed successfully.`,
    results,
  });
}
