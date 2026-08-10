-- Move the suggested donor support default from 15% to 10%.
--
-- ── Why a migration is needed at all ─────────────────────────────────────────
-- `SUGGESTED_SUPPORT_PERCENT` in packages/shared/fees.ts is only the FALLBACK.
-- lib/donation-checkout-settings.ts reads `platform_settings.config` first and
-- the stored value wins, so every environment that already ran
-- 20260902010000_donation_checkout_settings.sql has `defaultSupportPercent: 15`
-- persisted. Changing the constant alone would move the default in a fresh
-- database and leave production exactly as it was — the code and the live site
-- disagreeing, which is the failure mode this repo keeps rediscovering.
--
-- ── Why it is conditional ────────────────────────────────────────────────────
-- The value is editable from /admin/super/settings. An unconditional write
-- would silently discard a deliberate choice an owner made there. This only
-- rewrites the value if it is still exactly the 15 seeded by the earlier
-- migration, so it migrates the untouched default and leaves any human
-- decision alone. Re-running it is therefore also a no-op.
--
-- Nothing is deleted and no row is removed; this updates one JSON scalar.

update public.platform_settings
set
  config = jsonb_set(
    config,
    '{payment,donationCheckout,defaultSupportPercent}',
    to_jsonb(10),
    true
  ),
  updated_at = now()
where id = 1
  and config #> '{payment,donationCheckout,defaultSupportPercent}' = to_jsonb(15);
