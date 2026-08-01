-- Make `donation_forms` usable by the Donation Form Builder.
--
-- The table has shipped since 20260525002000 and has never had a reader or a
-- writer — it appears in the codebase exactly once, as a table NAME in
-- lib/feature-catalog.ts. Wiring the builder to it surfaced two gaps.
--
-- ── 1. `slug` was not unique ────────────────────────────────────────────────
-- The slug is how an embedded form is addressed. Two forms sharing one meant the
-- embed resolved to whichever row came back first — silently, and differently
-- between requests. Nothing enforced it: the only index on the table was on
-- `nonprofit_id`.
--
-- Plain (not partial) so `ON CONFLICT (slug)` can be inferred, per
-- 20260812000000 — a partial index cannot be, and that is what made four other
-- upserts fail 42P10 in production.
--
-- No dedupe pass is needed: the table has no writer, so it is empty of anything
-- but rows created by hand.

create unique index if not exists donation_forms_slug_uidx
  on public.donation_forms (slug);

-- ── 2. The write policy could not see campaign owners ───────────────────────
-- `donation_forms_owner_write` granted writes only to the owner of the linked
-- `nonprofit_profiles` row (or an admin). But the table also carries
-- `campaign_id`, and a campaign-scoped donation form is the ordinary case — the
-- builder is reached from a campaign. Under the old policy an organizer who runs
-- a campaign but has no nonprofit profile could not touch their own form.
--
-- This matters beyond RLS: the API routes use the service-role client, which
-- BYPASSES RLS, so the check that actually runs is the one in TypeScript. If the
-- policy and the route disagree about who owns a form, the database stops being
-- a backstop and the only real rule is the one in application code. Both are
-- widened together here, deliberately, so they keep agreeing.
--
-- Mirrors `campaigns.user_id`, the same ownership column the campaign routes use.

drop policy if exists donation_forms_owner_write on public.donation_forms;

create policy donation_forms_owner_write on public.donation_forms
  using (
    public.is_admin()
    or exists (
      select 1 from public.nonprofit_profiles np
      where np.id = donation_forms.nonprofit_id and np.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.campaigns c
      where c.id = donation_forms.campaign_id and c.user_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.nonprofit_profiles np
      where np.id = donation_forms.nonprofit_id and np.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.campaigns c
      where c.id = donation_forms.campaign_id and c.user_id = auth.uid()
    )
  );
