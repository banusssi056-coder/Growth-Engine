-- ========================================
-- ROW LEVEL SECURITY (RLS) POLICIES SETUP
-- ========================================
-- Run this script in Supabase SQL Editor to enable data access from the UI
-- This will allow authenticated users to view, create, update, and delete data

-- ========================================
-- COMPANIES TABLE
-- ========================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

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
-- USERS TABLE
-- ========================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to SELECT all users
CREATE POLICY "Allow authenticated users to view all users"
ON users
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to UPDATE users
CREATE POLICY "Allow authenticated users to update users"
ON users
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to INSERT users
CREATE POLICY "Allow authenticated users to insert users"
ON users
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ========================================
-- DEALS TABLE
-- ========================================
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view deals"
ON deals 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to create deals"
ON deals 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update deals"
ON deals 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete deals"
ON deals 
FOR DELETE 
TO authenticated 
USING (true);

-- ========================================
-- CONTACTS TABLE
-- ========================================
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view contacts"
ON contacts 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to create contacts"
ON contacts 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update contacts"
ON contacts 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete contacts"
ON contacts 
FOR DELETE 
TO authenticated 
USING (true);

-- ========================================
-- ACTIVITIES TABLE
-- ========================================
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view activities"
ON activities 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to create activities"
ON activities 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update activities"
ON activities 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete activities"
ON activities 
FOR DELETE 
TO authenticated 
USING (true);

-- ========================================
-- AUDIT LOGS TABLE
-- ========================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view audit logs"
ON audit_logs 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to create audit logs"
ON audit_logs 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Audit logs are typically append-only, so no UPDATE/DELETE policies

-- ========================================
-- VERIFICATION QUERY
-- ========================================
-- After running the above, test with these queries:
-- SELECT * FROM companies;
-- SELECT * FROM users;
-- SELECT * FROM deals;
-- 
-- If you see data, RLS is configured correctly!
