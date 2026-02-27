-- ============================================================
-- FR-C.2 & FR-C.3 Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── 1. Add last_activity_date column to deals (FR-C.2) ──────
ALTER TABLE deals
    ADD COLUMN IF NOT EXISTS last_activity_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS cold_pool BOOLEAN DEFAULT FALSE;

-- Backfill: use updated_at as the initial last_activity_date
UPDATE deals SET last_activity_date = updated_at WHERE last_activity_date IS NULL;

-- ── 2. Notifications table (In-App Notifications, FR-C.2) ───
CREATE TABLE IF NOT EXISTS notifications (
    notif_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID REFERENCES users(user_id) ON DELETE CASCADE,
    type         VARCHAR(50)  NOT NULL DEFAULT 'INFO',  -- STALE_ALERT | COLD_POOL | WORKFLOW | INFO
    title        TEXT         NOT NULL,
    body         TEXT,
    deal_id      UUID REFERENCES deals(deal_id) ON DELETE SET NULL,
    is_read      BOOLEAN      DEFAULT FALSE,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- ── 3. Workflow rules table (FR-C.3) ────────────────────────
CREATE TABLE IF NOT EXISTS workflow_rules (
    rule_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name         VARCHAR(255) NOT NULL,
    is_active    BOOLEAN DEFAULT TRUE,
    -- Trigger condition
    trigger_field  VARCHAR(100) NOT NULL,   -- e.g. "deal_value", "stage", "probability"
    trigger_op     VARCHAR(20)  NOT NULL,   -- "gt", "lt", "eq", "gte", "lte", "contains"
    trigger_value  TEXT         NOT NULL,   -- the threshold / value to compare against
    -- Action
    action_type    VARCHAR(100) NOT NULL,   -- "cc_manager", "send_notification", "change_stage", "assign_to"
    action_value   TEXT,                    -- action payload (e.g. manager email, stage name, user id)
    created_by     UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed one example rule: IF Deal_Value > 50000 THEN CC_Manager = TRUE
INSERT INTO workflow_rules (name, trigger_field, trigger_op, trigger_value, action_type, action_value, is_active)
VALUES (
    'High-Value Deal: CC Manager',
    'deal_value',
    'gt',
    '50000',
    'cc_manager',
    'true',
    TRUE
) ON CONFLICT DO NOTHING;

-- ── 4. Trigger: update last_activity_date when activity inserted ─
CREATE OR REPLACE FUNCTION update_deal_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE deals
    SET last_activity_date = NEW.occurred_at,
        updated_at         = NOW()
    WHERE deal_id = NEW.deal_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_last_activity ON activities;
CREATE TRIGGER trg_update_last_activity
    AFTER INSERT ON activities
    FOR EACH ROW
    EXECUTE FUNCTION update_deal_last_activity();

-- ── 5. activities table: allow STAGE_CHANGE type ─────────────
-- Update the CHECK constraint to also include STAGE_CHANGE & ALERT
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE activities ADD CONSTRAINT activities_type_check
    CHECK (type IN ('CALL','EMAIL','NOTE','MEETING','SYSTEM','STAGE_CHANGE','ALERT','EMAIL_SENT','EMAIL_OPENED','LINK_CLICKED'));
