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
    'Accept': 'application/json'
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

  Object.assign(headers, customHeaders);
  return headers;
}

export function getCustomerHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
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

/**
 * Safe JSON fetch wrapper that traps non-JSON/HTML errors before JSON.parse explodes
 */
async function safeFetchJson<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = getHeaders(options.headers as any);
  const response = await fetch(url, { ...options, headers });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    if (text.startsWith('<!DOCTYPE') || text.includes('<html')) {
      throw new Error(`API endpoint ${url} returned HTML (${response.status}). Please check backend service.`);
    }
    throw new Error(`Unexpected non-JSON response from server (${response.status})`);
  }

  const json = await response.json();
  if (!response.ok || json.success === false) {
    const errorMsg = json.error?.message || json.error || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return json;
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
  },

  async staffLogin(identifier: string, password: string): Promise<StaffAuthResponse> {
    const json = await safeFetchJson<{ data: StaffAuthResponse }>(`${BASE_URL}/auth/staff-login`, {
      method: 'POST',
      body: JSON.stringify({ userId: identifier, email: identifier, password })
    });
    this.setStaffToken(json.data.token);
    return json.data;
  },

  async getStaffMe(): Promise<StaffUser> {
    const json = await safeFetchJson<{ data: StaffUser }>(`${BASE_URL}/auth/staff-me`);
    return json.data;
  },

  staffLogout() {
    this.setStaffToken(null);
  },

  // --- CAFES & MENU ---
  async getCafes(): Promise<Cafe[]> {
    const json = await safeFetchJson<{ data: Cafe[] }>(`${BASE_URL}/cafes`);
    return json.data || [];
  },

  async getCafe(slugOrId: string): Promise<Cafe> {
    const json = await safeFetchJson<{ data: Cafe }>(`${BASE_URL}/cafes/${slugOrId}`);
    return json.data;
  },

  async getMenu(cafeId: string): Promise<{ categories: MenuCategory[]; items: MenuItem[] }> {
    const json = await safeFetchJson<{ data: { categories: MenuCategory[]; items: MenuItem[] } }>(`${BASE_URL}/cafes/${cafeId}/menu`);
    return json.data;
  },

  // --- CATEGORIES ---
  async addCategory(cafeId: string, data: { name: string; description?: string; display_order?: number }): Promise<MenuCategory> {
    const json = await safeFetchJson<{ data: MenuCategory }>(`${BASE_URL}/cafes/${cafeId}/categories`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return json.data;
  },

  async updateCategory(categoryId: string, data: Partial<MenuCategory>): Promise<MenuCategory> {
    const json = await safeFetchJson<{ data: MenuCategory }>(`${BASE_URL}/categories/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return json.data;
  },

  async deleteCategory(categoryId: string): Promise<void> {
    await safeFetchJson(`${BASE_URL}/categories/${categoryId}`, {
      method: 'DELETE'
    });
  },

  // --- TABLES & ACTIVE SESSIONS ---
  async getTables(cafeId: string): Promise<CafeTable[]> {
    const json = await safeFetchJson<{ data: CafeTable[] }>(`${BASE_URL}/cafes/${cafeId}/tables`);
    return json.data || [];
  },

  async addTable(cafeId: string, data: { table_number: number; table_name: string; capacity: number }): Promise<CafeTable> {
    const json = await safeFetchJson<{ data: CafeTable }>(`${BASE_URL}/cafes/${cafeId}/tables`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return json.data;
  },

  async regenerateQR(tableId: string): Promise<CafeTable> {
    const json = await safeFetchJson<{ data: CafeTable }>(`${BASE_URL}/tables/${tableId}/regenerate-qr`, {
      method: 'POST'
    });
    return json.data;
  },

  async resolveQr(qrToken: string): Promise<{
    cafe: Cafe;
    table: CafeTable;
    session: TableSession;
    session_id: string;
    session_token: string;
    table_number: number;
    table_name: string;
  }> {
    const json = await safeFetchJson<{ data: any }>(`${BASE_URL}/qr/resolve`, {
      method: 'POST',
      body: JSON.stringify({ qr_token: qrToken })
    });
    if (json.data?.session_token) {
      this.setCustomerSessionToken(json.data.session_token);
    }
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
    const json = await safeFetchJson<{ data: any }>(`${BASE_URL}/tables/session/init`, {
      method: 'POST',
      body: JSON.stringify({ cafe_id: cafeId, table_number: tableNumber, existing_token: existingToken })
    });
    this.setCustomerSessionToken(json.data.session_token);
    return json.data;
  },

  async getTableSession(tableId: string): Promise<{ session: TableSession | null; orders: Order[] }> {
    const json = await safeFetchJson<{ data: { session: TableSession | null; orders: Order[] } }>(`${BASE_URL}/tables/${tableId}/session`);
    return json.data;
  },

  async callWaiter(tableId: string, message?: string): Promise<{ message: string }> {
    return await safeFetchJson<{ message: string }>(`${BASE_URL}/tables/${tableId}/call-waiter`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  },

  async requestBill(tableId: string): Promise<{ message: string }> {
    return await safeFetchJson<{ message: string }>(`${BASE_URL}/tables/${tableId}/request-bill`, {
      method: 'POST'
    });
  },

  async releaseTable(tableId: string): Promise<{ message: string }> {
    const json = await safeFetchJson<{ data: { message: string } }>(`${BASE_URL}/tables/${tableId}/release`, {
      method: 'POST'
    });
    return json.data;
  },

  // --- RECEPTION DESK OPERATIONS ---
  async getReceptionOverview(cafeId: string): Promise<ReceptionOverview> {
    const json = await safeFetchJson<{ data: ReceptionOverview }>(`${BASE_URL}/reception/${cafeId}/overview`);
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
    const json = await safeFetchJson<{ data: any }>(`${BASE_URL}/reception/settle-payment`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return json.data;
  },

  async resolveNotification(notifId: string): Promise<StaffNotification> {
    const json = await safeFetchJson<{ data: StaffNotification }>(`${BASE_URL}/reception/notifications/${notifId}/resolve`, {
      method: 'POST'
    });
    return json.data;
  },

  // --- MENU MANAGEMENT ---
  async toggleAvailability(itemId: string): Promise<MenuItem> {
    const json = await safeFetchJson<{ data: MenuItem }>(`${BASE_URL}/menu/items/${itemId}/toggle-availability`, {
      method: 'PATCH'
    });
    return json.data;
  },

  async addMenuItem(cafeId: string, itemData: any): Promise<MenuItem> {
    const json = await safeFetchJson<{ data: MenuItem }>(`${BASE_URL}/cafes/${cafeId}/menu/items`, {
      method: 'POST',
      body: JSON.stringify(itemData)
    });
    return json.data;
  },

  // --- COUPONS ---
  async getCoupons(cafeId: string): Promise<Coupon[]> {
    const json = await safeFetchJson<{ data: Coupon[] }>(`${BASE_URL}/cafes/${cafeId}/coupons`);
    return json.data || [];
  },

  async validateCoupon(cafeId: string, code: string, subtotal: number): Promise<{ code: string; discount_amount: number; description: string }> {
    const json = await safeFetchJson<{ data: any }>(`${BASE_URL}/coupons/validate`, {
      method: 'POST',
      body: JSON.stringify({ cafeId, code, subtotal })
    });
    return json.data;
  },

  // --- ORDERS & PAYMENTS ---
  async createOrder(payload: any): Promise<{ order: Order; session_token?: string }> {
    const sessionToken = payload.session_token || this.getCustomerSessionToken();
    const finalPayload = { ...payload, session_token: sessionToken };

    const json = await safeFetchJson<{ data: { order: Order; session_token?: string } }>(`${BASE_URL}/orders`, {
      method: 'POST',
      body: JSON.stringify(finalPayload)
    });

    if (json.data.session_token) {
      this.setCustomerSessionToken(json.data.session_token);
    }
    if (payload.customer_email) {
      this.setCustomerEmail(payload.customer_email);
    }
    return json.data;
  },

  async createPaymentOrder(orderId: string): Promise<{
    razorpay_order_id: string;
    amount: number;
    currency: string;
    key_id: string;
    is_sandbox: boolean;
  }> {
    const json = await safeFetchJson<{ data: any }>(`${BASE_URL}/payments/create-order`, {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId })
    });
    return json.data;
  },

  async verifyPayment(payload: {
    order_id: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    method?: string;
  }): Promise<{ order: Order; reward_coupon: Coupon }> {
    const json = await safeFetchJson<{ data: { order: Order; reward_coupon: Coupon } }>(`${BASE_URL}/payments/verify`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return json.data;
  },

  async updateOrderStatus(orderId: string, status: string): Promise<Order> {
    const json = await safeFetchJson<{ data: Order }>(`${BASE_URL}/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    return json.data;
  },

  async getOrder(orderId: string): Promise<Order> {
    const json = await safeFetchJson<{ data: Order }>(`${BASE_URL}/orders/${orderId}`);
    return json.data;
  },

  async getCafeOrders(cafeId: string): Promise<Order[]> {
    const json = await safeFetchJson<{ data: Order[] }>(`${BASE_URL}/orders/cafe/${cafeId}`);
    return json.data || [];
  },

  async getCustomerOrders(emailOrId: string): Promise<Order[]> {
    const json = await safeFetchJson<{ data: Order[] }>(`${BASE_URL}/orders/customer/${encodeURIComponent(emailOrId)}`);
    return json.data || [];
  },

  // --- CUSTOMER PROFILE & CRM ---
  async syncCustomerProfile(data: {
    auth_user_id?: string;
    email: string;
    name: string;
    phone?: string;
    profile_image?: string;
  }, token?: string): Promise<Customer> {
    const json = await safeFetchJson<{ data: Customer }>(`${BASE_URL}/customers/sync`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(data)
    });
    return json.data;
  },

  async getCustomerProfile(emailOrAuthId: string): Promise<Customer> {
    const json = await safeFetchJson<{ data: Customer }>(`${BASE_URL}/customers/${encodeURIComponent(emailOrAuthId)}`);
    return json.data;
  },

  async updateCustomerProfile(idOrEmail: string, updates: { name?: string; phone?: string; profile_image?: string }): Promise<Customer> {
    const json = await safeFetchJson<{ data: Customer }>(`${BASE_URL}/customers/${encodeURIComponent(idOrEmail)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
    return json.data;
  },

  async updateCustomerMarketing(customerId: string, consent: {
    email_marketing?: boolean;
    sms_marketing?: boolean;
    whatsapp_marketing?: boolean;
  }): Promise<any> {
    const json = await safeFetchJson<{ data: any }>(`${BASE_URL}/customers/${encodeURIComponent(customerId)}/marketing`, {
      method: 'PATCH',
      body: JSON.stringify(consent)
    });
    return json.data;
  },

  async sendInvoiceEmail(orderId: string, email: string): Promise<{ success: boolean; message: string }> {
    const json = await safeFetchJson<{ success: boolean; message: string }>(`${BASE_URL}/orders/${orderId}/send-invoice-email`, {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    return json;
  },

  async getCustomers(cafeId: string): Promise<(Customer & { marketing?: any })[]> {
    const json = await safeFetchJson<{ data: any[] }>(`${BASE_URL}/cafes/${cafeId}/customers`);
    return json.data || [];
  },

  async getReports(cafeId: string): Promise<any> {
    const json = await safeFetchJson<{ data: any }>(`${BASE_URL}/reports/${cafeId}`);
    return json.data || {};
  },

  async getNotifications(cafeId: string): Promise<StaffNotification[]> {
    const json = await safeFetchJson<{ data: StaffNotification[] }>(`${BASE_URL}/notifications/${cafeId}`);
    return json.data || [];
  }
};
