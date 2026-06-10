-- ─────────────────────────────────────────────────────────────────────────────
-- Enable embeddable donation widget for all users
-- Date: 2026-06-10
-- The /campaigns/[slug]/embed iframe page has been stable in production;
-- graduate the feature flag from 25% rollout to fully enabled.
-- ─────────────────────────────────────────────────────────────────────────────

update public.feature_flags
set enabled = true, rollout_pct = 100
where key = 'embedded_forms';

insert into public.feature_flags (key, enabled, description, rollout_pct) values
  ('embedded_forms', true, 'Embeddable donation widget', 100)
on conflict (key) do nothing;
