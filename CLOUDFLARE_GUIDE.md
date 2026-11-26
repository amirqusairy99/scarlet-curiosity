# Cloudflare Pages + R2 Storage Deployment Guide

This guide explains how to host **Scarlet Curiosity** on **Cloudflare Pages** using **Cloudflare R2** for file uploads and **Cloudflare D1** for the database.

---

## 1. Overview of Cloudflare Architecture

- **Frontend**: Static files in `public/` (HTML, CSS, JS) served globally via Cloudflare CDN.
- **Backend API**: Serverless edge endpoints in `functions/` (Cloudflare Pages Functions).
- **File Storage**: **Cloudflare R2** (`UPLOADS_BUCKET`), replacing local disk storage (`uploads/`).
- **File Serving**: Handled directly by `functions/uploads/[filename].js` streaming from R2 with caching headers.
- **Database**: **Cloudflare D1** (`DB`), a zero-maintenance serverless SQLite database.

---

## 2. Prerequisites

1. A [Cloudflare Account](https://dash.cloudflare.com).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Cloudflare Wrangler CLI (installed via devDependencies or run via `npx wrangler`):
   ```bash
   npx wrangler login
   ```

---

## 3. Cloudflare Resources Setup

### Step 3.1: Create the Cloudflare R2 Storage Bucket
Create a new bucket named `scarlet-curiosity-uploads`:
```bash
npx wrangler r2 bucket create scarlet-curiosity-uploads
```

### Step 3.2: Create the Cloudflare D1 Database
Create the D1 database:
```bash
npx wrangler d1 create scarlet-curiosity-db
```
Wrangler will output something like:
```text
[[d1_databases]]
binding = "DB"
database_name = "scarlet-curiosity-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```
Copy that `database_id` and paste it into `wrangler.toml` under `database_id`.

### Step 3.3: Initialize the Database Schema & Admin User
Execute the schema script to create all tables and the initial administrator account:

**For Remote (Cloudflare Production):**
```bash
npm run d1:init-remote
# or: npx wrangler d1 execute scarlet-curiosity-db --remote --file=schema-d1.sql
```

**For Local Testing:**
```bash
npm run d1:init-local
# or: npx wrangler d1 execute scarlet-curiosity-db --local --file=schema-d1.sql
```

Default Admin Credentials:
- **Username:** `administrator`
- **Password:** `misdashboard9090`

---

## 4. Local Development

You can test the entire full-stack app locally using Wrangler:
```bash
npm run pages:dev
# or: npx wrangler pages dev public
```
This runs the frontend assets from `public/`, mounts the Functions from `functions/`, and simulates D1 & R2 locally!

Open: `http://localhost:8788`

---

## 5. Deploying to Cloudflare Pages

### Option A: Deploy via Wrangler CLI
Deploy directly from your machine:
```bash
npm run pages:deploy
# or: npx wrangler pages deploy public --project-name scarlet-curiosity
```

### Option B: Deploy via Git (GitHub / GitLab Integration)
1. Push this branch (`cloudflare-pages`) to your repository.
2. Go to **Cloudflare Dashboard** -> **Workers & Pages** -> **Create** -> **Pages** -> **Connect to Git**.
3. Select your repository and branch: `cloudflare-pages`.
4. Build configuration:
   - **Framework preset**: None
   - **Build output directory**: `public`
5. Click **Save and Deploy**.
6. After creating the Pages project, attach the bindings:
   - Go to **Settings** -> **Functions** -> **R2 bucket bindings**:
     - Variable name: `UPLOADS_BUCKET`
     - R2 bucket: `scarlet-curiosity-uploads`
   - Go to **Settings** -> **Functions** -> **D1 database bindings**:
     - Variable name: `DB`
     - D1 database: `scarlet-curiosity-db`
   - Go to **Settings** -> **Environment variables**:
     - `JWT_SECRET`: (Set a strong random secret)
     - Optional: `RESEND_API_KEY` or `EMAIL_FROM` for automated email notifications.

---

## 6. How File Uploads Work with Cloudflare R2

1. When a user submits a ticket or an admin adds an attachment:
   - The browser sends a `multipart/form-data` request with `attachments` to `/api/tickets` or `/api/tickets/:id/attachments`.
   - The Cloudflare Pages Function reads the file stream and stores it directly into the Cloudflare R2 bucket (`env.UPLOADS_BUCKET.put(...)`).
   - The relative file path `/uploads/<timestamp>_<filename>` is recorded in D1 `attachments` table.
2. When viewing or downloading an attachment:
   - The browser requests `/uploads/<timestamp>_<filename>`.
   - The Pages Function `functions/uploads/[filename].js` catches the request, fetches the object from R2, sets appropriate `Content-Type` and `Cache-Control` headers, and streams it back.
3. When an attachment or ticket is deleted:
   - The function automatically purges the corresponding file object from Cloudflare R2 (`env.UPLOADS_BUCKET.delete(...)`).
