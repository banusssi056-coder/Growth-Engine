-- ========================================
-- CLEANUP: Remove Debug Policy
-- ========================================
-- Run this AFTER you finish debugging to secure your database again.

DROP POLICY IF EXISTS "DEBUG_ALLOW_ANON_COMPANIES" ON companies;

-- Verify policies are back to normal (should be 4 policies)
SELECT * FROM pg_policies WHERE tablename = 'companies';
