-- ============================================================
-- Fix: Missing columns in activities table
-- ============================================================

ALTER TABLE activities 
    ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS actor_email TEXT;

-- ============================================================
-- Done.
-- ============================================================
