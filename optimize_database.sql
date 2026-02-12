-- ========================================
-- DATABASE OPTIMIZATION: Fix Missing Indexes
-- ========================================
-- Run this in Supabase SQL Editor to fix "Unindexed foreign keys" warnings
-- This improves performance for joins and lookups

-- 1. Fix unindexed foreign key on activities.cont_id
CREATE INDEX IF NOT EXISTS idx_activities_cont_id ON activities(cont_id);

-- 2. Fix unindexed foreign key on activities.deal_id
CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON activities(deal_id);

-- 3. Fix unindexed foreign key on contacts.comp_id
CREATE INDEX IF NOT EXISTS idx_contacts_comp_id ON contacts(comp_id);

-- 4. Fix unindexed foreign key on deals.comp_id
CREATE INDEX IF NOT EXISTS idx_deals_comp_id ON deals(comp_id);

-- 5. Fix unindexed foreign key on deals.owner_id
CREATE INDEX IF NOT EXISTS idx_deals_owner_id ON deals(owner_id);

-- ========================================
-- VERIFICATION
-- ========================================
SELECT 
    schemaname || '.' || tablename as table_name,
    indexname as index_created,
    indexdef as definition
FROM pg_indexes 
WHERE indexname IN (
    'idx_activities_cont_id', 
    'idx_activities_deal_id', 
    'idx_contacts_comp_id', 
    'idx_deals_comp_id', 
    'idx_deals_owner_id'
);
