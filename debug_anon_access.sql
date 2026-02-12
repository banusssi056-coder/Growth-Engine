-- ========================================
-- DEBUG: Allow Anonymous Access (Temporary)
-- ========================================
-- This script creates a temporary policy to allow ANYONE (even unauthenticated users)
-- to view companies. This will help us confirm if the issue is authentication-related.

-- 1. Create a policy for anon users to view companies
CREATE POLICY "DEBUG_ALLOW_ANON_COMPANIES"
ON companies
FOR SELECT
TO anon
USING (true);

-- 2. Verify policies
SELECT * FROM pg_policies WHERE tablename = 'companies';

-- ========================================
-- INSTRUCTIONS
-- ========================================
-- 1. Run this script in Supabase SQL Editor.
-- 2. Refresh your Contacts page.
-- 3. IF YOU SEE COMPANIES: The issue is your frontend is not sending the auth token correctly.
-- 4. IF YOU STILL SEE NOTHING: The issue is likely the wrong project URL/Key in your frontend.
