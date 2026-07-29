alter table public.donor_messages
  add column if not exists anonymous boolean not null default false;

update public.donor_messages
set anonymous = true,
    visibility = 'anonymous'
where anonymous
   or visibility = 'anonymous';

create or replace function public.sync_donor_message_anonymity()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    if new.anonymous or new.visibility = 'anonymous' then
      new.anonymous := true;
      new.visibility := 'anonymous';
    else
      new.anonymous := false;
      new.visibility := 'public';
    end if;
  elsif new.anonymous is distinct from old.anonymous then
    new.visibility := case when new.anonymous then 'anonymous' else 'public' end;
  elsif new.visibility is distinct from old.visibility then
    new.anonymous := new.visibility = 'anonymous';
  end if;

  return new;
end;
$$;

drop trigger if exists donor_messages_sync_anonymity on public.donor_messages;
create trigger donor_messages_sync_anonymity
before insert or update of anonymous, visibility on public.donor_messages
for each row execute function public.sync_donor_message_anonymity();

revoke all on function public.sync_donor_message_anonymity() from public;
