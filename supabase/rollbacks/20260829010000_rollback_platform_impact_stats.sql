begin;

drop trigger if exists platform_fund_allocation_touch on public.platform_fund_allocation;
drop trigger if exists platform_impact_stats_touch on public.platform_impact_stats;
drop function if exists public.touch_platform_editorial_updated_at();
drop table if exists public.platform_fund_allocation;
drop table if exists public.platform_impact_stats;

commit;
