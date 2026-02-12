-- ========================================
-- DIAGNOSTIC: Why Companies Are Not Showing
-- ========================================
-- Run this in Supabase SQL Editor to identify the exact problem

-- ========================================
-- QUESTION 1: Do companies exist in the database?
-- ========================================
SELECT 
    COUNT(*) as total_companies,
    'Companies exist in database' as status
FROM companies;

-- Show actual companies data
SELECT comp_id, name, domain, industry, revenue, created_at 
FROM companies 
ORDER BY created_at DESC 
LIMIT 10;

-- ========================================
-- QUESTION 2: Is RLS enabled on companies table?
-- ========================================
SELECT 
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = true THEN '⚠️ RLS is ON - Policies required!'
        ELSE '✅ RLS is OFF - Data visible to all'
    END as explanation
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'companies';

-- ========================================
-- QUESTION 3: Are there RLS policies on companies?
-- ========================================
SELECT 
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '❌ NO POLICIES - This is why companies dont show!'
        WHEN COUNT(*) < 4 THEN '⚠️ INCOMPLETE POLICIES - Missing some operations'
        ELSE '✅ POLICIES EXIST - Should work'
    END as diagnosis
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'companies';

-- List all companies policies
SELECT 
    policyname as policy_name,
    cmd as operation,
    CASE 
        WHEN cmd = 'SELECT' THEN '👀 View data'
        WHEN cmd = 'INSERT' THEN '➕ Create new'
        WHEN cmd = 'UPDATE' THEN '✏️ Edit existing'
        WHEN cmd = 'DELETE' THEN '🗑️ Delete'
        ELSE cmd
    END as what_it_does
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'companies'
ORDER BY cmd;

-- ========================================
-- QUESTION 4: Can authenticated users access companies?
-- ========================================
-- Check if there's a SELECT policy for authenticated users
SELECT 
    policyname,
    qual as policy_condition,
    CASE 
        WHEN qual = 'true' THEN '✅ All authenticated users can view'
        ELSE '⚠️ Conditional access: ' || qual
    END as access_level
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'companies'
  AND cmd = 'SELECT';

-- ========================================
-- QUESTION 5: Test if current session can access companies
-- ========================================
-- This simulates what the frontend does
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Frontend should see ' || COUNT(*) || ' companies'
        ELSE '❌ Frontend sees ZERO companies (RLS blocking)'
    END as frontend_result
FROM companies;

-- ========================================
-- THE DIAGNOSIS
-- ========================================
-- Based on the results above, here's what's happening:

/*
IF you see:
- ✓ Companies exist (COUNT > 0)
- ✓ RLS is ON (rowsecurity = true)  
- ✗ NO POLICIES or policy_count = 0

THEN THE PROBLEM IS:
📌 RLS is enabled but NO policies exist to allow access
📌 Supabase blocks ALL queries by default when RLS is ON
📌 Your frontend query gets blocked even though data exists

THE SOLUTION:
Run complete_fix.sql to create the missing RLS policies!
*/

-- ========================================
-- QUICK TEST: What should the frontend see?
-- ========================================
-- This query mimics exactly what your Contacts page does
SELECT 
    comp_id,
    name,
    domain,
    industry,
    revenue,
    created_at
FROM companies
ORDER BY created_at DESC;

-- If this returns 0 rows but the first query showed companies exist,
-- then RLS is blocking access. Solution: Run complete_fix.sql!
