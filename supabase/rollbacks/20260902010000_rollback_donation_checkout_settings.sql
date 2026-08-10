update public.platform_settings
set
  config = config #- '{payment,donationCheckout}',
  updated_at = now()
where id = 1
  and config #> '{payment,donationCheckout}' is not null;
