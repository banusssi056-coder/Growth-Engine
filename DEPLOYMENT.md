# Deployment & Execution Guide

This guide explains how to deploy the **SSSI Growth Engine** (Client & Server) to various environments and how to run it on different operating systems.

## 🚀 1. Deploying to Netlify (Frontend Client)

Netlify is the recommended host for the Next.js Client (`client` directory).

### Option A: Drag & Drop (Manual)
1.  Run `npm run build` inside the `client` folder locally.
2.  Login to [Netlify](https://app.netlify.com/).
3.  Drag the `client/.next` folder (or `out` if using static export) to the Netlify Drop zone.
    *   *Note: For dynamic Next.js apps (SSR), connecting via Git is recommended.*

### Option B: Git Integration (Recommended)
1.  Push your latest code to GitHub.
2.  Log in to Netlify and click **"Add new site"** > **"Import from an existing project"**.
3.  Select **GitHub** and choose your repository (`Growth-Engine`).
4.  Configure the build settings:
    *   **Base directory**: `client`
    *   **Build command**: `npm run build`
    *   **Publish directory**: `.next`
5.  **Environment Variables**:
    *   Click "Show advanced" or go to Site Settings > Environment Variables.
    *   Add the variables from `client/.env.local`:
        *   `NEXT_PUBLIC_SUPABASE_URL`
        *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6.  Click **Deploy Site**.

---

## ☁️ 2. Deploying the Backend (Server)

The `server` is a Node.js/Express app. It cannot be hosted on Netlify (which is for static/frontend). You need a Node.js host like **Render**, **Railway**, or **Heroku**.

### Example: Deploying to Render_com
1.  Create a new **Web Service**.
2.  Connect your GitHub repository.
3.  Settings:
    *   **Root Directory**: `server`
    *   **Build Command**: `npm install`
    *   **Start Command**: `node index.js`
4.  **Environment Variables**:
    *   Add variables from `server/.env`:
        *   `DATABASE_URL`
        *   `PGUSER`, `PGPASSWORD`, etc. (if needed separately)
        *   `SUPABASE_URL`, `SUPABASE_KEY`

---

## 💻 3. Running on Different Systems

### Windows (PowerShell)
1.  **Install Node.js 18**: Ensure you are using Node 18.x.
    ```powershell
    nvm install 18
    nvm use 18
    ```
2.  **Install Dependencies**:
    ```powershell
    npm run install-all
    ```
3.  **Run App**:
    ```powershell
    npm run dev
    ```

### Linux / macOS (Bash)
The commands are identical to Windows, but ensure your permissions are correct.

1.  **Clone & Setup**:
    ```bash
    git clone <your-repo-url>
    cd "SSSI Growth Engine"
    npm run install-all
    ```
2.  **Run**:
    ```bash
    npm run dev
    ```
3.  **Troubleshooting Linux**:
    *   If you get `EACCES` errors, do **not** run as root. Fix ownership with `chown -R $USER .`

### Docker (Containerized)
If you prefer running in a container (works on any OS with Docker installed):

1.  **Build & Run**:
    ```bash
    docker-compose up --build
    ```
    *This requires `docker-compose.yml` to be correctly configured for the current directory structure.*

---

## ⚠️ Important Troubleshooting

*   **Node Version**: This project strictly requires **Node.js 18.x**. Using Node 20+ or 22+ usually breaks `concurrently` or old Tailwind dependencies.
*   **Database**: Ensure your IP is allowed in Supabase if you see `ECONNREFUSED` or connection timeouts.
