update public.campaigns
set cover_image_url =
  'https://www.charitme.com/media/subject?category=' ||
  replace(
    replace(
      replace(coalesce(nullif(trim(category), ''), 'Community'), '%', '%25'),
      '&', '%26'
    ),
    ' ', '%20'
  ) ||
  '&key=migration-20260903-' || coalesce(nullif(trim(slug), ''), id::text)
where
  cover_image_url is null
  or trim(cover_image_url) = ''
  or cover_image_url ilike '%picsum.photos%'
  or cover_image_url ilike '%loremflickr.com%';

update public.campaign_media media
set public_url =
  'https://www.charitme.com/media/subject?category=' ||
  replace(
    replace(
      replace(coalesce(nullif(trim(campaign.category), ''), 'Community'), '%', '%25'),
      '&', '%26'
    ),
    ' ', '%20'
  ) ||
  '&key=migration-20260903-' || coalesce(nullif(trim(campaign.slug), ''), campaign.id::text) || '-media-' || media.id::text
from public.campaigns campaign
where media.campaign_id = campaign.id
  and (
    media.public_url ilike '%picsum.photos%'
    or media.public_url ilike '%loremflickr.com%'
  );
