-- ─────────────────────────────────────────────────────────────────────────────
-- Seed data for the Super-Admin Console tables (aeo_entries, seo_settings,
-- marketing_campaigns, announcements). Applied to the live DB 2026-07-20.
-- Idempotent-ish: seo_settings uses ON CONFLICT (route). Re-running the others
-- appends more rows — clear first if you need an exact count.
-- 105 records per table (announcements: only the first 2 are active).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── AEO entries (answer-engine Q&A) ──────────────────────────────────────────

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

insert into aeo_entries (question, answer, topic, schema_type, priority, published)
select
  (array['How do I start a fundraiser on CharitMe?','Are my donations tax-deductible?','What fees does CharitMe charge?','How fast are payouts?','Can I fundraise for someone else?','How do recurring donations work?','Is my donation secure?','How do I withdraw funds?','Can nonprofits use CharitMe?','How does AI help my campaign?','What payment methods are accepted?','Can I get a refund?','How do matching gifts work?','How do I verify my identity?','Can I run a fundraising event?'])[1+(n%15)] || ' (topic ' || n || ')',
  (array['Click Start a CharitMe, describe your cause, set a goal, and our AI drafts your story in seconds.','Tax-deductibility depends on the recipient organization; verified nonprofits can issue receipts.','CharitMe keeps a small platform fee plus standard payment processing; the exact amount is shown before you give.','Payouts arrive quickly to your connected bank once your account is verified.','Yes — you can fundraise on behalf of a beneficiary and route funds directly to them.','Set an amount and cadence at checkout; you can pause or cancel any time from your dashboard.','Every payment is processed securely through Stripe with bank-grade encryption.','Connect a payout account, verify it, and funds transfer automatically as donations arrive.','Absolutely — nonprofits get verification badges, receipts, and grant tools.','Our AI writes copy, recommends goals, finds donors, and drafts updates while you stay in control.'])[1+(n%10)],
  (array['Getting started','Payments','Fees','Payouts','Nonprofits','Trust & Safety','Recurring','Events'])[1+(n%8)],
  'FAQPage', (110 - n), (n % 7 <> 0)
from generate_series(1,105) n;

-- ── SEO settings — real app routes ───────────────────────────────────────────
insert into seo_settings (route, title, meta_description, keywords, noindex)
select r, initcap(trim(replace(replace(r,'/',' '),'-',' '))) || ' | CharitMe',
  'CharitMe — intelligent, AI-powered fundraising. Learn more on the ' || r || ' page.',
  'fundraising, donate, charity, nonprofit, crowdfunding', false
from unnest(array['/','/pricing','/how-it-works','/about-us','/blog','/contact','/success-stories','/ai-fundraising','/features','/grants','/events','/volunteer','/sponsor','/matching','/impact/manage','/leaderboard','/help','/faq','/privacy','/terms','/security','/trust-safety','/supported-countries','/for-nonprofits','/for-individuals','/for-donors','/fast-payouts','/prohibited-use','/privacy-center','/achievements']) r
on conflict (route) do nothing;
-- SEO settings — generated blog routes (pad to 100+)
insert into seo_settings (route, title, meta_description, keywords, noindex)
select '/blog/'||slug, initcap(replace(slug,'-',' '))||' | CharitMe Blog',
  'Fundraising insights and stories from CharitMe: '||replace(slug,'-',' ')||'.',
  'fundraising tips, charity, nonprofit', false
from (select 'guide-'||n as slug from generate_series(1,75) n) s
on conflict (route) do nothing;

-- ── Marketing campaigns ──────────────────────────────────────────────────────
insert into marketing_campaigns (name, campaign_type, status, subject, preview_text, sent_count, open_count, click_count, conversion_count, revenue_cents)
select
  (array['Year-End Giving','Spring Appeal','Donor Reactivation','Welcome Series','Matching Gift Push','Volunteer Drive','Impact Report','Monthly Newsletter'])[1+(n%8)] || ' #' || n,
  (array['email','sms','automation','push'])[1+(n%4)],
  (array['draft','scheduled','sent','sent','sent'])[1+(n%5)],
  'Your gift changes lives today', 'See the impact you make',
  (n*37)%6000, (n*13)%3000, (n*3)%900, (n%40), ((n*1250)%600000)::bigint
from generate_series(1,105) n;

-- ── Announcements (only the first 2 are active) ──────────────────────────────
insert into announcements (title, body, level, active, starts_at, ends_at)
select
  (array['Scheduled maintenance window','New: AI Growth Plan is live','Holiday payout schedule','Security best-practices update','Community milestone reached','Feature spotlight'])[1+(n%6)] || ' #' || n,
  'This is a platform announcement used to exercise the announcements surface end to end.',
  (array['info','success','warning','critical'])[1+(n%4)],
  (n <= 2),
  now() - ((n) || ' days')::interval,
  case when n%3=0 then now() + ((n) || ' days')::interval else null end
from generate_series(1,105) n;
