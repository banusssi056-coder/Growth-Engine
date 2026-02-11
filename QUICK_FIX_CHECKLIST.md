# ✅ Quick Fix Checklist - Display Companies & Users in UI

## Problem
✗ Companies and users exist in database but don't show in UI  
✗ User Management dashboard is empty  
✗ Contacts page shows "No companies found"

## Solution Summary
The issue is caused by **Row-Level Security (RLS)** in Supabase blocking queries. By default, Supabase blocks all database access until you explicitly allow it via RLS policies.

---

## 🚀 Quick Fix Steps (Do in Order)

### Step 1: Run RLS Policies in Supabase ⭐ MOST IMPORTANT
1. Open Supabase Dashboard: https://ghkviwcymbldnitaqbav.supabase.co
2. Go to **SQL Editor** (left sidebar)
3. Copy the entire contents of `rls_policies.sql` 
4. Paste and click **Run**
5. ✅ You should see "Success. No rows returned"

### Step 2: Verify RLS is Working
In Supabase SQL Editor, run:
```sql
SELECT * FROM companies;
SELECT * FROM users;
```
✅ If you see data → RLS is configured correctly!  
✗ If you see "permission denied" → Re-run the RLS policies

### Step 3: Test the UI
1. **Refresh your browser** (or restart the dev server)
2. Navigate to `/contacts` page
3. ✅ You should now see your companies listed
4. Navigate to `/settings` page  
5. ✅ You should now see all users in the User Management section

---

## 📂 Files Changed

### ✅ Updated Files (Already Done)
- `client/src/app/contacts/page.tsx` - Now fetches directly from Supabase
- `client/src/components/contacts/CreateCompanyModal.tsx` - Uses Supabase insert
- `client/src/app/settings/page.tsx` - Now fetches users from Supabase

### 📄 New Files Created
- `rls_policies.sql` - **RUN THIS IN SUPABASE!**
- `SUPABASE_SETUP_GUIDE.md` - Detailed documentation
- `QUICK_FIX_CHECKLIST.md` - This file

---

## 🔧 What Changed Under the Hood

### Before (❌ Broken)
```typescript
// Was calling backend API (which may not be running)
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/companies`);
```

### After (✅ Fixed)
```typescript
// Now calls Supabase directly
const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('created_at', { ascending: false });
```

---

## 🎯 Expected Results After Fix

### Contacts Page (`/contacts`)
- ✅ Shows all companies from database
- ✅ "Add Company" button works
- ✅ New companies appear immediately after creation

### Settings Page (`/settings`)  
- ✅ Shows all users in User Management table
- ✅ Can change user roles (Admin, Manager, Sales Rep, Intern)
- ✅ Can assign managers to users
- ✅ Can enable/disable users

---

## 🐛 Troubleshooting

### Issue: Still seeing "No companies found"
**Causes:**
- RLS policies not run in Supabase
- Not logged in / session expired
- No companies actually exist in database

**Fix:**
1. Check Supabase SQL Editor: `SELECT * FROM companies;`
2. If empty, add a test company via "Add Company" button
3. Log out and log back in to refresh session
4. Re-run RLS policies

### Issue: "Permission denied for table companies"
**Fix:** RLS policies not set up correctly
1. Go to Supabase → SQL Editor
2. Run `rls_policies.sql` again
3. Verify with: `SELECT * FROM companies;`

### Issue: Getting "Unknown error" when adding company
**Fix:** Check browser console (F12) for specific error
- May be auth issue (log out/in)
- May be column name mismatch (we already fixed this)

---

## 📞 Next Steps if Still Broken

1. **Check Browser Console** (F12):
   - Look for error messages
   - Check Network tab for failed requests

2. **Check Supabase Logs**:
   - Go to Supabase Dashboard → Logs → API Logs
   - Look for 403 (permission denied) or 401 (unauthorized) errors

3. **Verify Environment Variables**:
   ```bash
   # Should be set in .env.local
   NEXT_PUBLIC_SUPABASE_URL=https://ghkviwcymbldnitaqbav.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   ```

4. **Restart Dev Server**:
   ```powershell
   # Stop and restart
   cd client
   npm run dev
   ```

---

## ✨ Success Criteria

You'll know everything is working when:
- ✅ Companies appear in `/contacts` page
- ✅ Users appear in `/settings` page
- ✅ Can add new companies without errors
- ✅ Can modify user roles and managers
- ✅ No "permission denied" errors in console

---

**Most Important:** Run `rls_policies.sql` in Supabase SQL Editor first!
