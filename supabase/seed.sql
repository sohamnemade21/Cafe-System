-- SEED DATA FOR MULTI-TENANT PRODUCTION QR SYSTEM

-- 1. Insert Sample Cafes
INSERT INTO cafes (id, slug, name, tag_line, logo_url, address, phone, email, gst_number, currency, tax_rate, service_charge_rate)
VALUES 
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'roasted-bean',
  'The Roasted Bean Café',
  'Artisan Roasters & Gourmet Kitchen',
  'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200&auto=format&fit=crop&q=80',
  '42 Indiranagar 100ft Road, Bengaluru, KA 560038',
  '+91 98765 43210',
  'manager@roastedbean.in',
  '29AAAAA0000A1Z5',
  '₹',
  5.00,
  2.50
),
(
  'b1ffcd88-8b0a-3ef7-aa5c-5aa8ac270b22',
  'bella-italia',
  'Bella Italia Trattoria',
  'Authentic Wood-Fired Pizza & Handmade Pasta',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&auto=format&fit=crop&q=80',
  '18 Colaba Causeway, Mumbai, MH 400001',
  '+91 91234 56789',
  'bonjour@bellaitalia.in',
  '27BBBBB1111B2Z6',
  '₹',
  5.00,
  0.00
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Insert Staff / Users
INSERT INTO users (id, cafe_id, email, password_hash, full_name, role, phone)
VALUES
('u1111111-1111-1111-1111-111111111111', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'owner@roastedbean.in', '7b4e9f738b4c3e2182c0b2b8d0e8a719c23b2e59178ad381395b067d559bc81f', 'Vikramaditya Rao', 'CAFE_OWNER', '+91 98765 43210'),
('u4444444-4444-4444-4444-444444444444', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'reception@roastedbean.in', '7b4e9f738b4c3e2182c0b2b8d0e8a719c23b2e59178ad381395b067d559bc81f', 'Roasted Bean Cashier & Host Desk', 'RECEPTION', '+91 98765 43215'),
('u2222222-2222-2222-2222-222222222222', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'chef@roastedbean.in', '7b4e9f738b4c3e2182c0b2b8d0e8a719c23b2e59178ad381395b067d559bc81f', 'Chef Antonio', 'KITCHEN_STAFF', '+91 98765 43211'),
('u3333333-3333-3333-3333-333333333333', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'waiter@roastedbean.in', '7b4e9f738b4c3e2182c0b2b8d0e8a719c23b2e59178ad381395b067d559bc81f', 'Rahul Sharma', 'WAITER', '+91 98765 43212')
ON CONFLICT (email) DO NOTHING;

-- 3. Insert Tables for Roasted Bean
INSERT INTO tables (id, cafe_id, table_number, table_name, capacity, status)
VALUES
('t1111111-0000-0000-0000-000000000001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 1, 'Table 1 - Window Side', 2, 'FREE'),
('t1111111-0000-0000-0000-000000000002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 2, 'Table 2 - Indoor Cozy', 4, 'OCCUPIED'),
('t1111111-0000-0000-0000-000000000003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 3, 'Table 3 - Booth', 6, 'FREE'),
('t1111111-0000-0000-0000-000000000004', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 4, 'Table 4 - Garden Patio', 4, 'BILL_REQUESTED'),
('t1111111-0000-0000-0000-000000000005', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 5, 'Table 5 - VIP Lounge', 4, 'FREE')
ON CONFLICT DO NOTHING;

-- 4. Insert Menu Categories
INSERT INTO menu_categories (id, cafe_id, name, description, display_order)
VALUES
('c1111111-0000-0000-0000-000000000001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Specialty Coffee', 'Single-origin espresso & pour-over brews', 1),
('c1111111-0000-0000-0000-000000000002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Artisan Sandwiches', 'Sourdough toasties and gourmet paninis', 2),
('c1111111-0000-0000-0000-000000000003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Small Plates & Sides', 'Crispy truffled fries, dips & starters', 3),
('c1111111-0000-0000-0000-000000000004', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Desserts & Bakes', 'Freshly baked pastries and tarts', 4)
ON CONFLICT DO NOTHING;

-- 5. Insert Coupons
INSERT INTO coupons (id, cafe_id, code, description, discount_type, discount_value, minimum_order, status)
VALUES
('cp111111-0000-0000-0000-000000000001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'WELCOME20', '20% off on your first dine-in order', 'PERCENTAGE', 20.00, 300.00, 'ACTIVE'),
('cp111111-0000-0000-0000-000000000002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'FLAT50', 'Flat ₹50 off on orders above ₹400', 'FIXED', 50.00, 400.00, 'ACTIVE'),
('cp111111-0000-0000-0000-000000000003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'NEXTVISIT15', '15% off for our returning guests', 'PERCENTAGE', 15.00, 250.00, 'ACTIVE')
ON CONFLICT DO NOTHING;
