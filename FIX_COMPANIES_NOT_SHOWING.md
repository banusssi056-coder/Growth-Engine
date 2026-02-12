# Fix: Companies Not Showing in User Management

## Problem
Companies are being added to the database but are not visible in the user management interface or contacts page.

## Root Cause
**Missing or incorrectly applied Row Level Security (RLS) policies** in Supabase. By default, Supabase blocks all data access unless explicit RLS policies are defined.

---

## Solution: Apply RLS Policies

### Step 1: Access Supabase SQL Editor

1. Go to your Supabase Dashboard: **https://ghkviwcymbldnitaqbav.supabase.co**
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query** to create a new SQL query

### Step 2: Run the Fix Script

1. Open the file: `fix_rls_policies.sql` (in your project root)
2. Copy the entire contents of the file
3. Paste it into the Supabase SQL Editor
4. Click **Run** or press `Ctrl + Enter`

The script will:
- ✅ Drop any existing conflicting policies
- ✅ Enable Row Level Security on all tables
- ✅ Create proper policies for companies, contacts, users, deals, activities, and audit logs
- ✅ Run verification queries to confirm everything works

### Step 3: Verify the Fix

After running the script, you should see output showing:

1. **RLS Status** - All tables should show `rowsecurity = true`
2. **Policy List** - Each table should have 4-5 policies
3. **Data Counts** - Should show counts of your data (e.g., "company_count: 5")

Example expected output:
```
company_count: 5
contact_count: 12
user_count: 3
deal_count: 8
```

### Step 4: Test in Your Application

1. Log out of your application
2. Log back in (to refresh the authentication session)
3. Navigate to **Contacts** page
4. Navigate to **Settings > User Management**

You should now see:
- ✅ All companies in the Contacts page
- ✅ All users in User Management
- ✅ All contacts associated with companies

---

## What the RLS Policies Do

The policies grant authenticated users full access to:

| Table | Permissions |
|-------|------------|
| **companies** | SELECT, INSERT, UPDATE, DELETE |
| **contacts** | SELECT, INSERT, UPDATE, DELETE |
| **users** | SELECT, INSERT, UPDATE, DELETE |
| **deals** | SELECT, INSERT, UPDATE, DELETE |
| **activities** | SELECT, INSERT, UPDATE, DELETE |
| **audit_logs** | SELECT, INSERT (read-only) |

**Key Point**: Only authenticated users (logged in via Supabase Auth) can access the data. Anonymous users will see nothing.

---

## Troubleshooting

### Issue: Still seeing "No companies found"

**Possible causes:**
1. **Not logged in** - Refresh the page and ensure you're authenticated
2. **JWT expired** - Log out and log back in
3. **Wrong Supabase project** - Verify your `.env.local` has the correct `NEXT_PUBLIC_SUPABASE_URL`

**Fix:**
```bash
# Check your .env.local file
NEXT_PUBLIC_SUPABASE_URL=https://ghkviwcymbldnitaqbav.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

### Issue: "permission denied for table companies"

**Cause:** RLS policies didn't apply correctly

**Fix:**
1. Run the `fix_rls_policies.sql` script again
2. Make sure you're running it against the correct Supabase project
3. Check that all commands executed successfully (no errors in SQL Editor)

### Issue: Browser shows CORS errors

**Cause:** Frontend not properly configured to use Supabase

**Fix:** Verify that `client/src/app/contacts/page.tsx` is using Supabase directly (lines 19-22):
```typescript
const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('created_at', { ascending: false });
```

---

## Additional SQL Commands (Manual Verification)

If you want to manually verify the data exists:

### Check if tables have data
```sql
-- View all companies
SELECT * FROM companies;

-- View all contacts
SELECT * FROM contacts;

-- View all users
SELECT * FROM users;
```

### Check RLS status
```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('companies', 'contacts', 'users');
```

### List all policies
```sql
-- See all active policies
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Test policy permissions
```sql
-- This should work if policies are correct
SET ROLE authenticated;
SELECT * FROM companies LIMIT 5;
```

---

## Next Steps After Fix

Once RLS policies are working:

1. ✅ **Test company creation** - Add a new company via the UI
2. ✅ **Test contact creation** - Add contacts to companies
3. ✅ **Test user management** - View users in Settings
4. ✅ **Test deals** - Verify deals page works correctly

---

## Summary

The issue was that Supabase's Row Level Security was enabled but **no policies were defined**, so all queries were being blocked. The `fix_rls_policies.sql` script:

1. Drops any conflicting policies
2. Enables RLS on all tables
3. Creates permissive policies for authenticated users
4. Verifies the setup is correct

After running this script, your frontend will be able to fetch and display companies, contacts, and users correctly.

---

## Need Help?

If you're still experiencing issues:
1. Check the Supabase Dashboard → Logs → Database Logs for errors
2. Open browser DevTools (F12) → Console tab for JavaScript errors  
3. Check Network tab to see if Supabase queries are succeeding
4. Verify you're logged in with `await supabase.auth.getSession()` in the console
