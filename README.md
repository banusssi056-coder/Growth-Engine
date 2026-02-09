# SSSI GrowthEngine - Sales Accelerator & Automation Platform

**SSSI GrowthEngine** is a modern Sales CRM designed to accelerate deal velocity through intelligent automation and real-time visibility. It combines a robust Kanban sales desk with a background "Brain" that automates lead assignment and hygiene.

## 🚀 Key Features

### 1. Sales Desk (Visible)
*   **Kanban Pipeline**: Interactive drag-and-drop Deal board with real-time updates.
*   **Weighted Forecasting**: Real-time revenue projection based on deal probability.
*   **Deal Management**: Create, update, and track deal stages with full audit trail.
*   **Contact Management**: Companies and contacts with smart search.

### 2. The Brain (Automation)
*   **Round-Robin Distributor**: Automatically assigns new leads to active Sales Reps to ensure fair distribution.
*   **Stale Lead Detection**: Background job scans for deals inactive for >30 days and flags them as "Stale".

### 3. Intelligence
*   **Lead Scoring**: Dynamic scoring based on engagement (e.g., Email Opens +5, Silence -20).
*   **Pixel Tracking**: Invisible pixel for tracking email opens.
*   **Liquid Templates**: Dynamic email rendering with personalization.

### 4. Security & Access Control
*   **Google Login**: Secure authentication via Supabase Auth + Google OAuth.
*   **Role-Based Access Control (RBAC)**:
    *   **Admin**: Full access to all deals, settings, and user management. First user is auto-assigned Admin.
    *   **Sales Manager**: Access to team deals and reports.
    *   **Sales Rep**: Access only to their own deals.
    *   **Intern**: Restricted access (Lead view/create only).

---

## 🛠 Technology Stack

*   **Frontend**: Next.js 14, React 18, Tailwind CSS 3.4, TypeScript
*   **Backend**: Node.js 18, Express.js 5
*   **Database**: Supabase (PostgreSQL)
*   **Authentication**: Supabase Auth with Google OAuth
*   **Worker**: `node-cron` for background task scheduling
*   **Deployment**: Netlify (Frontend) + Render/Railway (Backend)
*   **Environment**: Optimized for cross-platform compatibility (Windows/Linux)

---

## ⚙️ Quick Start

### Prerequisites
*   **Node.js**: Version **18.x** is required (check with `node -v`)
*   **NPM**: Version 8.x or higher
*   **Supabase Account**: Create a free account at [supabase.com](https://supabase.com)

### 1. Clone & Install
```bash
git clone https://github.com/banusssi056-coder/Growth-Engine.git
cd "SSSI Growth Engine"

# Install all dependencies (Root, Client, Server)
npm run install-all
```

### 2. Environment Setup

#### **Client (.env.local)**
Create `client/.env.local` with:
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_API_URL=http://localhost:5000
```

**Where to find these values:**
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the long JWT token)

#### **Server (.env)**
Create `server/.env` with:
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_ID.supabase.co:5432/postgres
```

**Where to find DATABASE_URL:**
1. In Supabase Dashboard → **Settings** → **Database**
2. Scroll to **Connection string** → **URI**
3. Copy and replace `[YOUR-PASSWORD]` with your database password

### 3. Database Setup

Run the schema migration to create all required tables:
```bash
cd server
node migrate.js
```

This will create:
- `users` (for RBAC)
- `companies`
- `contacts`
- `deals`
- `activities`
- `audit_logs`

### 4. Configure Google OAuth (Supabase)

1. Go to your Supabase Dashboard → **Authentication** → **Providers**
2. Enable **Google** provider
3. Add your Google OAuth credentials:
   - **Client ID** and **Client Secret** from [Google Cloud Console](https://console.cloud.google.com/)
4. Add authorized redirect URLs:
   - `http://localhost:3000` (for local development)
   - `https://YOUR_SITE.netlify.app` (for production)

### 5. Run the Application

Start both Client and Server concurrently from the root:

```bash
npm run dev
```

This will start:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5000

---

## 🏃 Manual Run (Separate Terminals)

If you prefer running services individually:

**1. Backend API**
```bash
cd server
npm run dev
# Runs on localhost:5000
```

**2. Frontend Client**
```bash
cd client
npm run dev
# Runs on localhost:3000 (or 3001 if 3000 is busy)
```

**3. Automation Brain (Background Jobs)**
```bash
cd server
node worker.js
```

---

## 🚀 Deployment

### Frontend (Netlify)

1. **Push to GitHub**:
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

2. **Deploy on Netlify**:
   - Go to [Netlify](https://app.netlify.com/)
   - Click **Add new site** → **Import an existing project**
   - Connect to your GitHub repo
   - Netlify will auto-detect the build settings from `netlify.toml`
   - Click **Deploy**

3. **Environment Variables** (already configured in `netlify.toml`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` (set this to your deployed backend URL)

### Backend (Render/Railway)

**Option 1: Render.com**
1. Create a new **Web Service**
2. Connect your GitHub repository
3. Settings:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
4. Add environment variables from `server/.env`
5. Deploy

**Option 2: Railway.app**
1. Create a new project
2. Deploy from GitHub
3. Add environment variables
4. Railway will auto-detect and deploy

---

## 🧪 Testing

*   **Login**: Open [http://localhost:3000](http://localhost:3000)
*   **First User = Admin**: The first user to login becomes **Admin** with full access
*   **Role Testing**: 
    - Admin sees "Settings" tab
    - Reps see only their own deals
    - Managers see team deals

---

## 🐛 Troubleshooting

### Build Errors

**Issue**: `supabaseUrl is required` error during build
- **Fix**: Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in your environment

**Issue**: TypeScript or ESLint errors blocking build
- **Fix**: Already configured in `next.config.mjs` to ignore during builds

### Authentication Issues

**Issue**: 500 error when logging in
- **Fix**: Verify your Supabase anon key is the correct JWT token (starts with `eyJ...`)
- **Check**: Go to Supabase Dashboard → Settings → API → Copy the `anon` `public` key

**Issue**: User profile not visible in sidebar
- **Fix**: Ensure backend is running and `NEXT_PUBLIC_API_URL` points to the correct server

### Database Connection

**Issue**: `ECONNREFUSED` when connecting to database
- **Fix**: 
  1. Check your `DATABASE_URL` in `server/.env`
  2. Verify your IP is allowed in Supabase (Settings → Database → Connection Pooling)
  3. For local testing, Supabase allows all IPs by default

### Windows-Specific Issues

**Issue**: PowerShell script execution disabled
- **Fix**: Use `cmd /c npm run dev` instead of `npm run dev`

---

## 📁 Project Structure

```
SSSI Growth Engine/
├── client/                 # Next.js Frontend
│   ├── src/
│   │   ├── app/           # Next.js 14 App Router pages
│   │   ├── components/    # React components
│   │   └── lib/           # Utilities (Supabase client)
│   ├── .env.local         # Client environment variables
│   └── package.json
├── server/                # Express.js Backend
│   ├── middleware/        # Auth & Audit middleware
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   ├── .env              # Server environment variables
│   ├── index.js          # Main server
│   └── worker.js         # Background jobs
├── schema.sql            # Database schema
├── netlify.toml          # Netlify deployment config
└── package.json          # Root package for running both
```

---

## 🔐 Security Notes

- **Never commit `.env` files** to version control (already in `.gitignore`)
- **Supabase keys**: The `anon` key is public and safe to use in frontend code
- **Service role key**: Keep this secret and NEVER expose it in the frontend
- **Database password**: Only use in backend environment variables

---

## 📝 License

This project is proprietary. All rights reserved by SSSI.

---

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review recent conversation logs for context
3. Ensure all environment variables are correctly set
