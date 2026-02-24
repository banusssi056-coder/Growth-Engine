-- ============================================================
-- Workflow Logic Implementation (FR 6.1 & 6.2)
-- ============================================================

-- 1. Initialize lead_score to 10 for new/active deals (FR 6.1.5)
-- We only apply this to deals where lead_score is still 0 (default)
UPDATE deals 
SET lead_score = 10 
WHERE lead_score = 0 
  AND stage NOT IN ('Closed', 'Lost', 'Paid');

-- 2. Add escalation Tracking (FR 6.2.2)
ALTER TABLE deals 
    ADD COLUMN IF NOT EXISTS escalation_sent_at TIMESTAMP WITH TIME ZONE;

-- 3. Ensure contacts table has unique name/email for deduplication (FR 6.1.2)
-- Already has UNIQUE on email. No changes needed.

-- ============================================================
-- Done.
-- ============================================================
