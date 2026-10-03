QRDINE --- Multi-Tenant QR Café Ordering System
QRDINE is a production-oriented QR-based café/restaurant ordering
platform connecting customers, kitchen staff, reception staff, and café
owners through one centralized system.
Security: This README contains no passwords, API keys,
service-role keys, personal email addresses, database credentials, or
other confidential values.

1. Overview
Customer Mobile/Browser
        │
        │ Scan Table QR
        ▼
┌──────────────────────┐
│ Vercel Frontend      │
│ React + Vite         │
└──────────┬───────────┘
           │ HTTPS / API
           ▼
┌──────────────────────┐
│ Render Backend       │
│ Node.js + Express    │
└───────┬────────┬─────┘
        │        │
        ▼        ▼
┌────────────┐ ┌──────────────────┐
│ Supabase   │ │ External Services │
│ PostgreSQL │ │ Razorpay         │
│ Auth       │ │ Resend           │
│ Realtime   │ └──────────────────┘
└────────────┘
Main customer-to-café flow
QR Scan
  ↓
Authentication
  ↓
Café + Table Context
  ↓
Menu
  ↓
Cart
  ↓
Confirm Order
  ↓
Backend Validation
  ↓
Order Stored in PostgreSQL
  ↓
Kitchen Receives Order
  ↓
Kitchen Updates Status
  ↓
Reception Sees Table Bill
  ↓
Cash or Optional Online Payment
  ↓
Settlement
  ↓
Table Session Closed
2. Core Features
Customer
- Secure table QR entry
- Email/password authentication
- Google authentication
- Authentication-session handling
- QR/table context preservation during authentication redirects
- Menu browsing
- Cart and order placement
- Explicit order confirmation
- Order tracking
- Optional online payment
- Multiple customers using the same table session
Kitchen
- Staff authentication
- Active order display
- Table number, items, quantities, notes and totals
- Order status updates
- Persistent status across refreshes
Typical status flow:
PENDING → PREPARING → READY
Reception
- Staff authentication
- Live table overview
- Table-level outstanding balances
- Order/billing visibility
- Settlement
- Table release after settlement
- Real-time operational events
- Guest/order assistance alerts
Owner
- Owner authentication
- Order visibility
- Table management
- Menu management
- Coupon management
- Customer/CRM visibility
- Café operations overview
CRM
- Customer records from ordering activity
- Contact information available to the application
- Visit information
- Role-protected customer management
- Customer profile isolation
3. Architecture
                         ┌───────────────┐
                         │   Customer    │
                         └───────┬───────┘
                                 │
                              QR Scan
                                 │
                                 ▼
                       ┌──────────────────┐
                       │ React + Vite     │
                       │ Vercel Frontend  │
                       └────────┬─────────┘
                                │ HTTPS
                                ▼
                       ┌──────────────────┐
                       │ Node + Express   │
                       │ Render Backend   │
                       └──────┬─────┬─────┘
                              │     │
                     ┌────────┘     └────────┐
                     ▼                       ▼
              ┌──────────────┐       ┌──────────────┐
              │   Supabase   │       │  Providers   │
              │ PostgreSQL   │       │ Razorpay     │
              │ Auth        │       │ Resend       │
              │ Realtime    │       └──────────────┘
              └──────────────┘
4. Customer Ordering Architecture
Customer
   │
   ▼
Table QR
   │
   ▼
Validate QR + Table Context
   │
   ▼
Authenticate
   │
   ▼
Menu
   │
   ▼
Cart
   │
   ▼
Confirm Order
   │
   ▼
POST /api/orders
   │
   ▼
Backend validates request
   │
   ▼
orders + order_items
   │
   ├───────────────┐
   ▼               ▼
 Kitchen        Reception
   │               │
   ▼               ▼
Status          Table Bill
Updates         / Balance
Orders are initially created with a pending payment state. Customers do
not have to enter online payment merely to place an order.
5. Multi-Customer Table Billing
A table uses an active table session.
Table 3 — Active Session

Customer A → ₹172
Customer B → ₹516
                 │
                 ▼
          Combined Bill
               ₹688
After settlement:
ACTIVE SESSION
      ↓
Settlement
      ↓
SESSION CLOSED
      ↓
Table becomes FREE
      ↓
New session starts at ₹0
Previous-session orders are not mixed into the next active session.
6. Authentication
Customer opens QR URL
        │
        ▼
Check Supabase Session
        │
   ┌────┴────┐
   │         │
Logged In  Logged Out
   │         │
   │         ▼
   │    Sign-in Modal
   │       │    │
   │     Email Google
   │       └────┘
   │         │
   └────┬────┘
        ▼
Authenticated Session
        ↓
Restore QR/Table Context
        ↓
Menu
The authentication implementation preserves relevant ordering context
such as:
mode
qr
table
cafe
Production OAuth must return to the deployed frontend, never to
localhost.
7. QR Architecture
Physical Table QR
       ↓
Secure QR Token
       ↓
Production Frontend URL
       ↓
QR Validation
       ↓
Café + Table Context
       ↓
Customer Session
Example structure:
https://<frontend-domain>/?mode=customer&qr=<secure-token>
Do not put passwords, API keys, database credentials, or other secrets
into QR codes.
8. Backend Responsibilities
The backend is authoritative for:
- order creation
- order totals
- table-session aggregation
- payment state
- settlement
- role authorization
- customer data access
- table state
- order status transitions
The browser must not be trusted to determine financial or
authorization-sensitive values.
9. Real-Time Architecture
Database / Backend Event
          │
          ▼
     Real-Time Layer
          │
     ┌────┴────┐
     ▼         ▼
  Kitchen   Reception
     │         │
     ▼         ▼
 Order       Table /
 Status      Alert Updates
Real-time events complement persistent database state. The
database/backend remains the source of truth.
10. Reception Alert Principle
Reception alerts are operational notifications associated with events
such as new orders.
The correct model is:
New Event
   ↓
Persisted/Identifiable Event
   ↓
Realtime Notification
   ↓
Reception UI
   ↓
Dismiss
   ↓
Persist Dismissal
   ↓
UI Removes Alert
A dismissed alert must not delete, cancel, or alter the underlying
order.
11. Payment Model
Customer Orders
      ↓
Payment = PENDING
      ↓
Kitchen Processing
      ↓
Reception Table Total
      ↓
Settlement
   ┌──┴─────┐
   ▼        ▼
 Cash    Online
Payment-sensitive operations must be verified server-side.
The client must not be trusted to mark orders as paid.
12. RBAC
Owner
 ├── Orders
 ├── Tables
 ├── Menu
 ├── Coupons
 └── CRM

Kitchen
 └── Kitchen Orders / Status

Reception
 ├── Table Overview
 ├── Billing
 └── Settlement

Customer
 ├── Menu
 ├── Cart
 ├── Orders
 └── Own Customer Session
Protected staff operations require authenticated staff access and
appropriate roles.
13. Security
QRDINE follows these principles:
- Supabase Auth handles customer authentication.
- Backend authorization is enforced server-side.
- Role-based access control protects staff endpoints.
- Customer profile access is identity-restricted.
- Payment state is controlled by trusted backend logic.
- QR tokens contain no sensitive credentials.
- VITE_* variables are public browser configuration and must not
  contain server secrets.
- Supabase service-role credentials remain server-side.
- Production OAuth and QR flows must never use localhost.
- Financial totals are calculated/validated by backend logic.
- No credentials should be committed to Git.
14. Technology Stack
  Layer              Technology
  Frontend           React + Vite
  Backend            Node.js + Express
  Language           TypeScript / JavaScript
  Database           Supabase PostgreSQL
  Authentication     Supabase Auth
  Real-Time          Existing server/realtime event infrastructure
  Payments           Razorpay
  Email              Resend
  Frontend Hosting   Vercel
  Backend Hosting    Render
15. Deployment
Internet
   │
   ├──────────────► Vercel
   │                React + Vite
   │
   └──────────────► Render
                    Node + Express
                         │
                         ▼
                    Supabase
                 ┌──────┼──────┐
                 ▼      ▼      ▼
             Database  Auth  Realtime
Frontend environment
Use placeholders such as:
VITE_APP_URL=https://<frontend-domain>
VITE_API_URL=https://<backend-domain>
VITE_SUPABASE_URL=<supabase-project-url>
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
VITE_RAZORPAY_KEY_ID=<public-payment-key>
Backend environment
APP_URL=https://<backend-domain>
FRONTEND_URL=https://<frontend-domain>

SUPABASE_URL=<supabase-project-url>
SUPABASE_SERVICE_ROLE_KEY=<server-only-secret>

RAZORPAY_KEY_ID=<server-configured-key>
RAZORPAY_KEY_SECRET=<server-only-secret>

RESEND_API_KEY=<server-only-secret>
RESEND_FROM_EMAIL=<verified-sender>
Never commit actual environment values.
16. Local Development
Requirements
- Node.js
- npm
- Git
- Supabase project
- Required provider configuration for payment/email features
Install
npm install
Development
Use the existing project scripts:
npm run dev
Validation
npm run lint
npm run build
17. API Areas
The application contains API areas for:
/api/auth/*
/api/orders/*
/api/tables/*
/api/reception/*
/api/customers/*
/api/cafes/*
Representative operations include:
POST  /api/auth/staff-login
POST  /api/tables/session/init
POST  /api/orders
GET   /api/orders/cafe/:cafeId
PATCH /api/orders/:orderId/status
GET   /api/reception/:cafeId/overview
POST  /api/reception/settle-payment
GET   /api/cafes/:cafeId/customers
Exact endpoints should be verified against the current source before
external integration.
18. Database Concepts
Café
 │
 ├── Tables
 │    └── Table Sessions
 │
 ├── Menu
 │
 ├── Orders
 │    └── Order Items
 │
 ├── Coupons
 │
 └── Customers / CRM
A table session groups orders belonging to the same active dining
session.
19. Testing
The production verification suite has covered:
- customer table-session initialization
- order creation and persistence
- pending payment behavior
- kitchen authentication
- kitchen order retrieval
- kitchen status updates
- reception overview
- reception settlement
- multi-customer table aggregation
- owner access
- CRM ingestion
- customer profile isolation
- role-based access control
- forged payment-state protection
- TypeScript/lint validation
- production build
The core application flows were reported as passing in the production
verification pass.
Additional manual production checks
These require real browser/device or provider configuration:
- Google OAuth interactive login
- production OAuth redirect
- session persistence after refresh
- physical QR scan
- production email delivery through a verified Resend domain
20. Production Checklist
Deployment
[ ] Frontend deployed
[ ] Backend deployed
[ ] Database connected
[ ] Environment variables configured
[ ] No secrets committed
[ ] npm run lint passes
[ ] npm run build passes
Authentication
[ ] Signup works
[ ] Email/password login works
[ ] Google login works
[ ] OAuth returns to production frontend
[ ] No localhost OAuth redirect
[ ] Session persists after refresh
[ ] Password reset works with configured email provider
QR / Ordering
[ ] QR points to production frontend
[ ] No localhost QR
[ ] Correct café/table detected
[ ] Menu loads
[ ] Cart works
[ ] Confirm Order works
[ ] Kitchen receives order
[ ] Order status updates
Billing
[ ] Multiple customers can use one table
[ ] Orders aggregate correctly
[ ] Reception sees current balance
[ ] Settlement works
[ ] Table is released after settlement
[ ] New session starts cleanly
Security
[ ] Staff endpoints require authentication
[ ] Roles are enforced
[ ] Customer profiles are isolated
[ ] Payment status cannot be forged
[ ] Server secrets remain server-side
21. Troubleshooting
QR opens localhost
Check:
FRONTEND_URL
VITE_APP_URL
Correct production QR URLs must point to the deployed frontend.
Regenerate QR codes after correcting production configuration.
Google redirects to localhost
Check:
Supabase Auth
→ URL Configuration
→ Google Provider
→ Frontend redirect handling
Use the production frontend URL.
Customer appears logged out after authentication
Check:
Supabase session
      ↓
Auth state listener
      ↓
Customer auth context
      ↓
Auth initialization/loading state
Do not treat an uninitialized session as confirmed logged-out state.
Resend email fails
Check:
Resend domain verification
RESEND_API_KEY
RESEND_FROM_EMAIL
Production sending requires an appropriately verified sender/domain.
Reception data appears stale
Check:
Backend / Database
       ↓
Realtime Event
       ↓
Reception State
       ↓
UI
Operational data should come from persistent backend state rather than
temporary frontend-only state.
22. Project Structure
A representative structure is:
QRDINE/
│
├── client/
│   ├── components/
│   ├── pages/
│   ├── contexts/
│   ├── services/
│   └── ...
│
├── server/
│   ├── auth.ts
│   ├── db.ts
│   ├── routes/
│   └── ...
│
├── scripts/
│   ├── verify-e2e.ts
│   └── verify-full-production-suite.ts
│
├── package.json
├── tsconfig.json
├── vite.config.*
└── README.md
The exact repository structure may evolve; the current source is the
final authority.
23. Engineering Rules
1. Do not rewrite working modules unnecessarily.
2. Keep business logic on the backend.
3. Treat the database as the source of truth.
4. Do not use localStorage as the primary source of truth for financial
   or authorization state.
5. Never hardcode credentials or API keys.
6. Never expose Supabase service-role keys to the frontend.
7. Never use localhost URLs in production configuration.
8. Do not modify unrelated features while fixing a targeted bug.
9. Prefer small, isolated fixes over large rewrites.
10. Run lint/build/tests after production-impacting changes.
11. Keep production code minimal and maintainable.
12. Remove temporary debugging/test artifacts after verification.
24. Current Production Notes
The production verification pass confirmed the core customer ordering,
kitchen, reception settlement, multi-customer billing, owner, CRM, RBAC,
and build flows.
Some areas require environment/browser verification rather than
code-only verification:
- Google OAuth requires a real interactive production test.
- Resend production delivery requires a verified sending domain.
- Physical QR scanning requires a real smartphone test.
- Reception alert dismissal must remain persistent and backend-backed
  if the alert system is changed.
These checks should be completed before treating the deployment as fully
validated for live café operations.
25. License
This project is currently maintained as a private application/project.
Add the intended proprietary or open-source license here if the
repository is later published.
QRDINE --- QR ordering, kitchen operations, reception billing, and
café management in one system.