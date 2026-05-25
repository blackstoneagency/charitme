-- GiveRise storage buckets and policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('campaign-media', 'campaign-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  ('verification-documents', 'verification-documents', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "campaign media public read"
on storage.objects for select
using (bucket_id = 'campaign-media');

create policy "campaign media owner upload"
on storage.objects for insert
with check (
  bucket_id = 'campaign-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "campaign media owner update"
on storage.objects for update
using (
  bucket_id = 'campaign-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "campaign media owner delete"
on storage.objects for delete
using (
  bucket_id = 'campaign-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "verification documents owner admin read"
on storage.objects for select
using (
  bucket_id = 'verification-documents'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or public.is_admin()
  )
);

create policy "verification documents owner upload"
on storage.objects for insert
with check (
  bucket_id = 'verification-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "receipts owner admin read"
on storage.objects for select
using (
  bucket_id = 'receipts'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or public.is_admin()
    or exists (
      select 1
      from public.campaigns
      where campaigns.user_id = auth.uid()
      and campaigns.id::text = (storage.foldername(storage.objects.name))[2]
    )
  )
);

create policy "receipts owner upload"
on storage.objects for insert
with check (
  bucket_id = 'receipts'
  and auth.uid()::text = (storage.foldername(name))[1]
);
