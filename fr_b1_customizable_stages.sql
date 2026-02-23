-- ══════════════════════════════════════════════════════════════════════════════
-- FR-B.1: Customizable Kanban Stages + Activity Log Enhancement
-- Run this once in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Stages configuration table ─────────────────────────────────────────────
-- Allows admins to add, rename, reorder and (soft-)delete pipeline stages.
CREATE TABLE IF NOT EXISTS stages (
    stage_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    color       VARCHAR(20)  DEFAULT '#94a3b8', -- Tailwind slate-400 hex
    position    INTEGER      NOT NULL DEFAULT 0,
    probability INTEGER      NOT NULL DEFAULT 10 CHECK (probability BETWEEN 0 AND 100),
    is_active   BOOLEAN      DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index – board reads stages ordered by position
CREATE INDEX IF NOT EXISTS idx_stages_position ON stages(position) WHERE is_active = TRUE;

-- ── 2. Seed default stages (matches the current hardcoded frontend list) ──────
INSERT INTO stages (name, color, position, probability) VALUES
    ('1- New Lead',                   '#3b82f6', 1,  10),
    ('2- Discussing, RFQing',         '#f59e0b', 2,  20),
    ('3- Presenting, Quoting',        '#f59e0b', 3,  40),
    ('4- Negotiating, Closing',       '#f59e0b', 4,  60),
    ('5- WIP',                        '#f59e0b', 5,  80),
    ('6- Invoice, Payment pending',   '#f59e0b', 6,  90),
    ('7- Hold',                       '#94a3b8', 7,  10),
    ('8- Paid',                       '#10b981', 8, 100),
    ('9- Lost',                       '#ef4444', 9,   0)
ON CONFLICT (name) DO NOTHING;

-- ── 3. Enhance activities table with actor info ─────────────────────────────
-- Add actor_id so we know WHO made the change (not just the string in content)
ALTER TABLE activities ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS actor_email VARCHAR(255);

-- ── 4. Update the 'type' check to include 'STAGE_CHANGE' ─────────────────────
-- Drop the old constraint first, then re-add with the new type
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE activities
    ADD CONSTRAINT activities_type_check
    CHECK (type IN ('CALL', 'EMAIL', 'NOTE', 'MEETING', 'SYSTEM', 'STAGE_CHANGE'));

-- ── 5. GET /api/activities/:deal_id needs deal_id index ──────────────────────
CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON activities(deal_id, occurred_at DESC);

-- Done!
-- Next steps:
-- 1. Deploy server changes (adds /api/stages CRUD endpoints)
-- 2. The Board will now fetch stages from DB instead of using hardcoded array
