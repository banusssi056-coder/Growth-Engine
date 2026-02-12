-- ========================================
-- SCHEMA UPDATE: Add Level and Offering to Deals
-- ========================================
-- Adds 'level' and 'offering' columns to the deals table to support
-- new requirements for detailed deal tracking.

ALTER TABLE deals
ADD COLUMN IF NOT EXISTS level VARCHAR(50),      -- e.g., Standard, Premium, Enterprise
ADD COLUMN IF NOT EXISTS offering VARCHAR(100);  -- e.g., Consulting, License, Implementation

-- Update RLS policies to allow access to these new columns (implicit in SELECT *)
-- No action needed for policies if they use defined permissions, but good to verify.

-- Add an index for potentially filtering by these new fields later
CREATE INDEX IF NOT EXISTS idx_deals_level ON deals(level);
CREATE INDEX IF NOT EXISTS idx_deals_offering ON deals(offering);

-- Optional: Update existing deals with default values to avoid nulls
UPDATE deals SET level = 'Standard', offering = 'General' WHERE level IS NULL;
