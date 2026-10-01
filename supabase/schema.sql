-- ==============================================================================
-- PRODUCTION QR CAFÉ ORDERING & MANAGEMENT SYSTEM - DATABASE SCHEMA
-- Target Database: Supabase PostgreSQL
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CAFES (Multi-Tenant Core)
CREATE TABLE IF NOT EXISTS cafes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    tag_line VARCHAR(255),
    logo_url TEXT,
    address TEXT,
    phone VARCHAR(32),
    email VARCHAR(255),
    gst_number VARCHAR(64),
    currency VARCHAR(8) DEFAULT '₹',
    tax_rate NUMERIC(5, 2) DEFAULT 5.00,          -- 5% GST
    service_charge_rate NUMERIC(5, 2) DEFAULT 0.00, -- optional service charge %
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USERS (Staff & Admin Roles)
CREATE TYPE user_role AS ENUM (
    'SUPER_ADMIN',
    'CAFE_OWNER',
    'MANAGER',
    'RECEPTION',
    'KITCHEN_STAFF',
    'WAITER'
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cafe_id UUID REFERENCES cafes(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'CAFE_OWNER',
    phone VARCHAR(32),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CUSTOMERS (Patrons)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE, -- linked to Supabase auth.users.id
    google_id VARCHAR(128) UNIQUE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(32),
    profile_image TEXT,
    total_orders INTEGER DEFAULT 0,
    total_spent NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MARKETING CONSENTS (GDPR / DPDP Compliance)
CREATE TABLE IF NOT EXISTS marketing_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    email_marketing BOOLEAN DEFAULT FALSE,
    sms_marketing BOOLEAN DEFAULT FALSE,
    whatsapp_marketing BOOLEAN DEFAULT FALSE,
    consent_timestamp TIMESTAMPTZ DEFAULT NOW(),
    unsubscribe_timestamp TIMESTAMPTZ
);

-- 5. TABLES (Dine-in Tables & QR Association)
CREATE TYPE table_status AS ENUM (
    'FREE',
    'OCCUPIED',
    'RESERVED',
    'BILL_REQUESTED'
);

CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    table_number INTEGER NOT NULL,
    table_name VARCHAR(64) NOT NULL,
    capacity INTEGER DEFAULT 4,
    qr_code_url TEXT,
    status table_status DEFAULT 'FREE',
    current_order_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cafe_id, table_number)
);

-- 5b. TABLE SESSIONS (Active dine-in sessions for table isolation & billing accuracy)
CREATE TABLE IF NOT EXISTS table_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    table_number INTEGER NOT NULL,
    session_token VARCHAR(128) NOT NULL UNIQUE,
    status VARCHAR(32) DEFAULT 'ACTIVE', -- 'ACTIVE', 'CLOSED'
    total_amount NUMERIC(10, 2) DEFAULT 0.00 CHECK (total_amount >= 0),
    paid_amount NUMERIC(10, 2) DEFAULT 0.00 CHECK (paid_amount >= 0),
    outstanding_amount NUMERIC(10, 2) DEFAULT 0.00 CHECK (outstanding_amount >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- 6. MENU CATEGORIES
CREATE TABLE IF NOT EXISTS menu_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. MENU ITEMS
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    image_url TEXT,
    is_veg BOOLEAN DEFAULT TRUE,
    is_spicy BOOLEAN DEFAULT FALSE,
    is_bestseller BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    preparation_time_minutes INTEGER DEFAULT 15,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. MENU ITEM VARIANTS & ADDONS
CREATE TYPE variant_type AS ENUM ('SIZE', 'ROAST', 'ADDON', 'CRUST', 'OPTION');

CREATE TABLE IF NOT EXISTS menu_item_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    type variant_type DEFAULT 'SIZE',
    additional_price NUMERIC(10, 2) DEFAULT 0.00 CHECK (additional_price >= 0),
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. ORDERS
CREATE TYPE order_status AS ENUM (
    'PENDING',
    'PAID',
    'ACCEPTED',
    'PREPARING',
    'READY',
    'SERVED',
    'COMPLETED',
    'CANCELLED'
);

CREATE TYPE payment_status AS ENUM (
    'PENDING',
    'PAID',
    'FAILED',
    'REFUNDED'
);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    table_session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
    customer_session_token VARCHAR(128),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
    table_number INTEGER NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    tax NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    service_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    coupon_code VARCHAR(64),
    total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
    payment_status payment_status DEFAULT 'PENDING',
    order_status order_status DEFAULT 'PENDING',
    payment_id VARCHAR(128),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. ORDER ITEMS
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    item_name VARCHAR(255) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    selected_variants_json JSONB DEFAULT '[]',
    item_notes TEXT,
    subtotal NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. PAYMENTS (Razorpay Transactions)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    razorpay_order_id VARCHAR(128) NOT NULL,
    razorpay_payment_id VARCHAR(128),
    razorpay_signature VARCHAR(256),
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(8) DEFAULT 'INR',
    status VARCHAR(32) DEFAULT 'PENDING',
    payment_method VARCHAR(64),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. INVOICES
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    invoice_number VARCHAR(64) UNIQUE NOT NULL,
    pdf_url TEXT,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(32),
    subtotal NUMERIC(10, 2) NOT NULL,
    tax NUMERIC(10, 2) NOT NULL,
    service_charge NUMERIC(10, 2) NOT NULL,
    discount NUMERIC(10, 2) NOT NULL,
    total NUMERIC(10, 2) NOT NULL,
    email_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. COUPONS (Loyalty Engine)
CREATE TYPE coupon_type AS ENUM ('PERCENTAGE', 'FIXED');

CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    code VARCHAR(64) NOT NULL,
    description TEXT,
    discount_type coupon_type DEFAULT 'PERCENTAGE',
    discount_value NUMERIC(10, 2) NOT NULL,
    minimum_order NUMERIC(10, 2) DEFAULT 0.00,
    expiry_date TIMESTAMPTZ,
    usage_limit INTEGER DEFAULT 100,
    usage_count INTEGER DEFAULT 0,
    status VARCHAR(32) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cafe_id, code)
);

-- 14. CUSTOMER COUPONS (Per-User Next-Visit Offers)
CREATE TABLE IF NOT EXISTS customer_coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. NOTIFICATIONS (Waiter Calls, Ready Alerts)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
    table_number INTEGER,
    type VARCHAR(64) NOT NULL, -- 'CALL_WAITER', 'REQUEST_BILL', 'NEW_ORDER', 'ORDER_READY'
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cafe_id UUID REFERENCES cafes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(128) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    details_json JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_tables_cafe ON tables(cafe_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_cafe ON table_sessions(cafe_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_table ON table_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_token ON table_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_menu_items_cafe ON menu_items(cafe_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_cafe ON orders(cafe_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(table_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_coupons_cafe_code ON coupons(cafe_id, code);
CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id ON customers(auth_user_id);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE cafes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_consents ENABLE ROW LEVEL SECURITY;

-- Anonymous patrons can read active cafes and menu items
CREATE POLICY "Public cafes read" ON cafes FOR SELECT USING (is_active = true);
CREATE POLICY "Public menu items read" ON menu_items FOR SELECT USING (is_available = true);
CREATE POLICY "Public tables read" ON tables FOR SELECT USING (true);
CREATE POLICY "Public table sessions active" ON table_sessions FOR SELECT USING (status = 'ACTIVE');

-- Customers can view their own orders via session or customer_id
CREATE POLICY "Customer view own orders" ON orders FOR SELECT USING (
    auth.uid() IN (SELECT auth_user_id FROM customers WHERE id = orders.customer_id)
);
CREATE POLICY "Customer insert own orders" ON orders FOR INSERT WITH CHECK (
    orders.customer_id IS NULL OR auth.uid() IN (SELECT auth_user_id FROM customers WHERE id = orders.customer_id)
);

-- Customers can view, insert, and update their own profile
CREATE POLICY "Customers view own profile" ON customers FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "Customers insert own profile" ON customers FOR INSERT WITH CHECK (auth.uid() = auth_user_id);
CREATE POLICY "Customers update own profile" ON customers FOR UPDATE USING (auth.uid() = auth_user_id);

-- Order Items RLS
CREATE POLICY "Customer view own order items" ON order_items FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE auth.uid() IN (SELECT auth_user_id FROM customers WHERE id = orders.customer_id))
);
CREATE POLICY "Customer insert order items" ON order_items FOR INSERT WITH CHECK (true);

-- Marketing Consents RLS
CREATE POLICY "Customer view own consents" ON marketing_consents FOR SELECT USING (
    customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
);
CREATE POLICY "Customer insert own consents" ON marketing_consents FOR INSERT WITH CHECK (
    customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
);
CREATE POLICY "Customer update own consents" ON marketing_consents FOR UPDATE USING (
    customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
);

-- Multi-Tenant Staff Access Policies
CREATE POLICY "Staff manage cafe orders" ON orders FOR ALL USING (
    cafe_id IN (SELECT cafe_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "Staff manage cafe menu" ON menu_items FOR ALL USING (
    cafe_id IN (SELECT cafe_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "Staff manage cafe tables" ON tables FOR ALL USING (
    cafe_id IN (SELECT cafe_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "Staff manage table sessions" ON table_sessions FOR ALL USING (
    cafe_id IN (SELECT cafe_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "Staff manage coupons" ON coupons FOR ALL USING (
    cafe_id IN (SELECT cafe_id FROM users WHERE id = auth.uid())
);
