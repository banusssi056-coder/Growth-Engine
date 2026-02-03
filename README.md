# SSSI GrowthEngine - Sales Accelerator & Automation Platform

**SSSI GrowthEngine** is a modern Sales CRM designed to accelerate deal velocity through intelligent automation and real-time visibility. It combines a robust Kanban sales desk with a background "Brain" that automates lead assignment and hygiene.

## 🚀 Key Features

### 1. Sales Desk (Visible)
*   **Kanban Pipeline**: Interactive drag-and-drop Deal board.
*   **Weighted Forecasting**: Real-time revenue projection based on deal probability.
*   **Deal Management**: Create, update, and track deal stages.

### 2. The Brain (Automation)
*   **Round-Robin Distributor**: Automatically assigns new leads to active Sales Reps to ensure fair distribution.
*   **Stale Lead Detection**: Background job scans for deals inactive for >30 days and flags them as "Stale" (or re-assigns them).

### 3. Intelligence
*   **Lead Scoring**: Dynamic scoring based on engagement (e.g., Email Opens +5, Silence -20).
*   **Pixel Tracking**: Invisible pixel for tracking email opens.
*   **Liquid Templates**: Dynamic email rendering with personalization.

### 4. Security & Access Control (New)
*   **Google Login**: Secure authentication via Supabase Auth + Google OAuth.
*   **Role-Based Access Control (RBAC)**:
    *   **Admin**: Full access to all deals, settings, and user management. First user is auto-assigned Admin.
    *   **Sales Manager**: Access to team deals and reports.
    *   **Sales Rep**: Access only to their own deals.
    *   **Intern**: Restricted access (Lead view/create only).

---

## 🛠 Technology Stack

*   **Frontend**: Next.js 14+ (App Router), Tailwind CSS, Lucide Icons, `@dnd-kit`.
*   **Backend**: Node.js, Express.js.
*   **Database**: Supabase (PostgreSQL).
*   **Worker**: `node-cron` for background task scheduling.

---

## ⚙️ Setup Instructions

### 1. Prerequisites
*   Node.js (v18+)
*   Supabase Project (Credentials required)
*   Google Cloud Project (for OAuth)

### 2. Installation
Navigate to the folders and install dependencies:

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```

### 3. Environment Configuration

#### Server (`server/.env`)
```env
# Database Connection
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres

# Supabase API Keys (Found in Project Settings > API)
SUPABASE_URL=https://[REF].supabase.co
SUPABASE_ANON_KEY=[ANON_KEY]
SUPABASE_PUBLISHABLE_KEY=[PUBLISHABLE_KEY]
```

#### Client (`client/.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://[REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON_KEY]
```

### 4. Supabase & Google Auth Setup
1.  **Enable Google Auth**: In Supabase Dashboard > Authentication > Providers.
2.  **Configure Google Cloud**:
    *   Create a Project in Google Cloud Console.
    *   Create OAuth 2.0 Credentials (Web App).
    *   Add Supabase Callback URL to "Authorized redirect URIs".
    *   Copy Client ID/Secret to Supabase.

### 5. Database Initialization
Run the migration and seed scripts to create tables and load test data:

```bash
cd server
node migrate.js  # Creates Tables
# node seed.js   # Optional: Inserts Test Data
```

---

## 🏃‍♂️ Running the Application

You need to run 3 separate processes (Terminal tabs):

**1. Backend API**
```bash
cd server
node index.js
# Runs on localhost:5000
```

**2. Frontend Client**
```bash
cd client
npm run dev
# Runs on localhost:3000
```

**3. Automation Brain**
```bash
cd server
node worker.js
# Runs background jobs (Lead Assignment, Stale Checks)
```

---

## 🧪 Testing

*   **Login**: Open [http://localhost:3000](http://localhost:3000). You will be redirected to Login.
*   **Admin Check**: The first user to login becomes **Admin**. You will see the "Settings" tab.
*   **Rep Check**: Create a new user (or update DB role). You will NOT see "Settings" and only see your own deals.
