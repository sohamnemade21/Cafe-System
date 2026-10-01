import {
  Cafe,
  CafeTable,
  MenuItem,
  MenuCategory,
  Order,
  Coupon,
  Customer,
  StaffNotification,
  StaffAuthResponse,
  StaffUser,
  TableSession,
  ReceptionOverview
} from '../types';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const custom = (import.meta.env.VITE_API_URL || '').trim();
    if (custom) {
      return custom.replace(/\/+$/, '') + (custom.endsWith('/api') ? '' : '/api');
    }
    return '/api';
  }
  return (process.env.APP_URL ? process.env.APP_URL.replace(/\/+$/, '') + '/api' : 'http://localhost:3000/api');
}

const BASE_URL = getApiBaseUrl();

const STAFF_TOKEN_KEY = 'qrdine_staff_token';
const CUSTOMER_SESSION_KEY = 'qrdine_customer_session';
const CUSTOMER_EMAIL_KEY = 'qrdine_customer_email';
const CUSTOMER_AUTH_ID_KEY = 'qrdine_customer_auth_id';
const CUSTOMER_TOKEN_KEY = 'qrdine_customer_jwt';

function getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    const staffToken = localStorage.getItem(STAFF_TOKEN_KEY);
    if (staffToken) {
      headers['Authorization'] = `Bearer ${staffToken}`;
    }

    const customerToken = localStorage.getItem(CUSTOMER_TOKEN_KEY);
    if (customerToken) {
      headers['x-customer-token'] = customerToken;
      if (!headers['Authorization']) {
        headers['Authorization'] = `Bearer ${customerToken}`;
      }
    }

    const customerSession = sessionStorage.getItem(CUSTOMER_SESSION_KEY) || localStorage.getItem(CUSTOMER_SESSION_KEY);
    if (customerSession) {
      headers['x-customer-session'] = customerSession;
    }
  }

  // Caller headers take precedence over auto-injected defaults
  Object.assign(headers, customHeaders);

  return headers;
}

export function getCustomerHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    const customerToken = localStorage.getItem(CUSTOMER_TOKEN_KEY);
    if (customerToken) {
      headers['Authorization'] = `Bearer ${customerToken}`;
      headers['x-customer-token'] = customerToken;
    }

    const customerSession = sessionStorage.getItem(CUSTOMER_SESSION_KEY) || localStorage.getItem(CUSTOMER_SESSION_KEY);
    if (customerSession) {
      headers['x-customer-session'] = customerSession;
    }
  }

  Object.assign(headers, customHeaders);

  return headers;
}

export const api = {
  // --- AUTHENTICATION & SESSION MANAGEMENT ---
  getStaffToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STAFF_TOKEN_KEY);
  },

  setStaffToken(token: string | null) {
    if (typeof window === 'undefined') return;
    if (token) {
      localStorage.setItem(STAFF_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(STAFF_TOKEN_KEY);
    }
  },

  getCustomerSessionToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(CUSTOMER_SESSION_KEY) || localStorage.getItem(CUSTOMER_SESSION_KEY);
  },

  setCustomerSessionToken(token: string | null) {
    if (typeof window === 'undefined') return;
    if (token) {
      sessionStorage.setItem(CUSTOMER_SESSION_KEY, token);
      localStorage.setItem(CUSTOMER_SESSION_KEY, token);
    } else {
      sessionStorage.removeItem(CUSTOMER_SESSION_KEY);
      localStorage.removeItem(CUSTOMER_SESSION_KEY);
    }
  },

  setCustomerEmail(email: string | null) {
    if (typeof window === 'undefined') return;
    if (email) {
      localStorage.setItem(CUSTOMER_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(CUSTOMER_EMAIL_KEY);
    }
  },

  getCustomerEmail(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(CUSTOMER_EMAIL_KEY);
  },

  setCustomerAuthId(authId: string | null) {
    if (typeof window === 'undefined') return;
    if (authId) {
      localStorage.setItem(CUSTOMER_AUTH_ID_KEY, authId);
    } else {
      localStorage.removeItem(CUSTOMER_AUTH_ID_KEY);
    }
  },

  getCustomerAuthId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(CUSTOMER_AUTH_ID_KEY);
  },

  getCustomerToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(CUSTOMER_TOKEN_KEY);
  },

  setCustomerToken(token: string | null) {
    if (typeof window === 'undefined') return;
    if (token) {
      localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    }
  },

  clearCustomerAuth() {
    this.setCustomerToken(null);
    this.setCustomerEmail(null);
    this.setCustomerAuthId(null);
    this.setCustomerSessionToken(null);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(CUSTOMER_SESSION_KEY);
        localStorage.removeItem(CUSTOMER_SESSION_KEY);
        localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        localStorage.removeItem(CUSTOMER_EMAIL_KEY);
        localStorage.removeItem(CUSTOMER_AUTH_ID_KEY);
      } catch {}
    }
  },

  async staffLogin(identifier: string, password: string): Promise<StaffAuthResponse> {
    const res = await fetch(`${BASE_URL}/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: identifier, email: identifier, password })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Login failed');
    this.setStaffToken(json.data.token);
    return json.data;
  },

  async getStaffMe(): Promise<StaffUser> {
    const res = await fetch(`${BASE_URL}/auth/staff-me`, {
      headers: getHeaders()
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to authenticate');
    return json.data;
  },

  staffLogout() {
    this.setStaffToken(null);
  },

  // --- CAFES & MENU ---
  async getCafes(): Promise<Cafe[]> {
    const res = await fetch(`${BASE_URL}/cafes`);
    const json = await res.json();
    return json.data || [];
  },

  async getCafe(slugOrId: string): Promise<Cafe> {
    const res = await fetch(`${BASE_URL}/cafes/${slugOrId}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to load café');
    return json.data;
  },

  async getMenu(cafeId: string): Promise<{ categories: MenuCategory[]; items: MenuItem[] }> {
    const res = await fetch(`${BASE_URL}/cafes/${cafeId}/menu`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to load menu');
    return json.data;
  },

  // --- TABLES & ACTIVE SESSIONS ---
  async getTables(cafeId: string): Promise<CafeTable[]> {
    const res = await fetch(`${BASE_URL}/cafes/${cafeId}/tables`, {
      headers: getHeaders()
    });
    const json = await res.json();
    return json.data || [];
  },

  async addTable(cafeId: string, data: { table_number: number; table_name: string; capacity: number }): Promise<CafeTable> {
    const res = await fetch(`${BASE_URL}/cafes/${cafeId}/tables`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to add table');
    return json.data;
  },

  async regenerateQR(tableId: string): Promise<CafeTable> {
    const res = await fetch(`${BASE_URL}/tables/${tableId}/regenerate-qr`, {
      method: 'POST',
      headers: getHeaders()
    });
    const json = await res.json();
    return json.data;
  },

  async initTableSession(cafeId: string, tableNumber: number): Promise<{
    session_id: string;
    session_token: string;
    table_id: string;
    table_number: number;
    table_name: string;
    status: string;
    total_amount: number;
    paid_amount: number;
    outstanding_amount: number;
  }> {
    const existingToken = this.getCustomerSessionToken();
    const res = await fetch(`${BASE_URL}/tables/session/init`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ cafe_id: cafeId, table_number: tableNumber, existing_token: existingToken })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to initialize table session');
    this.setCustomerSessionToken(json.data.session_token);
    return json.data;
  },

  async getTableSession(tableId: string): Promise<{ session: TableSession | null; orders: Order[] }> {
    const res = await fetch(`${BASE_URL}/tables/${tableId}/session`, {
      headers: getHeaders()
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to load table session');
    return json.data;
  },

  async callWaiter(tableId: string, message?: string): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/tables/${tableId}/call-waiter`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message })
    });
    const json = await res.json();
    return json;
  },

  async requestBill(tableId: string): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/tables/${tableId}/request-bill`, {
      method: 'POST',
      headers: getHeaders()
    });
    const json = await res.json();
    return json;
  },

  async releaseTable(tableId: string): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/tables/${tableId}/release`, {
      method: 'POST',
      headers: getHeaders()
    });
    const json = await res.json();
    return json;
  },

  // --- RECEPTION DESK OPERATIONS ---
  async getReceptionOverview(cafeId: string): Promise<ReceptionOverview> {
    const res = await fetch(`${BASE_URL}/reception/${cafeId}/overview`, {
      headers: getHeaders()
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to load reception overview');
    return json.data;
  },

  async settleReceptionPayment(data: {
    cafe_id: string;
    table_id: string;
    method: 'CASH' | 'CARD' | 'UPI_POS';
    notes?: string;
    release_table?: boolean;
    order_id?: string;
  }): Promise<{
    settled_count: number;
    total_settled: number;
    remaining_outstanding: number;
    session_status: string;
    table_status: string;
  }> {
    const res = await fetch(`${BASE_URL}/reception/settle-payment`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Payment settlement failed');
    return json.data;
  },

  async resolveNotification(notifId: string): Promise<StaffNotification> {
    const res = await fetch(`${BASE_URL}/reception/notifications/${notifId}/resolve`, {
      method: 'POST',
      headers: getHeaders()
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to resolve notification');
    return json.data;
  },

  // --- MENU MANAGEMENT ---
  async toggleAvailability(itemId: string): Promise<MenuItem> {
    const res = await fetch(`${BASE_URL}/menu/items/${itemId}/toggle-availability`, {
      method: 'PATCH',
      headers: getHeaders()
    });
    const json = await res.json();
    return json.data;
  },

  async addMenuItem(cafeId: string, itemData: any): Promise<MenuItem> {
    const res = await fetch(`${BASE_URL}/cafes/${cafeId}/menu/items`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(itemData)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to add item');
    return json.data;
  },

  // --- COUPONS ---
  async getCoupons(cafeId: string): Promise<Coupon[]> {
    const res = await fetch(`${BASE_URL}/cafes/${cafeId}/coupons`);
    const json = await res.json();
    return json.data || [];
  },

  async validateCoupon(cafeId: string, code: string, subtotal: number): Promise<{ code: string; discount_amount: number; description: string }> {
    const res = await fetch(`${BASE_URL}/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cafeId, code, subtotal })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Invalid coupon');
    return json.data;
  },

  // --- ORDERS & PAYMENTS ---
  async createOrder(payload: any): Promise<{ order: Order; razorpay_order: any; session_token?: string }> {
    // Automatically attach existing session token if not explicitly provided
    const sessionToken = payload.session_token || this.getCustomerSessionToken();
    const finalPayload = { ...payload, session_token: sessionToken };

    const res = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(finalPayload)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to create order');
    if (json.data.session_token) {
      this.setCustomerSessionToken(json.data.session_token);
    }
    if (payload.customer_email) {
      this.setCustomerEmail(payload.customer_email);
    }
    return json.data;
  },

  async verifyPayment(payload: {
    order_id: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    method?: string;
  }): Promise<{ order: Order; reward_coupon: Coupon }> {
    const res = await fetch(`${BASE_URL}/payments/verify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Payment verification failed');
    return json.data;
  },

  async updateOrderStatus(orderId: string, status: string): Promise<Order> {
    const res = await fetch(`${BASE_URL}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to update order status');
    return json.data;
  },

  async getOrder(orderId: string): Promise<Order> {
    const res = await fetch(`${BASE_URL}/orders/${orderId}`, {
      headers: getHeaders()
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Order not found or access denied');
    return json.data;
  },

  async getCafeOrders(cafeId: string): Promise<Order[]> {
    const res = await fetch(`${BASE_URL}/orders/cafe/${cafeId}`, {
      headers: getHeaders()
    });
    const json = await res.json();
    return json.data || [];
  },

  async getCustomerOrders(emailOrId: string): Promise<Order[]> {
    const res = await fetch(`${BASE_URL}/orders/customer/${encodeURIComponent(emailOrId)}`, {
      headers: getHeaders()
    });
    const json = await res.json();
    return json.data || [];
  },

  async getCustomers(cafeId: string): Promise<(Customer & { marketing?: any })[]> {
    const res = await fetch(`${BASE_URL}/cafes/${cafeId}/customers`, {
      headers: getHeaders()
    });
    const json = await res.json();
    return json.data || [];
  },

  async getReports(cafeId: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/reports/${cafeId}`, {
      headers: getHeaders()
    });
    const json = await res.json();
    return json.data || {};
  },

  async sendInvoiceEmail(orderId: string, email?: string): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/invoices/${orderId}/email`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email })
    });
    const json = await res.json();
    return json;
  },

  async getNotifications(cafeId: string): Promise<StaffNotification[]> {
    const res = await fetch(`${BASE_URL}/notifications/${cafeId}`, {
      headers: getHeaders()
    });
    const json = await res.json();
    return json.data || [];
  },

  async syncCustomerProfile(
    data: {
      auth_user_id?: string;
      email: string;
      name?: string;
      phone?: string;
      profile_image?: string;
    },
    tokenOverride?: string
  ): Promise<Customer> {
    const customHeaders: Record<string, string> = {};
    const token = tokenOverride || this.getCustomerToken();
    if (token) {
      customHeaders['Authorization'] = `Bearer ${token}`;
      customHeaders['x-customer-token'] = token;
    }

    const res = await fetch(`${BASE_URL}/customers/sync`, {
      method: 'POST',
      headers: getCustomerHeaders(customHeaders),
      body: JSON.stringify(data)
    });
    const json = await res.json().catch(() => ({ success: false, error: `Invalid response from server (${res.status})` }));
    if (!res.ok || !json.success) {
      throw new Error(json.error || `Failed to synchronize customer profile (${res.status})`);
    }
    return json.data;
  },

  async getCustomerProfile(identifier: string): Promise<Customer> {
    const res = await fetch(`${BASE_URL}/customers/profile/${encodeURIComponent(identifier)}`, {
      headers: getCustomerHeaders()
    });
    const json = await res.json().catch(() => ({ success: false, error: 'Customer profile not found' }));
    if (!res.ok || !json.success) throw new Error(json.error || 'Customer profile not found');
    return json.data;
  },

  async updateCustomerProfile(
    identifier: string,
    updates: { name?: string; phone?: string; profile_image?: string }
  ): Promise<Customer> {
    const res = await fetch(`${BASE_URL}/customers/profile/${encodeURIComponent(identifier)}`, {
      method: 'PUT',
      headers: getCustomerHeaders(),
      body: JSON.stringify(updates)
    });
    const json = await res.json().catch(() => ({ success: false, error: 'Failed to update profile' }));
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update customer profile');
    return json.data;
  },

  async updateCustomerMarketing(
    customerId: string,
    consents: { email_marketing?: boolean; sms_marketing?: boolean; whatsapp_marketing?: boolean }
  ): Promise<any> {
    const res = await fetch(`${BASE_URL}/customers/marketing`, {
      method: 'POST',
      headers: getCustomerHeaders(),
      body: JSON.stringify({ customer_id: customerId, ...consents })
    });
    const json = await res.json().catch(() => ({ success: false, error: 'Failed to update preferences' }));
    return json.data;
  }
};
