-- ========================================
-- QUICK FIX: Enable Data Visibility
-- ========================================
-- Copy and paste this entire script into Supabase SQL Editor and run it

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- COMPANIES - Full Access
DROP POLICY IF EXISTS "Allow authenticated users to view companies" ON companies;
DROP POLICY IF EXISTS "Allow authenticated users to create companies" ON companies;
DROP POLICY IF EXISTS "Allow authenticated users to update companies" ON companies;
DROP POLICY IF EXISTS "Allow authenticated users to delete companies" ON companies;

CREATE POLICY "Allow authenticated users to view companies" ON companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to create companies" ON companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update companies" ON companies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete companies" ON companies FOR DELETE TO authenticated USING (true);

-- CONTACTS - Full Access
DROP POLICY IF EXISTS "Allow authenticated users to view contacts" ON contacts;
DROP POLICY IF EXISTS "Allow authenticated users to create contacts" ON contacts;
DROP POLICY IF EXISTS "Allow authenticated users to update contacts" ON contacts;
DROP POLICY IF EXISTS "Allow authenticated users to delete contacts" ON contacts;

CREATE POLICY "Allow authenticated users to view contacts" ON contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to create contacts" ON contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update contacts" ON contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete contacts" ON contacts FOR DELETE TO authenticated USING (true);

-- USERS - Full Access
DROP POLICY IF EXISTS "Allow authenticated users to view all users" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to insert users" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to update users" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to delete users" ON users;

CREATE POLICY "Allow authenticated users to view all users" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert users" ON users FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update users" ON users FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete users" ON users FOR DELETE TO authenticated USING (true);

-- DEALS - Full Access
DROP POLICY IF EXISTS "Allow authenticated users to view deals" ON deals;
DROP POLICY IF EXISTS "Allow authenticated users to create deals" ON deals;
DROP POLICY IF EXISTS "Allow authenticated users to update deals" ON deals;
DROP POLICY IF EXISTS "Allow authenticated users to delete deals" ON deals;

CREATE POLICY "Allow authenticated users to view deals" ON deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to create deals" ON deals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update deals" ON deals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete deals" ON deals FOR DELETE TO authenticated USING (true);

-- ACTIVITIES - Full Access
DROP POLICY IF EXISTS "Allow authenticated users to view activities" ON activities;
DROP POLICY IF EXISTS "Allow authenticated users to create activities" ON activities;
DROP POLICY IF EXISTS "Allow authenticated users to update activities" ON activities;
DROP POLICY IF EXISTS "Allow authenticated users to delete activities" ON activities;

CREATE POLICY "Allow authenticated users to view activities" ON activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to create activities" ON activities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update activities" ON activities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete activities" ON activities FOR DELETE TO authenticated USING (true);

-- AUDIT LOGS - Read and Insert Only
DROP POLICY IF EXISTS "Allow authenticated users to view audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Allow authenticated users to create audit logs" ON audit_logs;

CREATE POLICY "Allow authenticated users to view audit logs" ON audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to create audit logs" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Verification
SELECT 'RLS Policies Applied Successfully!' as status;
SELECT COUNT(*) as companies_count FROM companies;
SELECT COUNT(*) as contacts_count FROM contacts;
SELECT COUNT(*) as users_count FROM users;
