-- Add assignment_weight to users for Weighted Round-Robin (FR-C.1)
ALTER TABLE users ADD COLUMN IF NOT EXISTS assignment_weight INTEGER DEFAULT 1;

-- Seed some weights if desired (e.g. Senior Tier gets 2x leads)
-- UPDATE users SET assignment_weight = 2 WHERE role = 'manager';
