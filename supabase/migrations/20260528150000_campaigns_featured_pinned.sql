-- Add featured and pinned flags to campaigns for admin controls
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned   boolean NOT NULL DEFAULT false;
