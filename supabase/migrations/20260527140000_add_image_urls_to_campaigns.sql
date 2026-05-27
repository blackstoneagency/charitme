-- Add image_urls array to campaigns table
-- Stores all uploaded campaign image CDN URLs (cover is still in cover_image_url for compat)
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}';
