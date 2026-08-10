with defaults as (
  select jsonb_build_object(
    'payment', jsonb_build_object(
      'donationCheckout', jsonb_build_object(
        'amountPresetsCents', to_jsonb(array[2500, 5000, 7500, 10000, 15000, 25000]),
        'popularAmountCents', 5000,
        'supportTierPercents', to_jsonb(array[15, 12, 10, 8, 5, 3, 1, 0]),
        'defaultSupportPercent', 15,
        'methodFees', jsonb_build_object(
          'stripe', jsonb_build_object('pct', 2.9, 'fixed', 30),
          'gpay', jsonb_build_object('pct', 2.9, 'fixed', 30),
          'bank', jsonb_build_object('pct', 0.8, 'fixed', 0, 'cap', 500),
          'card', jsonb_build_object('pct', 2.9, 'fixed', 30)
        )
      )
    )
  ) as config
)
insert into public.platform_settings (id, config, updated_at)
select 1, config, now()
from defaults
on conflict (id) do update
set
  config = jsonb_set(
    coalesce(public.platform_settings.config, '{}'::jsonb),
    '{payment}',
    coalesce(public.platform_settings.config -> 'payment', '{}'::jsonb)
      || jsonb_build_object(
        'donationCheckout',
        coalesce(
          public.platform_settings.config #> '{payment,donationCheckout}',
          excluded.config #> '{payment,donationCheckout}'
        )
      ),
    true
  ),
  updated_at = now();
