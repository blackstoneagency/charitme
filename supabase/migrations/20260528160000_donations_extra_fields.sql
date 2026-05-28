-- Add extra admin columns to donations table
ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS payment_method  text,
  ADD COLUMN IF NOT EXISTS source          text,
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS is_spam         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS receipt_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_at     timestamptz,
  ADD COLUMN IF NOT EXISTS refund_reason   text,
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz;

-- Index for spam filtering
CREATE INDEX IF NOT EXISTS idx_donations_is_spam ON donations(is_spam) WHERE is_spam = true;
