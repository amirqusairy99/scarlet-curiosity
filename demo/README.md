# MIS Ticketing System — Static Demo (Cloudflare Pages)

A fully client-side demo of the MIS ticketing system. It runs entirely in the browser
(no backend, no database) using **localStorage** for persistence, so it can be hosted
for free on **Cloudflare Pages**.

## Demo Accounts
| Role  | Username       | Password          |
|-------|----------------|-------------------|
| Admin | `administrator`| `misdashboard9090`|
| User  | `demo`         | `demo1234`        |

> Data is stored per-browser in localStorage. To reset the demo data, clear your
> browser's site data (or open the site in a private/incognito window).

## Features Included
- Submit a ticket (with multiple attachments)
- Secure ticket-status tracking link (unguessable token in URL)
- Admin dashboard login
- Dashboard with:
  - Summary cards (Total / Open / In Progress / Resolved)
  - Search (by ID, requester, department, title, priority, status)
  - Pagination (25 per page)
  - Create / Edit / Delete tickets
  - Multiple attachments per ticket (add, list, remove)
- Light / dark theme toggle
- Responsive layout

## Deploy to Cloudflare Pages (Wrangler CLI)
```bash
# 1. Install the Cloudflare CLI if you haven't already
npm install -g wrangler

# 2. From the project root, deploy this folder
wrangler pages deploy demo --project-name mis-ticketing-demo
```

## Deploy to Cloudflare Pages (Dashboard)
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Go to **Workers & Pages** → **Create** → **Pages** → **Upload assets**.
3. Upload the **contents of the `demo` folder** (the HTML/CSS/JS files, not the folder itself).
4. Click **Deploy site**. Cloudflare assigns a `*.pages.dev` URL.

## Notes
- This is a **static demo** for showcasing the UI. Real persistence requires the
  Node.js + MySQL backend in the parent directory.
- No API keys, emails, or real data are used. All records are generated sample data.
