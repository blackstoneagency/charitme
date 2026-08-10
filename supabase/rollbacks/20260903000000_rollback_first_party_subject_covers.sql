update public.campaigns
set cover_image_url = null
where cover_image_url like 'https://www.charitme.com/media/subject?category=%&key=migration-20260903-%';

update public.campaign_media
set public_url = null
where public_url like 'https://www.charitme.com/media/subject?category=%&key=migration-20260903-%-media-%';
