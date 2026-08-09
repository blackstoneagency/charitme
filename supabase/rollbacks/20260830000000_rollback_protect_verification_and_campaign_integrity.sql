drop trigger if exists protect_campaign_integrity_fields on public.campaigns;
drop function if exists public.protect_campaign_integrity_fields();

drop trigger if exists protect_verification_document_fields on public.verification_documents;
drop function if exists public.protect_verification_document_fields();

drop trigger if exists protect_nonprofit_verification_fields on public.nonprofit_profiles;
drop function if exists public.protect_nonprofit_verification_fields();
