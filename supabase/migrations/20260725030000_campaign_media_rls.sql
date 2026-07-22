-- Keep normalized campaign media metadata aligned with campaign visibility and ownership.
alter table if exists public.campaign_media enable row level security;

drop policy if exists campaign_media_public_read on public.campaign_media;
create policy campaign_media_public_read
  on public.campaign_media for select
  using (
    is_admin()
    or uploader_id = auth.uid()
    or exists (
      select 1
      from public.campaigns
      where campaigns.id = campaign_media.campaign_id
        and campaigns.status = 'active'
        and campaigns.visibility = 'public'
        and campaigns.deleted_at is null
    )
  );

drop policy if exists campaign_media_owner_insert on public.campaign_media;
create policy campaign_media_owner_insert
  on public.campaign_media for insert
  with check (
    is_admin()
    or (
      auth.uid() = uploader_id
      and exists (
        select 1
        from public.campaigns
        where campaigns.id = campaign_media.campaign_id
          and campaigns.user_id = auth.uid()
      )
    )
  );

drop policy if exists campaign_media_owner_update on public.campaign_media;
create policy campaign_media_owner_update
  on public.campaign_media for update
  using (is_admin() or exists (
    select 1 from public.campaigns
    where campaigns.id = campaign_media.campaign_id
      and campaigns.user_id = auth.uid()
  ))
  with check (is_admin() or exists (
    select 1 from public.campaigns
    where campaigns.id = campaign_media.campaign_id
      and campaigns.user_id = auth.uid()
  ));

drop policy if exists campaign_media_owner_delete on public.campaign_media;
create policy campaign_media_owner_delete
  on public.campaign_media for delete
  using (is_admin() or exists (
    select 1 from public.campaigns
    where campaigns.id = campaign_media.campaign_id
      and campaigns.user_id = auth.uid()
  ));
