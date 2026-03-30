# Deploying SSSI Growth Engine (Frontend) to AWS S3 & CloudFront

This guide explains how to deploy the static frontend of the project to an AWS S3 bucket for high-performance hosting.

---

## 🏗️ 1. Build the Project Locally

Before uploading to AWS, you must generate the static files.

1.  **Open PowerShell** (or Terminal) and navigate to the project root.
2.  **Navigate to the client folder**:
    ```powershell
    cd client
    ```
3.  **Set Environment Variables**:
    Next.js needs your Supabase and Backend URLs at build time. Ensure your `client/.env.local` has:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - `NEXT_PUBLIC_API_URL` (Pointing to your deployed backend, e.g., Render/AWS App Runner)
4.  **Install dependencies and Build**:
    ```powershell
    npm install
    npm run build
    ```
5.  **Locate Output**:
    After a successful build, a folder named `out` will be created in the `client` directory. These are the files you will upload to S3.

---

## 🪣 2. Create and Configure S3 Bucket

1.  Log in to [AWS Management Console](https://console.aws.amazon.com/s3/).
2.  **Create Bucket**:
    - **Bucket name**: `sssi-growth-engine` (must be unique globally).
    - **Region**: Choose the one closest to your users (e.g., `us-east-1` or `ap-south-1`).
    - **Object Ownership**: ACLs disabled (Recommended).
    - **Block Public Access settings**: 
        - **UNCHECK** "Block all public access" (This is necessary to serve the website publicly).
        - Acknowledge that the bucket will become public.
3.  **Enable Static Website Hosting**:
    - Select your bucket > **Properties** tab.
    - Scroll to the bottom to **Static website hosting** > **Edit**.
    - Select **Enable**.
    - **Index document**: `index.html`
    - **Error document**: `404.html` (Next.js export generates this).
    - Save changes.

---

## 🔐 3. Set Bucket Policy

To allow the public to read your files, you need a Bucket Policy.

1.  Go to the **Permissions** tab of your bucket.
2.  Scroll to **Bucket policy** > **Edit**.
3.  Paste the following (replace `YOUR_BUCKET_NAME` with your actual bucket name):
    ```json
    {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "PublicReadGetObject",
                "Effect": "Allow",
                "Principal": "*",
                "Action": "s3:GetObject",
                "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
            }
        ]
    }
    ```
4.  Save changes.

---

## 📤 4. Upload Files

### Option A: Manual Upload (Console)
1.  Go to the **Objects** tab of your bucket.
2.  Click **Upload**.
3.  Drag and drop the **contents** of the `client/out` folder (not the folder itself) into the upload area.
4.  Click **Upload**.

### Option B: AWS CLI (Recommended)
If you have the AWS CLI configured:
```powershell
aws s3 sync out s3://YOUR_BUCKET_NAME --delete
```

---

## 🌐 5. CloudFront (Highly Recommended)
S3 static hosting only supports HTTP. For HTTPS and better speed, use CloudFront.

1.  Go to [CloudFront Console](https://console.aws.amazon.com/cloudfront/).
2.  **Create Distribution**:
    - **Origin domain**: Select your S3 bucket.
    - **Origin access**: Use "Origin access control settings" (Recommended for security).
    - **Protocol policy**: Redirect HTTP to HTTPS.
    - **Price Class**: Select based on your needs.
3.  After creation, use the **CloudFront Domain Name** (e.g., `d123.cloudfront.net`) to access your site.

---

## ⚙️ 6. What about the Backend?
S3 **cannot** host the Node.js `server` directory. You should deploy the backend separately:
- **AWS App Runner** (Easiest for Node.js).
- **AWS Elastic Beanstalk**.
- **Render** (as mentioned in `VERCEL_DEPLOY.md`).

Once the backend is deployed, update your `NEXT_PUBLIC_API_URL` in `client/.env.local` and rebuild the frontend.

---
