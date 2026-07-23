-- Make the marketing engine's service-role-only contract explicit in RLS.
-- Public writes and reads use authenticated API routes with supabaseAdmin;
-- direct client access is limited to administrators.

do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'marketing_contacts','marketing_identities','marketing_events','marketing_segments',
    'marketing_segment_members','marketing_campaigns','marketing_campaign_recipients',
    'marketing_automations','marketing_automation_runs','marketing_email_templates',
    'marketing_utm_links','marketing_referrals','marketing_forms','marketing_form_submissions',
    'marketing_consent','marketing_suppression_list','marketing_audit_logs'
  ]
  loop
    policy_name := table_name || '_admin_all';
    execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    execute format(
      'create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin())',
      policy_name,
      table_name
    );
  end loop;
end $$;
