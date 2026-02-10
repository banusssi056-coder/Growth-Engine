# Supabase Authentication Configuration

## URL Configuration in Supabase Dashboard

### Authentication → URL Configuration

#### Site URL
```
https://elaborate-sunburst-7b58f9.netlify.app
```

**Purpose**: Default redirect URL when no specific redirect is provided.

#### Redirect URLs (Allowed)
```
http://localhost:3000/auth/callback
http://localhost:3001/auth/callback
http://localhost:3002/auth/callback
https://elaborate-sunburst-7b58f9.netlify.app/auth/callback
https://elaborate-sunburst-7b58f9.netlify.app/**
```

**Important**: 
- The `/auth/callback` route handles authentication processing and role-based routing
- Wildcard `/**` allows flexibility for any route in production
- All role-based routing is handled in application code, NOT in Supabase

## Role-Based Dashboard Routing

After successful login, users are redirected based on their role:

| Role | Dashboard Route |
|------|----------------|
| **Admin** | `/admin/dashboard` |
| **Manager** | `/manager/dashboard` |
| **Rep** | `/dashboard` |
| **Intern** | `/dashboard` |

## How It Works

1. **Login Flow**:
   - User clicks "Sign in with Google" on `/login`
   - Supabase OAuth redirects to `/auth/callback`
   - Callback page fetches user profile from backend API
   - User role is retrieved and stored in sessionStorage
   - User is redirected to appropriate dashboard

2. **User Profile Availability**:
   - Profile data is cached in sessionStorage for immediate display
   - Sidebar loads profile from cache first, then refreshes from API
   - This ensures user profile is visible immediately after login

3. **Missing Profile Handling**:
   - If API call fails, user is redirected to default `/dashboard`
   - Error is logged to console for debugging
   - Graceful degradation ensures app remains functional

## Google OAuth Configuration

In Google Cloud Console, ensure the Authorized redirect URIs include:

```
https://ghkviwcymbldnitaqbav.supabase.co/auth/v1/callback
```

This is the Supabase auth endpoint that processes Google OAuth.
