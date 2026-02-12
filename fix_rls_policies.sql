-- ========================================
-- FIX: Companies and Contacts Not Showing in User Management
-- ========================================
-- This script drops and recreates all RLS policies to fix visibility issues
-- Run this entire script in Supabase SQL Editor

-- ========================================
-- STEP 1: DROP EXISTING POLICIES (if any)
-- ========================================
-- This ensures we start fresh without conflicts

-- Drop existing companies policies
DROP POLICY IF EXISTS "Allow authenticated users to view companies" ON companies;
DROP POLICY IF EXISTS "Allow authenticated users to create companies" ON companies;
DROP POLICY IF EXISTS "Allow authenticated users to update companies" ON companies;
DROP POLICY IF EXISTS "Allow authenticated users to delete companies" ON companies;

-- Drop existing contacts policies
DROP POLICY IF EXISTS "Allow authenticated users to view contacts" ON contacts;
DROP POLICY IF EXISTS "Allow authenticated users to create contacts" ON contacts;
DROP POLICY IF EXISTS "Allow authenticated users to update contacts" ON contacts;
DROP POLICY IF EXISTS "Allow authenticated users to delete contacts" ON contacts;

-- Drop existing users policies
DROP POLICY IF EXISTS "Allow authenticated users to view all users" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to update users" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to insert users" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to delete users" ON users;

-- Drop existing deals policies
DROP POLICY IF EXISTS "Allow authenticated users to view deals" ON deals;
DROP POLICY IF EXISTS "Allow authenticated users to create deals" ON deals;
DROP POLICY IF EXISTS "Allow authenticated users to update deals" ON deals;
DROP POLICY IF EXISTS "Allow authenticated users to delete deals" ON deals;

-- Drop existing activities policies
DROP POLICY IF EXISTS "Allow authenticated users to view activities" ON activities;
DROP POLICY IF EXISTS "Allow authenticated users to create activities" ON activities;
DROP POLICY IF EXISTS "Allow authenticated users to update activities" ON activities;
DROP POLICY IF EXISTS "Allow authenticated users to delete activities" ON activities;

-- Drop existing audit_logs policies
DROP POLICY IF EXISTS "Allow authenticated users to view audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Allow authenticated users to create audit logs" ON audit_logs;

-- ========================================
-- STEP 2: ENABLE RLS ON ALL TABLES
-- ========================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 3: CREATE COMPANIES POLICIES
-- ========================================

-- Allow authenticated users to SELECT companies
CREATE POLICY "Allow authenticated users to view companies"
ON companies
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to INSERT companies
CREATE POLICY "Allow authenticated users to create companies"
ON companies
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to UPDATE companies
CREATE POLICY "Allow authenticated users to update companies"
ON companies
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to DELETE companies
CREATE POLICY "Allow authenticated users to delete companies"
ON companies
FOR DELETE
TO authenticated
USING (true);

-- ========================================
-- STEP 4: CREATE CONTACTS POLICIES
-- ========================================

-- Allow authenticated users to SELECT contacts
CREATE POLICY "Allow authenticated users to view contacts"
ON contacts
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to INSERT contacts
CREATE POLICY "Allow authenticated users to create contacts"
ON contacts
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to UPDATE contacts
CREATE POLICY "Allow authenticated users to update contacts"
ON contacts
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to DELETE contacts
CREATE POLICY "Allow authenticated users to delete contacts"
ON contacts
FOR DELETE
TO authenticated
USING (true);

-- ========================================
-- STEP 5: CREATE USERS POLICIES
-- ========================================

-- Allow authenticated users to SELECT all users
CREATE POLICY "Allow authenticated users to view all users"
ON users
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to INSERT users
CREATE POLICY "Allow authenticated users to insert users"
ON users
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to UPDATE users
CREATE POLICY "Allow authenticated users to update users"
ON users
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to DELETE users
CREATE POLICY "Allow authenticated users to delete users"
ON users
FOR DELETE
TO authenticated
USING (true);

-- ========================================
-- STEP 6: CREATE DEALS POLICIES
-- ========================================

-- Allow authenticated users to SELECT deals
CREATE POLICY "Allow authenticated users to view deals"
ON deals
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to INSERT deals
CREATE POLICY "Allow authenticated users to create deals"
ON deals
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to UPDATE deals
CREATE POLICY "Allow authenticated users to update deals"
ON deals
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to DELETE deals
CREATE POLICY "Allow authenticated users to delete deals"
ON deals
FOR DELETE
TO authenticated
USING (true);

-- ========================================
-- STEP 7: CREATE ACTIVITIES POLICIES
-- ========================================

-- Allow authenticated users to SELECT activities
CREATE POLICY "Allow authenticated users to view activities"
ON activities
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to INSERT activities
CREATE POLICY "Allow authenticated users to create activities"
ON activities
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to UPDATE activities
CREATE POLICY "Allow authenticated users to update activities"
ON activities
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to DELETE activities
CREATE POLICY "Allow authenticated users to delete activities"
ON activities
FOR DELETE
TO authenticated
USING (true);

-- ========================================
-- STEP 8: CREATE AUDIT LOGS POLICIES
-- ========================================

-- Allow authenticated users to SELECT audit logs
CREATE POLICY "Allow authenticated users to view audit logs"
ON audit_logs
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to INSERT audit logs
CREATE POLICY "Allow authenticated users to create audit logs"
ON audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Audit logs are typically append-only, so no UPDATE/DELETE policies

-- ========================================
-- STEP 9: VERIFICATION QUERIES
-- ========================================
-- Run these queries to verify the policies are working

-- Check if RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('companies', 'contacts', 'users', 'deals', 'activities', 'audit_logs');

-- List all policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Test data retrieval (should work for authenticated users)
SELECT COUNT(*) as company_count FROM companies;
SELECT COUNT(*) as contact_count FROM contacts;
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as deal_count FROM deals;

-- ========================================
-- EXPECTED RESULTS
-- ========================================
-- After running this script:
-- 1. All tables should have rowsecurity = true
-- 2. Each table should have 4-5 policies (SELECT, INSERT, UPDATE, DELETE)
-- 3. The count queries should return numbers (not errors)
-- 4. Your frontend should now be able to fetch companies and contacts

-- ========================================
-- TROUBLESHOOTING
-- ========================================
-- If you still can't see data in the frontend:
-- 1. Make sure you're logged in (check Supabase auth session)
-- 2. Check browser console for errors
-- 3. Verify NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are correct
-- 4. Clear browser cache and refresh the page
