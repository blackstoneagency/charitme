-- Direct team membership writes remain service-role only. Restoring the former
-- self-enrollment policy would reopen a privilege-escalation vulnerability.

drop policy if exists team_members_read_own on public.team_members;
create policy team_members_visible_to_team
on public.team_members
for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

-- Super-admin inheritance is also preserved because narrowing is_admin() would
-- leave a valid super admin unable to satisfy admin RLS policies.
