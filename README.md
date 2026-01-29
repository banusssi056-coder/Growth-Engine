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
Create a `.env` file in the `server/` directory with your Supabase credentials:

**File:** `server/.env`
```env
# Database Connection (Transaction Pooler - Port 5432 or 6543)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres

# Supabase API Keys (Found in Project Settings > API)
SUPABASE_URL=https://[REF].supabase.co
SUPABASE_KEY=[ANON_KEY]
SUPABASE_PUBLISHABLE_KEY=[PUBLISHABLE_KEY]
```
*> **Note**: If your password contains special characters (like `@`), the system will automatically handle encoding.*

### 4. Database Initialization
Run the migration and seed scripts to create tables and load test data:

```bash
cd server
node migrate.js  # Creates Tables
node seed.js     # Inserts Test Data (Users, Deals, Companies)
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

*   **Dashboard**: Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard) to see the Kanban board.
*   **Automation**: Check the `worker.js` terminal logs. It runs:
    *   *Lead Assignment*: Every 30 seconds.
    *   *Stale Check*: Every 12 hours.
