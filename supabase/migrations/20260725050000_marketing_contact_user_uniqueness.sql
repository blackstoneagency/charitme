-- One authenticated user must resolve to one marketing contact.
-- The live duplicate audit was clean before adding this constraint.
create unique index if not exists marketing_contacts_user_id_uq
  on public.marketing_contacts (user_id)
  where user_id is not null;
