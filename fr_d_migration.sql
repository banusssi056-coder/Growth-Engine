-- =============================================================================
-- FR-D Migration: Communication Intelligence (Phase 2)
-- Run this in Supabase SQL Editor
-- =============================================================================

-- ── FR-D.1: Pixel Tracking Engine ──────────────────────────────────────────
-- Each outbound email gets a unique UUID tracked here.
-- The pixel fires when a recipient opens the email; link clicks are tracked separately.

CREATE TABLE IF NOT EXISTS email_sends (
    send_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id         UUID REFERENCES deals(deal_id) ON DELETE CASCADE,
    cont_id         UUID REFERENCES contacts(cont_id) ON DELETE SET NULL,
    sent_by         UUID REFERENCES users(user_id) ON DELETE SET NULL,
    subject         TEXT NOT NULL,
    body_html       TEXT,           -- rendered HTML (after Liquid substitution)
    body_raw        TEXT,           -- original template before rendering
    to_email        TEXT NOT NULL,
    open_count      INT NOT NULL DEFAULT 0,
    click_count     INT NOT NULL DEFAULT 0,
    first_opened_at TIMESTAMPTZ,
    last_opened_at  TIMESTAMPTZ,
    first_clicked_at TIMESTAMPTZ,
    last_clicked_at TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tracking events log (open & click) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracking_events (
    event_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    send_id     UUID NOT NULL REFERENCES email_sends(send_id) ON DELETE CASCADE,
    event_type  TEXT NOT NULL CHECK (event_type IN ('OPEN', 'CLICK')),
    url         TEXT,               -- populated for CLICK events
    user_agent  TEXT,
    ip_address  INET,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── FR-D.2: Lead Score column on deals ─────────────────────────────────────
ALTER TABLE deals
    ADD COLUMN IF NOT EXISTS lead_score     INT  NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS score_updated_at TIMESTAMPTZ;

-- ── Index for fast pixel lookups ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_email_sends_deal_id ON email_sends(deal_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_send_id ON tracking_events(send_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_occurred ON tracking_events(occurred_at DESC);

-- ── FR-D.1: Update activities type enum to include EMAIL_SENT ──────────────
-- Remove old constraint and re-add with additional allowed values
ALTER TABLE activities
    DROP CONSTRAINT IF EXISTS activities_type_check;

ALTER TABLE activities
    ADD CONSTRAINT activities_type_check
    CHECK (type IN (
        'CALL', 'MEETING', 'EMAIL', 'NOTE', 'SYSTEM',
        'STAGE_CHANGE', 'ALERT', 'EMAIL_SENT', 'EMAIL_OPENED', 'LINK_CLICKED'
    ));

-- =============================================================================
-- Done. Expected result:
--   ✓ email_sends table created
--   ✓ tracking_events table created
--   ✓ deals.lead_score column added
--   ✓ activities type check updated
-- =============================================================================
