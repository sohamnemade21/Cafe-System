import http from 'http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY).trim();

export const supabaseServer = (SUPABASE_URL && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY))
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

const app = express();
export const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).trim();

export function getRequestBaseUrl(req?: Request): string {
  if (req) {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || (req.secure ? 'https' : 'http');
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host');
    if (host) {
      return `${proto}://${host}`;
    }
  }
  return APP_URL;
}

const corsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-customer-token',
    'x-customer-session',
    'x-customer-email',
    'x-customer-auth-id',
    'x-staff-token',
    'x-requested-with',
    'Accept',
    'Origin'
  ]
};

app.set('trust proxy', 1);
app.disable('x-powered-by');

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (isProd) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// Health Check Endpoints (for container orchestration, load balancers, and monitoring)
app.get(['/health', '/api/health'], (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    supabaseConnected: Boolean(supabaseServer),
    version: '1.0.0'
  });
});

// ==========================================
// IN-MEMORY / PERSISTENT MULTI-TENANT STORE
// ==========================================

interface VariantOption {
  id: string;
  name: string;
  type: 'SIZE' | 'ROAST' | 'ADDON' | 'CRUST' | 'OPTION';
  additional_price: number;
  is_available: boolean;
}

interface MenuItemStore {
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
  variants: VariantOption[];
}

interface TableStore {
  id: string;
  cafe_id: string;
  table_number: number;
  table_name: string;
  capacity: number;
  qr_code_url: string;
  status: 'FREE' | 'OCCUPIED' | 'RESERVED' | 'BILL_REQUESTED';
  current_order_id?: string;
}

interface OrderStore {
  id: string;
  cafe_id: string;
  table_session_id?: string;
  customer_session_token?: string;
  customer_id?: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  table_id: string;
  table_number: number;
  items: any[];
  subtotal: number;
  tax: number;
  service_charge: number;
  discount: number;
  coupon_code?: string;
  total: number;
  payment_status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  order_status: 'PENDING' | 'PAID' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SERVED' | 'COMPLETED' | 'CANCELLED';
  payment_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface TableSessionStore {
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
  expires_at?: number;
}

interface StaffUserStore {
  id: string;
  user_id?: string;
  cafe_id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: 'SUPER_ADMIN' | 'CAFE_OWNER' | 'MANAGER' | 'RECEPTION' | 'KITCHEN_STAFF' | 'WAITER';
  phone?: string;
  is_active: boolean;
}

interface AuditLogStore {
  id: string;
  cafe_id: string;
  user_id?: string;
  user_name?: string;
  role?: string;
  action: string;
  details: any;
  timestamp: string;
}

interface CouponStore {
  id: string;
  cafe_id: string;
  code: string;
  description: string;
  discount_type: 'PERCENTAGE' | 'FIXED';
  discount_value: number;
  minimum_order: number;
  expiry_date?: string;
  usage_limit: number;
  usage_count: number;
  status: 'ACTIVE' | 'INACTIVE';
}

interface CustomerStore {
  id: string;
  auth_user_id?: string;
  google_id?: string;
  name: string;
  email: string;
  phone?: string;
  profile_image?: string;
  total_orders: number;
  total_spent: number;
  created_at: string;
}

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  type: 'INVOICE' | 'COUPON' | 'ORDER_CONFIRMATION';
  payload: any;
  sent_at: string;
}

// Initial Sample Data for Multi-Tenant Cafés
const cafes = [
  {
    id: 'cafe-roasted-bean',
    slug: 'roasted-bean',
    name: 'The Roasted Bean Café',
    tag_line: 'Artisan Micro-Roastery & Gourmet Bistro',
    logo_url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200&auto=format&fit=crop&q=80',
    address: '42 Indiranagar 100ft Road, Bengaluru, KA 560038',
    phone: '+91 98765 43210',
    email: 'hello@roastedbean.in',
    gst_number: '29AAAAA0000A1Z5',
    currency: '₹',
    tax_rate: 5.0, // 5% GST
    service_charge_rate: 2.5, // 2.5% service charge
    is_active: true,
  },
  {
    id: 'cafe-bella-italia',
    slug: 'bella-italia',
    name: 'Bella Italia Trattoria',
    tag_line: 'Authentic Neapolitan Wood-Fired Kitchen',
    logo_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&auto=format&fit=crop&q=80',
    address: '18 Colaba Causeway, Mumbai, MH 400001',
    phone: '+91 91234 56789',
    email: 'ciao@bellaitalia.in',
    gst_number: '27BBBBB1111B2Z6',
    currency: '₹',
    tax_rate: 5.0,
    service_charge_rate: 0.0,
    is_active: true,
  }
];

const categories = [
  { id: 'cat-coffee', cafe_id: 'cafe-roasted-bean', name: 'Coffee', description: 'Freshly roasted single-estate beans & handcrafted brews', display_order: 1, is_active: true },
  { id: 'cat-tea', cafe_id: 'cafe-roasted-bean', name: 'Tea', description: 'Artisanal whole leaves, spiced masala chais & iced brews', display_order: 2, is_active: true },
  { id: 'cat-bakery', cafe_id: 'cafe-roasted-bean', name: 'Bakery', description: 'Freshly baked French croissants, muffins & morning pastries', display_order: 3, is_active: true },
  { id: 'cat-snacks', cafe_id: 'cafe-roasted-bean', name: 'Snacks', description: 'Crisp fries, gourmet toasts, burgers & handcrafted pastas', display_order: 4, is_active: true },
  { id: 'cat-desserts', cafe_id: 'cafe-roasted-bean', name: 'Desserts', description: 'Decadent cakes, classic Italian tiramisu, waffles & gelato', display_order: 5, is_active: true },
  
  // Bella Italia categories
  { id: 'cat-pizza', cafe_id: 'cafe-bella-italia', name: 'Wood-Fired Pizza', description: 'Fermented 48 hours, San Marzano tomatoes', display_order: 1, is_active: true },
  { id: 'cat-pasta', cafe_id: 'cafe-bella-italia', name: 'Handcrafted Pasta', description: 'Rolled daily with semolina flour', display_order: 2, is_active: true },
  { id: 'cat-antipasti', cafe_id: 'cafe-bella-italia', name: 'Antipasti & Salads', description: 'Burrata, bruschetta & fresh greens', display_order: 3, is_active: true },
  { id: 'cat-dolci', cafe_id: 'cafe-bella-italia', name: 'Dolci', description: 'Classic tiramisu & gelato', display_order: 4, is_active: true },
];

const menuItems: MenuItemStore[] = [
  // --- COFFEE ---
  {
    id: 'item-espresso',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-coffee',
    name: 'Single Origin Espresso',
    description: 'Intense, velvety extraction with notes of candied orange, dark cocoa, and hazelnut crema.',
    price: 160,
    image_url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: false,
    is_chef_special: true,
    rating: 4.9,
    review_count: 88,
    calories: 5,
    is_available: true,
    preparation_time_minutes: 3,
    variants: [
      { id: 'v-esp-single', name: 'Solo (Single Shot)', type: 'SIZE', additional_price: 0, is_available: true },
      { id: 'v-esp-doppio', name: 'Doppio (Double Shot)', type: 'SIZE', additional_price: 40, is_available: true },
    ]
  },
  {
    id: 'item-americano',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-coffee',
    name: 'Artisan Americano',
    description: 'Double espresso shots poured over tempered mineral water, preserving the golden crema layer.',
    price: 190,
    image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: false,
    rating: 4.8,
    review_count: 112,
    calories: 10,
    is_available: true,
    preparation_time_minutes: 4,
    variants: [
      { id: 'v-amer-reg', name: 'Regular (240ml)', type: 'SIZE', additional_price: 0, is_available: true },
      { id: 'v-amer-lrg', name: 'Large (350ml)', type: 'SIZE', additional_price: 40, is_available: true },
      { id: 'v-amer-iced', name: 'Served Over Ice', type: 'OPTION', additional_price: 20, is_available: true },
    ]
  },
  {
    id: 'item-cappuccino',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-coffee',
    name: 'Artisan Velvet Cappuccino',
    description: 'Double shot Arabica espresso, textured silky microfoam, dusted with Dutch cocoa.',
    price: 240,
    image_url: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: true,
    is_chef_special: true,
    rating: 4.9,
    review_count: 340,
    calories: 130,
    is_available: true,
    preparation_time_minutes: 5,
    variants: [
      { id: 'v-cup-reg', name: 'Regular (240ml)', type: 'SIZE', additional_price: 0, is_available: true },
      { id: 'v-cup-lrg', name: 'Large (350ml)', type: 'SIZE', additional_price: 50, is_available: true },
      { id: 'v-oat-milk', name: 'Oat Milk Substitute', type: 'ADDON', additional_price: 45, is_available: true },
      { id: 'v-almond-milk', name: 'Almond Milk Substitute', type: 'ADDON', additional_price: 45, is_available: true },
      { id: 'v-extra-shot', name: 'Extra Espresso Shot', type: 'ADDON', additional_price: 40, is_available: true },
    ]
  },
  {
    id: 'item-latte',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-coffee',
    name: 'Creamy Cafe Latte',
    description: 'Smooth, light espresso enveloped in generous steamed farm milk with hand-poured rosetta latte art.',
    price: 250,
    image_url: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: true,
    rating: 4.9,
    review_count: 275,
    calories: 160,
    is_available: true,
    preparation_time_minutes: 5,
    variants: [
      { id: 'v-lat-reg', name: 'Regular (240ml)', type: 'SIZE', additional_price: 0, is_available: true },
      { id: 'v-lat-lrg', name: 'Large (350ml)', type: 'SIZE', additional_price: 50, is_available: true },
      { id: 'v-lat-vanilla', name: 'Madagascar Vanilla Syrup', type: 'ADDON', additional_price: 35, is_available: true },
      { id: 'v-lat-oat', name: 'Oat Milk Substitute', type: 'ADDON', additional_price: 45, is_available: true },
    ]
  },
  {
    id: 'item-mocha',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-coffee',
    name: 'Dark Chocolate Cafe Mocha',
    description: 'Rich espresso combined with 70% dark Belgian ganache, steamed milk, and light whipped cream.',
    price: 280,
    image_url: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: false,
    is_seasonal: true,
    rating: 4.8,
    review_count: 142,
    calories: 280,
    is_available: true,
    preparation_time_minutes: 6,
    variants: [
      { id: 'v-moc-reg', name: 'Regular (240ml)', type: 'SIZE', additional_price: 0, is_available: true },
      { id: 'v-moc-lrg', name: 'Large (350ml)', type: 'SIZE', additional_price: 50, is_available: true },
      { id: 'v-moc-marshmallow', name: 'Toasted Marshmallows', type: 'ADDON', additional_price: 35, is_available: true },
    ]
  },
  {
    id: 'item-flatwhite',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-coffee',
    name: 'Antipodean Flat White',
    description: 'Double ristretto blended with a thin, silky microfoam ribbon for a pure, robust coffee aroma.',
    price: 260,
    image_url: 'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: true,
    rating: 4.9,
    review_count: 198,
    calories: 120,
    is_available: true,
    preparation_time_minutes: 5,
    variants: [
      { id: 'v-fw-oat', name: 'Barista Oat Milk', type: 'ADDON', additional_price: 45, is_available: true },
      { id: 'v-fw-extra', name: 'Extra Ristretto Shot', type: 'ADDON', additional_price: 40, is_available: true },
    ]
  },
  {
    id: 'item-macchiato',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-coffee',
    name: 'Salted Caramel Macchiato',
    description: 'Vanilla-steamed milk stained with bold espresso shots, topped with hand-drizzled Himalayan salted caramel.',
    price: 270,
    image_url: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: true,
    rating: 4.8,
    review_count: 165,
    calories: 210,
    is_available: true,
    preparation_time_minutes: 5,
    variants: [
      { id: 'v-mac-caramel', name: 'Extra Caramel Drizzle', type: 'ADDON', additional_price: 30, is_available: true },
      { id: 'v-mac-iced', name: 'Served Over Ice', type: 'OPTION', additional_price: 20, is_available: true },
    ]
  },
  {
    id: 'item-coldcoffee',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-coffee',
    name: 'Classic Roastery Cold Coffee',
    description: 'Double espresso blended with cold fresh dairy milk, Madagascar vanilla, and crushed ice crystals.',
    price: 240,
    image_url: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: true,
    rating: 4.9,
    review_count: 420,
    calories: 220,
    is_available: true,
    preparation_time_minutes: 4,
    variants: [
      { id: 'v-cc-reg', name: 'Regular (350ml)', type: 'SIZE', additional_price: 0, is_available: true },
      { id: 'v-cc-lrg', name: 'Grande (500ml)', type: 'SIZE', additional_price: 60, is_available: true },
      { id: 'v-cc-icecream', name: 'Add Vanilla Ice Cream Scoop', type: 'ADDON', additional_price: 50, is_available: true },
      { id: 'v-cc-hazelnut', name: 'Roasted Hazelnut Syrup', type: 'ADDON', additional_price: 35, is_available: true },
    ]
  },
  {
    id: 'item-icedlatte',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-coffee',
    name: 'Spanish Iced Latte',
    description: 'Chilled espresso poured over sweet condensed milk, cold milk, and crystal ice cubes.',
    price: 265,
    image_url: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: true,
    rating: 4.9,
    review_count: 210,
    calories: 190,
    is_available: true,
    preparation_time_minutes: 4,
    variants: [
      { id: 'v-il-oat', name: 'Oat Milk Substitute', type: 'ADDON', additional_price: 45, is_available: true },
      { id: 'v-il-cinnamon', name: 'Ceylon Cinnamon Dust', type: 'ADDON', additional_price: 15, is_available: true },
    ]
  },
  {
    id: 'item-affogato',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-coffee',
    name: 'Artisan Affogato al Caffe',
    description: 'A generous scoop of Madagascar vanilla bean gelato drowned in a freshly extracted piping-hot double espresso.',
    price: 220,
    image_url: 'https://images.unsplash.com/photo-1592663527359-cf6642f54cff?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: false,
    is_chef_special: true,
    rating: 4.9,
    review_count: 95,
    calories: 180,
    is_available: true,
    preparation_time_minutes: 3,
    variants: [
      { id: 'v-aff-biscotti', name: 'Almond Biscotti Crumbs', type: 'ADDON', additional_price: 35, is_available: true },
    ]
  },

  // --- TEA ---
  {
    id: 'item-masalachai',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-tea',
    name: 'Kolkata Kadak Masala Chai',
    description: 'Full-bodied Assam CTC simmered with hand-pounded green cardamom, ginger, cinnamon, and farm milk.',
    price: 140,
    image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: true,
    rating: 4.9,
    review_count: 310,
    calories: 90,
    is_available: true,
    preparation_time_minutes: 6,
    variants: [
      { id: 'v-chai-kulhad', name: 'Traditional Clay Kulhad', type: 'OPTION', additional_price: 15, is_available: true },
      { id: 'v-chai-sugarfree', name: 'Stevia (Sugar-Free)', type: 'OPTION', additional_price: 0, is_available: true },
    ]
  },
  {
    id: 'item-greentea',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-tea',
    name: 'Himalayan Organic Green Tea',
    description: 'Whole leaf Darjeeling spring flush steeped gently, offering floral aromas and antioxidant sweetness.',
    price: 160,
    image_url: 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: false,
    rating: 4.7,
    review_count: 85,
    calories: 2,
    is_available: true,
    preparation_time_minutes: 4,
    variants: [
      { id: 'v-gt-honey', name: 'Pure Forest Honey Dipper', type: 'ADDON', additional_price: 25, is_available: true },
      { id: 'v-gt-mint', name: 'Fresh Mint Infusion', type: 'ADDON', additional_price: 20, is_available: true },
    ]
  },
  {
    id: 'item-lemontea',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-tea',
    name: 'Honey Ginger Lemon Tea',
    description: 'Steeped black tea infused with cold-pressed ginger juice, freshly squeezed lemon, and raw wild honey.',
    price: 170,
    image_url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: false,
    rating: 4.8,
    review_count: 120,
    calories: 45,
    is_available: true,
    preparation_time_minutes: 5,
    variants: []
  },
  {
    id: 'item-icedtea',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-tea',
    name: 'Peach & Passionfruit Iced Tea',
    description: 'Slow-brewed black tea shaken over ice with natural peach puree, passionfruit nectar, and mint leaves.',
    price: 190,
    image_url: 'https://images.unsplash.com/photo-1499638673689-79a0b5115d87?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: true,
    rating: 4.8,
    review_count: 175,
    calories: 95,
    is_available: true,
    preparation_time_minutes: 4,
    variants: [
      { id: 'v-it-large', name: 'Grande Jar (500ml)', type: 'SIZE', additional_price: 50, is_available: true },
      { id: 'v-it-boba', name: 'Mango Popping Boba', type: 'ADDON', additional_price: 40, is_available: true },
    ]
  },

  // --- BAKERY ---
  {
    id: 'item-croissant',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-bakery',
    name: 'French Normandy Butter Croissant',
    description: '72-layer laminated Viennoiserie baked with pure French butter, crispy golden exterior, airy honeycomb crumb.',
    price: 180,
    image_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: true,
    is_chef_special: true,
    rating: 4.9,
    review_count: 310,
    calories: 260,
    is_available: true,
    preparation_time_minutes: 3,
    variants: [
      { id: 'v-cr-jam', name: 'Artisan Strawberry Preserve', type: 'ADDON', additional_price: 30, is_available: true },
      { id: 'v-cr-nutella', name: 'Warm Nutella Ganache Dip', type: 'ADDON', additional_price: 45, is_available: true },
      { id: 'v-cr-cheese', name: 'Warm Cheddar Melt Inside', type: 'ADDON', additional_price: 50, is_available: true },
    ]
  },
  {
    id: 'item-chocmuffin',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-bakery',
    name: 'Belgian Molten Chocolate Muffin',
    description: 'Moist Dutch cocoa muffin filled with molten dark chocolate ganache, topped with Belgian dark chocolate buttons.',
    price: 190,
    image_url: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: false,
    rating: 4.8,
    review_count: 140,
    calories: 340,
    is_available: true,
    preparation_time_minutes: 2,
    variants: [
      { id: 'v-muf-warmed', name: 'Served Warm with Molten Core', type: 'OPTION', additional_price: 0, is_available: true },
    ]
  },
  {
    id: 'item-brownie',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-bakery',
    name: 'Kashmiri Walnut Fudgy Brownie',
    description: 'Dense, chewy cocoa brownie loaded with toasted Kashmiri walnuts and sea salt crystals.',
    price: 210,
    image_url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: true,
    rating: 4.9,
    review_count: 245,
    calories: 360,
    is_available: true,
    preparation_time_minutes: 3,
    variants: [
      { id: 'v-br-icecream', name: 'Scoop of Madagascar Vanilla Gelato', type: 'ADDON', additional_price: 50, is_available: true },
      { id: 'v-br-fudge', name: 'Hot Dark Chocolate Fudge Sauce', type: 'ADDON', additional_price: 35, is_available: true },
    ]
  },
  {
    id: 'item-cinnamonroll',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-bakery',
    name: 'Warm Cinnamon Brioche Roll',
    description: 'Fluffy brioche swirl packed with brown sugar Ceylon cinnamon butter and generous cream cheese glaze.',
    price: 200,
    image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: true,
    is_seasonal: true,
    rating: 4.9,
    review_count: 180,
    calories: 380,
    is_available: true,
    preparation_time_minutes: 3,
    variants: [
      { id: 'v-cin-extraicing', name: 'Double Cream Cheese Frosting', type: 'ADDON', additional_price: 35, is_available: true },
      { id: 'v-cin-pecans', name: 'Caramelized Roasted Pecans', type: 'ADDON', additional_price: 45, is_available: true },
    ]
  },
  {
    id: 'item-donut',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-bakery',
    name: 'Madagascar Glazed Donut',
    description: 'Light-as-air yeasted brioche donut dipped in real vanilla bean glaze with a delicate crackle finish.',
    price: 160,
    image_url: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: false,
    rating: 4.7,
    review_count: 110,
    calories: 240,
    is_available: true,
    preparation_time_minutes: 2,
    variants: []
  },
  {
    id: 'item-cheesecake',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-bakery',
    name: 'New York Baked Cheesecake',
    description: 'Ultra-creamy Philadelphia cream cheese baked to golden perfection over a crisp spiced graham cracker crust.',
    price: 320,
    image_url: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: true,
    is_chef_special: true,
    rating: 4.9,
    review_count: 220,
    calories: 410,
    is_available: true,
    preparation_time_minutes: 2,
    variants: [
      { id: 'v-ch-blueberry', name: 'Wild Blueberry Compote Top', type: 'ADDON', additional_price: 45, is_available: true },
      { id: 'v-ch-biscoff', name: 'Lotus Biscoff Crumble & Spread', type: 'ADDON', additional_price: 55, is_available: true },
    ]
  },

  // --- SNACKS ---
  {
    id: 'item-frenchfries',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-snacks',
    name: 'Crispy Shoestring Peri-Peri Fries',
    description: 'Golden double-crisped fries dusted with spicy African peri-peri seasoning, served with smoked garlic aioli.',
    price: 220,
    image_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: true,
    is_bestseller: true,
    rating: 4.8,
    review_count: 360,
    calories: 310,
    is_available: true,
    preparation_time_minutes: 8,
    variants: [
      { id: 'v-ff-large', name: 'Share Basket (+50% Quantity)', type: 'SIZE', additional_price: 80, is_available: true },
      { id: 'v-ff-cheese', name: 'Warm Melted Cheddar Drizzle', type: 'ADDON', additional_price: 50, is_available: true },
    ]
  },
  {
    id: 'item-garlicbread',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-snacks',
    name: 'Truffle & Mozzarella Garlic Bread',
    description: 'Toasted sourdough baguette brushed with confit garlic herb butter, bubbling mozzarella, and fresh parsley.',
    price: 240,
    image_url: 'https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: true,
    rating: 4.8,
    review_count: 190,
    calories: 290,
    is_available: true,
    preparation_time_minutes: 7,
    variants: [
      { id: 'v-gb-jalapeno', name: 'Pickled Jalapeño & Olive Topping', type: 'ADDON', additional_price: 35, is_available: true },
    ]
  },
  {
    id: 'item-sandwich',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-snacks',
    name: 'Grilled Pesto Bocconcini Panini',
    description: 'Crisp artisan panini pressed with Genovese basil pesto, vine-ripened tomatoes, buffalo bocconcini, and balsamic glaze.',
    price: 340,
    image_url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: true,
    is_chef_special: true,
    rating: 4.9,
    review_count: 215,
    calories: 390,
    is_available: true,
    preparation_time_minutes: 10,
    variants: [
      { id: 'v-sw-avocado', name: 'Add Fresh Hass Avocado', type: 'ADDON', additional_price: 60, is_available: true },
      { id: 'v-sw-glutenfree', name: 'Gluten-Free Bread', type: 'OPTION', additional_price: 45, is_available: true },
    ]
  },
  {
    id: 'item-burger',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-snacks',
    name: 'Artisan Brioche Truffle Burger',
    description: 'Crisp spiced herb & cheese patty, caramelized balsamic onions, melted English cheddar, and truffle mayo on toasted brioche.',
    price: 380,
    image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: true,
    rating: 4.8,
    review_count: 280,
    calories: 520,
    is_available: true,
    preparation_time_minutes: 12,
    variants: [
      { id: 'v-bg-double', name: 'Double Patty Melt', type: 'ADDON', additional_price: 90, is_available: true },
      { id: 'v-bg-friescombo', name: 'Add Side Peri Fries & Coke', type: 'ADDON', additional_price: 110, is_available: true },
    ]
  },
  {
    id: 'item-pasta',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-snacks',
    name: 'Creamy Wild Mushroom Penne',
    description: 'Al dente penne rigate tossed in velvety porcini & cremini mushroom cream, white truffle oil, and aged Grana Padano.',
    price: 420,
    image_url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: true,
    is_chef_special: true,
    rating: 4.9,
    review_count: 195,
    calories: 460,
    is_available: true,
    preparation_time_minutes: 12,
    variants: [
      { id: 'v-pa-garlicbread', name: 'Add 2x Garlic Bread Slices', type: 'ADDON', additional_price: 60, is_available: true },
      { id: 'v-pa-cheese', name: 'Extra Shaved Parmesan', type: 'ADDON', additional_price: 40, is_available: true },
    ]
  },
  {
    id: 'item-pizza',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-snacks',
    name: 'Wood-Fired Burrata Margherita',
    description: '48-hour fermented sourdough crust, San Marzano tomato sauce, fior di latte, sweet basil, and a fresh creamy burrata crown.',
    price: 490,
    image_url: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: true,
    is_chef_special: true,
    rating: 4.9,
    review_count: 310,
    calories: 680,
    is_available: true,
    preparation_time_minutes: 14,
    variants: [
      { id: 'v-pz-olives', name: 'Kalamata Olives & Sun-dried Tomato', type: 'ADDON', additional_price: 65, is_available: true },
      { id: 'v-pz-dip', name: 'Truffle Garlic Crust Dip', type: 'ADDON', additional_price: 40, is_available: true },
    ]
  },
  {
    id: 'item-nachos',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-snacks',
    name: 'Loaded Mexican Fiesta Nachos',
    description: 'Crispy stone-ground corn tortilla chips baked with warm cheddar queso, refried beans, jalapeños, pico de gallo, and sour cream.',
    price: 310,
    image_url: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: true,
    is_bestseller: false,
    rating: 4.7,
    review_count: 145,
    calories: 430,
    is_available: true,
    preparation_time_minutes: 9,
    variants: [
      { id: 'v-nc-guac', name: 'Fresh Hass Guacamole Dip', type: 'ADDON', additional_price: 75, is_available: true },
      { id: 'v-nc-cheese', name: 'Double Queso Melt', type: 'ADDON', additional_price: 55, is_available: true },
    ]
  },

  // --- DESSERTS ---
  {
    id: 'item-choccake',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-desserts',
    name: 'Belgian Dark Truffle Cake',
    description: 'Layers of moist chocolate sponge and 70% dark Belgian chocolate silk ganache, crowned with cocoa nib crisps.',
    price: 280,
    image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: true,
    rating: 4.9,
    review_count: 260,
    calories: 420,
    is_available: true,
    preparation_time_minutes: 2,
    variants: [
      { id: 'v-ck-icecream', name: 'Served with Vanilla Gelato', type: 'ADDON', additional_price: 50, is_available: true },
    ]
  },
  {
    id: 'item-tiramisu',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-desserts',
    name: 'Authentic Venetian Tiramisu',
    description: 'Savoiardi ladyfingers steeped in our double Arabica espresso, layered with whipped Italian mascarpone and Valrhona cocoa.',
    price: 340,
    image_url: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: true,
    is_chef_special: true,
    rating: 5.0,
    review_count: 380,
    calories: 390,
    is_available: true,
    preparation_time_minutes: 2,
    variants: []
  },
  {
    id: 'item-waffles',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-desserts',
    name: 'Golden Belgian Liege Waffles',
    description: 'Caramelized pearl sugar waffles served warm with Canadian maple syrup, fresh strawberries, and Chantilly cream.',
    price: 290,
    image_url: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: true,
    rating: 4.8,
    review_count: 170,
    calories: 440,
    is_available: true,
    preparation_time_minutes: 8,
    variants: [
      { id: 'v-wf-nutella', name: 'Warm Nutella Drizzle', type: 'ADDON', additional_price: 45, is_available: true },
      { id: 'v-wf-icecream', name: 'Madagascar Vanilla Scoop', type: 'ADDON', additional_price: 50, is_available: true },
    ]
  },
  {
    id: 'item-pancakes',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-desserts',
    name: 'Fluffy Blueberry Buttermilk Pancakes',
    description: 'Stack of 3 pillowy golden pancakes infused with fresh blueberries, whipped Normandy butter, and warm maple drizzle.',
    price: 290,
    image_url: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: false,
    rating: 4.8,
    review_count: 140,
    calories: 410,
    is_available: true,
    preparation_time_minutes: 9,
    variants: [
      { id: 'v-pc-banana', name: 'Caramelized Banana & Walnuts', type: 'ADDON', additional_price: 50, is_available: true },
    ]
  },
  {
    id: 'item-icecream',
    cafe_id: 'cafe-roasted-bean',
    category_id: 'cat-desserts',
    name: 'Artisanal Hand-Churned Gelato',
    description: 'Two generous scoops of dense, creamy Italian gelato. Choice of Bourbon Vanilla, Dark Cocoa, or Salted Butter Caramel.',
    price: 190,
    image_url: 'https://images.unsplash.com/photo-1560008581-09826d1de69e?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: false,
    rating: 4.8,
    review_count: 195,
    calories: 220,
    is_available: true,
    preparation_time_minutes: 2,
    variants: [
      { id: 'v-ic-wafflecone', name: 'Handmade Waffle Cone', type: 'OPTION', additional_price: 25, is_available: true },
      { id: 'v-ic-fudgeshot', name: 'Hot Fudge Ganache Pour', type: 'ADDON', additional_price: 35, is_available: true },
    ]
  },

  // --- BELLA ITALIA SPECIALS ---
  {
    id: 'item-margherita',
    cafe_id: 'cafe-bella-italia',
    category_id: 'cat-pizza',
    name: 'Classic Margherita D.O.P.',
    description: 'San Marzano tomato pulp, fior di latte mozzarella, fresh sweet basil, and extra virgin olive oil.',
    price: 495,
    image_url: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: false,
    is_bestseller: true,
    rating: 4.9,
    review_count: 310,
    calories: 650,
    is_available: true,
    preparation_time_minutes: 14,
    variants: [
      { id: 'v-burrata-top', name: 'Whole Burrata Crown', type: 'ADDON', additional_price: 180, is_available: true }
    ]
  },
  {
    id: 'item-cacio-pepe',
    cafe_id: 'cafe-bella-italia',
    category_id: 'cat-pasta',
    name: 'Tagliolini Cacio e Pepe',
    description: 'Fresh handmade egg pasta, Pecorino Romano, and toasted freshly crushed Tellicherry black peppercorns.',
    price: 520,
    image_url: 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=600&auto=format&fit=crop&q=80',
    is_veg: true,
    is_spicy: true,
    is_bestseller: true,
    rating: 4.9,
    review_count: 225,
    calories: 480,
    is_available: true,
    preparation_time_minutes: 15,
    variants: []
  }
];

const tables: TableStore[] = [
  { id: 'tbl-rb-1', cafe_id: 'cafe-roasted-bean', table_number: 1, table_name: 'Table 01 - Sunlit Window', capacity: 2, status: 'FREE', qr_code_url: '' },
  { id: 'tbl-rb-2', cafe_id: 'cafe-roasted-bean', table_number: 2, table_name: 'Table 02 - Cozy Corner', capacity: 4, status: 'FREE', qr_code_url: '' },
  { id: 'tbl-rb-3', cafe_id: 'cafe-roasted-bean', table_number: 3, table_name: 'Table 03 - Work Bench', capacity: 4, status: 'FREE', qr_code_url: '' },
  { id: 'tbl-rb-4', cafe_id: 'cafe-roasted-bean', table_number: 4, table_name: 'Table 04 - Garden Patio', capacity: 4, status: 'FREE', qr_code_url: '' },
  { id: 'tbl-rb-5', cafe_id: 'cafe-roasted-bean', table_number: 5, table_name: 'Table 05 - VIP Lounge', capacity: 6, status: 'FREE', qr_code_url: '' },

  // Bella Italia tables
  { id: 'tbl-bi-1', cafe_id: 'cafe-bella-italia', table_number: 1, table_name: 'Tavolo 1 - Piazza', capacity: 2, status: 'FREE', qr_code_url: '' },
  { id: 'tbl-bi-2', cafe_id: 'cafe-bella-italia', table_number: 2, table_name: 'Tavolo 2 - Wine Cellar', capacity: 4, status: 'FREE', qr_code_url: '' },
  { id: 'tbl-bi-3', cafe_id: 'cafe-bella-italia', table_number: 3, table_name: 'Tavolo 3 - Chef Counter', capacity: 2, status: 'FREE', qr_code_url: '' },
];

const coupons: CouponStore[] = [
  {
    id: 'cp-welcome20',
    cafe_id: 'cafe-roasted-bean',
    code: 'WELCOME20',
    description: '20% off on your first dine-in order above ₹300',
    discount_type: 'PERCENTAGE',
    discount_value: 20,
    minimum_order: 300,
    usage_limit: 100,
    usage_count: 8,
    status: 'ACTIVE'
  },
  {
    id: 'cp-flat50',
    cafe_id: 'cafe-roasted-bean',
    code: 'FLAT50',
    description: 'Flat ₹50 discount on orders above ₹400',
    discount_type: 'FIXED',
    discount_value: 50,
    minimum_order: 400,
    usage_limit: 500,
    usage_count: 24,
    status: 'ACTIVE'
  },
  {
    id: 'cp-coffee10',
    cafe_id: 'cafe-roasted-bean',
    code: 'COFFEE10',
    description: '10% off anytime for coffee lovers',
    discount_type: 'PERCENTAGE',
    discount_value: 10,
    minimum_order: 150,
    usage_limit: 1000,
    usage_count: 42,
    status: 'ACTIVE'
  },
  {
    id: 'cp-bella15',
    cafe_id: 'cafe-bella-italia',
    code: 'BELLA15',
    description: '15% off for authentic Italian dining',
    discount_type: 'PERCENTAGE',
    discount_value: 15,
    minimum_order: 600,
    usage_limit: 200,
    usage_count: 14,
    status: 'ACTIVE'
  }
];

const orders: OrderStore[] = [
  {
    id: 'ord-101',
    cafe_id: 'cafe-roasted-bean',
    customer_id: 'cust-demo-1',
    customer_name: 'Aditi Verma',
    customer_email: 'aditi.v@example.com',
    customer_phone: '+91 98450 11223',
    table_id: 'tbl-rb-1',
    table_number: 1,
    items: [
      {
        id: 'oi-1',
        order_id: 'ord-101',
        menu_item_id: 'item-cappuccino',
        item_name: 'Artisan Velvet Cappuccino',
        unit_price: 240,
        quantity: 1,
        selected_variants_json: [{ name: 'Regular (240ml)', additional_price: 0 }],
        item_notes: 'Oat milk if available',
        subtotal: 240
      },
      {
        id: 'oi-2',
        order_id: 'ord-101',
        menu_item_id: 'item-avocadotoast',
        item_name: 'Truffle Hass Avocado Toast',
        unit_price: 380,
        quantity: 1,
        selected_variants_json: [{ name: 'Add Free-Range Poached Egg', additional_price: 45 }],
        item_notes: 'Extra crispy sourdough',
        subtotal: 425
      }
    ],
    table_session_id: 'ts-rb-1-demo',
    customer_session_token: 'tok-rb-1-patron',
    subtotal: 665,
    tax: 33.25,
    service_charge: 16.63,
    discount: 0,
    coupon_code: undefined,
    total: 714.88,
    payment_status: 'PAID',
    order_status: 'COMPLETED',
    payment_id: 'pay_demo_101',
    notes: 'Near the plug point',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 1).toISOString()
  },
  {
    id: 'ord-104',
    cafe_id: 'cafe-roasted-bean',
    table_session_id: 'ts-rb-4-demo',
    customer_session_token: 'tok-rb-4-patron',
    customer_id: 'cust-demo-2',
    customer_name: 'Karan Mehra',
    customer_email: 'karan.m@example.com',
    customer_phone: '+91 98111 22334',
    table_id: 'tbl-rb-4',
    table_number: 4,
    items: [
      {
        id: 'oi-4-1',
        order_id: 'ord-104',
        menu_item_id: 'item-cappuccino',
        item_name: 'Artisan Velvet Cappuccino',
        unit_price: 240,
        quantity: 1,
        selected_variants_json: [{ name: 'Regular (240ml)', additional_price: 0 }],
        item_notes: 'Cinnamon dust on top',
        subtotal: 240
      },
      {
        id: 'oi-4-2',
        order_id: 'ord-104',
        menu_item_id: 'item-croissant',
        item_name: 'French Butter Croissant',
        unit_price: 180,
        quantity: 1,
        selected_variants_json: [],
        item_notes: 'Warm it up please',
        subtotal: 180
      }
    ],
    subtotal: 420,
    tax: 21,
    service_charge: 10.5,
    discount: 0,
    coupon_code: undefined,
    total: 451.5,
    payment_status: 'PENDING',
    order_status: 'SERVED',
    notes: 'Table 4 requested paper bill invoice at reception',
    created_at: new Date(Date.now() - 1800000).toISOString(),
    updated_at: new Date(Date.now() - 600000).toISOString()
  }
];

const customers: CustomerStore[] = [
  {
    id: 'cust-demo-1',
    google_id: 'g-1001',
    name: 'Aditi Verma',
    email: 'aditi.v@example.com',
    phone: '+91 98450 11223',
    profile_image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    total_orders: 1,
    total_spent: 714.88,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString()
  },
  {
    id: 'cust-demo-2',
    name: 'Karan Mehra',
    email: 'karan.m@example.com',
    phone: '+91 98111 22334',
    total_orders: 1,
    total_spent: 0,
    created_at: new Date(Date.now() - 1800000).toISOString()
  }
];

const marketingConsents: Record<string, any> = {
  'cust-demo-1': {
    customer_id: 'cust-demo-1',
    email_marketing: true,
    sms_marketing: false,
    whatsapp_marketing: true,
    consent_timestamp: new Date().toISOString()
  }
};

const emailLogs: EmailLog[] = [];
const notifications: any[] = [
  {
    id: 'notif-seed-bill-4',
    cafe_id: 'cafe-roasted-bean',
    table_id: 'tbl-rb-4',
    table_number: 4,
    type: 'REQUEST_BILL',
    message: 'Table 4 requested their bill invoice. Outstanding: ₹451.50',
    is_read: false,
    is_resolved: false,
    created_at: new Date(Date.now() - 600000).toISOString()
  }
];

// ==========================================
// SECURITY, SESSIONS & RECEPTION SUBSYSTEM
// ==========================================
const SESSION_SECRET = process.env.SESSION_SECRET || 'qrdine-super-secure-production-hmac-key-2026';

function hashPassword(password: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(password).digest('hex');
}

function verifyPassword(inputPassword: string, storedHash: string): boolean {
  if (!inputPassword || !storedHash) return false;
  return hashPassword(inputPassword) === storedHash;
}

interface StaffTokenPayload {
  userId: string;
  email: string;
  role: 'SUPER_ADMIN' | 'CAFE_OWNER' | 'MANAGER' | 'RECEPTION' | 'KITCHEN_STAFF' | 'WAITER';
  cafeId: string;
  fullName: string;
  exp: number;
}

function createStaffToken(user: StaffUserStore): string {
  const payload: StaffTokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    cafeId: user.cafe_id,
    fullName: user.full_name,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyStaffToken(token: string): StaffTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload: StaffTokenPayload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export interface VerifiedCustomer {
  authUserId: string;
  email: string;
  name?: string;
}

const verifiedCustomerCache = new Map<string, { user: VerifiedCustomer; exp: number }>();

export async function verifyCustomerAuth(req: Request): Promise<VerifiedCustomer | null> {
  let token = '';
  if (typeof req.headers['x-customer-token'] === 'string' && req.headers['x-customer-token'].trim()) {
    token = req.headers['x-customer-token'].trim();
  } else {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const raw = authHeader.slice(7).trim();
      if (!verifyStaffToken(raw)) {
        token = raw;
      }
    }
  }

  if (!token) return null;

  const cached = verifiedCustomerCache.get(token);
  if (cached && cached.exp > Date.now()) {
    return cached.user;
  }

  if (!supabaseServer) return null;

  try {
    const { data, error } = await supabaseServer.auth.getUser(token);
    const user = data?.user;
    if (!user || !user.email) {
      return null;
    }
    const userEmail = user.email.toLowerCase().trim();
    const verified: VerifiedCustomer = {
      authUserId: user.id,
      email: userEmail,
      name: user.user_metadata?.full_name || user.user_metadata?.name || userEmail.split('@')[0],
    };
    verifiedCustomerCache.set(token, { user: verified, exp: Date.now() + 60 * 1000 });
    return verified;
  } catch (err) {
    console.error('Failed to verify Supabase customer token:', err);
    return null;
  }
}

// Pre-seeded multi-tenant staff credentials
const staffUsers: StaffUserStore[] = [
  // Master Portal Credentials (per specification)
  {
    id: 'staff-owner-admin',
    user_id: 'cafeOwnerAdmin',
    cafe_id: 'cafe-roasted-bean',
    email: 'cafeOwnerAdmin@roastedbean.in',
    password_hash: hashPassword('HarborTable#Cafe27!'),
    full_name: 'Café Owner Administrator',
    role: 'CAFE_OWNER',
    phone: '+91 98765 43210',
    is_active: true
  },
  {
    id: 'staff-kitchen-lead',
    user_id: 'kitchenLead',
    cafe_id: 'cafe-roasted-bean',
    email: 'kitchenLead@roastedbean.in',
    password_hash: hashPassword('Kitchen#Shift27!'),
    full_name: 'Kitchen Shift Lead',
    role: 'KITCHEN_STAFF',
    phone: '+91 98765 43211',
    is_active: true
  },
  {
    id: 'staff-service-desk',
    user_id: 'serviceDesk',
    cafe_id: 'cafe-roasted-bean',
    email: 'serviceDesk@roastedbean.in',
    password_hash: hashPassword('Service#Desk27!'),
    full_name: 'Front Service Desk',
    role: 'RECEPTION',
    phone: '+91 98765 43215',
    is_active: true
  },
  // Roasted Bean Staff
  {
    id: 'staff-rb-rec',
    cafe_id: 'cafe-roasted-bean',
    email: 'reception@roastedbean.in',
    password_hash: hashPassword('Bean@Reception2026!'),
    full_name: 'Pooja Nair (Cashier & Front Desk)',
    role: 'RECEPTION',
    phone: '+91 98765 43215',
    is_active: true
  },
  {
    id: 'staff-rb-owner',
    cafe_id: 'cafe-roasted-bean',
    email: 'owner@roastedbean.in',
    password_hash: hashPassword('Bean@Owner2026!'),
    full_name: 'Vikramaditya Rao (Owner)',
    role: 'CAFE_OWNER',
    phone: '+91 98765 43210',
    is_active: true
  },
  {
    id: 'staff-rb-kds',
    cafe_id: 'cafe-roasted-bean',
    email: 'kitchen@roastedbean.in',
    password_hash: hashPassword('Bean@Kitchen2026!'),
    full_name: 'Chef Antonio (Barista & Head Cook)',
    role: 'KITCHEN_STAFF',
    phone: '+91 98765 43211',
    is_active: true
  },
  // Bella Italia Staff
  {
    id: 'staff-bi-rec',
    cafe_id: 'cafe-bella-italia',
    email: 'reception@bellaitalia.in',
    password_hash: hashPassword('Bella@Reception2026!'),
    full_name: 'Chiara Rossi (Host & Billing)',
    role: 'RECEPTION',
    phone: '+91 91234 56788',
    is_active: true
  },
  {
    id: 'staff-bi-owner',
    cafe_id: 'cafe-bella-italia',
    email: 'owner@bellaitalia.in',
    password_hash: hashPassword('Bella@Owner2026!'),
    full_name: 'Gianluigi Rossi (Owner)',
    role: 'CAFE_OWNER',
    phone: '+91 91234 56789',
    is_active: true
  },
  {
    id: 'staff-bi-kds',
    cafe_id: 'cafe-bella-italia',
    email: 'kitchen@bellaitalia.in',
    password_hash: hashPassword('Bella@Kitchen2026!'),
    full_name: 'Chef Mario (Pizzaiolo)',
    role: 'KITCHEN_STAFF',
    phone: '+91 91234 56780',
    is_active: true
  }
];

// Active Table Sessions
const tableSessions: TableSessionStore[] = [
  {
    id: 'ts-rb-1-demo',
    cafe_id: 'cafe-roasted-bean',
    table_id: 'tbl-rb-1',
    table_number: 1,
    session_token: 'tok-rb-1-seed-session',
    status: 'CLOSED',
    orders: ['ord-101'],
    total_amount: 714.88,
    paid_amount: 714.88,
    outstanding_amount: 0,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    closed_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'ts-rb-4-demo',
    cafe_id: 'cafe-roasted-bean',
    table_id: 'tbl-rb-4',
    table_number: 4,
    session_token: 'tok-rb-4-seed-session',
    status: 'ACTIVE',
    orders: ['ord-104'],
    total_amount: 451.5,
    paid_amount: 0,
    outstanding_amount: 451.5,
    created_at: new Date(Date.now() - 1800000).toISOString()
  }
];

// Track recent submissions to prevent duplicate clicks and race condition submissions
const recentOrderSubmissions = new Map<string, { order: OrderStore; timestamp: number }>();
const idempotencyOrdersMap = new Map<string, OrderStore>();

const auditLogs: AuditLogStore[] = [
  {
    id: 'audit-init-1',
    cafe_id: 'cafe-roasted-bean',
    user_name: 'System Security Engine',
    role: 'SUPER_ADMIN',
    action: 'SECURITY_AUDIT_INIT',
    details: { message: 'Multi-tenant table isolation and reception security initialized.' },
    timestamp: new Date().toISOString()
  }
];

function recalculateTableSession(session: TableSessionStore): TableSessionStore {
  const sessionOrders = orders.filter(
    o => (o.table_session_id === session.id || session.orders.includes(o.id)) && o.order_status !== 'CANCELLED'
  );

  session.orders = Array.from(new Set([...session.orders, ...sessionOrders.map(o => o.id)]));

  let totalBilled = 0;
  let totalPaid = 0;

  for (const o of sessionOrders) {
    totalBilled += o.total;
    if (o.payment_status === 'PAID') {
      totalPaid += o.total;
    }
  }

  session.total_amount = Number(totalBilled.toFixed(2));
  session.paid_amount = Number(totalPaid.toFixed(2));
  session.outstanding_amount = Math.max(0, Number((totalBilled - totalPaid).toFixed(2)));

  return session;
}

function parseStaffAuth(req: Request): StaffTokenPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return verifyStaffToken(token);
}

function requireStaffAuth(allowedRoles?: string[]) {
  return (req: Request, res: Response, next: Function) => {
    const payload = parseStaffAuth(req);
    if (!payload) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Staff authentication required' });
    }

    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(payload.role) && payload.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: `Forbidden: Requires role in [${allowedRoles.join(', ')}]` });
    }

    const cafeIdParam = req.params.cafeId;
    if (cafeIdParam) {
      const cafe = cafes.find(c => c.slug === cafeIdParam || c.id === cafeIdParam);
      if (cafe && payload.role !== 'SUPER_ADMIN' && payload.cafeId !== cafe.id) {
        return res.status(403).json({ success: false, error: 'Forbidden: You do not have permission for this café' });
      }
    }

    (req as any).staffUser = payload;
    next();
  };
}

async function canAccessOrder(order: OrderStore, req: Request): Promise<boolean> {
  // 1. Staff access
  const staff = parseStaffAuth(req);
  if (staff) {
    if (staff.role === 'SUPER_ADMIN' || staff.cafeId === order.cafe_id) {
      return true;
    }
  }

  // 2. Table Session access (for active dine-in table sessions)
  const custSession = (req.headers['x-customer-session'] as string) || (req.query.session_token as string);
  if (custSession && order.customer_session_token && custSession === order.customer_session_token) {
    return true;
  }
  if (custSession && order.table_session_id) {
    const session = tableSessions.find(s => s.session_token === custSession);
    if (session && session.id === order.table_session_id) {
      return true;
    }
  }

  // 3. Cryptographically verified Supabase Customer Identity
  const verifiedCust = await verifyCustomerAuth(req);
  if (verifiedCust) {
    if (order.customer_email && verifiedCust.email === order.customer_email.toLowerCase()) {
      return true;
    }
    const cust = customers.find(c => c.auth_user_id === verifiedCust.authUserId || c.email.toLowerCase() === verifiedCust.email);
    if (cust && (cust.id === order.customer_id || (order.customer_email && cust.email.toLowerCase() === order.customer_email.toLowerCase()))) {
      return true;
    }
  }

  return false;
}

// Realtime SSE Clients set
const sseClients = new Set<Response>();

function broadcastRealtime(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  });
}

// Generate QR code helper
async function ensureTableQRs() {
  for (const t of tables) {
    const cafe = cafes.find(c => c.id === t.cafe_id);
    const targetUrl = `${APP_URL}/menu/${cafe?.slug || 'roasted-bean'}?table=${t.table_number}`;
    try {
      t.qr_code_url = await QRCode.toDataURL(targetUrl, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 300,
        color: {
          dark: '#1c1917',
          light: '#ffffff'
        }
      });
    } catch (err) {
      console.error('Failed to generate QR for table', t.table_number, err);
    }
  }
}
ensureTableQRs();

// ==========================================
// REST API ROUTES
// ==========================================

// 1. REALTIME SSE STREAM
app.get('/api/realtime/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.add(res);

  // Send initial ping
  res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// ==========================================
// 1b. STAFF AUTHENTICATION (Reception, Kitchen, Owner)
app.post('/api/auth/staff-login', (req: Request, res: Response) => {
  const identifier = (req.body.identifier || req.body.userId || req.body.user_id || req.body.username || req.body.email || '').trim();
  const password = req.body.password;

  if (!identifier || !password) {
    return res.status(400).json({ success: false, error: 'User ID and password are required' });
  }

  const lower = identifier.toLowerCase();
  const user = staffUsers.find(
    u => u.is_active && ((u.user_id && u.user_id.toLowerCase() === lower) || u.email.toLowerCase() === lower)
  );

  if (!user || !verifyPassword(password, user.password_hash)) {
    auditLogs.unshift({
      id: `audit-${Date.now()}`,
      cafe_id: user?.cafe_id || 'unknown',
      action: 'LOGIN_FAILED',
      details: { identifier },
      timestamp: new Date().toISOString()
    });
    return res.status(401).json({ success: false, error: 'Invalid user ID or password' });
  }

  const token = createStaffToken(user);
  const cafe = cafes.find(c => c.id === user.cafe_id);

  auditLogs.unshift({
    id: `audit-${Date.now()}`,
    cafe_id: user.cafe_id,
    user_id: user.id,
    user_name: user.full_name,
    role: user.role,
    action: 'LOGIN_SUCCESS',
    details: { user_id: user.user_id, email: user.email },
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        cafe_id: user.cafe_id,
        cafe_slug: cafe?.slug || '',
        cafe_name: cafe?.name || ''
      }
    }
  });
});

app.get('/api/auth/staff-me', (req: Request, res: Response) => {
  const staff = parseStaffAuth(req);
  if (!staff) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  const user = staffUsers.find(u => u.id === staff.userId);
  const cafe = cafes.find(c => c.id === staff.cafeId);

  res.json({
    success: true,
    data: {
      id: staff.userId,
      email: staff.email,
      role: staff.role,
      full_name: staff.fullName,
      cafe_id: staff.cafeId,
      cafe_slug: cafe?.slug || '',
      cafe_name: cafe?.name || ''
    }
  });
});

// ==========================================
// 1c. TABLE SESSIONS & CUSTOMER ISOLATION
// ==========================================
function handleTableSessionInitOrScan(req: Request, res: Response) {
  const { cafe_id, table_number, existing_token } = req.body;
  if (!cafe_id || table_number === undefined || table_number === null) {
    return res.status(400).json({ success: false, error: 'Café ID and Table Number are required' });
  }

  const cafe = cafes.find(c => c.slug === cafe_id || c.id === cafe_id);
  if (!cafe) {
    return res.status(404).json({ success: false, error: 'Café not found' });
  }

  const parsedTableNum = Number(table_number);
  const table = tables.find(t => t.cafe_id === cafe.id && t.table_number === parsedTableNum);
  if (!table) {
    return res.status(404).json({ success: false, error: `Table ${table_number} does not exist in ${cafe.name}` });
  }

  // 1. If existing token was passed, validate if it belongs to an active session
  if (existing_token) {
    const matchedSession = tableSessions.find(s => s.session_token === existing_token);
    if (matchedSession) {
      if (matchedSession.status === 'CLOSED') {
        return res.status(403).json({
          success: false,
          error: 'This table session has ended and is settled/closed. Please contact reception to open a new session.',
          is_closed: true
        });
      }
      if (matchedSession.expires_at && matchedSession.expires_at < Date.now()) {
        matchedSession.status = 'CLOSED';
        return res.status(403).json({
          success: false,
          error: 'This table session has expired. Ordering is blocked.',
          is_expired: true
        });
      }
      if (matchedSession.table_id !== table.id || matchedSession.cafe_id !== cafe.id) {
        return res.status(403).json({
          success: false,
          error: 'Session token does not match this table or café. Tampering detected.'
        });
      }

      recalculateTableSession(matchedSession);
      return res.json({
        success: true,
        data: {
          session_id: matchedSession.id,
          session_token: matchedSession.session_token,
          table_id: table.id,
          table_number: table.table_number,
          table_name: table.table_name,
          status: matchedSession.status,
          total_amount: matchedSession.total_amount,
          paid_amount: matchedSession.paid_amount,
          outstanding_amount: matchedSession.outstanding_amount
        }
      });
    }
  }

  // 2. Look for active session on this table (allows multiple customers at same table to share session)
  let session = tableSessions.find(s => s.table_id === table.id && s.status === 'ACTIVE');
  if (session) {
    if (session.expires_at && session.expires_at < Date.now()) {
      session.status = 'CLOSED';
      session = undefined;
    }
  }

  // 3. If no active session, create a new one
  if (!session) {
    const newToken = `ts_${crypto.randomBytes(20).toString('hex')}`;
    session = {
      id: `ts-${table.id}-${Date.now().toString(36)}`,
      cafe_id: cafe.id,
      table_id: table.id,
      table_number: table.table_number,
      session_token: newToken,
      status: 'ACTIVE',
      orders: [],
      total_amount: 0,
      paid_amount: 0,
      outstanding_amount: 0,
      created_at: new Date().toISOString(),
      expires_at: Date.now() + 4 * 60 * 60 * 1000 // 4 hour validity
    };
    tableSessions.push(session);
    if (table.status === 'FREE') {
      table.status = 'OCCUPIED';
      broadcastRealtime('table_status_changed', { cafe_id: cafe.id, table });
    }
  }

  recalculateTableSession(session);

  res.json({
    success: true,
    data: {
      session_id: session.id,
      session_token: session.session_token,
      table_id: table.id,
      table_number: table.table_number,
      table_name: table.table_name,
      status: session.status,
      total_amount: session.total_amount,
      paid_amount: session.paid_amount,
      outstanding_amount: session.outstanding_amount
    }
  });
}

app.post('/api/tables/session/scan', (req: Request, res: Response) => {
  handleTableSessionInitOrScan(req, res);
});

app.post('/api/tables/session/init', (req: Request, res: Response) => {
  handleTableSessionInitOrScan(req, res);
});

app.post('/api/tables/:tableId/session/close', requireStaffAuth(['SUPER_ADMIN', 'CAFE_OWNER', 'MANAGER', 'RECEPTION']), (req: Request, res: Response) => {
  const { tableId } = req.params;
  const table = tables.find(t => t.id === tableId || t.table_number === Number(tableId));
  if (!table) return res.status(404).json({ success: false, error: 'Table not found' });
  const session = tableSessions.find(s => s.table_id === table.id && s.status === 'ACTIVE');
  if (session) {
    session.status = 'CLOSED';
    session.closed_at = new Date().toISOString();
  }
  table.status = 'FREE';
  table.current_order_id = undefined;
  broadcastRealtime('table_status_changed', { cafe_id: table.cafe_id, table });
  res.json({ success: true, message: 'Table session closed successfully' });
});

app.get('/api/tables/:tableId/session', (req: Request, res: Response) => {
  const { tableId } = req.params;
  const table = tables.find(t => t.id === tableId || t.table_number === Number(tableId));
  if (!table) {
    return res.status(404).json({ success: false, error: 'Table not found' });
  }

  const session = tableSessions.find(s => s.table_id === table.id && s.status === 'ACTIVE');
  if (!session) {
    return res.json({ success: true, data: null });
  }

  recalculateTableSession(session);

  // Authorization check: Staff or matching customer token
  const staff = parseStaffAuth(req);
  const custToken = (req.headers['x-customer-session'] as string) || (req.query.session_token as string);

  if (!staff && custToken !== session.session_token) {
    return res.status(403).json({ success: false, error: 'Forbidden: Cannot access this table session' });
  }

  const sessionOrders = orders.filter(
    o => (o.table_session_id === session.id || session.orders.includes(o.id)) && o.order_status !== 'CANCELLED'
  );

  res.json({
    success: true,
    data: {
      session,
      orders: sessionOrders
    }
  });
});

// ==========================================
// 1d. RECEPTION DASHBOARD & BILL SETTLEMENT
// ==========================================
app.get('/api/reception/:cafeId/overview', requireStaffAuth(['SUPER_ADMIN', 'CAFE_OWNER', 'MANAGER', 'RECEPTION']), (req: Request, res: Response) => {
  const { cafeId } = req.params;
  const cafe = cafes.find(c => c.slug === cafeId || c.id === cafeId);
  if (!cafe) {
    return res.status(404).json({ success: false, error: 'Café not found' });
  }

  const cafeTables = tables.filter(t => t.cafe_id === cafe.id);
  const summaries = cafeTables.map(t => {
    let session = tableSessions.find(s => s.table_id === t.id && s.status === 'ACTIVE');
    if (session) {
      recalculateTableSession(session);
    }
    const sessionOrders = session
      ? orders.filter(o => (o.table_session_id === session!.id || session!.orders.includes(o.id)) && o.order_status !== 'CANCELLED')
      : [];

    return {
      table: t,
      session: session || null,
      orders: sessionOrders,
      total_billed: session ? session.total_amount : 0,
      total_paid: session ? session.paid_amount : 0,
      outstanding_amount: session ? session.outstanding_amount : 0,
      is_bill_requested: t.status === 'BILL_REQUESTED'
    };
  });

  const occupiedCount = summaries.filter(s => s.table.status === 'OCCUPIED' || s.table.status === 'BILL_REQUESTED').length;
  const billReqCount = summaries.filter(s => s.is_bill_requested).length;
  const totalOutstanding = summaries.reduce((sum, s) => sum + s.outstanding_amount, 0);

  const today = new Date().toISOString().slice(0, 10);
  const todayPaid = orders
    .filter(o => o.cafe_id === cafe.id && o.payment_status === 'PAID' && o.created_at.startsWith(today))
    .reduce((sum, o) => sum + o.total, 0);

  const cafeNotifs = notifications.filter(n => n.cafe_id === cafe.id && !n.is_resolved);

  res.json({
    success: true,
    data: {
      tables: summaries,
      stats: {
        total_tables: cafeTables.length,
        occupied_tables: occupiedCount,
        bill_requested_tables: billReqCount,
        total_outstanding: Number(totalOutstanding.toFixed(2)),
        total_paid_today: Number(todayPaid.toFixed(2))
      },
      notifications: cafeNotifs
    }
  });
});

app.post('/api/reception/settle-payment', requireStaffAuth(['SUPER_ADMIN', 'CAFE_OWNER', 'MANAGER', 'RECEPTION']), (req: Request, res: Response) => {
  const staff = (req as any).staffUser as StaffTokenPayload;
  const { cafe_id, table_id, method, notes, release_table, order_id } = req.body;

  if (!['CASH', 'CARD', 'UPI_POS'].includes(method)) {
    return res.status(400).json({ success: false, error: 'Payment method must be CASH, CARD, or UPI_POS' });
  }

  const table = tables.find(t => t.id === table_id && (t.cafe_id === staff.cafeId || staff.role === 'SUPER_ADMIN'));
  if (!table) {
    return res.status(404).json({ success: false, error: 'Table not found for your café' });
  }

  let session = tableSessions.find(s => s.table_id === table.id && s.status === 'ACTIVE');
  if (!session) {
    return res.status(400).json({ success: false, error: 'No active session found for this table' });
  }

  let ordersToSettle: OrderStore[] = [];
  if (order_id) {
    const o = orders.find(ord => ord.id === order_id);
    if (!o) return res.status(404).json({ success: false, error: 'Order not found' });
    if (o.payment_status === 'PAID') return res.status(400).json({ success: false, error: 'Order is already paid' });
    ordersToSettle = [o];
  } else {
    ordersToSettle = orders.filter(
      ord => (ord.table_session_id === session!.id || session!.orders.includes(ord.id)) &&
      ord.payment_status !== 'PAID' &&
      ord.order_status !== 'CANCELLED'
    );
  }

  if (ordersToSettle.length === 0) {
    return res.status(400).json({ success: false, error: 'No unpaid orders to settle' });
  }

  let totalSettled = 0;
  const timestamp = new Date().toISOString();
  for (const ord of ordersToSettle) {
    ord.payment_status = 'PAID';
    if (ord.order_status === 'PENDING') {
      ord.order_status = 'ACCEPTED';
    }
    ord.payment_id = `rec_${method.toLowerCase()}_${Date.now()}`;
    ord.updated_at = timestamp;
    totalSettled += ord.total;

    if (ord.customer_id) {
      const cust = customers.find(c => c.id === ord.customer_id);
      if (cust) {
        cust.total_orders += 1;
        cust.total_spent = Number((cust.total_spent + ord.total).toFixed(2));
      }
    }

    broadcastRealtime('payment_confirmed', { order_id: ord.id, payment_id: ord.payment_id, method });
    broadcastRealtime('order_status_updated', { order: ord });
  }

  recalculateTableSession(session);

  const billNotif = notifications.find(n => n.table_id === table.id && n.type === 'REQUEST_BILL' && !n.is_resolved);
  if (billNotif) {
    billNotif.is_resolved = true;
  }

  if (release_table) {
    session.status = 'CLOSED';
    session.closed_at = timestamp;
    table.status = 'FREE';
    table.current_order_id = undefined;

    // Dispatch final tax invoices with roastery thank-you & visit-again message to customers
    for (const ord of ordersToSettle) {
      const emailToUse = ord.customer_email || 'adwetabruk02@gmail.com';
      sendInvoiceEmailHelper(ord, emailToUse).catch(err => console.error('Auto invoice email error:', err));
    }
  } else if (session.outstanding_amount === 0) {
    if (table.status === 'BILL_REQUESTED') {
      table.status = 'OCCUPIED';
    }
  }

  broadcastRealtime('table_status_changed', { cafe_id: table.cafe_id, table });

  auditLogs.unshift({
    id: `audit-${Date.now()}`,
    cafe_id: table.cafe_id,
    user_id: staff.userId,
    user_name: staff.fullName,
    role: staff.role,
    action: 'RECEPTION_SETTLE_PAYMENT',
    details: {
      table_number: table.table_number,
      session_id: session.id,
      settled_orders_count: ordersToSettle.length,
      amount: totalSettled,
      method,
      notes: notes || '',
      released_table: Boolean(release_table)
    },
    timestamp
  });

  res.json({
    success: true,
    data: {
      settled_count: ordersToSettle.length,
      total_settled: Number(totalSettled.toFixed(2)),
      remaining_outstanding: session.outstanding_amount,
      session_status: session.status,
      table_status: table.status
    }
  });
});

app.post('/api/reception/notifications/:notifId/resolve', requireStaffAuth(['SUPER_ADMIN', 'CAFE_OWNER', 'MANAGER', 'RECEPTION']), (req: Request, res: Response) => {
  const { notifId } = req.params;
  const notif = notifications.find(n => n.id === notifId);
  if (!notif) {
    return res.status(404).json({ success: false, error: 'Notification not found' });
  }
  notif.is_resolved = true;
  notif.is_read = true;
  res.json({ success: true, data: notif });
});

// 2. CAFES
app.get('/api/cafes', (req: Request, res: Response) => {
  res.json({ success: true, data: cafes });
});

app.get('/api/cafes/:slugOrId', (req: Request, res: Response) => {
  const { slugOrId } = req.params;
  const cafe = cafes.find(c => c.slug === slugOrId || c.id === slugOrId);
  if (!cafe) {
    return res.status(404).json({ success: false, error: 'Café not found' });
  }
  res.json({ success: true, data: cafe });
});

// 3. TABLES
app.get('/api/cafes/:cafeId/tables', (req: Request, res: Response) => {
  const { cafeId } = req.params;
  const cafe = cafes.find(c => c.slug === cafeId || c.id === cafeId);
  if (!cafe) {
    return res.status(404).json({ success: false, error: 'Café not found' });
  }
  const cafeTables = tables.filter(t => t.cafe_id === cafe.id);
  res.json({ success: true, data: cafeTables });
});

app.post('/api/cafes/:cafeId/tables', requireStaffAuth(['SUPER_ADMIN', 'CAFE_OWNER', 'MANAGER']), async (req: Request, res: Response) => {
  const { cafeId } = req.params;
  const { table_number, table_name, capacity } = req.body;
  const cafe = cafes.find(c => c.slug === cafeId || c.id === cafeId);
  if (!cafe) {
    return res.status(404).json({ success: false, error: 'Café not found' });
  }

  const existing = tables.find(t => t.cafe_id === cafe.id && t.table_number === Number(table_number));
  if (existing) {
    return res.status(400).json({ success: false, error: `Table ${table_number} already exists` });
  }

  const newTableId = `tbl-${cafe.slug}-${Date.now().toString(36)}`;
  const baseUrl = getRequestBaseUrl(req);
  const targetUrl = `${baseUrl}/menu/${cafe.slug}?table=${table_number}`;
  const qrCodeUrl = await QRCode.toDataURL(targetUrl, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 300,
  });

  const newTable: TableStore = {
    id: newTableId,
    cafe_id: cafe.id,
    table_number: Number(table_number),
    table_name: table_name || `Table ${table_number}`,
    capacity: Number(capacity) || 4,
    qr_code_url: qrCodeUrl,
    status: 'FREE',
  };

  tables.push(newTable);
  broadcastRealtime('table_status_changed', { cafe_id: cafe.id, table: newTable });
  res.status(201).json({ success: true, data: newTable });
});

// Regenerate QR
app.post('/api/tables/:tableId/regenerate-qr', requireStaffAuth(['SUPER_ADMIN', 'CAFE_OWNER', 'MANAGER']), async (req: Request, res: Response) => {
  const { tableId } = req.params;
  const table = tables.find(t => t.id === tableId);
  if (!table) {
    return res.status(404).json({ success: false, error: 'Table not found' });
  }
  const cafe = cafes.find(c => c.id === table.cafe_id);
  const baseUrl = getRequestBaseUrl(req);
  const targetUrl = `${baseUrl}/menu/${cafe?.slug || 'roasted-bean'}?table=${table.table_number}`;
  table.qr_code_url = await QRCode.toDataURL(targetUrl, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 300,
  });

  res.json({ success: true, data: table });
});

// Table Actions: Call Waiter, Request Bill, Release Table
app.post('/api/tables/:tableId/call-waiter', (req: Request, res: Response) => {
  const { tableId } = req.params;
  const { message } = req.body;
  const table = tables.find(t => t.id === tableId || t.table_number === Number(tableId));
  if (!table) {
    return res.status(404).json({ success: false, error: 'Table not found' });
  }

  const notif = {
    id: `notif-${Date.now()}`,
    cafe_id: table.cafe_id,
    table_id: table.id,
    table_number: table.table_number,
    type: 'CALL_WAITER',
    message: message || `Table ${table.table_number} is requesting waiter assistance.`,
    is_read: false,
    created_at: new Date().toISOString()
  };

  notifications.unshift(notif);
  broadcastRealtime('waiter_called', notif);
  res.json({ success: true, message: 'Waiter has been alerted to your table' });
});

app.post('/api/tables/:tableId/request-bill', (req: Request, res: Response) => {
  const { tableId } = req.params;
  const table = tables.find(t => t.id === tableId || t.table_number === Number(tableId));
  if (!table) {
    return res.status(404).json({ success: false, error: 'Table not found' });
  }

  table.status = 'BILL_REQUESTED';
  const notif = {
    id: `notif-${Date.now()}`,
    cafe_id: table.cafe_id,
    table_id: table.id,
    table_number: table.table_number,
    type: 'REQUEST_BILL',
    message: `Table ${table.table_number} requested their bill invoice.`,
    is_read: false,
    created_at: new Date().toISOString()
  };

  notifications.unshift(notif);
  broadcastRealtime('bill_requested', { table, notification: notif });
  broadcastRealtime('table_status_changed', { cafe_id: table.cafe_id, table });
  res.json({ success: true, message: 'Printed bill requested. Staff is on the way.' });
});

app.post('/api/tables/:tableId/release', requireStaffAuth(['SUPER_ADMIN', 'CAFE_OWNER', 'MANAGER', 'RECEPTION']), (req: Request, res: Response) => {
  const { tableId } = req.params;
  const table = tables.find(t => t.id === tableId || t.table_number === Number(tableId));
  if (!table) {
    return res.status(404).json({ success: false, error: 'Table not found' });
  }

  table.status = 'FREE';
  table.current_order_id = undefined;
  broadcastRealtime('table_status_changed', { cafe_id: table.cafe_id, table });
  res.json({ success: true, message: `Table ${table.table_number} is now FREE` });
});

// 4. MENU
app.get('/api/cafes/:cafeId/menu', (req: Request, res: Response) => {
  const { cafeId } = req.params;
  const cafe = cafes.find(c => c.slug === cafeId || c.id === cafeId);
  if (!cafe) {
    return res.status(404).json({ success: false, error: 'Café not found' });
  }

  const cafeCategories = categories.filter(c => c.cafe_id === cafe.id && c.is_active);
  const cafeItems = menuItems.filter(i => i.cafe_id === cafe.id);

  res.json({
    success: true,
    data: {
      categories: cafeCategories,
      items: cafeItems
    }
  });
});

app.post('/api/cafes/:cafeId/menu/items', requireStaffAuth(['SUPER_ADMIN', 'CAFE_OWNER', 'MANAGER']), (req: Request, res: Response) => {
  const { cafeId } = req.params;
  const cafe = cafes.find(c => c.slug === cafeId || c.id === cafeId);
  if (!cafe) {
    return res.status(404).json({ success: false, error: 'Café not found' });
  }

  const { category_id, name, description, price, image_url, is_veg, is_spicy, is_bestseller, preparation_time_minutes, variants } = req.body;
  if (!name || price == null || !category_id) {
    return res.status(400).json({ success: false, error: 'Name, price, and category are required' });
  }

  const newItem: MenuItemStore = {
    id: `item-${Date.now().toString(36)}`,
    cafe_id: cafe.id,
    category_id,
    name,
    description: description || '',
    price: Number(price),
    image_url: image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
    is_veg: Boolean(is_veg),
    is_spicy: Boolean(is_spicy),
    is_bestseller: Boolean(is_bestseller),
    is_available: true,
    preparation_time_minutes: Number(preparation_time_minutes) || 12,
    variants: variants || []
  };

  menuItems.push(newItem);
  broadcastRealtime('menu_updated', { cafe_id: cafe.id });
  res.status(201).json({ success: true, data: newItem });
});

// Toggle Item Availability (86'd out of stock)
app.patch('/api/menu/items/:itemId/toggle-availability', requireStaffAuth(['SUPER_ADMIN', 'CAFE_OWNER', 'MANAGER', 'RECEPTION', 'KITCHEN_STAFF']), (req: Request, res: Response) => {
  const { itemId } = req.params;
  const item = menuItems.find(i => i.id === itemId);
  if (!item) {
    return res.status(404).json({ success: false, error: 'Menu item not found' });
  }
  item.is_available = !item.is_available;
  broadcastRealtime('menu_item_availability_changed', { item_id: item.id, is_available: item.is_available });
  res.json({ success: true, data: item });
});

// 5. COUPONS & LOYALTY VALIDATION
app.get('/api/cafes/:cafeId/coupons', (req: Request, res: Response) => {
  const { cafeId } = req.params;
  const cafe = cafes.find(c => c.slug === cafeId || c.id === cafeId);
  if (!cafe) {
    return res.status(404).json({ success: false, error: 'Café not found' });
  }
  const cafeCoupons = coupons.filter(c => c.cafe_id === cafe.id);
  res.json({ success: true, data: cafeCoupons });
});

app.post('/api/coupons/validate', (req: Request, res: Response) => {
  const { cafeId, code, subtotal } = req.body;
  const cafe = cafes.find(c => c.slug === cafeId || c.id === cafeId);
  if (!cafe) {
    return res.status(404).json({ success: false, error: 'Café not found' });
  }

  const coupon = coupons.find(c => c.cafe_id === cafe.id && c.code.toUpperCase() === code?.toUpperCase() && c.status === 'ACTIVE');
  if (!coupon) {
    return res.status(400).json({ success: false, error: 'Invalid or inactive coupon code' });
  }

  if (subtotal < coupon.minimum_order) {
    return res.status(400).json({
      success: false,
      error: `Minimum order of ${cafe.currency}${coupon.minimum_order} required for code ${coupon.code}`
    });
  }

  let discountAmount = 0;
  if (coupon.discount_type === 'PERCENTAGE') {
    discountAmount = Math.round((subtotal * coupon.discount_value) / 100);
  } else {
    discountAmount = Math.min(subtotal, coupon.discount_value);
  }

  res.json({
    success: true,
    data: {
      code: coupon.code,
      discount_amount: discountAmount,
      description: coupon.description
    }
  });
});

// Helper function to dispatch final branded tax invoice email with roastery thank-you message
async function sendInvoiceEmailHelper(order: OrderStore, recipientEmail?: string) {
  const targetEmail = (recipientEmail || order.customer_email || 'adwetabruk02@gmail.com').toLowerCase().trim();
  const cafe = cafes.find(c => c.id === order.cafe_id) || cafes[0];
  const table = tables.find(t => t.id === order.table_id);
  const tableNum = table ? table.table_number : order.table_number;

  const itemRowsHtml = order.items.map(it => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #EFE7DD; font-size: 13px; color: #2A1810;">
        <strong>${it.item_name}</strong>
        ${it.selected_variants_json && it.selected_variants_json.length > 0 ? `<br><small style="color: #8C7667;">${it.selected_variants_json.map((v: any) => v.name).join(', ')}</small>` : ''}
        ${it.item_notes ? `<br><small style="color: #C87D32;">Note: ${it.item_notes}</small>` : ''}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #EFE7DD; font-size: 13px; text-align: center; color: #2A1810;">${it.quantity}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #EFE7DD; font-size: 13px; text-align: right; color: #2A1810;">${cafe.currency}${it.unit_price.toFixed(2)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #EFE7DD; font-size: 13px; text-align: right; font-weight: bold; color: #2A1810;">${cafe.currency}${it.subtotal.toFixed(2)}</td>
    </tr>
  `).join('');

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FAF8F5; padding: 28px; border-radius: 20px; border: 1px solid #EFE7DD;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px dashed #EFE7DD;">
        <h1 style="color: #2D1B14; margin: 0; font-size: 26px; font-family: serif; letter-spacing: -0.5px;">${cafe.name}</h1>
        <p style="color: #705648; margin: 4px 0 0 0; font-size: 12px;">${cafe.address} • GSTIN: ${cafe.gst_number || '27AAAAA0000A1Z5'}</p>
        <div style="display: inline-block; background: #FAF3EA; border: 1px solid #EFE2D3; padding: 5px 14px; border-radius: 10px; margin-top: 12px; font-size: 12px; font-weight: bold; color: #C87D32;">
          Table #${tableNum} • Official Tax Invoice INV-${order.id.slice(-6)}
        </div>
      </div>

      <div style="margin: 20px 0; font-size: 12px; color: #553E32; background: #ffffff; padding: 14px 18px; border-radius: 12px; border: 1px solid #EFE7DD;">
        <p style="margin: 3px 0;"><strong>Billed To:</strong> ${order.customer_name || 'Valued Guest'} (${targetEmail})</p>
        <p style="margin: 3px 0;"><strong>Order ID:</strong> ${order.id}</p>
        <p style="margin: 3px 0;"><strong>Date & Time:</strong> ${new Date(order.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
        <p style="margin: 3px 0;"><strong>Payment Status:</strong> <span style="color: #15803d; font-weight: bold;">${order.payment_status} (${order.payment_id || 'SETTLED'})</span></p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-top: 14px; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #EFE7DD;">
        <thead>
          <tr style="background: #2D1B14; color: #FDFBF7; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
            <th style="padding: 10px 12px; text-align: left;">Item</th>
            <th style="padding: 10px 12px; text-align: center;">Qty</th>
            <th style="padding: 10px 12px; text-align: right;">Unit Price</th>
            <th style="padding: 10px 12px; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRowsHtml}
        </tbody>
      </table>

      <div style="margin-top: 16px; padding: 14px 18px; background: #ffffff; border-radius: 12px; border: 1px solid #EFE7DD; font-size: 12px; color: #553E32;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Subtotal:</span>
          <strong>${cafe.currency}${order.subtotal.toFixed(2)}</strong>
        </div>
        ${order.discount > 0 ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #15803d;">
          <span>Discount (${order.coupon_code || 'COUPON'}):</span>
          <strong>-${cafe.currency}${order.discount.toFixed(2)}</strong>
        </div>` : ''}
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>GST (${cafe.tax_rate}%):</span>
          <span>${cafe.currency}${order.tax.toFixed(2)}</span>
        </div>
        ${order.service_charge > 0 ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Service Charge (${cafe.service_charge_rate}%):</span>
          <span>${cafe.currency}${order.service_charge.toFixed(2)}</span>
        </div>` : ''}
        <div style="display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px solid #EFE7DD; font-size: 15px; font-weight: bold; color: #2D1B14;">
          <span>Total Settled Amount:</span>
          <span style="color: #C87D32;">${cafe.currency}${order.total.toFixed(2)}</span>
        </div>
      </div>

      <div style="text-align: center; margin-top: 24px; padding-top: 18px; border-top: 1px solid #EFE7DD;">
        <h3 style="color: #2D1B14; font-size: 16px; margin: 0 0 6px 0; font-family: serif;">Thank You for Dining With Us!</h3>
        <p style="color: #705648; font-size: 12px; margin: 0 0 12px 0; line-height: 1.6;">
          We hope you had an exceptional single-estate coffee and dining experience at <strong>${cafe.name}</strong>. It was our pleasure serving you, and we look forward to welcoming you back to your table soon!
        </p>
        <p style="font-size: 11px; color: #A89284; margin: 0;">Warm regards,<br>The Roastery &amp; Culinary Team</p>
      </div>
    </div>
  `;

  const emailEntry: EmailLog = {
    id: `em-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    to: targetEmail,
    subject: `Your Final Tax Invoice & Thank You for Visiting ${cafe.name} (Order #${order.id})`,
    type: 'INVOICE',
    payload: {
      order_id: order.id,
      amount: order.total,
      table_number: tableNum,
      items_count: order.items.length
    },
    sent_at: new Date().toISOString()
  };

  emailLogs.push(emailEntry);

  if (process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'adwetabruk02@gmail.com',
          to: targetEmail,
          subject: emailEntry.subject,
          html: htmlContent
        })
      });
    } catch (err) {
      console.error('Failed sending invoice email via Resend:', err);
    }
  }

  return emailEntry;
}

// 6. SERVER-SIDE PRICE CALCULATION & ORDER CREATION (QR-FIRST ENFORCED)
app.post('/api/orders', async (req: Request, res: Response) => {
  // 1. Verify Customer Authentication (Derived strictly from verified Supabase session / JWT)
  // Rule 1: Customer Login / Signup -> Authentication succeeds -> Menu unlocks -> Customer orders
  const verifiedCust = await verifyCustomerAuth(req);
  if (!verifiedCust) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required: You must be logged in as a customer to place an order. Please sign in or register.'
    });
  }

  const customerEmail = verifiedCust.email;
  const customerName = verifiedCust.name || req.body.customer_name || 'Customer';
  const customerPhone = req.body.customer_phone || '';

  // 2. Validate Table QR & Active Table Session (Rules 2, 4, 5, 6, 7)
  const sessionToken = (req.headers['x-customer-session'] as string) || (req.headers['x-table-session'] as string) || req.body.session_token;
  if (!sessionToken) {
    return res.status(403).json({
      success: false,
      error: 'Ordering blocked: A valid table QR session is required to place an order. Please scan your table QR code.'
    });
  }

  const activeSession = tableSessions.find(s => s.session_token === sessionToken);
  if (!activeSession) {
    return res.status(403).json({
      success: false,
      error: 'Ordering blocked: Invalid or unknown table session token. Please scan the QR code at your table.'
    });
  }

  if (activeSession.status === 'CLOSED') {
    return res.status(403).json({
      success: false,
      error: 'Ordering blocked: This table session has been settled and closed. Further orders cannot be placed.'
    });
  }

  if (activeSession.expires_at && activeSession.expires_at < Date.now()) {
    activeSession.status = 'CLOSED';
    return res.status(403).json({
      success: false,
      error: 'Ordering blocked: This table session has expired. Please ask staff for assistance or scan fresh QR.'
    });
  }

  const {
    cafe_id,
    table_number,
    cart_items,
    items,
    coupon_code,
    notes,
    marketing_consent
  } = req.body;

  // 3. Tamper Protection: Café and Table must match the active session
  const cafe = cafes.find(c => c.slug === cafe_id || c.id === cafe_id);
  if (!cafe) {
    return res.status(404).json({ success: false, error: 'Café not found' });
  }

  if (cafe.id !== activeSession.cafe_id) {
    return res.status(403).json({
      success: false,
      error: 'Ordering blocked: Café does not match active table session. Tampering detected.'
    });
  }

  const table = tables.find(t => t.id === activeSession.table_id);
  if (!table) {
    return res.status(404).json({ success: false, error: 'Table not found for active session' });
  }

  if (table_number !== undefined && Number(table_number) !== activeSession.table_number) {
    return res.status(403).json({
      success: false,
      error: `Ordering blocked: Requested table (${table_number}) does not match active table session (${activeSession.table_number}). Tampering detected.`
    });
  }

  // 4. Cart items validation
  const rawOrderItems = Array.isArray(cart_items) && cart_items.length > 0
    ? cart_items
    : Array.isArray(items) && items.length > 0
    ? items
    : [];

  if (rawOrderItems.length === 0) {
    return res.status(400).json({ success: false, error: 'Cart cannot be empty' });
  }

  // 5. Duplicate Order & Idempotency Protection (Rule 11)
  const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotency_key;
  if (idempotencyKey && idempotencyOrdersMap.has(idempotencyKey)) {
    const existing = idempotencyOrdersMap.get(idempotencyKey)!;
    return res.status(200).json({
      success: true,
      data: {
        order: existing,
        session_token: sessionToken,
        session_id: activeSession.id,
        is_duplicate: true
      }
    });
  }

  const itemsSignature = rawOrderItems.map((i: any) => `${i.menu_item_id || i.id}:${i.quantity}`).sort().join('|');
  const submissionKey = `${verifiedCust.authUserId}:${activeSession.id}:${itemsSignature}`;
  const prevSubmission = recentOrderSubmissions.get(submissionKey);
  if (prevSubmission && (Date.now() - prevSubmission.timestamp < 6000)) {
    return res.status(200).json({
      success: true,
      data: {
        order: prevSubmission.order,
        session_token: sessionToken,
        session_id: activeSession.id,
        is_duplicate: true
      }
    });
  }

  // 6. Server-side price calculation
  let calculatedSubtotal = 0;
  const processedItems: any[] = [];

  for (const rawItem of rawOrderItems) {
    const menuItemId = rawItem.menu_item_id || rawItem.id;
    const menuItem = menuItems.find(i => i.id === menuItemId && i.cafe_id === cafe.id);
    if (!menuItem) {
      return res.status(400).json({ success: false, error: `Item ${menuItemId} not found in this café's menu` });
    }
    if (!menuItem.is_available) {
      return res.status(400).json({
        success: false,
        error: `Sorry, "${menuItem.name}" is currently sold out. Please remove it from your cart.`
      });
    }

    let itemUnitPrice = menuItem.price;
    const selectedVariants = rawItem.selected_variants || rawItem.selected_variants_json || [];
    let variantsAddition = 0;

    for (const v of selectedVariants) {
      const dbVariant = menuItem.variants?.find(mv => mv.name === v.name || mv.id === v.id);
      if (dbVariant) {
        variantsAddition += dbVariant.additional_price;
      }
    }

    const itemUnitWithVariants = itemUnitPrice + variantsAddition;
    const qty = Math.max(1, Number(rawItem.quantity) || 1);
    const itemSubtotal = itemUnitWithVariants * qty;
    calculatedSubtotal += itemSubtotal;

    processedItems.push({
      id: `oi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      menu_item_id: menuItem.id,
      item_name: menuItem.name,
      unit_price: itemUnitPrice,
      quantity: qty,
      selected_variants_json: selectedVariants,
      item_notes: rawItem.item_notes || rawItem.notes || '',
      subtotal: itemSubtotal
    });
  }

  // Server-side coupon verification
  let discountAmount = 0;
  let appliedCouponCode: string | undefined = undefined;

  if (coupon_code) {
    const coupon = coupons.find(c => c.cafe_id === cafe.id && c.code.toUpperCase() === coupon_code.toUpperCase() && c.status === 'ACTIVE');
    if (coupon && calculatedSubtotal >= coupon.minimum_order) {
      appliedCouponCode = coupon.code;
      if (coupon.discount_type === 'PERCENTAGE') {
        discountAmount = Math.round((calculatedSubtotal * coupon.discount_value) / 100);
      } else {
        discountAmount = Math.min(calculatedSubtotal, coupon.discount_value);
      }
      coupon.usage_count += 1;
    }
  }

  // Calculate Tax and Service Charge on discounted subtotal
  const taxableBase = Math.max(0, calculatedSubtotal - discountAmount);
  const taxAmount = Number(((taxableBase * (cafe.tax_rate || 5)) / 100).toFixed(2));
  const serviceChargeAmount = Number(((taxableBase * (cafe.service_charge_rate || 0)) / 100).toFixed(2));
  const finalTotal = Number((taxableBase + taxAmount + serviceChargeAmount).toFixed(2));

  // Customer in store linked to verified auth ID
  let cust = customers.find(c => c.auth_user_id === verifiedCust.authUserId || c.email.toLowerCase() === customerEmail.toLowerCase());
  if (!cust) {
    cust = {
      id: `cust-${Date.now()}`,
      auth_user_id: verifiedCust.authUserId,
      name: customerName,
      email: customerEmail.toLowerCase(),
      phone: customerPhone,
      total_orders: 0,
      total_spent: 0,
      created_at: new Date().toISOString()
    };
    customers.push(cust);
  } else {
    cust.auth_user_id = verifiedCust.authUserId;
    if (customerName && customerName !== 'Customer') cust.name = customerName;
    if (customerPhone) cust.phone = customerPhone;
  }

  if (marketing_consent) {
    const isBool = typeof marketing_consent === 'boolean';
    marketingConsents[cust.id] = {
      customer_id: cust.id,
      email_marketing: isBool ? marketing_consent : Boolean(marketing_consent.email),
      sms_marketing: isBool ? false : Boolean(marketing_consent.sms),
      whatsapp_marketing: isBool ? marketing_consent : Boolean(marketing_consent.whatsapp),
      consent_timestamp: new Date().toISOString()
    };
  }

  // Create order linked to active table session
  const orderId = `ord-${Date.now().toString(36).toUpperCase()}`;
  const newOrder: OrderStore = {
    id: orderId,
    cafe_id: cafe.id,
    table_session_id: activeSession.id,
    customer_session_token: sessionToken,
    customer_id: cust.id,
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    table_id: table.id,
    table_number: table.table_number,
    items: processedItems,
    subtotal: calculatedSubtotal,
    tax: taxAmount,
    service_charge: serviceChargeAmount,
    discount: discountAmount,
    coupon_code: appliedCouponCode,
    total: finalTotal,
    payment_status: 'PENDING',
    order_status: 'PENDING',
    notes: notes || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  orders.unshift(newOrder);
  activeSession.orders.push(newOrder.id);
  recalculateTableSession(activeSession);

  if (table.status === 'FREE') {
    table.status = 'OCCUPIED';
  }
  table.current_order_id = newOrder.id;

  // Record for duplicate protection
  recentOrderSubmissions.set(submissionKey, { order: newOrder, timestamp: Date.now() });
  if (idempotencyKey) {
    idempotencyOrdersMap.set(idempotencyKey, newOrder);
  }

  // Broadcast to Kitchen KDS and Reception (Rules 8 & 9)
  broadcastRealtime('order_created', { order: newOrder });
  broadcastRealtime('table_status_changed', { cafe_id: cafe.id, table });
  broadcastRealtime('table_session_updated', {
    cafe_id: cafe.id,
    table_number: table.table_number,
    session: activeSession,
    new_order: newOrder
  });

  res.status(201).json({
    success: true,
    data: {
      order: newOrder,
      session_token: sessionToken,
      session_id: activeSession.id,
      razorpay_order: {
        id: `rzp_order_${orderId}`,
        amount: Math.round(finalTotal * 100), // amount in paise
        currency: 'INR',
        key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_production_dine',
      }
    }
  });
});

// 7. RAZORPAY PAYMENT VERIFICATION & KDS BROADCAST
app.post('/api/payments/verify', (req: Request, res: Response) => {
  const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, method } = req.body;

  const order = orders.find(o => o.id === order_id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  // Idempotency check: if already verified as PAID, return safe response
  if (order.payment_status === 'PAID') {
    return res.json({
      success: true,
      data: {
        order,
        message: 'Payment was already verified and recorded.'
      }
    });
  }

  // Verify HMAC signature if real Razorpay secret is set
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (secret && razorpay_order_id && razorpay_signature) {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      order.payment_status = 'FAILED';
      return res.status(400).json({ success: false, error: 'Razorpay signature verification failed' });
    }
  }

  // Update order status to PAID & trigger kitchen!
  order.payment_status = 'PAID';
  order.order_status = 'ACCEPTED'; // Sent straight to KDS
  order.payment_id = razorpay_payment_id || `pay_${Date.now()}`;
  order.updated_at = new Date().toISOString();

  // Recalculate Table Session
  if (order.table_session_id) {
    const session = tableSessions.find(s => s.id === order.table_session_id);
    if (session) {
      recalculateTableSession(session);
    }
  }

  // Update table status to OCCUPIED
  const table = tables.find(t => t.id === order.table_id || t.table_number === order.table_number);
  if (table) {
    table.status = 'OCCUPIED';
    table.current_order_id = order.id;
    broadcastRealtime('table_status_changed', { cafe_id: order.cafe_id, table });
  }

  // Update customer stats
  if (order.customer_id) {
    const cust = customers.find(c => c.id === order.customer_id);
    if (cust) {
      cust.total_orders += 1;
      cust.total_spent = Number((cust.total_spent + order.total).toFixed(2));
    }
  }

  // Generate Next-Visit Loyalty Coupon for Customer!
  const nextVisitCode = `REWARD-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const rewardCoupon: CouponStore = {
    id: `cp-${Date.now()}`,
    cafe_id: order.cafe_id,
    code: nextVisitCode,
    description: '15% OFF your next visit! Thank you for dining with us.',
    discount_type: 'PERCENTAGE',
    discount_value: 15,
    minimum_order: 200,
    usage_limit: 1,
    usage_count: 0,
    status: 'ACTIVE'
  };
  coupons.push(rewardCoupon);

  // Broadcast realtime event for kitchen display, reception, and admin
  broadcastRealtime('new_order', { order, reward_coupon: rewardCoupon });
  broadcastRealtime('payment_confirmed', { order_id: order.id, payment_id: order.payment_id });

  // Log transactional email
  if (order.customer_email) {
    emailLogs.push({
      id: `em-${Date.now()}`,
      to: order.customer_email,
      subject: `Order #${order.id.slice(-6)} Confirmed & Invoice - The Roasted Bean`,
      type: 'ORDER_CONFIRMATION',
      payload: {
        order_id: order.id,
        total: order.total,
        next_visit_code: nextVisitCode
      },
      sent_at: new Date().toISOString()
    });
  }

  res.json({
    success: true,
    data: {
      order,
      reward_coupon: rewardCoupon,
      message: 'Payment verified and sent to kitchen in real-time.'
    }
  });
});

// 8. ORDER STATUS UPDATES (Kitchen / Manager / Reception actions)
app.patch('/api/orders/:orderId/status', requireStaffAuth(['SUPER_ADMIN', 'CAFE_OWNER', 'MANAGER', 'RECEPTION', 'KITCHEN_STAFF']), (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { status } = req.body;

  const validStatuses = ['ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid order status' });
  }

  const order = orders.find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  order.order_status = status;
  order.updated_at = new Date().toISOString();

  // If order served or completed, optionally update table session
  if (order.table_session_id) {
    const session = tableSessions.find(s => s.id === order.table_session_id);
    if (session) {
      recalculateTableSession(session);
    }
  }

  if (status === 'COMPLETED') {
    const table = tables.find(t => t.id === order.table_id);
    if (table) {
      table.status = 'FREE';
      broadcastRealtime('table_status_changed', { cafe_id: order.cafe_id, table });
    }
  }

  broadcastRealtime('order_status_updated', { order });
  res.json({ success: true, data: order });
});

// 9. ORDER DETAILS & CUSTOMER ORDER HISTORY (Hardened Customer Privacy)
app.get('/api/orders/:orderId', async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const order = orders.find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  // Customer Privacy Check: Verified Supabase JWT or Staff or Active Session
  if (!(await canAccessOrder(order, req))) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: You do not have permission to view this order.'
    });
  }

  res.json({ success: true, data: order });
});

app.get('/api/orders/cafe/:cafeId', requireStaffAuth(['SUPER_ADMIN', 'CAFE_OWNER', 'MANAGER', 'RECEPTION', 'KITCHEN_STAFF']), (req: Request, res: Response) => {
  const { cafeId } = req.params;
  const cafe = cafes.find(c => c.slug === cafeId || c.id === cafeId);
  if (!cafe) {
    return res.status(404).json({ success: false, error: 'Café not found' });
  }
  const cafeOrders = orders.filter(o => o.cafe_id === cafe.id);
  res.json({ success: true, data: cafeOrders });
});

app.get('/api/orders/customer/:emailOrId', async (req: Request, res: Response) => {
  const { emailOrId } = req.params;
  const staff = parseStaffAuth(req);
  const verifiedCust = await verifyCustomerAuth(req);

  let isCustSelf = false;
  if (verifiedCust) {
    const cust = customers.find(
      c => c.auth_user_id === verifiedCust.authUserId || c.email.toLowerCase() === verifiedCust.email
    );
    if (
      verifiedCust.email === emailOrId.toLowerCase() ||
      verifiedCust.authUserId === emailOrId ||
      (cust && (cust.id === emailOrId || cust.email.toLowerCase() === emailOrId.toLowerCase()))
    ) {
      isCustSelf = true;
    }
  }

  if (!staff && !isCustSelf) {
    return res.status(403).json({ success: false, error: 'Forbidden: You can only view your own order history' });
  }

  const custOrders = orders.filter(
    o => o.customer_id === emailOrId || (o.customer_email && o.customer_email.toLowerCase() === emailOrId.toLowerCase())
  );
  res.json({ success: true, data: custOrders });
});

// Customer Profile Synchronization (Supabase Auth / Google OAuth sync)
app.post('/api/customers/sync', async (req: Request, res: Response) => {
  try {
    const verifiedCust = await verifyCustomerAuth(req);
    const staff = parseStaffAuth(req);

    // Derive identity securely - NEVER trust client header claims
    let auth_user_id = req.body?.auth_user_id;
    let email = req.body?.email;
    let name = req.body?.name;
    const phone = req.body?.phone;
    const profile_image = req.body?.profile_image;

    if (verifiedCust) {
      auth_user_id = verifiedCust.authUserId;
      email = verifiedCust.email;
      if (verifiedCust.name) name = verifiedCust.name;
    } else if (!staff) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Valid Supabase authentication token required to sync customer profile'
      });
    }

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, error: 'Valid email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let customer = customers.find(
      c => (auth_user_id && c.auth_user_id === auth_user_id) || c.email.toLowerCase() === normalizedEmail
    );

    if (customer) {
      if (auth_user_id && !customer.auth_user_id) {
        customer.auth_user_id = auth_user_id;
      }
      if (name && (!customer.name || customer.name === 'Guest Patron' || customer.name === customer.email.split('@')[0])) {
        customer.name = name.trim();
      }
      if (phone && !customer.phone) {
        customer.phone = phone.trim();
      }
      if (profile_image && !customer.profile_image) {
        customer.profile_image = profile_image;
      }
    } else {
      customer = {
        id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        auth_user_id: auth_user_id || undefined,
        name: name?.trim() || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        phone: phone?.trim() || '',
        profile_image: profile_image || '',
        total_orders: 0,
        total_spent: 0,
        created_at: new Date().toISOString()
      };
      customers.push(customer);
    }

    // Connect any historical orders with this email to the customer record
    const matchingOrders = orders.filter(
      o => o.customer_email && o.customer_email.toLowerCase() === normalizedEmail
    );
    for (const ord of matchingOrders) {
      ord.customer_id = customer.id;
      if (!ord.customer_name || ord.customer_name === 'Guest Patron') {
        ord.customer_name = customer.name;
      }
    }

    // Recalculate customer metrics accurately
    customer.total_orders = matchingOrders.length;
    customer.total_spent = Number(
      matchingOrders
        .filter(o => o.payment_status === 'PAID')
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0)
        .toFixed(2)
    );

    return res.status(200).json({
      success: true,
      data: customer
    });
  } catch (err: any) {
    console.error('Customer profile sync error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to synchronize customer profile'
    });
  }
});

app.get('/api/customers/profile/:identifier', async (req: Request, res: Response) => {
  const { identifier } = req.params;
  const lower = identifier.toLowerCase();
  const customer = customers.find(
    c => c.id === identifier || (c.auth_user_id && c.auth_user_id === identifier) || c.email.toLowerCase() === lower
  );

  if (!customer) {
    return res.status(404).json({ success: false, error: 'Customer not found' });
  }

  // Authorization check: Staff or verified cryptographic customer token
  const staff = parseStaffAuth(req);
  const verifiedCust = await verifyCustomerAuth(req);

  const isSelf = verifiedCust && (
    (customer.auth_user_id && verifiedCust.authUserId === customer.auth_user_id) ||
    (verifiedCust.email === customer.email.toLowerCase())
  );

  if (!staff && !isSelf) {
    return res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to view this customer profile' });
  }

  res.json({ success: true, data: customer });
});

app.put('/api/customers/profile/:identifier', async (req: Request, res: Response) => {
  const { identifier } = req.params;
  const lower = identifier.toLowerCase();
  const customer = customers.find(
    c => c.id === identifier || (c.auth_user_id && c.auth_user_id === identifier) || c.email.toLowerCase() === lower
  );

  if (!customer) {
    return res.status(404).json({ success: false, error: 'Customer not found' });
  }

  // Authorization check: Staff or verified cryptographic customer token
  const staff = parseStaffAuth(req);
  const verifiedCust = await verifyCustomerAuth(req);

  const isSelf = verifiedCust && (
    (customer.auth_user_id && verifiedCust.authUserId === customer.auth_user_id) ||
    (verifiedCust.email === customer.email.toLowerCase())
  );

  if (!staff && !isSelf) {
    return res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to update this profile' });
  }

  const { name, phone, profile_image } = req.body;

  // Protect critical identity fields: Customers CANNOT edit role, auth_user_id, id, total_spent, total_orders
  if (name && typeof name === 'string' && name.trim().length > 0) {
    customer.name = name.trim();
  }
  if (phone !== undefined && typeof phone === 'string') {
    customer.phone = phone.trim();
  }
  if (profile_image !== undefined && typeof profile_image === 'string') {
    customer.profile_image = profile_image.trim();
  }

  // Sync customer name on historical orders
  for (const ord of orders) {
    if (ord.customer_id === customer.id || (ord.customer_email && ord.customer_email.toLowerCase() === customer.email.toLowerCase())) {
      ord.customer_name = customer.name;
    }
  }

  res.json({ success: true, data: customer });
});

app.post('/api/customers/marketing', async (req: Request, res: Response) => {
  const { customer_id, email_marketing, sms_marketing, whatsapp_marketing } = req.body;
  if (!customer_id) {
    return res.status(400).json({ success: false, error: 'customer_id is required' });
  }

  const customer = customers.find(c => c.id === customer_id);
  if (!customer) {
    return res.status(404).json({ success: false, error: 'Customer not found' });
  }

  const staff = parseStaffAuth(req);
  const verifiedCust = await verifyCustomerAuth(req);

  const isSelf = verifiedCust && (
    (customer.auth_user_id && verifiedCust.authUserId === customer.auth_user_id) ||
    (verifiedCust.email === customer.email.toLowerCase())
  );

  if (!staff && !isSelf) {
    return res.status(403).json({ success: false, error: 'Forbidden: You can only update your own marketing preferences' });
  }

  marketingConsents[customer_id] = {
    customer_id,
    email_marketing: Boolean(email_marketing),
    sms_marketing: Boolean(sms_marketing),
    whatsapp_marketing: Boolean(whatsapp_marketing),
    consent_timestamp: new Date().toISOString()
  };

  res.json({ success: true, data: marketingConsents[customer_id] });
});

// 10. CUSTOMERS CRM & MARKETING CONSENTS
app.get('/api/cafes/:cafeId/customers', requireStaffAuth(['SUPER_ADMIN', 'CAFE_OWNER', 'MANAGER']), (req: Request, res: Response) => {
  const { cafeId } = req.params;
  const cafe = cafes.find(c => c.slug === cafeId || c.id === cafeId);
  if (!cafe) {
    return res.status(404).json({ success: false, error: 'Café not found' });
  }

  // Get unique customers who ordered from this cafe
  const cafeOrderCustomerIds = new Set(orders.filter(o => o.cafe_id === cafe.id).map(o => o.customer_id));
  const cafeCustomers = customers
    .filter(c => cafeOrderCustomerIds.has(c.id))
    .map(c => ({
      ...c,
      marketing: marketingConsents[c.id] || { email_marketing: false, sms_marketing: false, whatsapp_marketing: false }
    }));

  res.json({ success: true, data: cafeCustomers });
});

// 11. INVOICE & RESEND TRANSACTIONAL EMAIL
app.get('/api/invoices/:orderId', async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const order = orders.find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  if (!(await canAccessOrder(order, req))) {
    return res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to view this invoice' });
  }

  const cafe = cafes.find(c => c.id === order.cafe_id);

  res.json({
    success: true,
    data: {
      invoice_number: `INV-${order.id.slice(-6)}`,
      date: order.created_at,
      cafe,
      order
    }
  });
});

app.post('/api/invoices/:orderId/email', async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { email } = req.body;
  const order = orders.find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  if (!(await canAccessOrder(order, req))) {
    return res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to dispatch this invoice' });
  }

  const targetEmail = (email || order.customer_email || 'adwetabruk02@gmail.com').toLowerCase().trim();
  if (!targetEmail) {
    return res.status(400).json({ success: false, error: 'Recipient email address is required' });
  }

  await sendInvoiceEmailHelper(order, targetEmail);

  res.json({
    success: true,
    message: `Tax invoice dispatched successfully to ${targetEmail}`
  });
});

// Outbox / Sent Emails list
app.get('/api/admin/emails', requireStaffAuth(['SUPER_ADMIN', 'CAFE_OWNER', 'MANAGER']), (req: Request, res: Response) => {
  res.json({ success: true, data: emailLogs });
});

// 12. REPORTS & ANALYTICS
app.get('/api/reports/:cafeId', requireStaffAuth(['SUPER_ADMIN', 'CAFE_OWNER', 'MANAGER']), (req: Request, res: Response) => {
  const { cafeId } = req.params;
  const cafe = cafes.find(c => c.slug === cafeId || c.id === cafeId);
  if (!cafe) {
    return res.status(404).json({ success: false, error: 'Café not found' });
  }

  const cafeOrders = orders.filter(o => o.cafe_id === cafe.id && o.payment_status === 'PAID');
  const totalRevenue = cafeOrders.reduce((sum, o) => sum + o.total, 0);
  const totalOrdersCount = cafeOrders.length;
  const aov = totalOrdersCount > 0 ? Number((totalRevenue / totalOrdersCount).toFixed(2)) : 0;

  // Best selling items tally
  const itemCounts: Record<string, { name: string; count: number; revenue: number }> = {};
  cafeOrders.forEach(o => {
    o.items.forEach(it => {
      if (!itemCounts[it.menu_item_id]) {
        itemCounts[it.menu_item_id] = { name: it.item_name, count: 0, revenue: 0 };
      }
      itemCounts[it.menu_item_id].count += it.quantity;
      itemCounts[it.menu_item_id].revenue += it.subtotal;
    });
  });

  const bestSellingItems = Object.values(itemCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Table analytics
  const tableCounts: Record<number, number> = {};
  cafeOrders.forEach(o => {
    tableCounts[o.table_number] = (tableCounts[o.table_number] || 0) + 1;
  });

  res.json({
    success: true,
    data: {
      total_revenue: totalRevenue,
      total_orders: totalOrdersCount,
      aov,
      best_selling_items: bestSellingItems,
      orders_by_table: tableCounts,
      payment_breakdown: {
        UPI: Math.round(totalOrdersCount * 0.65),
        Cards: Math.round(totalOrdersCount * 0.25),
        NetBanking: Math.round(totalOrdersCount * 0.10)
      }
    }
  });
});

// Notifications
app.get('/api/notifications/:cafeId', (req: Request, res: Response) => {
  const { cafeId } = req.params;
  const cafe = cafes.find(c => c.slug === cafeId || c.id === cafeId);
  const notifs = notifications.filter(n => !cafe || n.cafe_id === cafe.id);
  res.json({ success: true, data: notifs });
});

// ==========================================
// VITE CLIENT INTEGRATION
// ==========================================
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : {
          server: httpServer,
          ...(process.env.HMR_CLIENT_PORT ? { clientPort: Number(process.env.HMR_CLIENT_PORT) } : {}),
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      maxAge: isProd ? '1d' : 0,
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`) || filePath.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
    app.get('*', (req: Request, res: Response, next: any) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Global Express error handler to prevent unhandled rejections/crashes
  app.use((err: any, req: Request, res: Response, next: any) => {
    console.error('Unhandled server error:', err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({
      success: false,
      error: err?.message || 'Internal Server Error'
    });
  });

  const serverInstance = httpServer.listen(Number(PORT) || 3000, '0.0.0.0', () => {
    console.log(`QRDine Server running on ${APP_URL} (Port: ${PORT}) [Mode: ${isProd ? 'Production' : 'Development'}]`);
  });

  // Graceful shutdown handling for container and process managers (Docker, Kubernetes, PM2)
  const shutdown = (signal: string) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    sseClients.forEach(client => {
      try {
        client.write(`data: ${JSON.stringify({ type: 'server_shutdown' })}\n\n`);
        client.end();
      } catch {}
    });
    sseClients.clear();

    serverInstance.close(() => {
      console.log('HTTP server closed successfully.');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
