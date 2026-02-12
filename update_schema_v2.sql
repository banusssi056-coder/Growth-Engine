-- ========================================
-- SCHEMA UPDATE V2: Sync with Tracker 2026
-- ========================================

-- 1. Add new columns for Tracker 2026 requirements
ALTER TABLE deals
ADD COLUMN IF NOT EXISTS priority NUMERIC(5, 2), -- LH Prio (e.g., 0.09)
ADD COLUMN IF NOT EXISTS frequency VARCHAR(50),  -- e.g., 'OneTime', 'Royalty'
ADD COLUMN IF NOT EXISTS remark TEXT;            -- e.g., 'Given Technical Presentation...'

-- 2. Migrate old stages to new stage names (Best Effort Mapping)
-- This ensures existing deals don't disappear from the board
UPDATE deals SET stage = '1- New Lead' WHERE stage = 'Lead';
UPDATE deals SET stage = '2- Discussing, RFQing' WHERE stage = 'Meeting';
UPDATE deals SET stage = '3- Presenting, Quoting' WHERE stage = 'Proposal';
UPDATE deals SET stage = '8- Paid' WHERE stage = 'Closed';

-- 3. Default any other unknown stages to '1- New Lead'
UPDATE deals SET stage = '1- New Lead' WHERE stage NOT IN (
    '1- New Lead',
    '2- Discussing, RFQing',
    '3- Presenting, Quoting',
    '4- Negotiating, Closing',
    '5- WIP',
    '6- Invoice, Payment pending',
    '7- Hold',
    '8- Paid',
    '9- Lost'
);
