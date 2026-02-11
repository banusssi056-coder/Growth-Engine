# User Profile Setup Guide

This guide will help you set up the enhanced user profile functionality in your SSSI Growth Engine application.

## 📋 What's New

The user profile system has been enhanced to display:
- **Full Name** - User's complete name
- **Avatar** - Profile picture or generated avatar
- **Email** - User's email address  
- **Role Badge** - Color-coded role indicator (Admin, Manager, Rep, Intern)
- **Phone & Department** - Additional contact information

## 🗄️ Database Setup

### Step 1: Run the Updated Schema in Supabase

1. **Go to Supabase SQL Editor**
   - Navigate to: https://supabase.com/dashboard
   - Select your project: `ghkviwcymbldnitaqbav`
   - Click on "SQL Editor" in the left sidebar

2. **Run the Schema File**
   - Copy the entire contents of `schema.sql` from your project
   - Paste it into the SQL Editor
   - Click **"Run"** to execute

   This will:
   - ✅ Create/update the `users` table with profile fields
   - ✅ Add indexes for better performance
   - ✅ Create a trigger function to auto-sync auth users
   - ✅ Insert sample test users

### Step 2: Set Up the Auth Trigger

After running the schema, create the trigger on `auth.users` table:

```sql
-- This trigger automatically creates a user profile when someone signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();
```

**Why is this needed?**
This trigger ensures that when a user signs up via Supabase Auth, their profile is automatically created in your `public.users` table.

### Step 3: (Optional) Update Existing Users

If you already have users in `auth.users` but not in `public.users`, run this:

```sql
-- Sync existing auth users to public.users table
INSERT INTO public.users (user_id, email, full_name, role)
SELECT 
    id as user_id,
    email,
    COALESCE(raw_user_meta_data->>'full_name', email) as full_name,
    'rep' as role
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
```

## 🎨 Updated Schema Fields

The `users` table now includes:

```sql
CREATE TABLE users (
    user_id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),           -- NEW: User's full name
    avatar_url TEXT,                   -- NEW: Profile picture URL
    phone VARCHAR(50),                 -- NEW: Phone number
    department VARCHAR(100),           -- NEW: Department/Team
    role VARCHAR(50) DEFAULT 'rep',    -- admin, manager, rep, intern
    is_active BOOLEAN DEFAULT TRUE,
    last_assigned_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()  -- NEW: Last update timestamp
);
```

## 🔄 How User Profiles Work

### 1. **User Signs Up** (via Supabase Auth)
   - User creates account at `/login` or signup page
   - Supabase Auth creates entry in `auth.users`
   
### 2. **Trigger Auto-Creates Profile**
   - `on_auth_user_created` trigger fires
   - `handle_new_user()` function creates entry in `public.users`
   - Default role: `rep`
   - Full name extracted from metadata or defaults to email

### 3. **User Logs In**
   - Frontend sends JWT token to backend
   - Backend middleware (`auth.js`) verifies token
   - Fetches full user profile from `public.users`
   - Returns complete profile to frontend

### 4. **Sidebar Displays Profile**
   - Sidebar receives user data including:
     - Full name
     - Email
     - Avatar URL (or generates initials)
     - Role badge with color coding

## 🎯 Testing the Changes

### Test User Accounts

The schema includes these test accounts:

| Email | Password | Role | Full Name |
|-------|----------|------|-----------|
| `admin@sssi.com` | (set in Supabase Auth) | admin | Admin User |
| `manager@sssi.com` | (set in Supabase Auth) | manager | Manager User |
| `rep@sssi.com` | (set in Supabase Auth) | rep | Sales Representative |

### How to Test:

1. **Create Test Users in Supabase Auth**
   - Go to: Authentication → Users → Add User
   - Create users with the emails above
   - Set passwords for each

2. **Login to Your App**
   - Visit: `https://growth-engine-1.netlify.app/login`
   - Login with test credentials
   - Check sidebar for user profile display

3. **Verify Profile Display**
   - ✅ Avatar shows user's initial
   - ✅ Full name is displayed
   - ✅ Email is shown below name
   - ✅ Role badge appears with correct color
   
## 🎨 Role Badge Colors

The sidebar displays role-specific color badges:

- **Admin** - Purple badge (`bg-purple-500/20`)
- **Manager** - Blue badge (`bg-blue-500/20`)
- **Rep** - Green badge (`bg-emerald-500/20`)
- **Intern** - Amber badge (`bg-amber-500/20`)

## 📝 Updating User Profiles

### Via Supabase Dashboard:

1. Go to: Table Editor → `users`
2. Find the user row
3. Click to edit
4. Update fields:
   - `full_name`
   - `avatar_url`
   - `phone`
   - `department`
5. Save changes

### Via API (Future Enhancement):

You can create an endpoint like:

```javascript
app.put('/api/users/profile', authenticate, async (req, res) => {
    const { full_name, avatar_url, phone, department } = req.body;
    
    const result = await pool.query(
        `UPDATE users 
         SET full_name = $1, avatar_url = $2, phone = $3, department = $4, updated_at = NOW()
         WHERE user_id = $5 
         RETURNING *`,
        [full_name, avatar_url, phone, department, req.user.id]
    );
    
    res.json(result.rows[0]);
});
```

## 🐛 Troubleshooting

### User Profile Not Showing?

**Check 1: Is the user in the database?**
```sql
SELECT * FROM public.users WHERE email = 'your@email.com';
```

**Check 2: Is the trigger active?**
```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

**Check 3: Check browser console**
- Open DevTools → Console
- Look for errors from `/api/me` endpoint
- Check Network tab for 401/403/500 errors

### Avatar Not Showing?

- Make sure `avatar_url` field contains a valid URL
- Check if the image URL is accessible
- Verify CORS settings on the image host

### Role Badge Not Showing?

- Verify `role` field in database is one of: `admin`, `manager`, `rep`, `intern`
- Check that role is lowercase
- Ensure the user object has the `role` property

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Run updated `schema.sql` in Supabase
- [ ] Create the `on_auth_user_created` trigger
- [ ] Sync existing auth users to public.users
- [ ] Test login with all role types
- [ ] Verify sidebar displays correctly
- [ ] Check that avatars load properly
- [ ] Test on mobile/tablet views
- [ ] Commit and push changes to GitHub
- [ ] Netlify auto-deploys the updated code

## 📦 Files Modified

The following files were updated:

1. **schema.sql** - Enhanced users table with profile fields
2. **server/middleware/auth.js** - Returns full user profile
3. **client/src/components/layout/Sidebar.tsx** - Enhanced profile UI

## 🔗 Related Documentation

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Triggers Guide](https://supabase.com/docs/guides/database/postgres/triggers)
- [SQL Functions](https://supabase.com/docs/guides/database/functions)

---

## 📞 Support

If you encounter any issues:
1. Check the browser console for errors
2. Verify database schema is up to date
3. Ensure Supabase authentication is configured
4. Check that environment variables are set correctly
