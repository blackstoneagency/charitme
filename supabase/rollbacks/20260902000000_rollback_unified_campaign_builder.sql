drop function if exists public.create_campaign_from_builder(uuid, text, jsonb);
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
where id = 'campaign-media';
drop trigger if exists campaign_wizard_drafts_capture_version on public.campaign_wizard_drafts;
drop function if exists public.capture_campaign_wizard_draft_version();

-- The app rollback is compatible with additive columns and tables. Preserve all
-- organizer drafts, source metadata, and private Storage objects so rollback is
-- operationally reversible and never destroys user-authored campaign work.
