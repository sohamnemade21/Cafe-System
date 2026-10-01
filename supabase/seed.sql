-- ==============================================================================
-- AUTHORITATIVE PRODUCTION SEED DATA FOR QRDINE CAFÉ SAAS
-- ==============================================================================

-- 1. Insert Master Roasted Bean Café
INSERT INTO cafes (id, slug, name, tag_line, logo_url, address, phone, email, gst_number, currency, tax_rate, service_charge_rate, is_active)
VALUES 
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'roasted-bean',
  'The Roasted Bean Café',
  'Artisan Roasters & Gourmet Kitchen',
  'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200&auto=format&fit=crop&q=80',
  '42 Indiranagar 100ft Road, Bengaluru, KA 560038',
  '+91 98765 43210',
  'hello@roastedbean.in',
  '29AAAAA0000A1Z5',
  '₹',
  5.00,
  2.50,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tag_line = EXCLUDED.tag_line,
  tax_rate = EXCLUDED.tax_rate,
  service_charge_rate = EXCLUDED.service_charge_rate;

-- 2. Insert Authoritative Staff Users (Owner, Kitchen Lead, Reception)
INSERT INTO users (id, cafe_id, email, password_hash, full_name, role, phone, is_active)
VALUES
(
  'a1111111-1111-1111-1111-111111111111',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'owner@roastedbean.in',
  'HarborTable#Cafe27!',
  'Café Owner Admin',
  'CAFE_OWNER',
  '+91 98765 43210',
  true
),
(
  'a2222222-2222-2222-2222-222222222222',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'kitchen@roastedbean.in',
  'Kitchen#Shift27!',
  'Kitchen Shift Lead',
  'KITCHEN_STAFF',
  '+91 98765 43211',
  true
),
(
  'a4444444-4444-4444-4444-444444444444',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'reception@roastedbean.in',
  'Service#Desk27!',
  'Service Desk Reception',
  'RECEPTION',
  '+91 98765 43212',
  true
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name;

-- 3. Insert Initial 6 Production Tables (Tables 1 - 6)
INSERT INTO tables (id, cafe_id, table_number, table_name, capacity, status)
VALUES
('b1111111-0000-0000-0000-000000000001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 1, 'Table 1 - Window Corner', 2, 'FREE'),
('b1111111-0000-0000-0000-000000000002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 2, 'Table 2 - Indoor Lounge', 4, 'FREE'),
('b1111111-0000-0000-0000-000000000003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 3, 'Table 3 - Central Booth', 6, 'FREE'),
('b1111111-0000-0000-0000-000000000004', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 4, 'Table 4 - Garden Patio', 4, 'FREE'),
('b1111111-0000-0000-0000-000000000005', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 5, 'Table 5 - VIP Lounge', 4, 'FREE'),
('b1111111-0000-0000-0000-000000000006', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 6, 'Table 6 - Espresso Bar', 2, 'FREE')
ON CONFLICT (cafe_id, table_number) DO NOTHING;

-- 4. Insert Menu Categories
INSERT INTO menu_categories (id, cafe_id, name, description, display_order, is_active)
VALUES
('c1111111-0000-0000-0000-000000000001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Specialty Coffee', 'Single-origin espresso & pour-over brews', 1, true),
('c1111111-0000-0000-0000-000000000002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Artisan Tea', 'Hand-plucked whole leaf infusions & spiced chais', 2, true),
('c1111111-0000-0000-0000-000000000003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Bakery & Pastries', 'Fresh French brioches, croissants, and morning pastries', 3, true),
('c1111111-0000-0000-0000-000000000004', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Gourmet Bites & Toasts', 'Rustic sourdough toasties, crisps, and artisan snacks', 4, true),
('c1111111-0000-0000-0000-000000000005', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Desserts & Bakes', 'House specialty espresso tiramisu and gelato', 5, true)
ON CONFLICT (id) DO NOTHING;

-- 5. Insert Core Menu Items
INSERT INTO menu_items (id, cafe_id, category_id, name, description, price, image_url, is_veg, is_spicy, is_bestseller, preparation_time_minutes, is_available)
VALUES
('d1111111-0000-0000-0000-000000000001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1111111-0000-0000-0000-000000000001', 'Single Origin Espresso', 'Intense, velvety extraction with notes of candied orange, dark cocoa, and hazelnut crema.', 160.00, 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=600&auto=format&fit=crop&q=80', true, false, false, 3, true),
('d1111111-0000-0000-0000-000000000002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1111111-0000-0000-0000-000000000001', 'Artisan Velvet Cappuccino', 'Double shot Arabica espresso, textured silky microfoam, dusted with Dutch cocoa.', 240.00, 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80', true, false, true, 5, true),
('d1111111-0000-0000-0000-000000000003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1111111-0000-0000-0000-000000000001', 'Creamy Cafe Latte', 'Smooth, light espresso enveloped in generous steamed farm milk with hand-poured rosetta latte art.', 250.00, 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?w=600&auto=format&fit=crop&q=80', true, false, true, 5, true),
('d1111111-0000-0000-0000-000000000004', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1111111-0000-0000-0000-000000000003', 'Butter Brioche Croissant', 'Flaky 72-layer laminated French pastry made with Normandy butter, baked fresh every morning.', 210.00, 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80', true, false, true, 3, true),
('d1111111-0000-0000-0000-000000000005', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1111111-0000-0000-0000-000000000004', 'Avocado Sourdough Tartine', 'Hass avocado mash, pickled shallots, feta crumble, toasted seeds on rustic country sourdough.', 360.00, 'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?w=600&auto=format&fit=crop&q=80', true, false, true, 8, true),
('d1111111-0000-0000-0000-000000000006', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1111111-0000-0000-0000-000000000005', 'House Special Espresso Tiramisu', 'Savoiardi ladyfingers soaked in our signature espresso, layered with whipped mascarpone & cocoa.', 340.00, 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&auto=format&fit=crop&q=80', true, false, true, 4, true)
ON CONFLICT (id) DO NOTHING;

-- 6. Insert Menu Variants
INSERT INTO menu_item_variants (id, menu_item_id, name, type, additional_price, is_available)
VALUES
('e1111111-0000-0000-0000-000000000001', 'd1111111-0000-0000-0000-000000000001', 'Solo (Single Shot)', 'SIZE', 0.00, true),
('e1111111-0000-0000-0000-000000000002', 'd1111111-0000-0000-0000-000000000001', 'Doppio (Double Shot)', 'SIZE', 40.00, true),
('e1111111-0000-0000-0000-000000000003', 'd1111111-0000-0000-0000-000000000002', 'Regular (240ml)', 'SIZE', 0.00, true),
('e1111111-0000-0000-0000-000000000004', 'd1111111-0000-0000-0000-000000000002', 'Large (350ml)', 'SIZE', 50.00, true),
('e1111111-0000-0000-0000-000000000005', 'd1111111-0000-0000-0000-000000000002', 'Oat Milk Substitute', 'ADDON', 45.00, true)
ON CONFLICT (id) DO NOTHING;

-- 7. Insert Active Coupons
INSERT INTO coupons (id, cafe_id, code, description, discount_type, discount_value, minimum_order, status)
VALUES
('cf111111-0000-0000-0000-000000000001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'WELCOME20', '20% off on your first dine-in order', 'PERCENTAGE', 20.00, 300.00, 'ACTIVE'),
('cf111111-0000-0000-0000-000000000002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'FLAT50', 'Flat ₹50 off on orders above ₹400', 'FIXED', 50.00, 400.00, 'ACTIVE')
ON CONFLICT (cafe_id, code) DO NOTHING;
