-- ========================================
-- DEBUG: Check Database State
-- ========================================
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'companies', 'contacts', 'deals');

-- 2. Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'companies', 'contacts', 'deals');

-- 3. Check if users exist in the database
SELECT user_id, email, role, is_active, created_at 
FROM users 
ORDER BY created_at DESC;

-- 4. Check companies
SELECT comp_id, name, domain, industry, created_at 
FROM companies 
ORDER BY created_at DESC 
LIMIT 10;

-- 5. Check contacts
SELECT cont_id, first_name, last_name, email, created_at 
FROM contacts 
ORDER BY created_at DESC 
LIMIT 10;

-- 6. List all active RLS policies
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 7. Check auth.users (Supabase Auth table)
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC;

-- 8. Check if there's a mismatch between auth.users and public.users
SELECT 
    au.id as auth_user_id,
    au.email as auth_email,
    pu.user_id as public_user_id,
    pu.email as public_email,
    pu.role
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.user_id
ORDER BY au.created_at DESC;

-- ========================================
-- EXPECTED RESULTS
-- ========================================
-- Query 1: Should show users, companies, contacts, deals tables
-- Query 2: Should show rowsecurity = true for all tables
-- Query 3: Should list all users with their roles
-- Query 4-5: Should show companies and contacts if any exist
-- Query 6: Should show 4-5 policies per table
-- Query 7: Should show Supabase auth users
-- Query 8: Should show if auth users are linked to public users table
