-- Add unique constraint to companies table for name column
-- This ensures that no two companies can have the same name (case-sensitive by default with UNIQUE, but we might want to enforce case-insensitive uniqueness if needed, but standard UNIQUE is a good start)

ALTER TABLE companies ADD CONSTRAINT companies_name_key UNIQUE (name);
