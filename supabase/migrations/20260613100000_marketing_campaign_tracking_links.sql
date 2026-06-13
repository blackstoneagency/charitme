-- ─────────────────────────────────────────────────────────────────────────────
-- Per-campaign click-tracking links — 2026-06-13
--
-- Lets the campaign launch flow auto-create a /go/[code] tracking link per
-- marketing_campaigns row, so {{tracking_url}} in a campaign's body/subject
-- resolves to a unique, click-tracked URL that records link_clicked events
-- and marks marketing_campaign_recipients as 'clicked'.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.marketing_utm_links
  add column if not exists campaign_id uuid references public.marketing_campaigns(id) on delete cascade;

create unique index if not exists marketing_utm_links_campaign_id_key
  on public.marketing_utm_links (campaign_id)
  where campaign_id is not null;
