export type UserRole = 
  | 'SUPER_ADMIN' 
  | 'CAFE_OWNER' 
  | 'MANAGER' 
  | 'RECEPTION'
  | 'KITCHEN_STAFF' 
  | 'WAITER' 
  | 'CUSTOMER';

export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'BILL_REQUESTED';

export type OrderStatus = 
  | 'PENDING' 
  | 'PAID' 
  | 'ACCEPTED' 
  | 'PREPARING' 
  | 'READY' 
  | 'SERVED' 
  | 'COMPLETED' 
  | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export type VariantType = 'SIZE' | 'ROAST' | 'ADDON' | 'CRUST' | 'OPTION';

export interface Cafe {
  id: string;
  slug: string;
  name: string;
  tag_line?: string;
  logo_url?: string;
  address: string;
  phone: string;
  email: string;
  gst_number?: string;
  currency: string;
  tax_rate: number;          // e.g. 5.0 for 5%
  service_charge_rate: number; // e.g. 2.5 for 2.5%
  is_active: boolean;
  created_at?: string;
}

export interface CafeTable {
  id: string;
  cafe_id: string;
  table_number: number;
  table_name: string;
  capacity: number;
  qr_code_url?: string;
  status: TableStatus;
  current_order_id?: string;
}

export interface MenuCategory {
  id: string;
  cafe_id: string;
  name: string;
  description?: string;
  display_order: number;
  is_active: boolean;
}

export interface MenuItemVariant {
  id: string;
  menu_item_id: string;
  name: string;
  type: VariantType;
  additional_price: number;
  is_available: boolean;
}

export interface MenuItem {
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
  variants?: MenuItemVariant[];
}

export interface OrderItemOption {
  name: string;
  additional_price: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  selected_variants_json: OrderItemOption[];
  item_notes?: string;
  subtotal: number;
}

export interface Order {
  id: string;
  cafe_id: string;
  table_session_id?: string;
  customer_session_token?: string;
  customer_id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  table_id: string;
  table_number: number;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  service_charge: number;
  discount: number;
  coupon_code?: string;
  total: number;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  payment_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  auth_user_id?: string;
  google_id?: string;
  name: string;
  email: string;
  phone?: string;
  profile_image?: string;
  total_orders: number;
  total_spent: number;
  created_at?: string;
}

export interface MarketingConsent {
  id: string;
  customer_id: string;
  email_marketing: boolean;
  sms_marketing: boolean;
  whatsapp_marketing: boolean;
  consent_timestamp: string;
  unsubscribe_timestamp?: string;
}

export interface Coupon {
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
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
}

export interface Invoice {
  id: string;
  order_id: string;
  cafe_id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  subtotal: number;
  tax: number;
  service_charge: number;
  discount: number;
  total: number;
  created_at: string;
  email_sent?: boolean;
}

export interface StaffNotification {
  id: string;
  cafe_id: string;
  table_id: string;
  table_number: number;
  type: 'CALL_WAITER' | 'REQUEST_BILL' | 'NEW_ORDER' | 'ORDER_READY';
  message: string;
  is_read: boolean;
  is_resolved?: boolean;
  created_at: string;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  selectedVariants: MenuItemVariant[];
  notes: string;
  itemTotal: number;
}

export interface TableSession {
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

export interface StaffUser {
  id: string;
  user_id?: string;
  cafe_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  is_active: boolean;
}

export interface StaffAuthResponse {
  token: string;
  user: StaffUser;
}

export interface TableSessionSummary {
  table: CafeTable;
  session: TableSession | null;
  orders: Order[];
  total_billed: number;
  total_paid: number;
  outstanding_amount: number;
  is_bill_requested: boolean;
}

export interface ReceptionOverview {
  tables: TableSessionSummary[];
  stats: {
    total_tables: number;
    occupied_tables: number;
    bill_requested_tables: number;
    total_outstanding: number;
    total_paid_today: number;
  };
  notifications: StaffNotification[];
}
