# Deploying to Vercel

## 1. Prerequisites
- Your code is pushed to GitHub.
- You have a Vercel account linked to GitHub.

## 2. Import Project
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New** -> **Project**.
3. Import the `growth-engine` repository.

## 3. Configure Project Settings
**Crucial Step:** Since this is a monorepo (client + server), you must tell Vercel where the frontend lives.

1. **Framework Preset**: Vercel should auto-detect **Next.js**.
2. **Root Directory**:
   - Click **Edit** next to Root Directory.
   - Select the `client` folder.
   - Click **Continue**.

## 4. Environment Variables
Add the following variables in the **Environment Variables** section before deploying:

| Variable Name | Value | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://growth-engine-fzoe.onrender.com` | URL of your backend on Render |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ghkviwcymbldnitaqbav.supabase.co` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(Get from `client/.env.local`)* | Your Supabase Public/Anon Key (starts with `eyJ...`) |

*(Note: Never paste the backend `DATABASE_URL` or `SERVICE_ROLE_KEY` here. They belong on the backend only.)*

## 5. Deploy
1. Click **Deploy**.
2. Wait for the build to complete.
3. Your frontend is now live!
