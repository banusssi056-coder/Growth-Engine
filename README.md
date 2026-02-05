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

*   **Frontend**: Next.js 14, React 18, Tailwind CSS 3.4.
*   **Backend**: Node.js, Express.js.
*   **Database**: Supabase (PostgreSQL).
*   **Worker**: `node-cron` for background task scheduling.
*   **Environment**: Optimized for cross-platform compatibility (Windows/Linux).

---

## ⚙️ Quick Start

### Prerequisites
*   **Node.js**: Version **18.x** is required.
*   **NPM**: Version 8.x or higher.

### 1. Clone & Install
```bash
git clone <repository-url>
cd "SSSI Growth Engine"

# Install all dependencies (Root, Client, Server)
npm run install-all
```

### 2. Environment Setup
Create environment files from the examples and add your credentials:

**Client:**
```bash
cp client/.env.example client/.env.local
# Edit client/.env.local with your Supabase keys
```

**Server:**
```bash
cp server/.env.example server/.env
# Edit server/.env with your Supabase keys & Database URL
```

### 3. Run the Application
You can start the Client and Server concurrently from the root:

```bash
# Starts Client (localhost:3000) and Server (localhost:5000)
npm run dev
```

If you encounter compatibility issues or need a fresh start:
```bash
# Clean install (removes node_modules) and reinstall
rm -rf node_modules client/node_modules server/node_modules
npm run install-all
```

---

## 🏃‍♂️ Manual Run (Separate Terminals)

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
# Runs on localhost:3000
```

**3. Automation Brain (Background Jobs)**
```bash
cd server
node worker.js
```

---

## 🧪 Testing

*   **Login**: Open [http://localhost:3000](http://localhost:3000). You will be redirected to Login.
*   **Admin Check**: The first user to login becomes **Admin**. You will see the "Settings" tab.
*   **Rep Check**: Create a new user (or update DB role). You will NOT see "Settings" and only see your own deals.
