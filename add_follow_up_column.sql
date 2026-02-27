-- Add next_follow_up column to deals for scheduled notifications
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS next_follow_up TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS follow_up_notified BOOLEAN DEFAULT FALSE;

-- Index for performance in background jobs
CREATE INDEX IF NOT EXISTS idx_deals_follow_up ON deals(next_follow_up) WHERE follow_up_notified = FALSE;
