-- Restore the suggested donor support default to 15%.
--
-- Mirror of 20260904040000_default_support_percent_ten.sql, and conditional for
-- the same reason: it only reverts the value if it is still exactly the 10 that
-- migration wrote, so an owner who has since chosen a different rate from
-- /admin/super/settings keeps it.
--
-- ⚠️ Rolling the database back does NOT roll back the application. The code
-- fallback (`SUGGESTED_SUPPORT_PERCENT`) is 10, so a fresh environment, or one
-- whose settings row is missing, still starts at 10 after this runs. Revert the
-- constant too if the intent is to undo the change everywhere.

update public.platform_settings
set
  config = jsonb_set(
    config,
    '{payment,donationCheckout,defaultSupportPercent}',
    to_jsonb(15),
    true
  ),
  updated_at = now()
where id = 1
  and config #> '{payment,donationCheckout,defaultSupportPercent}' = to_jsonb(10);
