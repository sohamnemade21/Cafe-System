# QRDine SaaS - Production & Deployment Guide

This document outlines the architecture, environment configuration, database migrations, and step-by-step instructions for deploying **QRDine** to production platforms.

---

## 1. System Architecture

QRDine is architected as a high-performance, single-container monolithic SaaS:
- **Frontend**: React 19 SPA built with Vite, TailwindCSS, Framer Motion, Lucide icons, and Razorpay Checkout SDK.
- **Backend**: Node.js ESM Express server with real-time SSE streams, JWT/HMAC table session management, multi-tenant cafe data stores, and Supabase integration.
- **Database / Infrastructure**: Supabase (PostgreSQL 15+, Row-Level Security, Realtime).
- **External Integrations**: Razorpay (Payments), Resend (Invoices & Emails), Google Gemini API (AI Cafe Assistant & Menu Pairing).

---

## 2. Production Build Pipeline

```bash
# Install dependencies
npm install --legacy-peer-deps

# Run TypeScript type check
npm run lint

# Build client SPA and bundle server into dist/
npm run build

# Start the compiled production server
npm start
```

When `npm run build` runs:
1. `vite build` creates minified client assets in `dist/` with cache-busting hashes.
2. `esbuild server.ts` compiles the Express TypeScript backend into `dist/server.js` (clean ESM format with 0 runtime compilation overhead).
3. `npm start` runs `node dist/server.js` directly with optimal memory footprint and near-instant startup.

---

## 3. Environment Variables Reference

Create a `.env` or configure your host's environment settings:

| Variable | Required | Description | Example |
|---|---|---|---|
| `NODE_ENV` | Yes | Application environment | `production` |
| `PORT` | Yes | Listening port (injected by host) | `3000` or `10000` |
| `APP_URL` | Yes | Public HTTPS canonical URL | `https://dine.yourdomain.com` |
| `SUPABASE_URL` | Yes | Supabase Project URL | `https://xyz.supabase.co` |
| `SUPABASE_ANON_KEY` | Yes | Supabase Public Anonymous Key | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase Server Service Role Key | `eyJhbGci...` |
| `GEMINI_API_KEY` | Optional | Google Gemini API Key for AI features | `AIzaSy...` |
| `RAZORPAY_KEY_ID` | Optional | Razorpay Key ID | `rzp_live_...` |
| `RAZORPAY_KEY_SECRET` | Optional | Razorpay Secret Key | `secret...` |
| `RESEND_API_KEY` | Optional | Resend API Key for digital invoice emails | `re_1234...` |
| `RESEND_FROM_EMAIL` | Optional | Verified sender email | `orders@yourdomain.com` |
| `SESSION_SECRET` | Yes | 32+ char secret for HMAC token signing | `random_long_secret_key_32_chars` |

---

## 4. Deployment Methods

### Option A: Docker / Docker Compose (Recommended for Containers & VPS)

```bash
# Build and run with Docker Compose
docker compose up -d --build

# View logs
docker compose logs -f

# Check container health
docker ps
```

The multi-stage `Dockerfile` uses `node:22-alpine`, non-root user `node`, and includes automatic health checks via `/api/health`.

---

### Option B: Render.com

1. Push your repository to GitHub / GitLab.
2. Connect your repository on Render and create a **Web Service** (or use the Blueprint from `render.yaml`).
3. Set the following build and start commands:
   - **Build Command:** `npm install --legacy-peer-deps && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
4. Add all environment variables in the **Environment** tab.

---

### Option C: Railway.app

1. Create a new project in Railway and select **Deploy from GitHub repo**.
2. Railway detects the `Dockerfile` automatically.
3. In **Settings -> Networking**, generate a public domain and set `APP_URL` to that HTTPS URL.
4. Add the environment variables from the table above.

---

### Option D: Google Cloud Run / AWS App Runner

1. Build container image:
   ```bash
   docker build -t gcr.io/PROJECT_ID/qrdine:latest .
   docker push gcr.io/PROJECT_ID/qrdine:latest
   ```
2. Deploy to Cloud Run with Port `3000`, minimum 1 CPU, 512MB RAM, and concurrency `80`.

---

### Option E: Traditional Linux VPS (Ubuntu + PM2 + Nginx)

1. **Install Node 22 & PM2:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx
   sudo npm install -g pm2
   ```

2. **Clone & Build:**
   ```bash
   git clone <repo-url> /var/www/qrdine
   cd /var/www/qrdine
   npm install --legacy-peer-deps
   npm run build
   ```

3. **Start with PM2:**
   ```bash
   pm2 start dist/server.js --name "qrdine" -i max --env production
   pm2 save
   pm2 startup
   ```

4. **Nginx Reverse Proxy (`/etc/nginx/sites-available/qrdine`):**
   ```nginx
   server {
       server_name dine.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;

           # SSE streaming timeout configuration
           proxy_read_timeout 86400s;
           proxy_send_timeout 86400s;
       }
   }
   ```
5. **Enable SSL:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/qrdine /etc/nginx/sites-enabled/
   sudo certbot --nginx -d dine.yourdomain.com
   ```

---

## 5. Database Setup (Supabase)

1. Open your Supabase Dashboard SQL Editor.
2. Execute [supabase/schema.sql](file:///d:/QR%20Code/supabase/schema.sql) to create tables, indexes, and Row Level Security policies.
3. (Optional) Execute [supabase/seed.sql](file:///d:/QR%20Code/supabase/seed.sql) for demo cafes, categories, menu items, and tables.
4. Copy `Project URL`, `anon key`, and `service_role key` from **Project Settings -> API** into your production environment variables.

---

## 6. Health & Monitoring

- **Health Check Endpoint:** `GET /api/health`
  ```json
  {
    "status": "ok",
    "uptime": 1284,
    "timestamp": "2026-10-01T07:10:00.000Z",
    "environment": "production",
    "supabaseConnected": true,
    "version": "1.0.0"
  }
  ```
