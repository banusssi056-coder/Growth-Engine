# Supabase Configuration Guide - Fixing UI Data Display Issues

## Problem
Companies and users are added to the database but not showing in the UI (Contacts page and Settings/User Management).

## Root Causes
1. **Missing Row-Level Security (RLS) Policies** - Supabase blocks all queries by default
2. **Backend API dependency** - The UI is trying to fetch from backend API instead of Supabase directly
3. **Authentication issues** - Supabase needs proper auth configuration

---

## Solution 1: Setup Row-Level Security (RLS) Policies in Supabase

### Step 1: Access Supabase SQL Editor
1. Go to your Supabase Dashboard: https://ghkviwcymbldnitaqbav.supabase.co
2. Navigate to **SQL Editor** in the left sidebar
3. Create a new query

### Step 2: Add RLS Policies for Companies Table

```sql
-- Enable RLS on companies table
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to SELECT companies
CREATE POLICY "Allow authenticated users to view companies"
ON companies
FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow authenticated users to INSERT companies
CREATE POLICY "Allow authenticated users to create companies"
ON companies
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Allow authenticated users to UPDATE companies
CREATE POLICY "Allow authenticated users to update companies"
ON companies
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: Allow authenticated users to DELETE companies
CREATE POLICY "Allow authenticated users to delete companies"
ON companies
FOR DELETE
TO authenticated
USING (true);
```

### Step 3: Add RLS Policies for Users Table

```sql
-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to SELECT all users
CREATE POLICY "Allow authenticated users to view all users"
ON users
FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow authenticated users to UPDATE users
CREATE POLICY "Allow authenticated users to update users"
ON users
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: Allow authenticated users to INSERT users
CREATE POLICY "Allow authenticated users to insert users"
ON users
FOR INSERT
TO authenticated
WITH CHECK (true);
```

### Step 4: Add RLS Policies for Deals, Contacts, Activities Tables

```sql
-- DEALS TABLE
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view deals"
ON deals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to create deals"
ON deals FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update deals"
ON deals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete deals"
ON deals FOR DELETE TO authenticated USING (true);

-- CONTACTS TABLE
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view contacts"
ON contacts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to create contacts"
ON contacts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update contacts"
ON contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete contacts"
ON contacts FOR DELETE TO authenticated USING (true);

-- ACTIVITIES TABLE
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view activities"
ON activities FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to create activities"
ON activities FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update activities"
ON activities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete activities"
ON activities FOR DELETE TO authenticated USING (true);

-- AUDIT LOGS TABLE (Read-only for most users)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view audit logs"
ON audit_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to create audit logs"
ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);
```

---

## Solution 2: Update Frontend to Use Supabase Directly (Recommended)

Since you're already using Supabase for company creation, update the contacts and settings pages to fetch directly from Supabase.

### Update Contacts Page (e:\SSSI Growth Engine\client\src\app\contacts\page.tsx)

Replace the `fetchCompanies` function (lines 17-33) with:

```typescript
const fetchCompanies = async () => {
    try {
        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (data) {
            setCompanies(data);
        }
    } catch (err) {
        console.error("Error loading companies", err);
        alert(`Failed to load companies: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
        setLoading(false);
    }
};
```

### Update Settings Page (e:\SSSI Growth Engine\client\src\app\settings\page.tsx)

Replace the `fetchUsers` function (lines 28-45) with:

```typescript
const fetchUsers = async () => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (data) {
            setUsers(data);
        }
    } catch (err) {
        console.error("Error loading users", err);
        alert(`Failed to load users: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
        setLoading(false);
    }
};
```

---

## Solution 3: Verify Supabase Configuration

### Check Your .env.local File
Ensure these are set correctly:
```
NEXT_PUBLIC_SUPABASE_URL=https://ghkviwcymbldnitaqbav.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

### Verify Supabase Client Setup
Check `client/src/lib/supabase.ts` (or wherever it's defined):

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

---

## Quick Testing Steps

### 1. Test RLS Policies
After adding RLS policies, test in Supabase SQL Editor:

```sql
-- This should return your companies
SELECT * FROM companies;

-- This should return your users
SELECT * FROM users;
```

### 2. Test Frontend Connection
1. Open browser console (F12)
2. Navigate to `/contacts` page
3. Check for any error messages
4. Look for successful Supabase queries in Network tab

### 3. Verify Authentication
Make sure you're logged in:
- Check that `supabase.auth.getSession()` returns a valid session
- User should be authenticated via Supabase Auth

---

## Implementation Priority

**Do this in order:**
1. ✅ **Add RLS Policies** (SQL scripts above) - MOST IMPORTANT
2. ✅ **Update Contacts page** to use Supabase directly
3. ✅ **Update Settings page** to use Supabase directly
4. ✅ **Test and verify** data appears in UI

---

## Common Issues & Fixes

### Issue: "Failed to load companies: permission denied"
**Fix:** RLS policies not set up - Run the RLS SQL scripts above

### Issue: "Failed to load companies: JWT expired"
**Fix:** User session expired - Log out and log back in

### Issue: "No companies/users found" (but data exists)
**Fix:** 
- Check RLS policies are enabled and correct
- Verify user is authenticated
- Check browser console for errors

### Issue: Backend API still being called
**Fix:** Update the frontend code to use Supabase directly (Solution 2)

---

## Need More Help?

If you're still having issues after following these steps:
1. Check Supabase Logs (Dashboard → Logs → Database Logs)
2. Check browser console for JavaScript errors
3. Verify your Supabase project is active
4. Make sure you're logged in with a valid Supabase user
