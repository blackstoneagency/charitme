-- Align Storage policy checks with campaigns/{owner-or-campaign}/{slot}/{file} paths.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'video/mp4'
    ]
where id = 'campaign-media';

drop policy if exists "campaign media owner upload" on storage.objects;
create policy "campaign media owner upload"
on storage.objects for insert
with check (
  bucket_id = 'campaign-media'
  and (
    auth.uid()::text = (storage.foldername(name))[2]
    or exists (
      select 1
      from public.campaigns
      where campaigns.id::text = (storage.foldername(name))[2]
        and campaigns.user_id = auth.uid()
    )
  )
);

drop policy if exists "campaign media owner update" on storage.objects;
create policy "campaign media owner update"
on storage.objects for update
using (
  bucket_id = 'campaign-media'
  and (
    auth.uid()::text = (storage.foldername(name))[2]
    or exists (
      select 1
      from public.campaigns
      where campaigns.id::text = (storage.foldername(name))[2]
        and campaigns.user_id = auth.uid()
    )
  )
)
with check (
  bucket_id = 'campaign-media'
  and (
    auth.uid()::text = (storage.foldername(name))[2]
    or exists (
      select 1
      from public.campaigns
      where campaigns.id::text = (storage.foldername(name))[2]
        and campaigns.user_id = auth.uid()
    )
  )
);

drop policy if exists "campaign media owner delete" on storage.objects;
create policy "campaign media owner delete"
on storage.objects for delete
using (
  bucket_id = 'campaign-media'
  and (
    auth.uid()::text = (storage.foldername(name))[2]
    or exists (
      select 1
      from public.campaigns
      where campaigns.id::text = (storage.foldername(name))[2]
        and campaigns.user_id = auth.uid()
    )
  )
);
