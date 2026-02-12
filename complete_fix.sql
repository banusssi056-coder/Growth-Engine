-- ========================================
-- COMPLETE FIX: Users Not Showing + Auto Profile Creation
-- ========================================
-- This script fixes the "No users found" issue by:
-- 1. Applying RLS policies
-- 2. Creating user profiles for existing auth users
-- 3. Setting up auto-profile creation trigger
-- ========================================

-- STEP 1: Enable RLS and Apply Policies
-- ========================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated users to view all users" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to insert users" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to update users" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to delete users" ON users;

DROP POLICY IF EXISTS "Allow authenticated users to view companies" ON companies;
DROP POLICY IF EXISTS "Allow authenticated users to create companies" ON companies;
DROP POLICY IF EXISTS "Allow authenticated users to update companies" ON companies;
DROP POLICY IF EXISTS "Allow authenticated users to delete companies" ON companies;

DROP POLICY IF EXISTS "Allow authenticated users to view contacts" ON contacts;
DROP POLICY IF EXISTS "Allow authenticated users to create contacts" ON contacts;
DROP POLICY IF EXISTS "Allow authenticated users to update contacts" ON contacts;
DROP POLICY IF EXISTS "Allow authenticated users to delete contacts" ON contacts;

DROP POLICY IF EXISTS "Allow authenticated users to view deals" ON deals;
DROP POLICY IF EXISTS "Allow authenticated users to create deals" ON deals;
DROP POLICY IF EXISTS "Allow authenticated users to update deals" ON deals;
DROP POLICY IF EXISTS "Allow authenticated users to delete deals" ON deals;

DROP POLICY IF EXISTS "Allow authenticated users to view activities" ON activities;
DROP POLICY IF EXISTS "Allow authenticated users to create activities" ON activities;
DROP POLICY IF EXISTS "Allow authenticated users to update activities" ON activities;
DROP POLICY IF EXISTS "Allow authenticated users to delete activities" ON activities;

DROP POLICY IF EXISTS "Allow authenticated users to view audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Allow authenticated users to create audit logs" ON audit_logs;

-- Create USERS policies
CREATE POLICY "Allow authenticated users to view all users" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert users" ON users FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update users" ON users FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete users" ON users FOR DELETE TO authenticated USING (true);

-- Create COMPANIES policies
CREATE POLICY "Allow authenticated users to view companies" ON companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to create companies" ON companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update companies" ON companies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete companies" ON companies FOR DELETE TO authenticated USING (true);

-- Create CONTACTS policies
CREATE POLICY "Allow authenticated users to view contacts" ON contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to create contacts" ON contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update contacts" ON contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete contacts" ON contacts FOR DELETE TO authenticated USING (true);

-- Create DEALS policies
CREATE POLICY "Allow authenticated users to view deals" ON deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to create deals" ON deals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update deals" ON deals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete deals" ON deals FOR DELETE TO authenticated USING (true);

-- Create ACTIVITIES policies  
CREATE POLICY "Allow authenticated users to view activities" ON activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to create activities" ON activities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update activities" ON activities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete activities" ON activities FOR DELETE TO authenticated USING (true);

-- Create AUDIT LOGS policies
CREATE POLICY "Allow authenticated users to view audit logs" ON audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to create audit logs" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ========================================
-- STEP 2: Create User Profiles for Existing Auth Users
-- ========================================
-- This syncs auth.users with public.users

INSERT INTO public.users (user_id, email, full_name, role, is_active)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email),
    COALESCE(au.raw_user_meta_data->>'role', 'rep'),
    true
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.user_id
WHERE pu.user_id IS NULL  -- Only insert if not already exists
ON CONFLICT (user_id) DO UPDATE
SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, users.full_name),
    updated_at = CURRENT_TIMESTAMP;

-- ========================================
-- STEP 3: Create or Replace Auto-Profile Creation Trigger
-- ========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (user_id, email, full_name, role, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'rep'),
        true
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, users.full_name),
        updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- STEP 4: Grant necessary permissions
-- ========================================

-- Grant trigger function permission to insert into users table
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- ========================================
-- STEP 5: Verification
-- ========================================

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'companies', 'contacts', 'deals')
ORDER BY tablename;

-- Count policies per table
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Check users were created
SELECT user_id, email, role, is_active, created_at 
FROM public.users 
ORDER BY created_at DESC;

-- Check auth <-> public users sync
SELECT 
    au.id as auth_user_id,
    au.email as auth_email,
    pu.user_id as public_user_id,
    pu.email as public_email,
    pu.role,
    pu.is_active
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.user_id
ORDER BY au.created_at DESC;

-- Success message
SELECT 
    '✅ RLS Policies Applied' as step_1,
    '✅ User Profiles Created' as step_2,
    '✅ Auto-Profile Trigger Set' as step_3,
    '✅ Ready to use!' as status;
