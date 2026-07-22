-- Keep payout preferences separate from the organizer's public website URL.
-- Existing legacy JSON remains readable through the builder's compatibility path.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payment_methods jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.payment_methods IS
  'Organizer payout preference metadata; secrets and bank credentials must never be stored here.';
