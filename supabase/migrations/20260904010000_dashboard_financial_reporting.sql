create or replace function public.organizer_donation_summary(p_user_id uuid)
returns table (
  total_raised_cents bigint,
  donation_count bigint,
  unique_donor_count bigint,
  average_donation_cents bigint,
  one_time_donation_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with owned as (
    select
      d.amount_cents,
      d.donor_id,
      d.anonymous,
      count(*) over (
        partition by case when d.anonymous or d.donor_id is null then d.id else d.donor_id end
      ) as donor_gift_count
    from public.donations d
    join public.campaigns c on c.id = d.campaign_id
    where c.user_id = p_user_id
      and d.status = 'completed'
      and (auth.role() = 'service_role' or auth.uid() = p_user_id)
  )
  select
    coalesce(sum(amount_cents), 0)::bigint,
    count(*)::bigint,
    count(distinct donor_id) filter (where donor_id is not null and not anonymous)::bigint,
    coalesce(round(avg(amount_cents)), 0)::bigint,
    count(*) filter (where donor_gift_count = 1)::bigint
  from owned;
$$;

create or replace function public.organizer_donation_page(
  p_user_id uuid,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 51,
  p_one_time_only boolean default false
)
returns table (
  id uuid,
  amount_cents bigint,
  currency text,
  status text,
  created_at timestamptz,
  anonymous boolean,
  donor_id uuid,
  campaign_id uuid,
  donor_name text,
  campaign_title text
)
language sql
stable
security definer
set search_path = public
as $$
  with owned as (
    select
      d.id,
      d.amount_cents,
      coalesce(d.currency, 'usd') as currency,
      d.status,
      d.created_at,
      d.anonymous,
      d.donor_id,
      d.campaign_id,
      case
        when d.anonymous or d.donor_id is null then 'Anonymous'
        else coalesce(nullif(trim(p.full_name), ''), 'Anonymous')
      end as donor_name,
      c.title as campaign_title,
      count(*) over (
        partition by case when d.anonymous or d.donor_id is null then d.id else d.donor_id end
      ) as donor_gift_count
    from public.donations d
    join public.campaigns c on c.id = d.campaign_id
    left join public.profiles p on p.id = d.donor_id
    where c.user_id = p_user_id
      and d.status = 'completed'
      and (auth.role() = 'service_role' or auth.uid() = p_user_id)
  )
  select
    owned.id,
    owned.amount_cents,
    owned.currency,
    owned.status,
    owned.created_at,
    owned.anonymous,
    owned.donor_id,
    owned.campaign_id,
    owned.donor_name,
    owned.campaign_title
  from owned
  where (not p_one_time_only or owned.donor_gift_count = 1)
    and (
      p_before_created_at is null
      or (owned.created_at, owned.id) < (p_before_created_at, p_before_id)
    )
  order by owned.created_at desc, owned.id desc
  limit greatest(1, least(p_limit, 101));
$$;

create or replace function public.organizer_top_donors(
  p_user_id uuid,
  p_limit integer default 20
)
returns table (
  id uuid,
  amount_cents bigint,
  currency text,
  status text,
  created_at timestamptz,
  anonymous boolean,
  donor_id uuid,
  campaign_id uuid,
  donor_name text,
  campaign_title text
)
language sql
stable
security definer
set search_path = public
as $$
  with owned as (
    select
      d.*,
      c.title as campaign_title,
      case
        when d.anonymous or d.donor_id is null then 'Anonymous'
        else coalesce(nullif(trim(p.full_name), ''), 'Anonymous')
      end as donor_name,
      case when d.anonymous or d.donor_id is null then d.id else d.donor_id end as donor_key
    from public.donations d
    join public.campaigns c on c.id = d.campaign_id
    left join public.profiles p on p.id = d.donor_id
    where c.user_id = p_user_id
      and d.status = 'completed'
      and (auth.role() = 'service_role' or auth.uid() = p_user_id)
  ), totals as (
    select donor_key, sum(amount_cents)::bigint as total_cents
    from owned
    group by donor_key
  ), latest as (
    select distinct on (donor_key) *
    from owned
    order by donor_key, created_at desc, id desc
  )
  select
    latest.id,
    totals.total_cents,
    coalesce(latest.currency, 'usd'),
    latest.status,
    latest.created_at,
    latest.anonymous,
    latest.donor_id,
    latest.campaign_id,
    latest.donor_name,
    latest.campaign_title
  from totals
  join latest using (donor_key)
  order by totals.total_cents desc, totals.donor_key desc
  limit greatest(1, least(p_limit, 100));
$$;

create or replace function public.organizer_payout_summary(p_user_id uuid)
returns table (
  paid_out_cents bigint,
  pending_cents bigint,
  month_cents bigint,
  fee_cents bigint,
  payout_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(p.amount_cents) filter (where p.status = 'paid'), 0)::bigint,
    coalesce(sum(p.amount_cents) filter (where p.status in ('requested', 'approved')), 0)::bigint,
    coalesce(sum(p.amount_cents) filter (where p.created_at >= date_trunc('month', now())), 0)::bigint,
    coalesce(sum(p.fee_cents), 0)::bigint,
    count(*)::bigint
  from public.payouts p
  where p.user_id = p_user_id
    and (auth.role() = 'service_role' or auth.uid() = p_user_id);
$$;

create or replace function public.organizer_payout_page(
  p_user_id uuid,
  p_status_group text default 'all',
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 51
)
returns table (
  id uuid,
  campaign_id uuid,
  amount_cents bigint,
  fee_cents bigint,
  payout_speed text,
  status text,
  created_at timestamptz,
  campaign_title text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.campaign_id,
    p.amount_cents,
    p.fee_cents,
    p.payout_speed,
    p.status,
    p.created_at,
    c.title
  from public.payouts p
  join public.campaigns c on c.id = p.campaign_id
  where p.user_id = p_user_id
    and (auth.role() = 'service_role' or auth.uid() = p_user_id)
    and (
      p_status_group = 'all'
      or (p_status_group = 'paid' and p.status = 'paid')
      or (p_status_group = 'pending' and p.status in ('requested', 'approved'))
      or (p_status_group = 'failed' and p.status in ('failed', 'frozen'))
    )
    and (
      p_before_created_at is null
      or (p.created_at, p.id) < (p_before_created_at, p_before_id)
    )
  order by p.created_at desc, p.id desc
  limit greatest(1, least(p_limit, 101));
$$;

revoke all on function public.organizer_donation_summary(uuid) from public, anon, authenticated;
revoke all on function public.organizer_donation_page(uuid, timestamptz, uuid, integer, boolean) from public, anon, authenticated;
revoke all on function public.organizer_top_donors(uuid, integer) from public, anon, authenticated;
revoke all on function public.organizer_payout_summary(uuid) from public, anon, authenticated;
revoke all on function public.organizer_payout_page(uuid, text, timestamptz, uuid, integer) from public, anon, authenticated;

grant execute on function public.organizer_donation_summary(uuid) to service_role;
grant execute on function public.organizer_donation_page(uuid, timestamptz, uuid, integer, boolean) to service_role;
grant execute on function public.organizer_top_donors(uuid, integer) to service_role;
grant execute on function public.organizer_payout_summary(uuid) to service_role;
grant execute on function public.organizer_payout_page(uuid, text, timestamptz, uuid, integer) to service_role;

grant execute on function public.organizer_donation_summary(uuid) to authenticated;
grant execute on function public.organizer_donation_page(uuid, timestamptz, uuid, integer, boolean) to authenticated;
grant execute on function public.organizer_top_donors(uuid, integer) to authenticated;
grant execute on function public.organizer_payout_summary(uuid) to authenticated;
grant execute on function public.organizer_payout_page(uuid, text, timestamptz, uuid, integer) to authenticated;
