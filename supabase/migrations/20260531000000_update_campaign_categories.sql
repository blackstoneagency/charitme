-- Migrate campaign categories to the new 18-category taxonomy and add a CHECK constraint.
-- Old values that no longer exist are remapped to the closest equivalent.

-- 1. Remap old category values
update public.campaigns set category = 'Memorial'  where category = 'Memorial/Funeral';
update public.campaigns set category = 'Animal'    where category = 'Animal/Pet';
update public.campaigns set category = 'Sports'    where category = 'Sports/Teams';
-- 'Disaster Relief' folds into 'Emergency' (closest match)
update public.campaigns set category = 'Emergency' where category = 'Disaster Relief';
-- 'Other' has no direct equivalent; map to 'Community' as the broadest catch-all
update public.campaigns set category = 'Community' where category = 'Other';

-- 2. Add CHECK constraint enforcing the new allowed values
alter table public.campaigns
  add constraint campaigns_category_check
  check (category in (
    'Medical','Memorial','Emergency','Nonprofit','Education','Animal',
    'Environment','Business','Community','Competition','Creative','Event',
    'Faith','Family','Sports','Travel','Volunteer','Wishes'
  ));
