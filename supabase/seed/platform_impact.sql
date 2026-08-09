-- ─────────────────────────────────────────────────────────────────────────────
-- The /impact reference design's figures, EXACTLY as drawn — and deliberately
-- NOT published.
--
-- Running this file changes nothing a visitor sees. Every row lands with
-- `published = false`, so /impact keeps rendering the figures it can measure.
-- The page becomes pixel-identical to the design at the moment an admin flips
-- `published` to true, and not before.
--
-- ⚠️ WHY IT IS GATED. These numbers are not derivable from this schema — nothing
-- records "people helped" or "lives transformed", and there is no expense ledger
-- behind the spend breakdown. Publishing them asserts, to donors deciding where
-- to send money, that they are true. That assertion belongs to whoever runs the
-- organisation, so each row carries a `source_note` demanding the evidence before
-- it goes live.
--
-- The donut is the more serious half: "Programs & Services 82% / Fundraising 10%
-- / Operations 6% / Other 2%" is a financial disclosure about how donated money
-- is spent. Publish it only against real accounts.
--
-- TO PUBLISH, once each figure has a source you can stand behind:
--
--   update public.platform_impact_stats
--      set published = true, source_note = '<where this number comes from>'
--    where sort_order = 0;   -- repeat per row, or drop the where to publish all
--
--   update public.platform_fund_allocation
--      set published = true, source_note = 'FY2026 audited accounts, p.12';
--
-- Idempotent: `on conflict (sort_order)` updates the text and leaves `published`
-- alone, so re-running never silently unpublishes a figure you already approved.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.platform_impact_stats (value, label, icon, sort_order, source_note, published)
values
  ('2.3M+', 'People Helped',     0, 0, 'UNVERIFIED — from the reference design. Replace with the source before publishing.', false),
  ('68K+',  'Lives Transformed', 1, 1, 'UNVERIFIED — from the reference design. Replace with the source before publishing.', false),
  ('1,250+','Programs Funded',   2, 2, 'UNVERIFIED — from the reference design. Compare against a live count of funded campaigns.', false),
  ('120+',  'Countries Reached', 3, 3, 'UNVERIFIED — from the reference design. `supported_countries` holds a real list; count that instead.', false),
  ('98%',   'Funds to Programs', 4, 4, 'UNVERIFIED — from the reference design. NOTE: the platform fee is 0%, so the measured figure is higher than 98%.', false)
on conflict (sort_order) do update
  set value = excluded.value,
      label = excluded.label,
      icon  = excluded.icon,
      source_note = excluded.source_note;

insert into public.platform_fund_allocation (label, percent, color_index, sort_order, source_note, published)
values
  ('Programs & Services', 82, 0, 0, 'UNVERIFIED FINANCIAL DISCLOSURE — from the reference design. Publish only against audited accounts.', false),
  ('Fundraising',         10, 1, 1, 'UNVERIFIED FINANCIAL DISCLOSURE — from the reference design. Publish only against audited accounts.', false),
  ('Operations',           6, 2, 2, 'UNVERIFIED FINANCIAL DISCLOSURE — from the reference design. Publish only against audited accounts.', false),
  ('Other',                2, 3, 3, 'UNVERIFIED FINANCIAL DISCLOSURE — from the reference design. Publish only against audited accounts.', false)
on conflict (sort_order) do update
  set label = excluded.label,
      percent = excluded.percent,
      color_index = excluded.color_index,
      source_note = excluded.source_note;
