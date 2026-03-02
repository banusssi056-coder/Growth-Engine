-- Migration to support optional fields in Directory (Companies & Contacts)
-- As per user request: "system should allow any of the field empty input"

-- 1. Companies Table
ALTER TABLE companies ALTER COLUMN name DROP NOT NULL;

-- 2. Contacts Table
ALTER TABLE contacts ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE contacts ALTER COLUMN last_name DROP NOT NULL;
ALTER TABLE contacts ALTER COLUMN email DROP NOT NULL;
