import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { hashPassword, createTableQrToken, verifyTableQrToken } from './auth.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export const supabaseServer: SupabaseClient | null = (SUPABASE_URL && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY))
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

if (supabaseServer) {
  console.log(`✅ Supabase PostgreSQL Client initialized (${SUPABASE_URL}) [Auth: ${SUPABASE_SERVICE_ROLE_KEY ? 'Service Role' : 'Anon'}]`);
} else {
  console.warn('⚠️ WARNING: Supabase is not configured. Real database persistence requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

export function getSupabaseServer(): SupabaseClient | null {
  return supabaseServer;
}

// ==========================================
// CORE DOMAIN TYPES
// ==========================================

export interface MenuItemVariant {
  id?: string;
  name: string;
  type: 'SIZE' | 'ROAST' | 'ADDON' | 'CRUST' | 'OPTION';
  additional_price: number;
  is_available: boolean;
}

export interface MenuItemRecord {
  id: string;
  cafe_id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  is_veg: boolean;
  is_spicy: boolean;
  is_bestseller: boolean;
  is_chef_special?: boolean;
  is_seasonal?: boolean;
  rating?: number;
  review_count?: number;
  calories?: number;
  pairings?: string[];
  is_available: boolean;
  preparation_time_minutes: number;
  display_order?: number;
  variants: MenuItemVariant[];
}

export interface CategoryRecord {
  id: string;
  cafe_id: string;
  name: string;
  description?: string;
  display_order: number;
  is_active: boolean;
}

export interface TableRecord {
  id: string;
  cafe_id: string;
  table_number: number;
  table_name: string;
  capacity: number;
  qr_code_url: string;
  qr_token?: string;
  status: 'FREE' | 'OCCUPIED' | 'RESERVED' | 'BILL_REQUESTED';
  current_order_id?: string;
}

export interface OrderItemRecord {
  id?: string;
  order_id?: string;
  menu_item_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  selected_variants_json: any[];
  item_notes?: string;
  subtotal: number;
}

export interface OrderRecord {
  id: string;
  cafe_id: string;
  table_session_id?: string;
  customer_session_token?: string;
  customer_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  table_id: string;
  table_number: number;
  items: OrderItemRecord[];
  subtotal: number;
  tax: number;
  service_charge: number;
  discount: number;
  coupon_code?: string;
  total: number;
  payment_status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'UNPAID' | 'PAYMENT_PENDING';
  order_status: 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SERVED' | 'COMPLETED' | 'CANCELLED';
  payment_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TableSessionRecord {
  id: string;
  cafe_id: string;
  table_id: string;
  table_number: number;
  session_token: string;
  status: 'ACTIVE' | 'CLOSED';
  orders: string[];
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  created_at: string;
  closed_at?: string;
}

export interface StaffUserRecord {
  id: string;
  user_id: string;
  cafe_id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: 'SUPER_ADMIN' | 'CAFE_OWNER' | 'MANAGER' | 'RECEPTION' | 'KITCHEN_STAFF' | 'WAITER';
  phone?: string;
  is_active: boolean;
}

// ==========================================
// AUTHORITATIVE INITIAL SEED DATA
// ==========================================

export const DEFAULT_CAFE_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
export const DEFAULT_CAFE_SLUG = 'roasted-bean';

export const INITIAL_STAFF_USERS: StaffUserRecord[] = [
  {
    id: 'usr-owner-admin',
    user_id: 'cafeOwnerAdmin',
    cafe_id: DEFAULT_CAFE_ID,
    email: 'owner@roastedbean.in',
    password_hash: hashPassword('HarborTable#Cafe27!'),
    full_name: 'Café Owner Admin',
    role: 'CAFE_OWNER',
    phone: '+91 98765 43210',
    is_active: true
  },
  {
    id: 'usr-kitchen-lead',
    user_id: 'kitchenLead',
    cafe_id: DEFAULT_CAFE_ID,
    email: 'kitchen@roastedbean.in',
    password_hash: hashPassword('Kitchen#Shift27!'),
    full_name: 'Kitchen Shift Lead',
    role: 'KITCHEN_STAFF',
    phone: '+91 98765 43211',
    is_active: true
  },
  {
    id: 'usr-service-desk',
    user_id: 'serviceDesk',
    cafe_id: DEFAULT_CAFE_ID,
    email: 'reception@roastedbean.in',
    password_hash: hashPassword('Service#Desk27!'),
    full_name: 'Service Desk Reception',
    role: 'RECEPTION',
    phone: '+91 98765 43212',
    is_active: true
  }
];

// Fallback in-memory cache for high-availability synchronization
export const memoryCache = {
  cafes: [
    {
      id: DEFAULT_CAFE_ID,
      slug: DEFAULT_CAFE_SLUG,
      name: 'The Roasted Bean Café',
      tag_line: 'Artisan Micro-Roastery & Gourmet Kitchen',
      logo_url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200&auto=format&fit=crop&q=80',
      address: '42 Indiranagar 100ft Road, Bengaluru, KA 560038',
      phone: '+91 98765 43210',
      email: 'hello@roastedbean.in',
      gst_number: '29AAAAA0000A1Z5',
      currency: '₹',
      tax_rate: 5.0,
      service_charge_rate: 2.5,
      is_active: true
    },
    {
      id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      slug: 'cafe-bella-italia',
      name: 'Bella Italia Trattoria',
      tag_line: 'Authentic Woodfired Pizza & Artisan Gelato',
      logo_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&auto=format&fit=crop&q=80',
      address: '12 Lavelle Road, Bengaluru, KA 560001',
      phone: '+91 98765 11223',
      email: 'ciao@bellaitalia.in',
      gst_number: '29BBBBB0000B1Z6',
      currency: '₹',
      tax_rate: 5.0,
      service_charge_rate: 5.0,
      is_active: true
    }
  ],
  categories: [
    { id: 'cat-coffee', cafe_id: DEFAULT_CAFE_ID, name: 'Specialty Coffee', description: 'Single-origin espresso & pour-over brews', display_order: 1, is_active: true },
    { id: 'cat-tea', cafe_id: DEFAULT_CAFE_ID, name: 'Artisan Tea', description: 'Hand-plucked whole leaf infusions & spiced chais', display_order: 2, is_active: true },
    { id: 'cat-bakery', cafe_id: DEFAULT_CAFE_ID, name: 'Bakery & Pastries', description: 'Fresh French brioches, croissants, and scones', display_order: 3, is_active: true },
    { id: 'cat-snacks', cafe_id: DEFAULT_CAFE_ID, name: 'Gourmet Bites & Toasts', description: 'Rustic sourdough toasts, fries, and light meals', display_order: 4, is_active: true },
    { id: 'cat-desserts', cafe_id: DEFAULT_CAFE_ID, name: 'Desserts & Bakes', description: 'House specialty espresso tiramisu and gelato', display_order: 5, is_active: true }
  ] as CategoryRecord[],
  menuItems: [
    {
      id: 'item-espresso',
      cafe_id: DEFAULT_CAFE_ID,
      category_id: 'cat-coffee',
      name: 'Single Origin Espresso',
      description: 'Intense, velvety extraction with notes of candied orange, dark cocoa, and hazelnut crema.',
      price: 160,
      image_url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=600&auto=format&fit=crop&q=80',
      is_veg: true,
      is_spicy: false,
      is_bestseller: false,
      is_chef_special: true,
      preparation_time_minutes: 3,
      is_available: true,
      variants: [
        { name: 'Solo (Single Shot)', type: 'SIZE', additional_price: 0, is_available: true },
        { name: 'Doppio (Double Shot)', type: 'SIZE', additional_price: 40, is_available: true }
      ]
    },
    {
      id: 'item-cappuccino',
      cafe_id: DEFAULT_CAFE_ID,
      category_id: 'cat-coffee',
      name: 'Artisan Velvet Cappuccino',
      description: 'Double shot Arabica espresso, textured silky microfoam, dusted with Dutch cocoa.',
      price: 240,
      image_url: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80',
      is_veg: true,
      is_spicy: false,
      is_bestseller: true,
      preparation_time_minutes: 5,
      is_available: true,
      variants: [
        { name: 'Regular (240ml)', type: 'SIZE', additional_price: 0, is_available: true },
        { name: 'Large (350ml)', type: 'SIZE', additional_price: 50, is_available: true },
        { name: 'Oat Milk Substitute', type: 'ADDON', additional_price: 45, is_available: true }
      ]
    },
    {
      id: 'item-latte',
      cafe_id: DEFAULT_CAFE_ID,
      category_id: 'cat-coffee',
      name: 'Creamy Cafe Latte',
      description: 'Smooth, light espresso enveloped in generous steamed farm milk with hand-poured rosetta latte art.',
      price: 250,
      image_url: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?w=600&auto=format&fit=crop&q=80',
      is_veg: true,
      is_spicy: false,
      is_bestseller: true,
      preparation_time_minutes: 5,
      is_available: true,
      variants: [
        { name: 'Regular (240ml)', type: 'SIZE', additional_price: 0, is_available: true },
        { name: 'Large (350ml)', type: 'SIZE', additional_price: 50, is_available: true }
      ]
    },
    {
      id: 'item-croissant',
      cafe_id: DEFAULT_CAFE_ID,
      category_id: 'cat-bakery',
      name: 'Butter Brioche Croissant',
      description: 'Flaky 72-layer laminated French pastry made with Normandy butter, baked fresh every morning.',
      price: 210,
      image_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80',
      is_veg: true,
      is_spicy: false,
      is_bestseller: true,
      preparation_time_minutes: 3,
      is_available: true,
      variants: []
    },
    {
      id: 'item-avotoast',
      cafe_id: DEFAULT_CAFE_ID,
      category_id: 'cat-snacks',
      name: 'Avocado Sourdough Tartine',
      description: 'Hass avocado mash, pickled shallots, feta crumble, toasted seeds on rustic country sourdough.',
      price: 360,
      image_url: 'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?w=600&auto=format&fit=crop&q=80',
      is_veg: true,
      is_spicy: false,
      is_bestseller: true,
      preparation_time_minutes: 8,
      is_available: true,
      variants: []
    },
    {
      id: 'item-tiramisu',
      cafe_id: DEFAULT_CAFE_ID,
      category_id: 'cat-desserts',
      name: 'House Special Espresso Tiramisu',
      description: 'Savoiardi ladyfingers soaked in our signature espresso, layered with whipped mascarpone & cocoa.',
      price: 340,
      image_url: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&auto=format&fit=crop&q=80',
      is_veg: true,
      is_spicy: false,
      is_bestseller: true,
      preparation_time_minutes: 4,
      is_available: true,
      variants: []
    }
  ] as MenuItemRecord[],
  tables: [
    { id: 'tbl-rb-1', cafe_id: DEFAULT_CAFE_ID, table_number: 1, table_name: 'Table 1 - Window Corner', capacity: 2, qr_code_url: '', status: 'FREE' },
    { id: 'tbl-rb-2', cafe_id: DEFAULT_CAFE_ID, table_number: 2, table_name: 'Table 2 - Indoor Lounge', capacity: 4, qr_code_url: '', status: 'FREE' },
    { id: 'tbl-rb-3', cafe_id: DEFAULT_CAFE_ID, table_number: 3, table_name: 'Table 3 - Central Booth', capacity: 6, qr_code_url: '', status: 'FREE' },
    { id: 'tbl-rb-4', cafe_id: DEFAULT_CAFE_ID, table_number: 4, table_name: 'Table 4 - Garden Patio', capacity: 4, qr_code_url: '', status: 'FREE' },
    { id: 'tbl-rb-5', cafe_id: DEFAULT_CAFE_ID, table_number: 5, table_name: 'Table 5 - VIP Lounge', capacity: 4, qr_code_url: '', status: 'FREE' },
    { id: 'tbl-rb-6', cafe_id: DEFAULT_CAFE_ID, table_number: 6, table_name: 'Table 6 - Espresso Bar', capacity: 2, qr_code_url: '', status: 'FREE' }
  ] as TableRecord[],
  tableSessions: [] as TableSessionRecord[],
  orders: [
    {
      id: 'ord-101',
      cafe_id: DEFAULT_CAFE_ID,
      table_session_id: 'ts-sample-101',
      customer_session_token: 'tok_sample_101',
      customer_id: 'cust-demo-1',
      customer_name: 'Aditi V',
      customer_email: 'aditi.v@example.com',
      table_id: 'tbl-rb-1',
      table_number: 1,
      items: [
        {
          id: 'oi-sample-101',
          menu_item_id: 'item-cappuccino',
          item_name: 'Artisan Velvet Cappuccino',
          unit_price: 240,
          quantity: 1,
          selected_variants_json: [],
          subtotal: 240
        }
      ],
      subtotal: 240,
      tax: 12,
      service_charge: 6,
      discount: 0,
      total: 258,
      payment_status: 'PAID',
      order_status: 'SERVED',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString()
    }
  ] as OrderRecord[],
  coupons: [
    { id: 'cp-welcome20', cafe_id: DEFAULT_CAFE_ID, code: 'WELCOME20', description: '20% off on your first dine-in order', discount_type: 'PERCENTAGE', discount_value: 20.0, minimum_order: 300.0, usage_limit: 500, usage_count: 0, status: 'ACTIVE' },
    { id: 'cp-flat50', cafe_id: DEFAULT_CAFE_ID, code: 'FLAT50', description: 'Flat ₹50 off on orders above ₹400', discount_type: 'FIXED', discount_value: 50.0, minimum_order: 400.0, usage_limit: 1000, usage_count: 0, status: 'ACTIVE' }
  ],
  customers: [
    {
      id: 'cust-demo-1',
      auth_user_id: 'auth-aditi-v',
      email: 'aditi.v@example.com',
      name: 'Aditi V',
      phone: '+91 98450 11223',
      profile_image: '',
      total_orders: 1,
      total_spent: 258,
      marketing: { email_marketing: true, sms_marketing: false, whatsapp_marketing: true },
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString()
    }
  ] as any[],
  invoices: [] as any[],
  notifications: [] as any[],
  auditLogs: [] as any[],
  staffUsers: [...INITIAL_STAFF_USERS]
};

// ==========================================
// QR CODE GENERATOR UTILITY (SECURE SIGNED TOKEN)
// ==========================================

export function getFrontendBaseUrl(explicitFrontendUrl?: string): string {
  // If an explicit URL is provided and it's a valid frontend URL (not backend), use it
  if (explicitFrontendUrl && !explicitFrontendUrl.includes(':3000') && !explicitFrontendUrl.includes('onrender.com/api')) {
    const clean = explicitFrontendUrl.trim().replace(/\/+$/, '');
    if (clean) return clean;
  }

  // Check environment variables
  const configured = (
    process.env.FRONTEND_URL ||
    process.env.VITE_APP_URL ||
    ''
  ).trim().replace(/\/+$/, '');

  if (configured && !configured.includes(':3000') && !configured.includes('onrender.com/api')) {
    return configured;
  }

  // Production must NEVER fall back to localhost
  if (process.env.NODE_ENV === 'production') {
    return 'https://cafe-system-jade.vercel.app';
  }

  return 'http://localhost:5173';
}

export async function generateTableQr(
  cafeId: string,
  cafeSlug: string,
  tableNumber: number,
  tableId: string,
  frontendUrl?: string
): Promise<{ qr_code_url: string; qr_token: string; qr_target_url: string }> {
  const base = getFrontendBaseUrl(frontendUrl);
  const qr_token = createTableQrToken({ cafeId, cafeSlug, tableNumber, tableId });
  const qr_target_url = `${base}/?mode=customer&qr=${qr_token}`;

  const qr_code_url = await QRCode.toDataURL(qr_target_url, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 400,
    color: {
      dark: '#1c1917',
      light: '#ffffff'
    }
  });

  return { qr_code_url, qr_token, qr_target_url };
}

export async function generateTableQrDataUrl(
  cafeSlug: string,
  tableNumber: number,
  frontendUrl?: string,
  tableId?: string,
  cafeId?: string
): Promise<string> {
  const result = await generateTableQr(
    cafeId || DEFAULT_CAFE_ID,
    cafeSlug,
    tableNumber,
    tableId || `tbl-${cafeSlug}-${tableNumber}`,
    frontendUrl
  );
  return result.qr_code_url;
}

// Generate QR codes for all initial tables
export async function ensureTableQRs(frontendUrl?: string) {
  for (const t of memoryCache.tables) {
    try {
      const { qr_code_url, qr_token } = await generateTableQr(DEFAULT_CAFE_ID, DEFAULT_CAFE_SLUG, t.table_number, t.id, frontendUrl);
      t.qr_code_url = qr_code_url;
      t.qr_token = qr_token;
    } catch (err) {
      console.error(`Failed to generate QR for table ${t.table_number}:`, err);
    }
  }
}

// ==========================================
// DATABASE INITIALIZATION & SEED VERIFICATION
// ==========================================

export async function initializeDatabase() {
  if (!supabaseServer) return;

  try {
    const { data: cafesFound, error } = await supabaseServer.from('cafes').select('id, slug').limit(1);

    if (error) {
      console.warn('ℹ️ Supabase schema pending. Run supabase/schema.sql in your Supabase SQL editor.');
      return;
    }

    if (!cafesFound || cafesFound.length === 0) {
      console.log('🌱 Populating Supabase with initial café data...');

      // 1. Cafe
      await supabaseServer.from('cafes').upsert({
        id: DEFAULT_CAFE_ID,
        slug: DEFAULT_CAFE_SLUG,
        name: 'The Roasted Bean Café',
        tag_line: 'Artisan Micro-Roastery & Gourmet Kitchen',
        logo_url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200&auto=format&fit=crop&q=80',
        address: '42 Indiranagar 100ft Road, Bengaluru, KA 560038',
        phone: '+91 98765 43210',
        email: 'hello@roastedbean.in',
        gst_number: '29AAAAA0000A1Z5',
        currency: '₹',
        tax_rate: 5.00,
        service_charge_rate: 2.50,
        is_active: true
      }, { onConflict: 'slug' });

      // 2. Initial Staff Users
      for (const staff of INITIAL_STAFF_USERS) {
        await supabaseServer.from('users').upsert({
          id: staff.id,
          cafe_id: DEFAULT_CAFE_ID,
          email: staff.email,
          password_hash: staff.password_hash,
          full_name: staff.full_name,
          role: staff.role,
          phone: staff.phone,
          is_active: true
        }, { onConflict: 'email' });
      }

      // 3. Initial 6 Tables
      for (const t of memoryCache.tables) {
        const qrUrl = await generateTableQrDataUrl(DEFAULT_CAFE_SLUG, t.table_number);
        await supabaseServer.from('tables').upsert({
          id: t.id,
          cafe_id: DEFAULT_CAFE_ID,
          table_number: t.table_number,
          table_name: t.table_name,
          capacity: t.capacity,
          qr_code_url: qrUrl,
          status: 'FREE'
        }, { onConflict: 'cafe_id,table_number' });
      }

      // 4. Categories
      for (const cat of memoryCache.categories) {
        await supabaseServer.from('menu_categories').upsert({
          id: cat.id,
          cafe_id: DEFAULT_CAFE_ID,
          name: cat.name,
          description: cat.description,
          display_order: cat.display_order,
          is_active: true
        });
      }

      // 5. Menu Items
      for (const item of memoryCache.menuItems) {
        await supabaseServer.from('menu_items').upsert({
          id: item.id,
          cafe_id: DEFAULT_CAFE_ID,
          category_id: item.category_id,
          name: item.name,
          description: item.description,
          price: item.price,
          image_url: item.image_url,
          is_veg: item.is_veg,
          is_spicy: item.is_spicy,
          is_bestseller: item.is_bestseller,
          preparation_time_minutes: item.preparation_time_minutes,
          is_available: true
        });
      }

      console.log('✅ Supabase tables and seed data synchronized successfully.');
    }
  } catch (err) {
    console.warn('Database initialization check:', err);
  }
}

// ==========================================
// PRODUCTION DATABASE REPOSITORY LAYER
// ==========================================

export const db = {
  // --- CAFES ---
  async getCafes() {
    if (supabaseServer) {
      const { data, error } = await supabaseServer.from('cafes').select('*').eq('is_active', true);
      if (!error && data && data.length > 0) return data;
    }
    return memoryCache.cafes.filter(c => c.is_active);
  },

  async getCafeBySlugOrId(identifier: string) {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    const cleanAlt = clean.startsWith('cafe-') ? clean.slice(5) : `cafe-${clean}`;

    if (supabaseServer) {
      const { data, error } = await supabaseServer
        .from('cafes')
        .select('*')
        .or(`slug.ilike.${clean},slug.ilike.${cleanAlt},id.eq.${identifier}`)
        .maybeSingle();
      if (!error && data) return data;
    }

    return memoryCache.cafes.find(
      c => c.slug.toLowerCase() === clean || c.slug.toLowerCase() === cleanAlt || c.id === identifier
    ) || null;
  },

  // --- MENU CATEGORIES ---
  async getCategories(cafeId: string) {
    const cafe = await this.getCafeBySlugOrId(cafeId);
    const targetId = cafe ? cafe.id : cafeId;

    if (supabaseServer) {
      const { data, error } = await supabaseServer
        .from('menu_categories')
        .select('*')
        .eq('cafe_id', targetId)
        .order('display_order', { ascending: true });
      if (!error && data) return data;
    }
    return memoryCache.categories.filter(c => c.cafe_id === targetId || c.cafe_id === cafe?.slug);
  },

  async createCategory(cafeId: string, data: { name: string; description?: string; display_order?: number }): Promise<CategoryRecord> {
    const cafe = await this.getCafeBySlugOrId(cafeId);
    const targetId = cafe ? cafe.id : cafeId;
    const newId = crypto.randomUUID();

    const newCat: CategoryRecord = {
      id: newId,
      cafe_id: targetId,
      name: data.name.trim(),
      description: data.description?.trim() || '',
      display_order: data.display_order || (memoryCache.categories.length + 1),
      is_active: true
    };

    if (supabaseServer) {
      const { data: created, error } = await supabaseServer
        .from('menu_categories')
        .insert({
          id: newCat.id,
          cafe_id: targetId,
          name: newCat.name,
          description: newCat.description,
          display_order: newCat.display_order,
          is_active: true
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create category in Supabase: ${error.message}`);
      if (created) return created;
    }

    memoryCache.categories.push(newCat);
    return newCat;
  },

  async updateCategory(id: string, updates: Partial<CategoryRecord>): Promise<CategoryRecord> {
    if (supabaseServer) {
      const { data, error } = await supabaseServer
        .from('menu_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update category: ${error.message}`);
      if (data) return data;
    }

    const cat = memoryCache.categories.find(c => c.id === id);
    if (!cat) throw new Error('Category not found');
    Object.assign(cat, updates);
    return cat;
  },

  async deleteCategory(id: string): Promise<boolean> {
    if (supabaseServer) {
      const { error } = await supabaseServer.from('menu_categories').delete().eq('id', id);
      if (error) throw new Error(`Failed to delete category: ${error.message}`);
    }
    const idx = memoryCache.categories.findIndex(c => c.id === id);
    if (idx !== -1) memoryCache.categories.splice(idx, 1);
    return true;
  },

  // --- MENU ITEMS ---
  async getMenuItems(cafeId: string) {
    const cafe = await this.getCafeBySlugOrId(cafeId);
    const targetId = cafe ? cafe.id : cafeId;

    if (supabaseServer) {
      const { data: items, error } = await supabaseServer
        .from('menu_items')
        .select('*, menu_item_variants(*)')
        .eq('cafe_id', targetId);

      if (!error && items) {
        return items.map((item: any) => ({
          ...item,
          variants: item.menu_item_variants || []
        }));
      }
    }

    return memoryCache.menuItems.filter(m => m.cafe_id === targetId || m.cafe_id === cafe?.slug);
  },

  async getMenuItemById(id: string): Promise<MenuItemRecord | null> {
    if (supabaseServer) {
      const { data, error } = await supabaseServer
        .from('menu_items')
        .select('*, menu_item_variants(*)')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return {
          ...data,
          variants: data.menu_item_variants || []
        };
      }
    }
    return memoryCache.menuItems.find(m => m.id === id) || null;
  },

  async createMenuItem(cafeId: string, itemData: any): Promise<MenuItemRecord> {
    const cafe = await this.getCafeBySlugOrId(cafeId);
    const targetId = cafe ? cafe.id : cafeId;
    const newId = crypto.randomUUID();

    const newItem: MenuItemRecord = {
      id: newId,
      cafe_id: targetId,
      category_id: itemData.category_id,
      name: itemData.name.trim(),
      description: itemData.description?.trim() || '',
      price: Number(itemData.price),
      image_url: itemData.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
      is_veg: Boolean(itemData.is_veg),
      is_spicy: Boolean(itemData.is_spicy),
      is_bestseller: Boolean(itemData.is_bestseller),
      preparation_time_minutes: Number(itemData.preparation_time_minutes) || 10,
      is_available: true,
      variants: itemData.variants || []
    };

    if (supabaseServer) {
      const { data: created, error } = await supabaseServer
        .from('menu_items')
        .insert({
          id: newItem.id,
          cafe_id: targetId,
          category_id: newItem.category_id,
          name: newItem.name,
          description: newItem.description,
          price: newItem.price,
          image_url: newItem.image_url,
          is_veg: newItem.is_veg,
          is_spicy: newItem.is_spicy,
          is_bestseller: newItem.is_bestseller,
          preparation_time_minutes: newItem.preparation_time_minutes,
          is_available: true
        })
        .select()
        .single();

      if (error) throw new Error(`Supabase error creating menu item: ${error.message}`);

      if (newItem.variants && newItem.variants.length > 0) {
        await supabaseServer.from('menu_item_variants').insert(
          newItem.variants.map((v: any) => ({
            id: crypto.randomUUID(),
            menu_item_id: newItem.id,
            name: v.name,
            type: v.type || 'SIZE',
            additional_price: Number(v.additional_price) || 0,
            is_available: true
          }))
        );
      }

      return { ...created, variants: newItem.variants };
    }

    memoryCache.menuItems.unshift(newItem);
    return newItem;
  },

  async updateMenuItem(id: string, updates: Partial<MenuItemRecord>): Promise<MenuItemRecord> {
    if (supabaseServer) {
      const { data, error } = await supabaseServer
        .from('menu_items')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(`Failed to update menu item: ${error.message}`);
      return data;
    }

    const item = memoryCache.menuItems.find(m => m.id === id);
    if (!item) throw new Error('Menu item not found');
    Object.assign(item, updates);
    return item;
  },

  async toggleMenuItemAvailability(id: string): Promise<MenuItemRecord> {
    const existing = await this.getMenuItemById(id);
    if (!existing) throw new Error('Menu item not found');

    const newStatus = !existing.is_available;
    return await this.updateMenuItem(id, { is_available: newStatus });
  },

  // --- TABLES & QR CODES ---
  async getTables(cafeId: string): Promise<TableRecord[]> {
    const cafe = await this.getCafeBySlugOrId(cafeId);
    const targetId = cafe ? cafe.id : cafeId;
    const targetSlug = cafe ? cafe.slug : DEFAULT_CAFE_SLUG;

    let tables: TableRecord[] = [];
    if (supabaseServer) {
      const { data, error } = await supabaseServer
        .from('tables')
        .select('*')
        .eq('cafe_id', targetId)
        .order('table_number', { ascending: true });

      if (!error && data) tables = data;
    }

    if (tables.length === 0) {
      tables = memoryCache.tables.filter(t => t.cafe_id === targetId || t.cafe_id === cafe?.slug);
    }

    // Ensure every table has a valid real QR data URL and secure token
    const enrichedTables: TableRecord[] = await Promise.all(
      tables.map(async (t) => {
        if (!t.qr_code_url || !t.qr_code_url.startsWith('data:image/') || !t.qr_token) {
          try {
            const { qr_code_url, qr_token } = await generateTableQr(targetId, targetSlug, t.table_number, t.id);
            t.qr_code_url = qr_code_url;
            t.qr_token = qr_token;
            // Best-effort update Supabase in background
            if (supabaseServer) {
              try {
                supabaseServer.from('tables').update({ qr_code_url }).eq('id', t.id).then(() => {}, () => {});
              } catch {}
            }
          } catch (err) {
            console.error(`Error generating QR for table ${t.table_number}:`, err);
          }
        }
        return t;
      })
    );

    return enrichedTables;
  },

  async createTable(cafeId: string, data: { table_number: number; table_name: string; capacity: number }): Promise<TableRecord> {
    const cafe = await this.getCafeBySlugOrId(cafeId);
    if (!cafe) throw new Error('Café not found');

    const existingTables = await this.getTables(cafe.id);
    const num = Number(data.table_number);
    if (existingTables.some(t => t.table_number === num)) {
      throw new Error(`Table #${num} already exists in this café`);
    }

    const newId = crypto.randomUUID();
    const { qr_code_url, qr_token } = await generateTableQr(cafe.id, cafe.slug, num, newId);

    const newTable: TableRecord = {
      id: newId,
      cafe_id: cafe.id,
      table_number: num,
      table_name: data.table_name?.trim() || `Table ${num}`,
      capacity: Number(data.capacity) || 4,
      qr_code_url,
      qr_token,
      status: 'FREE'
    };

    if (supabaseServer) {
      try {
        const { data: created, error } = await supabaseServer
          .from('tables')
          .insert({
            id: newTable.id,
            cafe_id: newTable.cafe_id,
            table_number: newTable.table_number,
            table_name: newTable.table_name,
            capacity: newTable.capacity,
            qr_code_url: newTable.qr_code_url,
            status: 'FREE'
          })
          .select()
          .single();

        if (!error && created) {
          const res = { ...created, qr_token };
          memoryCache.tables.push(res);
          return res;
        }
      } catch (err) {
        console.warn('Supabase table insert fallback to cache:', err);
      }
    }

    memoryCache.tables.push(newTable);
    return newTable;
  },

  async updateTable(id: string, updates: Partial<TableRecord>): Promise<TableRecord> {
    if (supabaseServer) {
      const { data, error } = await supabaseServer
        .from('tables')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update table: ${error.message}`);
      return data;
    }

    const table = memoryCache.tables.find(t => t.id === id || String(t.table_number) === id);
    if (!table) throw new Error('Table not found');
    Object.assign(table, updates);
    return table;
  },

  async regenerateTableQr(tableId: string): Promise<TableRecord> {
    const table = await this.updateTable(tableId, {});
    const cafe = await this.getCafeBySlugOrId(table.cafe_id);
    const cafeId = cafe?.id || table.cafe_id;
    const cafeSlug = cafe?.slug || DEFAULT_CAFE_SLUG;

    const { qr_code_url, qr_token } = await generateTableQr(cafeId, cafeSlug, table.table_number, table.id);
    const updated = await this.updateTable(tableId, { qr_code_url });
    return { ...updated, qr_token, qr_code_url };
  },

  // --- TABLE SESSIONS ---
  async getTableSession(tokenOrId: string): Promise<TableSessionRecord | null> {
    if (!tokenOrId) return null;

    if (supabaseServer) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tokenOrId);
      const query = isUuid
        ? supabaseServer.from('table_sessions').select('*').or(`id.eq.${tokenOrId},session_token.eq.${tokenOrId}`).maybeSingle()
        : supabaseServer.from('table_sessions').select('*').eq('session_token', tokenOrId).maybeSingle();

      const { data, error } = await query;

      if (!error && data) {
        const { data: ordersData } = await supabaseServer
          .from('orders')
          .select('id')
          .eq('table_session_id', data.id);
        return {
          ...data,
          orders: (ordersData || []).map((o: any) => o.id)
        };
      }
    }

    return memoryCache.tableSessions.find(s => s.session_token === tokenOrId || s.id === tokenOrId) || null;
  },

  async getActiveSessionForTable(cafeId: string, tableNumber: number): Promise<TableSessionRecord | null> {
    const cafe = await this.getCafeBySlugOrId(cafeId);
    const targetId = cafe ? cafe.id : cafeId;

    if (supabaseServer) {
      const { data, error } = await supabaseServer
        .from('table_sessions')
        .select('*')
        .eq('cafe_id', targetId)
        .eq('table_number', tableNumber)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const { data: ordersData } = await supabaseServer
          .from('orders')
          .select('id')
          .eq('table_session_id', data.id);
        return {
          ...data,
          orders: (ordersData || []).map((o: any) => o.id)
        };
      }
    }

    return memoryCache.tableSessions.slice().reverse().find(
      s => (s.cafe_id === targetId || s.cafe_id === cafe?.slug) && s.table_number === tableNumber && s.status === 'ACTIVE'
    ) || null;
  },

  async createTableSession(data: Omit<TableSessionRecord, 'id' | 'created_at'>): Promise<TableSessionRecord> {
    const newId = crypto.randomUUID();
    const session: TableSessionRecord = {
      id: newId,
      created_at: new Date().toISOString(),
      ...data
    };

    if (supabaseServer) {
      const { data: created, error } = await supabaseServer
        .from('table_sessions')
        .insert({
          id: session.id,
          cafe_id: session.cafe_id,
          table_id: session.table_id,
          table_number: session.table_number,
          session_token: session.session_token,
          status: session.status,
          total_amount: session.total_amount,
          paid_amount: session.paid_amount,
          outstanding_amount: session.outstanding_amount,
          created_at: session.created_at
        })
        .select()
        .single();

      if (!error && created) return { ...created, orders: [] };
    }

    memoryCache.tableSessions.push(session);
    return session;
  },

  async updateTableSession(id: string, updates: Partial<TableSessionRecord>): Promise<TableSessionRecord | null> {
    if (supabaseServer) {
      const { orders, ...dbUpdates } = updates;
      const { data, error } = await supabaseServer
        .from('table_sessions')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) return { ...data, orders: orders || [] };
    }

    const session = memoryCache.tableSessions.find(s => s.id === id);
    if (session) {
      Object.assign(session, updates);
    }
    return session || null;
  },

  // --- ORDERS ---
  async createOrder(orderData: OrderRecord): Promise<OrderRecord> {
    if (supabaseServer) {
      const { error: orderError } = await supabaseServer.from('orders').insert({
        id: orderData.id,
        cafe_id: orderData.cafe_id,
        table_session_id: orderData.table_session_id || null,
        customer_session_token: orderData.customer_session_token || null,
        customer_id: orderData.customer_id || null,
        table_id: orderData.table_id || null,
        table_number: orderData.table_number,
        subtotal: orderData.subtotal,
        tax: orderData.tax,
        service_charge: orderData.service_charge,
        discount: orderData.discount,
        coupon_code: orderData.coupon_code || null,
        total: orderData.total,
        payment_status: orderData.payment_status,
        order_status: orderData.order_status,
        payment_id: orderData.payment_id || null,
        notes: orderData.notes || null,
        created_at: orderData.created_at,
        updated_at: orderData.updated_at
      });

      if (orderError) {
        console.error('Supabase order insert error:', orderError);
        throw new Error(`Database error creating order: ${orderError.message}`);
      }

      if (orderData.items && orderData.items.length > 0) {
        await supabaseServer.from('order_items').insert(
          orderData.items.map(item => ({
            id: item.id || crypto.randomUUID(),
            order_id: orderData.id,
            menu_item_id: item.menu_item_id || null,
            item_name: item.item_name,
            unit_price: item.unit_price,
            quantity: item.quantity,
            selected_variants_json: item.selected_variants_json || [],
            item_notes: item.item_notes || null,
            subtotal: item.subtotal
          }))
        );
      }
    }

    memoryCache.orders.unshift(orderData);
    return orderData;
  },

  async getOrderById(id: string): Promise<OrderRecord | null> {
    if (supabaseServer) {
      const { data: order, error } = await supabaseServer
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', id)
        .maybeSingle();

      if (!error && order) {
        return {
          ...order,
          items: order.order_items || []
        };
      }
    }

    return memoryCache.orders.find(o => o.id === id) || null;
  },

  async getOrders(cafeId: string, filters: { tableSessionId?: string; tableNumber?: number; customerEmail?: string } = {}) {
    const cafe = await this.getCafeBySlugOrId(cafeId);
    const targetId = cafe ? cafe.id : cafeId;

    if (supabaseServer) {
      let query = supabaseServer
        .from('orders')
        .select('*, order_items(*)')
        .eq('cafe_id', targetId)
        .order('created_at', { ascending: false });

      if (filters.tableSessionId) query = query.eq('table_session_id', filters.tableSessionId);
      if (filters.tableNumber) query = query.eq('table_number', filters.tableNumber);

      const { data, error } = await query;
      if (!error && data) {
        return data.map((o: any) => ({
          ...o,
          items: o.order_items || []
        }));
      }
    }

    let filtered = memoryCache.orders.filter(o => o.cafe_id === targetId || o.cafe_id === cafe?.slug);
    if (filters.tableSessionId) filtered = filtered.filter(o => o.table_session_id === filters.tableSessionId);
    if (filters.tableNumber) filtered = filtered.filter(o => o.table_number === filters.tableNumber);
    if (filters.customerEmail) filtered = filtered.filter(o => o.customer_email?.toLowerCase() === filters.customerEmail?.toLowerCase());

    return filtered;
  },

  async updateOrderStatus(id: string, updates: Partial<OrderRecord>): Promise<OrderRecord | null> {
    if (supabaseServer) {
      const { data, error } = await supabaseServer
        .from('orders')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*, order_items(*)')
        .single();

      if (!error && data) {
        return {
          ...data,
          items: data.order_items || []
        };
      }
    }

    const order = memoryCache.orders.find(o => o.id === id);
    if (order) {
      Object.assign(order, updates, { updated_at: new Date().toISOString() });
    }
    return order || null;
  },

  async getOrdersByCustomer(emailOrAuthId: string) {
    if (!emailOrAuthId) return [];
    const lower = emailOrAuthId.trim().toLowerCase();

    if (supabaseServer) {
      const { data, error } = await supabaseServer
        .from('orders')
        .select('*, order_items(*)')
        .or(`customer_email.ilike.${lower},customer_id.eq.${emailOrAuthId}`)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map((o: any) => ({
          ...o,
          items: o.order_items || []
        }));
      }
    }

    return memoryCache.orders.filter(
      o => o.customer_email?.toLowerCase() === lower || o.customer_id === emailOrAuthId
    );
  },

  // --- INVOICES ---
  async createInvoice(invoiceData: { order_id: string; cafe_id: string; invoice_number: string; subtotal: number; tax: number; service_charge: number; discount: number; total: number; payment_method?: string; customer_name?: string; customer_email?: string; metadata_json?: any }) {
    const newInv = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...invoiceData
    };

    if (supabaseServer) {
      try {
        await supabaseServer.from('invoices').insert(newInv);
      } catch {}
    }

    memoryCache.invoices.unshift(newInv);
    return newInv;
  },

  async getInvoiceByOrderId(orderId: string) {
    if (supabaseServer) {
      const { data, error } = await supabaseServer
        .from('invoices')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();
      if (!error && data) return data;
    }

    return memoryCache.invoices.find(i => i.order_id === orderId) || null;
  },

  // --- STAFF USERS ---
  async getStaffUserByIdentifier(identifier: string): Promise<StaffUserRecord | null> {
    if (!identifier) return null;
    const lower = identifier.trim().toLowerCase();

    if (supabaseServer) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lower);
      const query = isUuid
        ? supabaseServer.from('users').select('*').or(`email.ilike.${lower},id.eq.${lower}`).eq('is_active', true).maybeSingle()
        : supabaseServer.from('users').select('*').ilike('email', lower).eq('is_active', true).maybeSingle();

      const { data, error } = await query;

      if (!error && data) {
        return {
          id: data.id,
          user_id: data.email?.split('@')[0] || data.id,
          cafe_id: data.cafe_id,
          email: data.email,
          password_hash: data.password_hash,
          full_name: data.full_name,
          role: data.role,
          phone: data.phone,
          is_active: data.is_active
        };
      }
    }

    return memoryCache.staffUsers.find(
      u => u.is_active && (u.user_id.toLowerCase() === lower || u.email.toLowerCase() === lower)
    ) || null;
  },

  // --- COUPONS ---
  async getCouponByCode(cafeId: string, code: string) {
    const cafe = await this.getCafeBySlugOrId(cafeId);
    const targetId = cafe ? cafe.id : cafeId;

    if (supabaseServer) {
      const { data, error } = await supabaseServer
        .from('coupons')
        .select('*')
        .eq('cafe_id', targetId)
        .ilike('code', code.trim())
        .eq('status', 'ACTIVE')
        .maybeSingle();
      if (!error && data) return data;
    }

    return memoryCache.coupons.find(
      c => (c.cafe_id === targetId || c.cafe_id === cafe?.slug) && c.code.toUpperCase() === code.trim().toUpperCase() && c.status === 'ACTIVE'
    ) || null;
  },

  // --- AUDIT LOGS ---
  async logAudit(entry: { cafe_id: string; user_id?: string; user_name?: string; role?: string; action: string; details?: any }) {
    const newLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry
    };

    if (supabaseServer) {
      await supabaseServer.from('audit_logs').insert({
        id: newLog.id,
        cafe_id: newLog.cafe_id,
        user_id: newLog.user_id || null,
        action: newLog.action,
        entity_type: 'SYSTEM',
        entity_id: newLog.cafe_id,
        details_json: newLog.details || {}
      });
    }

    memoryCache.auditLogs.unshift(newLog);
    return newLog;
  },

  // --- NOTIFICATIONS ---
  async getNotifications(cafeId: string) {
    const cafe = await this.getCafeBySlugOrId(cafeId);
    const targetId = cafe ? cafe.id : cafeId;

    if (supabaseServer) {
      const { data, error } = await supabaseServer
        .from('notifications')
        .select('*')
        .eq('cafe_id', targetId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) return data;
    }

    return memoryCache.notifications.filter(n => n.cafe_id === targetId || n.cafe_id === cafe?.slug);
  },

  async createNotification(notif: { cafe_id: string; table_id: string; table_number: number; type: string; message: string }) {
    const newNotif = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      is_read: false,
      ...notif
    };

    if (supabaseServer) {
      await supabaseServer.from('notifications').insert(newNotif);
    }

    memoryCache.notifications.unshift(newNotif);
    return newNotif;
  },

  // --- CUSTOMERS & CRM ---
  async syncCustomer(data: { auth_user_id?: string; email: string; name: string; phone?: string; profile_image?: string }) {
    const email = data.email.toLowerCase().trim();

    if (supabaseServer) {
      // Check if customer exists by email or auth_user_id
      const isAuthUuid = data.auth_user_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.auth_user_id);
      const { data: existing } = await supabaseServer
        .from('customers')
        .select('*')
        .or(`email.eq.${email}${isAuthUuid ? `,auth_user_id.eq.${data.auth_user_id}` : ''}`)
        .maybeSingle();

      if (existing) {
        const { data: updated, error } = await supabaseServer
          .from('customers')
          .update({
            name: data.name || existing.name,
            phone: data.phone || existing.phone,
            profile_image: data.profile_image || existing.profile_image,
            auth_user_id: isAuthUuid ? data.auth_user_id : existing.auth_user_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (!error && updated) return updated;
      } else {
        const newCustId = crypto.randomUUID();
        const { data: created, error } = await supabaseServer
          .from('customers')
          .insert({
            id: newCustId,
            auth_user_id: isAuthUuid ? data.auth_user_id : null,
            email,
            name: data.name,
            phone: data.phone || null,
            profile_image: data.profile_image || null,
            total_orders: 0,
            total_spent: 0
          })
          .select()
          .single();

        if (!error && created) return created;
      }
    }

    let existing = memoryCache.customers.find(
      c => c.email.toLowerCase() === email || (data.auth_user_id && c.auth_user_id === data.auth_user_id)
    );

    if (existing) {
      existing.name = data.name || existing.name;
      existing.phone = data.phone || existing.phone;
      existing.profile_image = data.profile_image || existing.profile_image;
      if (data.auth_user_id) existing.auth_user_id = data.auth_user_id;
      existing.updated_at = new Date().toISOString();
      return existing;
    }

    const newCust = {
      id: crypto.randomUUID(),
      auth_user_id: data.auth_user_id || undefined,
      email,
      name: data.name,
      phone: data.phone || '',
      profile_image: data.profile_image || '',
      total_orders: 0,
      total_spent: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    memoryCache.customers.push(newCust);
    return newCust;
  },

  async getCustomer(identifier: string) {
    if (!identifier) return null;
    const lower = identifier.trim().toLowerCase();

    if (supabaseServer) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      const query = isUuid
        ? supabaseServer.from('customers').select('*, marketing_consents(*)').or(`id.eq.${identifier},auth_user_id.eq.${identifier}`).maybeSingle()
        : supabaseServer.from('customers').select('*, marketing_consents(*)').ilike('email', lower).maybeSingle();

      const { data, error } = await query;
      if (!error && data) return data;
    }

    return memoryCache.customers.find(
      c => c.email.toLowerCase() === lower || c.id === identifier || c.auth_user_id === identifier
    ) || null;
  },

  async updateCustomer(identifier: string, updates: { name?: string; phone?: string; profile_image?: string }) {
    if (supabaseServer) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      const query = isUuid
        ? supabaseServer.from('customers').update({ ...updates, updated_at: new Date().toISOString() }).or(`id.eq.${identifier},auth_user_id.eq.${identifier}`).select().maybeSingle()
        : supabaseServer.from('customers').update({ ...updates, updated_at: new Date().toISOString() }).ilike('email', identifier.toLowerCase()).select().maybeSingle();

      const { data, error } = await query;
      if (!error && data) return data;
    }

    const cust = memoryCache.customers.find(
      c => c.email.toLowerCase() === identifier.toLowerCase() || c.id === identifier || c.auth_user_id === identifier
    );
    if (cust) {
      Object.assign(cust, updates, { updated_at: new Date().toISOString() });
      return cust;
    }
    throw new Error('Customer not found');
  },

  async updateCustomerMarketing(customerId: string, consent: { email_marketing?: boolean; sms_marketing?: boolean; whatsapp_marketing?: boolean }) {
    if (supabaseServer) {
      const { data: existing } = await supabaseServer
        .from('marketing_consents')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (existing) {
        await supabaseServer
          .from('marketing_consents')
          .update({
            ...consent,
            consent_timestamp: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await supabaseServer
          .from('marketing_consents')
          .insert({
            id: crypto.randomUUID(),
            customer_id: customerId,
            ...consent,
            consent_timestamp: new Date().toISOString()
          });
      }
    }
    return { success: true };
  },

  async getCoupons(cafeId: string) {
    const cafe = await this.getCafeBySlugOrId(cafeId);
    const targetId = cafe ? cafe.id : cafeId;

    if (supabaseServer) {
      const { data, error } = await supabaseServer
        .from('coupons')
        .select('*')
        .eq('cafe_id', targetId)
        .eq('status', 'ACTIVE');
      if (!error && data) return data;
    }

    return memoryCache.coupons.filter(c => c.cafe_id === targetId || c.cafe_id === cafe?.slug);
  },

  async getCustomersForCafe(cafeId: string) {
    const cafe = await this.getCafeBySlugOrId(cafeId);
    const targetId = cafe ? cafe.id : cafeId;
    const orders = await this.getOrders(targetId);

    let rawCustomers: any[] = [];
    if (supabaseServer) {
      const { data, error } = await supabaseServer
        .from('customers')
        .select('*, marketing_consents(*)');
      if (!error && data) {
        rawCustomers = data;
      }
    }

    if (rawCustomers.length === 0) {
      rawCustomers = memoryCache.customers;
    }

    // Build unique customer map by email and auth_user_id
    const customerMap = new Map<string, any>();

    for (const c of rawCustomers) {
      const email = c.email?.toLowerCase().trim();
      if (!email) continue;
      const consentObj = Array.isArray(c.marketing_consents) && c.marketing_consents.length > 0
        ? c.marketing_consents[0]
        : (c.marketing || {});

      customerMap.set(email, {
        id: c.id,
        auth_user_id: c.auth_user_id,
        name: c.name,
        email: c.email,
        phone: c.phone || '',
        profile_image: c.profile_image || '',
        total_orders: 0,
        total_spent: 0,
        last_order_id: null,
        last_order_date: null,
        last_table_number: null,
        marketing: {
          email_marketing: Boolean(consentObj.email_marketing),
          sms_marketing: Boolean(consentObj.sms_marketing),
          whatsapp_marketing: Boolean(consentObj.whatsapp_marketing)
        },
        created_at: c.created_at
      });
    }

    // Also include any customers who placed orders but might not have a separate customer row
    for (const o of orders) {
      const email = o.customer_email?.toLowerCase().trim();
      if (!email) continue;

      if (!customerMap.has(email)) {
        customerMap.set(email, {
          id: o.customer_id || `cust-${email}`,
          auth_user_id: o.customer_id,
          name: o.customer_name || email.split('@')[0],
          email: o.customer_email,
          phone: o.customer_phone || '',
          profile_image: '',
          total_orders: 0,
          total_spent: 0,
          last_order_id: null,
          last_order_date: null,
          last_table_number: null,
          marketing: {
            email_marketing: true,
            sms_marketing: false,
            whatsapp_marketing: true
          },
          created_at: o.created_at
        });
      }

      const entry = customerMap.get(email)!;
      if (o.order_status !== 'CANCELLED') {
        entry.total_orders += 1;
      }
      if (o.payment_status === 'PAID') {
        entry.total_spent = Number((entry.total_spent + o.total).toFixed(2));
      }

      const orderTime = new Date(o.created_at).getTime();
      const currentLastTime = entry.last_order_date ? new Date(entry.last_order_date).getTime() : 0;
      if (orderTime >= currentLastTime) {
        entry.last_order_id = o.id;
        entry.last_order_date = o.created_at;
        entry.last_table_number = o.table_number;
      }
    }

    return Array.from(customerMap.values());
  }
};
