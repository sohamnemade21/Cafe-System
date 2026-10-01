# QRDine Production Deployment Guide (Vercel + Render + Supabase)

This guide provides step-by-step instructions for deploying QRDine in a split production architecture:
- **Frontend SPA**: Hosted on **Vercel** (React 19 + Vite)
- **Backend API**: Hosted on **Render** (Node.js + Express)
- **Database & Auth**: Hosted on **Supabase** (PostgreSQL 15+ & GoTrue Auth)
- **Payment Processing**: **Razorpay** (Real UPI, Cards, NetBanking, HMAC signatures)
- **Transactional Invoices**: **Resend** (HTML Tax Invoices & Order Receipts)

---

## 1. Supabase PostgreSQL Setup

1. Open your **Supabase Dashboard** ([supabase.com](https://supabase.com)).
2. Navigate to **SQL Editor** -> **New query**.
3. Copy and run the entire contents of [supabase/schema.sql](file:///d:/QR%20Code/supabase/schema.sql).
4. (Optional) Run [supabase/seed.sql](file:///d:/QR%20Code/supabase/seed.sql) to populate initial cafes, menu items, and tables.
5. In **Project Settings** -> **API**, obtain:
   - `Project URL` (`SUPABASE_URL`)
   - `anon public key` (`SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`)
   - `service_role secret key` (`SUPABASE_SERVICE_ROLE_KEY`)
6. In **Authentication** -> **URL Configuration**:
   - Set **Site URL** to your Vercel frontend URL: `https://your-app.vercel.app`
   - Add **Redirect URLs**:
     - `https://your-app.vercel.app/**`
     - `http://localhost:5173/**`

---

## 2. Render Deployment (Backend API Only)

1. Create a new **Web Service** on [Render](https://render.com) linked to your GitHub repo.
2. Configure the following service settings:
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build:server`
   - **Start Command:** `node dist/server.js`
   - **Health Check Path:** `/health`
3. In the **Environment** tab, set the following environment variables:

| Variable | Description | Example |
|---|---|---|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Listening port (Render default) | `10000` |
| `APP_URL` | Render API URL | `https://qrdine-api.onrender.com` |
| `FRONTEND_URL` | Vercel Frontend URL (for CORS) | `https://qrdine.vercel.app` |
| `SESSION_SECRET` | 32+ char secret for JWT/HMAC token signing | `your-random-32-char-secret-string` |
| `SUPABASE_URL` | Supabase Project URL | `https://xyz.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase Anon Key | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | `eyJhbGci...` |
| `RAZORPAY_KEY_ID` | Razorpay Key ID | `rzp_live_...` or `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay Secret Key | `your_secret_key` |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Webhook Secret | `your_webhook_secret` |
| `RESEND_API_KEY` | Resend API Key for digital invoice emails | `re_123456789` |
| `RESEND_FROM_EMAIL` | Verified sender email | `orders@yourdomain.com` |

---

## 3. Vercel Deployment (Frontend SPA Only)

1. Create a new project on [Vercel](https://vercel.com) and import your Git repository.
2. Configure the build settings:
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build:client` (or `vite build`)
   - **Output Directory:** `dist`
3. Add the following **Environment Variables** in Vercel:

| Variable | Description | Value |
|---|---|---|
| `VITE_API_URL` | Render Backend API URL | `https://qrdine-api.onrender.com` |
| `VITE_SUPABASE_URL` | Supabase Project URL | `https://xyz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase Anon Public Key | `eyJhbGci...` |
| `VITE_RAZORPAY_KEY_ID` | Razorpay Key ID for Checkout.js | `rzp_live_...` or `rzp_test_...` |

---

## 4. Razorpay Webhooks Setup

1. In your **Razorpay Dashboard** -> **Settings** -> **Webhooks** -> **Add New Webhook**.
2. **Webhook URL**: `https://your-api.onrender.com/api/payments/webhook`
3. **Secret**: Enter a secure secret (same as `RAZORPAY_WEBHOOK_SECRET`).
4. **Active Events**:
   - `payment.captured`
   - `order.paid`
   - `payment.failed`

---

## 5. Verification & Testing

1. **Backend Health Check**:
   ```bash
   curl -i https://your-api.onrender.com/health
   ```
   Should return HTTP 200 with status `"ok"`.

2. **Frontend Test**:
   - Open `https://your-app.vercel.app`
   - Scan/select a table QR
   - Add items to cart with variant customisation
   - Verify that subtotal, GST taxes, and discounts compute dynamically
   - Proceed to Razorpay payment and verify checkout flow
   - Inspect kitchen KDS and reception overview for real-time order updates
