-- =============================================================================
-- CharitMe seed · 05 · Engagement, financial history & trust
--   donor_messages, recurring_donations, refunds, payouts,
--   verification_documents, risk_flags, tax_receipts, business_leads — 120 each.
-- Requires: profiles (00), campaigns + donations (01). Run after 00–01.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- DEMO-SEED GUARD — refuses to run unless this database is explicitly marked as
-- a disposable demo/staging target.
--
-- Why: scripts/seed-guard.mjs already protects the JS seed runners, but THESE
-- files are pasted straight into the Supabase SQL editor, which bypasses it
-- entirely — and that is the path that actually loaded demo data into
-- production. These seeds are also NOT idempotent (see the header note: "Run
-- once. Re-running appends more rows"), so an accidental re-run silently
-- duplicates campaigns and donations.
--
-- To run against a throwaway project, execute this FIRST in the same session:
--     set charitme.allow_demo_seed = 'true';
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if coalesce(current_setting('charitme.allow_demo_seed', true), '') <> 'true' then
    raise exception 'Demo seed blocked: this database is not marked as a disposable demo/staging target.'
      using hint = 'If this really is a throwaway project, run  set charitme.allow_demo_seed = ''true'';  in the SAME session, then re-run this file.';
  end if;
end $$;

do $$
begin
  if current_setting('app.charitme_allow_demo_seed', true) <> 'true' then
    raise exception 'Demo seed blocked. Set app.charitme_allow_demo_seed = true only on a disposable staging/demo project.';
  end if;
end $$;

do $$
declare
  v_users uuid[]; v_camps uuid[]; v_dons uuid[];
  n_users int;    n_camps int;    n_dons int;
  v_suffix text := to_hex(floor(extract(epoch from now()))::bigint);
begin
  select array_agg(id) into v_users from public.profiles;
  n_users := coalesce(array_length(v_users, 1), 0);
  select array_agg(id) into v_camps from public.campaigns;
  n_camps := coalesce(array_length(v_camps, 1), 0);
  select array_agg(id) into v_dons from public.donations;
  n_dons := coalesce(array_length(v_dons, 1), 0);
  if n_users = 0 or n_camps = 0 then
    raise exception 'Need profiles and campaigns first. Run 00 and 01.';
  end if;

  -- donor_messages (campaign comments / donor wall) --------------------------
  insert into public.donor_messages (campaign_id, donor_id, donation_id, message, visibility)
  select v_camps[1 + (g % n_camps)],
         v_users[1 + (g % n_users)],
         case when n_dons > 0 and g % 2 = 0 then v_dons[1 + (g % n_dons)] else null end,
         (array['Sending love and support!','So proud to back this cause.','Praying for you all.',
                'Happy to help — keep going!','This matters. Thank you for doing it.'])[1 + (g % 5)],
         (array['public','public','public','anonymous'])[1 + (g % 4)]
  from generate_series(1, 120) g;

  -- recurring_donations ------------------------------------------------------
  insert into public.recurring_donations
    (donor_id, campaign_id, amount_cents, cadence, status, next_bill_at)
  select v_users[1 + (g % n_users)], v_camps[1 + (g % n_camps)],
         ((g % 20) + 1) * 1000,
         (array['weekly','monthly','monthly','quarterly','annual'])[1 + (g % 5)],
         (array['active','active','active','paused','cancelled'])[1 + (g % 5)],
         now() + (((g % 30) + 1) || ' days')::interval
  from generate_series(1, 120) g;

  -- refunds (needs donations) ------------------------------------------------
  if n_dons > 0 then
    insert into public.refunds (donation_id, amount_cents, reason, status)
    select v_dons[1 + (g % n_dons)],
           ((g % 20) + 1) * 2500,
           (array['Requested by donor','Duplicate charge','Campaign canceled','Payment error'])[1 + (g % 4)],
           (array['requested','under_review','approved','processed','declined'])[1 + (g % 5)]
    from generate_series(1, 120) g;
  else
    raise notice 'skipping refunds (no donations present)';
  end if;

  -- payouts ------------------------------------------------------------------
  insert into public.payouts
    (campaign_id, user_id, amount_cents, payout_speed, fee_cents, status, risk_score)
  select v_camps[1 + (g % n_camps)], v_users[1 + (g % n_users)],
         ((g % 30) + 1) * 5000,
         (array['standard','standard','same_day','instant'])[1 + (g % 4)],
         (g % 10) * 25,
         (array['requested','approved','paid','paid','failed'])[1 + (g % 5)],
         (g % 100)
  from generate_series(1, 120) g;

  -- verification_documents ---------------------------------------------------
  -- Some databases (built from the old schema.sql) also have a legacy NOT NULL
  -- `doc_type` column alongside the migration's `document_type`; populate both
  -- when it's present. (plpgsql only plans the branch it runs, so the doc_type
  -- branch never errors on a DB that lacks the column.)
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'verification_documents'
               and column_name = 'doc_type') then
    insert into public.verification_documents (user_id, campaign_id, document_type, doc_type, storage_path, status)
    select v_users[1 + (g % n_users)], v_camps[1 + (g % n_camps)],
           (array['government_id','proof_of_address','bank_statement','nonprofit_ein'])[1 + (g % 4)],
           (array['id','medical','financial','legal','nonprofit','other'])[1 + (g % 6)],
           'verification/seed-' || v_suffix || '/' || g || '.pdf',
           (array['pending','pending','approved','rejected'])[1 + (g % 4)]
    from generate_series(1, 120) g;
  else
    insert into public.verification_documents (user_id, campaign_id, document_type, storage_path, status)
    select v_users[1 + (g % n_users)], v_camps[1 + (g % n_camps)],
           (array['government_id','proof_of_address','bank_statement','nonprofit_ein'])[1 + (g % 4)],
           'verification/seed-' || v_suffix || '/' || g || '.pdf',
           (array['pending','pending','approved','rejected'])[1 + (g % 4)]
    from generate_series(1, 120) g;
  end if;

  -- risk_flags ---------------------------------------------------------------
  insert into public.risk_flags
    (campaign_id, user_id, code, label, severity, status, flag_type, description)
  select v_camps[1 + (g % n_camps)], v_users[1 + (g % n_users)],
         (array['VELOCITY','DUP_IMAGE','UNSUPPORTED_CLAIM','IP_RISK'])[1 + (g % 4)],
         (array['High donation velocity','Possible duplicate image','Unsupported claim','Risky IP'])[1 + (g % 4)],
         (array['low','medium','high','critical'])[1 + (g % 4)],
         (array['open','reviewing','resolved','dismissed'])[1 + (g % 4)],
         (array['campaign','donation','account','payout'])[1 + (g % 4)],
         'Automated risk flag #' || g || ' for review.'
  from generate_series(1, 120) g;

  -- tax_receipts (unique receipt_number) -------------------------------------
  insert into public.tax_receipts (donation_id, donor_id, receipt_number, amount_cents, emailed_at)
  select case when n_dons > 0 then v_dons[1 + (g % n_dons)] else null end,
         v_users[1 + (g % n_users)],
         'TR-' || v_suffix || '-' || lpad(g::text, 4, '0'),
         ((g % 20) + 1) * 2500,
         case when g % 3 = 0 then now() - ((g % 20) || ' days')::interval else null end
  from generate_series(1, 120) g
  on conflict do nothing;

  -- business_leads (lead-gen service) ----------------------------------------
  insert into public.business_leads
    (business_name, entity_type, state, filing_status, industry, source, status, lead_score, lead_grade)
  select 'Seed Business ' || g || ' ' || (array['LLC','Inc','Foundation','Co'])[1 + (g % 4)],
         (array['LLC','Corporation','Nonprofit','Partnership'])[1 + (g % 4)],
         (array['TX','CO','FL','WA','MA'])[1 + (g % 5)],
         (array['Active','Pending','Active','Good Standing'])[1 + (g % 4)],
         (array['Healthcare','Education','Technology','Retail'])[1 + (g % 4)],
         'sample',
         (array['new','enriched','contacted','qualified','converted'])[1 + (g % 5)],
         (g % 100),
         (array['A','B','C','D'])[1 + (g % 4)]
  from generate_series(1, 120) g;

  raise notice 'CharitMe seed 05: engagement/financial/trust tables seeded.';
end $$;
