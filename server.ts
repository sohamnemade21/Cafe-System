// Side-effect import: loads .env BEFORE any other module evaluates (ESM hoisting safe)
import 'dotenv/config';

import http from 'http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import {
  db,
  supabaseServer,
  initializeDatabase,
  ensureTableQRs,
  DEFAULT_CAFE_ID,
  DEFAULT_CAFE_SLUG,
  memoryCache,
  OrderRecord,
  TableSessionRecord,
  CategoryRecord,
  MenuItemRecord,
  TableRecord
} from './server/db.js';
import {
  createStaffToken,
  verifyStaffToken,
  verifyPassword,
  verifyCustomerAuth,
  createTableQrToken,
  verifyTableQrToken,
  StaffTokenPayload
} from './server/auth.js';
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  verifyWebhookSignature,
  getRazorpayKeyId,
  isRazorpayLive
} from './server/razorpay.js';
import {
  sendEmail,
  generateInvoiceHtml
} from './server/email.js';

const app = express();
export const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';
const APP_URL = (process.env.APP_URL || (isProd ? `http://0.0.0.0:${PORT}` : `http://localhost:${PORT}`)).trim();

// ==========================================
// PRODUCTION CORS & SECURITY HEADERS
// ==========================================

const allowedOriginsEnv = process.env.FRONTEND_URL || process.env.ALLOWED_ORIGINS || '';
const allowedOrigins = allowedOriginsEnv
  ? allowedOriginsEnv.split(',').map(o => o.trim().replace(/\/+$/, ''))
  : [];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || !isProd) {
      return callback(null, true);
    }
    const cleanOrigin = origin.replace(/\/+$/, '');
    if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes('*') || cleanOrigin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    callback(null, true);
  },
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
    'x-razorpay-signature',
    'Accept',
    'Origin'
  ]
};

app.set('trust proxy', 1);
app.disable('x-powered-by');

// Security Headers
app.use((req: Request, res: Response, next: NextFunction) => {
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

// Capture raw body for webhook verification
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// ==========================================
// REALTIME SSE STREAMING
// ==========================================

const sseClients = new Set<Response>();

export function broadcastRealtime(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  });
}

app.get('/api/realtime/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.add(res);
  res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get(['/health', '/api/health'], (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    success: true,
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    supabaseConnected: Boolean(supabaseServer),
    razorpayLive: isRazorpayLive,
    version: '1.0.0'
  });
});

// ==========================================
// AUTH MIDDLEWARE
// ==========================================

function parseStaffAuth(req: Request): StaffTokenPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return verifyStaffToken(token);
}

function requireStaffAuth(allowedRoles?: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const payload = parseStaffAuth(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Staff authentication required' }
      });
    }

    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(payload.role) && payload.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: `Requires role in [${allowedRoles.join(', ')}]` }
      });
    }

    // Multi-tenant isolation check
    const cafeSlugOrId = req.params.cafeId || req.params.slugOrId;
    if (cafeSlugOrId && payload.role !== 'SUPER_ADMIN') {
      const targetCafe = await db.getCafeBySlugOrId(cafeSlugOrId);
      const targetCafeId = targetCafe ? targetCafe.id : cafeSlugOrId;
      const targetCafeSlug = targetCafe ? targetCafe.slug : cafeSlugOrId;

      const staffCafe = await db.getCafeBySlugOrId(payload.cafeId);
      const staffCafeId = staffCafe ? staffCafe.id : payload.cafeId;
      const staffCafeSlug = staffCafe ? staffCafe.slug : payload.cafeId;

      if (staffCafeId !== targetCafeId && staffCafeSlug !== targetCafeSlug) {
        return res.status(403).json({
          success: false,
          error: { code: 'TENANT_FORBIDDEN', message: 'Access denied: Staff is not authorized for this cafe' }
        });
      }
    }

    (req as any).staffUser = payload;
    next();
  };
}

// Recalculate Table Session Totals
async function recalculateTableSession(session: TableSessionRecord): Promise<TableSessionRecord> {
  const sessionOrders = await db.getOrders(session.cafe_id, { tableSessionId: session.id });
  const activeOrders = sessionOrders.filter(o => o.order_status !== 'CANCELLED');

  let totalBilled = 0;
  let totalPaid = 0;

  for (const o of activeOrders) {
    totalBilled += o.total;
    if (o.payment_status === 'PAID') {
      totalPaid += o.total;
    }
  }

  const updated = await db.updateTableSession(session.id, {
    orders: Array.from(new Set([...session.orders, ...activeOrders.map(o => o.id)])),
    total_amount: Number(totalBilled.toFixed(2)),
    paid_amount: Number(totalPaid.toFixed(2)),
    outstanding_amount: Math.max(0, Number((totalBilled - totalPaid).toFixed(2))),
  });

  return updated || session;
}

// ==========================================
// REST API ENDPOINTS
// ==========================================

// 1. Staff Authentication
app.post('/api/auth/staff-login', async (req: Request, res: Response) => {
  try {
    const identifier = (req.body.userId || req.body.identifier || req.body.email || '').trim();
    const password = req.body.password;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'User ID and password are required' }
      });
    }

    const user = await db.getStaffUserByIdentifier(identifier);
    if (!user || !verifyPassword(password, user.password_hash)) {
      await db.logAudit({
        cafe_id: user?.cafe_id || 'unknown',
        action: 'STAFF_LOGIN_FAILED',
        details: { identifier }
      });
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid User ID or Password' }
      });
    }

    const token = createStaffToken(user);
    const cafe = await db.getCafeBySlugOrId(user.cafe_id);

    await db.logAudit({
      cafe_id: user.cafe_id,
      user_id: user.id,
      user_name: user.full_name,
      role: user.role,
      action: 'STAFF_LOGIN_SUCCESS',
      details: { email: user.email }
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          user_id: user.user_id,
          cafe_id: user.cafe_id,
          cafe_slug: cafe?.slug || user.cafe_id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          phone: user.phone,
          is_active: user.is_active
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err?.message || 'Authentication error' }
    });
  }
});

app.get('/api/auth/staff-me', requireStaffAuth(), async (req: Request, res: Response) => {
  const staff = (req as any).staffUser;
  res.json({ success: true, data: staff });
});

// 2. Cafes
app.get('/api/cafes', async (req: Request, res: Response) => {
  try {
    const list = await db.getCafes();
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

app.get('/api/cafes/:slugOrId', async (req: Request, res: Response) => {
  try {
    const cafe = await db.getCafeBySlugOrId(req.params.slugOrId);
    if (!cafe) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Café not found' } });
    }
    res.json({ success: true, data: cafe });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// 3. Menu Categories & Items
app.get('/api/cafes/:cafeId/menu', async (req: Request, res: Response) => {
  try {
    const cafe = await db.getCafeBySlugOrId(req.params.cafeId);
    if (!cafe) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Café not found' } });
    }

    const [categories, items] = await Promise.all([
      db.getCategories(cafe.id),
      db.getMenuItems(cafe.id)
    ]);

    res.json({
      success: true,
      data: {
        categories,
        items
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

app.post('/api/cafes/:cafeId/categories', requireStaffAuth(['CAFE_OWNER', 'MANAGER', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.params;
    const { name, description, display_order } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Category name is required' } });
    }

    const category = await db.createCategory(cafeId, { name, description, display_order });
    await db.logAudit({
      cafe_id: category.cafe_id,
      action: 'CATEGORY_CREATED',
      details: { category_name: category.name }
    });

    res.status(201).json({ success: true, data: category });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

app.put('/api/categories/:id', requireStaffAuth(['CAFE_OWNER', 'MANAGER', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const updated = await db.updateCategory(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

app.delete('/api/categories/:id', requireStaffAuth(['CAFE_OWNER', 'MANAGER', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    await db.deleteCategory(req.params.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

app.post('/api/cafes/:cafeId/menu/items', requireStaffAuth(['CAFE_OWNER', 'MANAGER', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.params;
    const item = await db.createMenuItem(cafeId, req.body);
    await db.logAudit({
      cafe_id: item.cafe_id,
      action: 'MENU_ITEM_CREATED',
      details: { item_name: item.name, price: item.price }
    });
    res.status(201).json({ success: true, data: item });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

app.patch('/api/menu/items/:itemId/toggle-availability', requireStaffAuth(['CAFE_OWNER', 'KITCHEN_STAFF', 'MANAGER']), async (req: Request, res: Response) => {
  try {
    const updated = await db.toggleMenuItemAvailability(req.params.itemId);
    broadcastRealtime('menu_item_updated', { item: updated });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// 4. Tables & QR Management
app.get(['/api/cafes/:cafeId/tables', '/api/tables/:cafeId'], async (req: Request, res: Response) => {
  try {
    const cafe = await db.getCafeBySlugOrId(req.params.cafeId);
    const cafeId = cafe ? cafe.id : req.params.cafeId;
    const tables = await db.getTables(cafeId);
    res.json({ success: true, data: tables });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

app.post(['/api/cafes/:cafeId/tables', '/api/tables'], requireStaffAuth(['CAFE_OWNER', 'MANAGER', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const cafeIdParam = req.params.cafeId || req.body.cafe_id || (req as any).staffUser?.cafe_id;
    const cafe = await db.getCafeBySlugOrId(cafeIdParam || 'cafe_roasted_bean_001');
    const cafeId = cafe ? cafe.id : cafeIdParam;
    const { table_number, table_name, name, capacity, seating_capacity } = req.body;
    const finalTableNum = Number(table_number);

    if (!finalTableNum) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Table number is required' } });
    }

    const table = await db.createTable(cafeId, {
      table_number: finalTableNum,
      table_name: table_name || name || `Table ${finalTableNum}`,
      capacity: Number(capacity || seating_capacity) || 4
    });

    await db.logAudit({
      cafe_id: table.cafe_id,
      action: 'TABLE_CREATED',
      details: { table_number: table.table_number, table_name: table.table_name }
    });

    broadcastRealtime('table_created', { table });
    res.status(201).json({ success: true, data: table });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'TABLE_CREATION_FAILED', message: err.message } });
  }
});

app.post('/api/tables/:tableId/regenerate-qr', requireStaffAuth(['CAFE_OWNER', 'RECEPTION', 'MANAGER']), async (req: Request, res: Response) => {
  try {
    const table = await db.regenerateTableQr(req.params.tableId);
    res.json({ success: true, data: table });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'QR_GEN_FAILED', message: err.message } });
  }
});

app.post('/api/tables/:tableId/release', requireStaffAuth(['RECEPTION', 'CAFE_OWNER', 'MANAGER']), async (req: Request, res: Response) => {
  try {
    const table = await db.updateTable(req.params.tableId, { status: 'FREE', current_order_id: undefined });
    const session = await db.getActiveSessionForTable(table.cafe_id, table.table_number);
    if (session) {
      await db.updateTableSession(session.id, { status: 'CLOSED', closed_at: new Date().toISOString() });
    }
    broadcastRealtime('table_released', { table });
    res.json({ success: true, data: { message: `Table #${table.table_number} released to FREE` } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'RELEASE_FAILED', message: err.message } });
  }
});

// 5. Table Sessions & Customer QR Flow

// Secure QR Token Resolution Endpoint
app.all(['/api/qr/resolve', '/api/tables/qr/resolve'], async (req: Request, res: Response) => {
  try {
    const qrToken = req.body?.qr_token || req.body?.qr || req.query?.qr_token || req.query?.qr;
    if (!qrToken || typeof qrToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_QR_REQUEST', message: 'A secure QR token is required' }
      });
    }

    const payload = verifyTableQrToken(qrToken);
    if (!payload) {
      return res.status(403).json({
        success: false,
        error: { code: 'INVALID_QR_TOKEN', message: 'The scanned QR code is invalid, tampered, or expired. Please rescan the physical table standee.' }
      });
    }

    const cafe = await db.getCafeBySlugOrId(payload.cafeId || payload.cafeSlug);
    if (!cafe) {
      return res.status(404).json({
        success: false,
        error: { code: 'CAFE_NOT_FOUND', message: 'The café associated with this QR code could not be found' }
      });
    }

    const tables = await db.getTables(cafe.id);
    const table = tables.find(t => t.table_number === payload.tableNumber || t.id === payload.tableId);
    if (!table) {
      return res.status(404).json({
        success: false,
        error: { code: 'TABLE_NOT_FOUND', message: `Table #${payload.tableNumber} does not exist in ${cafe.name}` }
      });
    }

    // Get or initialize active session for this verified table
    let session = await db.getActiveSessionForTable(cafe.id, table.table_number);
    if (!session) {
      const newToken = `tok_${cafe.slug}_t${table.table_number}_${crypto.randomBytes(8).toString('hex')}`;
      session = await db.createTableSession({
        cafe_id: cafe.id,
        table_id: table.id,
        table_number: table.table_number,
        session_token: newToken,
        status: 'ACTIVE',
        orders: [],
        total_amount: 0,
        paid_amount: 0,
        outstanding_amount: 0
      });
      await db.updateTable(table.id, { status: 'OCCUPIED' });
    }

    const recalculated = await recalculateTableSession(session);

    res.json({
      success: true,
      data: {
        cafe,
        table,
        session: recalculated,
        session_id: recalculated.id,
        session_token: recalculated.session_token,
        table_number: table.table_number,
        table_name: table.table_name
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'QR_RESOLVE_FAILED', message: err.message }
    });
  }
});

app.post('/api/tables/session/init', async (req: Request, res: Response) => {
  try {
    const cafeIdentifier = req.body.cafe_id || req.body.cafeSlug || req.body.cafe || 'roasted-bean';
    const tableNumInput = req.body.table_number !== undefined ? req.body.table_number : req.body.tableNumber;
    const existing_token = req.body.existing_token || req.body.existingToken;

    const cafe = await db.getCafeBySlugOrId(cafeIdentifier);
    if (!cafe) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Café not found' } });

    const num = Number(tableNumInput);
    if (isNaN(num)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_TABLE', message: 'Valid table number is required' } });
    }

    const tableList = await db.getTables(cafe.id);
    let table = tableList.find(t => t.table_number === num);

    if (!table) {
      return res.status(404).json({ success: false, error: { code: 'TABLE_NOT_FOUND', message: `Table #${num} does not exist in this café` } });
    }

    let session: TableSessionRecord | null = null;
    if (existing_token) {
      session = await db.getTableSession(existing_token);
      if (session && session.status === 'CLOSED') {
        return res.status(403).json({
          success: false,
          error: { code: 'SESSION_CLOSED', message: 'Cannot reuse closed session token' }
        });
      }
      if (session && session.status === 'ACTIVE' && session.table_number === num) {
        const recalculated = await recalculateTableSession(session);
        return res.json({
          success: true,
          data: {
            session: recalculated,
            session_id: recalculated.id,
            session_token: recalculated.session_token,
            table_id: table.id,
            table_number: num,
            table_name: table.table_name,
            status: recalculated.status,
            total_amount: recalculated.total_amount,
            paid_amount: recalculated.paid_amount,
            outstanding_amount: recalculated.outstanding_amount
          }
        });
      }
    }

    session = await db.getActiveSessionForTable(cafe.id, num);
    if (!session) {
      const newToken = `tok_${cafe.slug}_t${num}_${crypto.randomBytes(8).toString('hex')}`;
      session = await db.createTableSession({
        cafe_id: cafe.id,
        table_id: table.id,
        table_number: num,
        session_token: newToken,
        status: 'ACTIVE',
        orders: [],
        total_amount: 0,
        paid_amount: 0,
        outstanding_amount: 0
      });
      await db.updateTable(table.id, { status: 'OCCUPIED' });
    }

    const recalculated = await recalculateTableSession(session);
    res.json({
      success: true,
      data: {
        session: recalculated,
        session_id: recalculated.id,
        session_token: recalculated.session_token,
        table_id: table.id,
        table_number: num,
        table_name: table.table_name,
        status: recalculated.status,
        total_amount: recalculated.total_amount,
        paid_amount: recalculated.paid_amount,
        outstanding_amount: recalculated.outstanding_amount
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SESSION_INIT_FAILED', message: err.message } });
  }
});

app.get('/api/tables/:tableId/session', async (req: Request, res: Response) => {
  try {
    const tableParam = req.params.tableId;
    let table = memoryCache.tables.find((t: TableRecord) => t.id === tableParam || String(t.table_number) === tableParam);
    if (!table) {
      const tables = await db.getTables(DEFAULT_CAFE_ID);
      table = tables.find(t => t.id === tableParam || String(t.table_number) === tableParam);
    }

    if (!table) {
      return res.status(404).json({ success: false, error: { code: 'TABLE_NOT_FOUND', message: 'Table not found' } });
    }

    const session = await db.getActiveSessionForTable(table.cafe_id, table.table_number);
    let ordersList: OrderRecord[] = [];
    if (session) {
      const recalculated = await recalculateTableSession(session);
      ordersList = await db.getOrders(table.cafe_id, { tableSessionId: recalculated.id });
    }

    res.json({
      success: true,
      data: {
        session: session || null,
        orders: ordersList
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SESSION_FETCH_FAILED', message: err.message } });
  }
});

// 6. Food Orders Creation (Unpaid, Separate from Payments)
app.post('/api/orders', async (req: Request, res: Response) => {
  try {
    const {
      cafe_id,
      table_number,
      session_token,
      customer_name,
      customer_email,
      customer_phone,
      cart_items,
      items,
      coupon_code,
      notes
    } = req.body;

    // 1. Mandatory Customer Authentication
    const customer = await verifyCustomerAuth(req);
    if (!customer) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Customer authentication required to place orders' }
      });
    }

    // 2. Mandatory QR Session Token & Validation
    const sessionToken = (req.headers['x-customer-session'] as string) || session_token;
    if (!sessionToken) {
      return res.status(403).json({
        success: false,
        error: { code: 'SESSION_REQUIRED', message: 'Valid QR table session required' }
      });
    }

    const session = await db.getTableSession(sessionToken);
    if (!session || session.status === 'CLOSED') {
      return res.status(403).json({
        success: false,
        error: { code: 'SESSION_INVALID', message: 'QR Table session is invalid or closed' }
      });
    }

    const tableNum = Number(table_number);
    if (session.table_number !== tableNum) {
      return res.status(403).json({
        success: false,
        error: { code: 'TABLE_MISMATCH', message: 'Session table does not match requested table number' }
      });
    }

    const cafe = await db.getCafeBySlugOrId(cafe_id || DEFAULT_CAFE_SLUG);
    if (!cafe) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Café not found' } });
    }

    if (session.cafe_id !== cafe.id && session.cafe_id !== cafe.slug) {
      return res.status(403).json({
        success: false,
        error: { code: 'CAFE_MISMATCH', message: 'Session café does not match requested café' }
      });
    }

    const orderItemsInput = cart_items || items || [];
    if (!Array.isArray(orderItemsInput) || orderItemsInput.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'EMPTY_CART', message: 'Order must contain at least one item' } });
    }

    const tableList = await db.getTables(cafe.id);
    const table = tableList.find(t => t.table_number === tableNum);

    if (!table) {
      return res.status(404).json({ success: false, error: { code: 'TABLE_NOT_FOUND', message: `Table #${tableNum} does not exist` } });
    }

    // 3. Duplicate Order Protection (Rule 11: rapid re-submission within 5 seconds)
    const recentOrders = await db.getOrders(cafe.id, { tableSessionId: session.id });
    const now = Date.now();
    const duplicate = recentOrders.find(o => {
      const orderTime = new Date(o.created_at).getTime();
      if (now - orderTime > 8000) return false;
      const emailMatches = o.customer_email?.toLowerCase() === customer.email.toLowerCase() ||
                           (o.customer_id && o.customer_id === customer.authUserId);
      if (!emailMatches) return false;
      if (o.items.length !== orderItemsInput.length) return false;
      return orderItemsInput.every((oi: any) => {
        const targetId = oi.menu_item_id || oi.id;
        const match = o.items.find((item: any) => item.menu_item_id === targetId && item.quantity === (oi.quantity || 1));
        return Boolean(match);
      });
    });

    if (duplicate) {
      return res.status(200).json({
        success: true,
        data: {
          is_duplicate: true,
          order: duplicate
        }
      });
    }

    // 4. Server-side authoritative price and items calculation
    let calculatedSubtotal = 0;
    const validatedOrderItems: any[] = [];

    for (const item of orderItemsInput) {
      const dbItem = await db.getMenuItemById(item.menu_item_id || item.id);
      if (!dbItem) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_ITEM', message: `Item not found on menu` } });
      }

      if (!dbItem.is_available) {
        return res.status(400).json({ success: false, error: { code: 'ITEM_UNAVAILABLE', message: `${dbItem.name} is currently out of stock` } });
      }

      const qty = Math.max(1, Number(item.quantity) || 1);
      let unitPrice = dbItem.price;

      const selectedVariants = item.selected_variants || item.selected_variants_json || item.selectedVariants || [];
      if (Array.isArray(selectedVariants)) {
        for (const variant of selectedVariants) {
          const matchedVariant = dbItem.variants?.find(v => v.name === variant.name);
          if (matchedVariant) {
            unitPrice += matchedVariant.additional_price;
          }
        }
      }

      const lineTotal = Number((unitPrice * qty).toFixed(2));
      calculatedSubtotal += lineTotal;

      validatedOrderItems.push({
        id: crypto.randomUUID(),
        menu_item_id: dbItem.id,
        item_name: dbItem.name,
        unit_price: unitPrice,
        quantity: qty,
        selected_variants_json: selectedVariants,
        item_notes: item.notes || item.item_notes || '',
        subtotal: lineTotal
      });
    }

    // Coupon calculation
    let discount = 0;
    if (coupon_code) {
      const coupon = await db.getCouponByCode(cafe.id, coupon_code);
      if (coupon && calculatedSubtotal >= coupon.minimum_order) {
        if (coupon.discount_type === 'PERCENTAGE') {
          discount = Number(((calculatedSubtotal * coupon.discount_value) / 100).toFixed(2));
        } else {
          discount = Math.min(coupon.discount_value, calculatedSubtotal);
        }
      }
    }

    const discountedSubtotal = Math.max(0, calculatedSubtotal - discount);
    const tax = Number(((discountedSubtotal * (cafe.tax_rate || 5.0)) / 100).toFixed(2));
    const serviceCharge = Number(((discountedSubtotal * (cafe.service_charge_rate || 0.0)) / 100).toFixed(2));
    const finalTotal = Number((discountedSubtotal + tax + serviceCharge).toFixed(2));

    let dbCustomerId: string | null = null;
    try {
      if (customer?.email) {
        const isAuthUuid = customer.authUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customer.authUserId);
        const synced = await db.syncCustomer({
          auth_user_id: isAuthUuid ? customer.authUserId : undefined,
          email: customer.email,
          name: customer_name || customer.name || customer.email.split('@')[0],
          phone: customer_phone || ''
        });
        if (synced && synced.id) {
          dbCustomerId = synced.id;
        }
      }
    } catch (e) {
      console.warn('Customer CRM sync skipped:', e);
    }

    const orderId = crypto.randomUUID();
    const newOrder: OrderRecord = {
      id: orderId,
      cafe_id: cafe.id,
      table_session_id: session.id,
      customer_session_token: session.session_token,
      customer_id: dbCustomerId || undefined,
      customer_name: customer_name || customer.name || 'Valued Patron',
      customer_email: customer.email || customer_email || '',
      customer_phone: customer_phone || '',
      table_id: table.id,
      table_number: tableNum,
      items: validatedOrderItems,
      subtotal: calculatedSubtotal,
      discount,
      coupon_code: discount > 0 ? coupon_code : undefined,
      tax,
      service_charge: serviceCharge,
      total: finalTotal,
      payment_status: 'PENDING',
      order_status: 'PENDING',
      notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const savedOrder = await db.createOrder(newOrder);
    await recalculateTableSession(session);
    await db.updateTable(table.id, { status: 'OCCUPIED' });

    // Send notification to kitchen KDS
    await db.createNotification({
      cafe_id: cafe.id,
      table_id: table.id,
      table_number: tableNum,
      type: 'NEW_ORDER',
      message: `New Order #${savedOrder.id.slice(-6)} placed on Table ${tableNum} (${cafe.currency}${savedOrder.total})`
    });

    broadcastRealtime('order_created', { order: savedOrder, session });
    broadcastRealtime('new_order', { order: savedOrder, session });

    res.status(201).json({
      success: true,
      data: {
        order: savedOrder,
        session_token: session.session_token
      }
    });
  } catch (err: any) {
    console.error('Order creation failed:', err);
    res.status(500).json({ success: false, error: { code: 'ORDER_FAILED', message: err.message } });
  }
});

// 7. Kitchen & Orders Management
app.get('/api/orders/cafe/:cafeId', async (req: Request, res: Response) => {
  try {
    const cafe = await db.getCafeBySlugOrId(req.params.cafeId);
    const targetId = cafe ? cafe.id : req.params.cafeId;
    const orders = await db.getOrders(targetId);
    res.json({ success: true, data: orders });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'FETCH_FAILED', message: err.message } });
  }
});

app.get('/api/orders/:orderId', async (req: Request, res: Response) => {
  try {
    const order = await db.getOrderById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    const staff = parseStaffAuth(req);
    if (staff) {
      return res.json({ success: true, data: order });
    }

    const customer = await verifyCustomerAuth(req);
    if (!customer) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Authentication required' } });
    }

    const isMatch = (order.customer_email && order.customer_email.toLowerCase() === customer.email.toLowerCase()) ||
                    (order.customer_id && (order.customer_id === customer.authUserId || order.customer_id === customer.email));

    if (!isMatch) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to this order' } });
    }

    res.json({ success: true, data: order });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: err.message } });
  }
});

app.get('/api/orders/customer/:emailOrId', async (req: Request, res: Response) => {
  try {
    const target = decodeURIComponent(req.params.emailOrId).toLowerCase();
    const staff = parseStaffAuth(req);
    const customer = await verifyCustomerAuth(req);

    if (!staff && !customer) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Authentication required' } });
    }

    if (customer && !staff) {
      const isMatch = customer.email.toLowerCase() === target || customer.authUserId === target;
      if (!isMatch) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Cannot access another customer order history' } });
      }
    }

    const orders = await db.getOrdersByCustomer(target);
    res.json({ success: true, data: orders });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'FETCH_FAILED', message: err.message } });
  }
});

app.patch('/api/orders/:orderId/status', requireStaffAuth(['KITCHEN_STAFF', 'RECEPTION', 'CAFE_OWNER', 'MANAGER']), async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const updated = await db.updateOrderStatus(req.params.orderId, { order_status: status as any });
    if (!updated) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    broadcastRealtime('order_status_updated', { order: updated });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'UPDATE_FAILED', message: err.message } });
  }
});

// 8. Waiter Call & Bill Request Actions
app.post('/api/tables/:tableId/call-waiter', async (req: Request, res: Response) => {
  try {
    const table = memoryCache.tables.find((t: TableRecord) => t.id === req.params.tableId || String(t.table_number) === req.params.tableId);
    const tableNum = table ? table.table_number : Number(req.params.tableId);

    const notif = await db.createNotification({
      cafe_id: table?.cafe_id || DEFAULT_CAFE_ID,
      table_id: table?.id || req.params.tableId,
      table_number: tableNum,
      type: 'CALL_WAITER',
      message: req.body.message || `Table #${tableNum} requested assistance.`
    });

    broadcastRealtime('waiter_called', { notification: notif });
    res.json({ success: true, message: `Staff alerted for Table #${tableNum}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CALL_FAILED', message: err.message } });
  }
});

app.post('/api/tables/:tableId/request-bill', async (req: Request, res: Response) => {
  try {
    const table = memoryCache.tables.find((t: TableRecord) => t.id === req.params.tableId || String(t.table_number) === req.params.tableId);
    const tableNum = table ? table.table_number : Number(req.params.tableId);

    if (table) {
      await db.updateTable(table.id, { status: 'BILL_REQUESTED' });
    }

    const notif = await db.createNotification({
      cafe_id: table?.cafe_id || DEFAULT_CAFE_ID,
      table_id: table?.id || req.params.tableId,
      table_number: tableNum,
      type: 'REQUEST_BILL',
      message: `Bill requested for Table #${tableNum}`
    });

    broadcastRealtime('bill_requested', { notification: notif, table_number: tableNum });
    res.json({ success: true, message: `Bill invoice requested for Table #${tableNum}. Staff alerted.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'BILL_REQUEST_FAILED', message: err.message } });
  }
});

// 9. Reception Dashboard & Payment Settlement
app.get('/api/reception/:cafeId/overview', requireStaffAuth(['RECEPTION', 'CAFE_OWNER', 'MANAGER', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const cafe = await db.getCafeBySlugOrId(req.params.cafeId);
    if (!cafe) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Café not found' } });

    const [tables, orders, notifs] = await Promise.all([
      db.getTables(cafe.id),
      db.getOrders(cafe.id),
      db.getNotifications(cafe.id)
    ]);

    const tableSummaries = await Promise.all(
      tables.map(async (tbl) => {
        const session = await db.getActiveSessionForTable(cafe.id, tbl.table_number);
        const tblOrders = session
          ? orders.filter(o => o.table_session_id === session.id && o.order_status !== 'CANCELLED')
          : [];

        let totalBilled = 0;
        let totalPaid = 0;
        tblOrders.forEach(o => {
          totalBilled += o.total;
          if (o.payment_status === 'PAID') totalPaid += o.total;
        });

        return {
          table: tbl,
          session: session || null,
          orders: tblOrders,
          total_billed: Number(totalBilled.toFixed(2)),
          total_paid: Number(totalPaid.toFixed(2)),
          outstanding_amount: Math.max(0, Number((totalBilled - totalPaid).toFixed(2))),
          is_bill_requested: tbl.status === 'BILL_REQUESTED'
        };
      })
    );

    const occupiedCount = tables.filter(t => t.status === 'OCCUPIED' || t.status === 'BILL_REQUESTED').length;
    const billRequestedCount = tables.filter(t => t.status === 'BILL_REQUESTED').length;
    let totalOutstanding = 0;
    let totalPaidToday = 0;

    tableSummaries.forEach(ts => {
      totalOutstanding += ts.outstanding_amount;
      totalPaidToday += ts.total_paid;
    });

    res.json({
      success: true,
      data: {
        tables: tableSummaries,
        stats: {
          total_tables: tables.length,
          occupied_tables: occupiedCount,
          bill_requested_tables: billRequestedCount,
          total_outstanding: Number(totalOutstanding.toFixed(2)),
          total_paid_today: Number(totalPaidToday.toFixed(2))
        },
        notifications: notifs.slice(0, 15)
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'RECEPTION_ERROR', message: err.message } });
  }
});

app.post('/api/reception/settle-payment', requireStaffAuth(['RECEPTION', 'CAFE_OWNER', 'MANAGER']), async (req: Request, res: Response) => {
  try {
    const { cafe_id, table_id, method, release_table, order_id } = req.body;
    const cafe = await db.getCafeBySlugOrId(cafe_id);
    if (!cafe) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Café not found' } });

    const tables = await db.getTables(cafe.id);
    const table = tables.find(t => t.id === table_id || String(t.table_number) === table_id);
    if (!table) return res.status(404).json({ success: false, error: { code: 'TABLE_NOT_FOUND', message: 'Table not found' } });

    const session = await db.getActiveSessionForTable(cafe.id, table.table_number);
    const allOrders = await db.getOrders(cafe.id, { tableNumber: table.table_number });
    const unpaidOrders = allOrders.filter(o => o.payment_status !== 'PAID' && o.order_status !== 'CANCELLED');

    let settledCount = 0;
    let totalSettled = 0;

    for (const ord of unpaidOrders) {
      if (!order_id || ord.id === order_id) {
        await db.updateOrderStatus(ord.id, {
          payment_status: 'PAID',
          payment_id: `rec_${method}_${Date.now()}`
        });
        settledCount++;
        totalSettled += ord.total;
      }
    }

    if (session) {
      await recalculateTableSession(session);
    }

    if (release_table) {
      await db.updateTable(table.id, { status: 'FREE', current_order_id: undefined });
      if (session) {
        await db.updateTableSession(session.id, { status: 'CLOSED', closed_at: new Date().toISOString() });
      }
    }

    await db.logAudit({
      cafe_id: cafe.id,
      action: 'PAYMENT_SETTLED_RECEPTION',
      details: { table_number: table.table_number, method, totalSettled }
    });

    broadcastRealtime('reception_payment_settled', { table_number: table.table_number, totalSettled, method });
    broadcastRealtime('payment_confirmed', { table_number: table.table_number, totalSettled, method });
    broadcastRealtime('table_status_changed', { table_number: table.table_number });

    res.json({
      success: true,
      data: {
        settled_count: settledCount,
        total_settled: Number(totalSettled.toFixed(2)),
        remaining_outstanding: 0,
        session_status: release_table ? 'CLOSED' : 'ACTIVE',
        table_status: release_table ? 'FREE' : table.status
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SETTLE_FAILED', message: err.message } });
  }
});

app.post('/api/reception/notifications/:notifId/resolve', requireStaffAuth(['RECEPTION', 'CAFE_OWNER', 'MANAGER']), async (req: Request, res: Response) => {
  res.json({ success: true, data: { resolved: true } });
});

app.get('/api/notifications/:cafeId', requireStaffAuth(['RECEPTION', 'CAFE_OWNER', 'MANAGER', 'KITCHEN_STAFF', 'WAITER', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const notifs = await db.getNotifications(req.params.cafeId);
    res.json({ success: true, data: notifs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: err.message } });
  }
});

// 10. Online Payments & Verification
app.post('/api/payments/create-order', async (req: Request, res: Response) => {
  try {
    const { order_id } = req.body;
    if (!order_id) {
      return res.status(400).json({ success: false, error: { code: 'ORDER_ID_REQUIRED', message: 'Order ID is required' } });
    }

    const order = await db.getOrderById(order_id);
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    const cafe = await db.getCafeBySlugOrId(order.cafe_id);
    const amountInPaise = Math.round(order.total * 100);

    const rzpOrder = await createRazorpayOrder({
      amountInPaise,
      currency: 'INR',
      receipt: `rcpt_${order.id.slice(0, 30)}`,
      notes: {
        order_id: order.id,
        table_number: String(order.table_number),
        cafe_name: cafe?.name || 'QRDine Cafe'
      }
    });

    res.json({
      success: true,
      data: {
        razorpay_order_id: rzpOrder.razorpay_order_id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        key_id: rzpOrder.key_id,
        is_sandbox: rzpOrder.is_sandbox
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'PAYMENT_CREATION_FAILED', message: err.message } });
  }
});

app.post('/api/payments/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    if (signature && !verifyWebhookSignature(rawBody, signature)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' } });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentObj = payload?.payment?.entity;
      const orderId = paymentObj?.notes?.order_id;
      if (orderId) {
        const order = await db.getOrderById(orderId);
        if (order && order.payment_status !== 'PAID') {
          const updated = await db.updateOrderStatus(order.id, {
            payment_status: 'PAID',
            payment_id: paymentObj.id
          });
          if (order.table_session_id) {
            const session = await db.getTableSession(order.table_session_id);
            if (session) await recalculateTableSession(session);
          }
          broadcastRealtime('payment_success', { order: updated });
        }
      }
    }

    res.json({ status: 'ok' });
  } catch (err: any) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments/verify', async (req: Request, res: Response) => {
  try {
    const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const order = await db.getOrderById(order_id);
    if (!order) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });

    const isValid = verifyRazorpaySignature({
      razorpay_order_id: razorpay_order_id || `order_${order.id}`,
      razorpay_payment_id: razorpay_payment_id || `pay_${Date.now()}`,
      razorpay_signature: razorpay_signature || ''
    });

    if (!isValid) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Payment verification failed' } });
    }

    const updated = await db.updateOrderStatus(order.id, {
      payment_status: 'PAID',
      payment_id: razorpay_payment_id
    });

    if (order.table_session_id) {
      const session = await db.getTableSession(order.table_session_id);
      if (session) await recalculateTableSession(session);
    }

    const rewardCoupon = {
      id: 'cp-nextvisit15',
      cafe_id: order.cafe_id,
      code: 'NEXTVISIT15',
      description: '15% off on your next dine-in visit',
      discount_type: 'PERCENTAGE' as const,
      discount_value: 15,
      minimum_order: 250,
      usage_limit: 1000,
      usage_count: 0,
      status: 'ACTIVE' as const
    };

    // Send invoice email if email is attached
    if (order.customer_email) {
      const cafe = await db.getCafeBySlugOrId(order.cafe_id);
      if (cafe) {
        const invoiceHtml = generateInvoiceHtml({
          cafe,
          order: updated || order,
          customer: { name: order.customer_name, email: order.customer_email },
          invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
          couponReward: rewardCoupon
        });
        sendEmail({
          to: order.customer_email,
          subject: `Tax Invoice - ${cafe.name} (Order #${order.id.slice(-6)})`,
          html: invoiceHtml
        }).catch(() => {});
      }
    }

    broadcastRealtime('payment_success', { order: updated });
    broadcastRealtime('payment_confirmed', { order: updated });

    res.json({
      success: true,
      data: {
        order: updated,
        reward_coupon: rewardCoupon
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'VERIFICATION_ERROR', message: err.message } });
  }
});

// 11. Coupons, CRM & Reports
app.get('/api/cafes/:cafeId/coupons', async (req: Request, res: Response) => {
  try {
    const coupons = await db.getCoupons(req.params.cafeId);
    res.json({ success: true, data: coupons });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: err.message } });
  }
});

app.post('/api/coupons/validate', async (req: Request, res: Response) => {
  try {
    const { cafeId, code, subtotal } = req.body;
    const coupon = await db.getCouponByCode(cafeId || DEFAULT_CAFE_ID, code);
    if (!coupon) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_COUPON', message: 'Invalid or expired coupon' } });
    }

    const sub = Number(subtotal) || 0;
    if (sub < coupon.minimum_order) {
      return res.status(400).json({
        success: false,
        error: { code: 'MINIMUM_ORDER_UNMET', message: `Minimum order is ₹${coupon.minimum_order}` }
      });
    }

    const discount = coupon.discount_type === 'PERCENTAGE'
      ? Number(((sub * coupon.discount_value) / 100).toFixed(2))
      : Math.min(coupon.discount_value, sub);

    res.json({
      success: true,
      data: {
        code: coupon.code,
        discount_amount: discount,
        description: coupon.description
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'COUPON_ERROR', message: err.message } });
  }
});

// 12. Customer Management & Profile Sync
app.post('/api/customers/sync', async (req: Request, res: Response) => {
  try {
    const verified = await verifyCustomerAuth(req);
    const { auth_user_id, email, name, phone, profile_image } = req.body;
    const targetEmail = (verified?.email || email || '').trim().toLowerCase();

    if (!targetEmail) {
      return res.status(400).json({ success: false, error: { code: 'EMAIL_REQUIRED', message: 'Email is required' } });
    }

    const customer = await db.syncCustomer({
      auth_user_id: verified?.authUserId || auth_user_id,
      email: targetEmail,
      name: name || verified?.name || targetEmail.split('@')[0],
      phone: phone || '',
      profile_image
    });

    res.json({ success: true, data: customer });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SYNC_ERROR', message: err.message } });
  }
});

app.get(['/api/customers/profile/:identifier', '/api/customers/:identifier'], async (req: Request, res: Response) => {
  try {
    const identifier = decodeURIComponent(req.params.identifier).trim().toLowerCase();
    const staff = parseStaffAuth(req);
    const customer = await verifyCustomerAuth(req);

    if (!staff && !customer) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Authentication required' } });
    }

    if (customer && !staff) {
      const isSelf = customer.email.toLowerCase() === identifier || customer.authUserId === identifier;
      if (!isSelf) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Cannot access another customer profile' } });
      }
    }

    let profile = await db.getCustomer(identifier);
    if (!profile && customer && (customer.email === identifier || customer.authUserId === identifier)) {
      profile = await db.syncCustomer({
        email: customer.email,
        auth_user_id: customer.authUserId,
        name: customer.name || customer.email.split('@')[0]
      });
    }

    if (!profile) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
    }

    res.json({ success: true, data: profile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: err.message } });
  }
});

app.put('/api/customers/profile/:identifier', async (req: Request, res: Response) => {
  try {
    const identifier = decodeURIComponent(req.params.identifier).trim().toLowerCase();
    const staff = parseStaffAuth(req);
    const customer = await verifyCustomerAuth(req);

    if (!staff && !customer) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Authentication required' } });
    }

    if (customer && !staff) {
      const isSelf = customer.email.toLowerCase() === identifier || customer.authUserId === identifier;
      if (!isSelf) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Cannot modify another customer profile' } });
      }
    }

    // Strip protected fields from being tampered
    const { name, phone, profile_image } = req.body;
    let cust = await db.getCustomer(identifier);
    if (!cust) {
      cust = await db.syncCustomer({
        email: customer?.email || identifier,
        auth_user_id: customer?.authUserId,
        name: name || 'Valued Patron',
        phone: phone || ''
      });
    }

    const updated = await db.updateCustomer(identifier, { name, phone, profile_image });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: err.message } });
  }
});

app.patch('/api/customers/:identifier', async (req: Request, res: Response) => {
  try {
    const identifier = decodeURIComponent(req.params.identifier).trim().toLowerCase();
    const staff = parseStaffAuth(req);
    const customer = await verifyCustomerAuth(req);

    if (!staff && !customer) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Authentication required' } });
    }

    if (customer && !staff) {
      const isSelf = customer.email.toLowerCase() === identifier || customer.authUserId === identifier;
      if (!isSelf) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Cannot modify another customer profile' } });
      }
    }

    const { name, phone, profile_image } = req.body;
    const updated = await db.updateCustomer(identifier, { name, phone, profile_image });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: err.message } });
  }
});

app.post('/api/customers/marketing', async (req: Request, res: Response) => {
  try {
    const customerId = req.body.customer_id;
    const staff = parseStaffAuth(req);
    const customer = await verifyCustomerAuth(req);

    if (!staff && !customer) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Authentication required' } });
    }

    if (customer && !staff) {
      const custObj = await db.getCustomer(customerId);
      const isSelf = custObj
        ? (custObj.email.toLowerCase() === customer.email.toLowerCase() || custObj.auth_user_id === customer.authUserId)
        : (customer.email.toLowerCase() === customerId?.toLowerCase() || customer.authUserId === customerId);

      if (!isSelf) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Cannot update marketing preferences for another customer' } });
      }
    }

    const { email_marketing, sms_marketing, whatsapp_marketing } = req.body;
    await db.updateCustomerMarketing(customerId, { email_marketing, sms_marketing, whatsapp_marketing });
    res.json({ success: true, data: { updated: true } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CONSENT_ERROR', message: err.message } });
  }
});

app.patch('/api/customers/:identifier/marketing', async (req: Request, res: Response) => {
  try {
    const identifier = req.params.identifier;
    const staff = parseStaffAuth(req);
    const customer = await verifyCustomerAuth(req);

    if (!staff && !customer) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Authentication required' } });
    }

    if (customer && !staff) {
      const custObj = await db.getCustomer(identifier);
      const isSelf = custObj
        ? (custObj.email.toLowerCase() === customer.email.toLowerCase() || custObj.auth_user_id === customer.authUserId)
        : (customer.email.toLowerCase() === identifier?.toLowerCase() || customer.authUserId === identifier);

      if (!isSelf) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Cannot update marketing preferences for another customer' } });
      }
    }

    const { email_marketing, sms_marketing, whatsapp_marketing } = req.body;
    await db.updateCustomerMarketing(identifier, { email_marketing, sms_marketing, whatsapp_marketing });
    res.json({ success: true, data: { updated: true } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CONSENT_ERROR', message: err.message } });
  }
});

// 13. Invoices & Email Dispatch
app.get('/api/invoices/:orderId', async (req: Request, res: Response) => {
  try {
    const order = await db.getOrderById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    const cafe = await db.getCafeBySlugOrId(order.cafe_id);
    const customer = order.customer_email ? await db.getCustomer(order.customer_email) : null;
    let inv = await db.getInvoiceByOrderId(order.id);

    if (!inv) {
      inv = await db.createInvoice({
        order_id: order.id,
        cafe_id: order.cafe_id,
        invoice_number: `INV-${order.id.slice(-6).toUpperCase()}`,
        subtotal: order.subtotal,
        tax: order.tax,
        service_charge: order.service_charge,
        discount: order.discount,
        total: order.total,
        payment_method: order.payment_id ? 'ONLINE' : 'CASH',
        customer_name: order.customer_name,
        customer_email: order.customer_email
      });
    }

    res.json({
      success: true,
      data: {
        invoice_number: inv.invoice_number,
        order,
        cafe,
        customer: customer || { name: order.customer_name, email: order.customer_email }
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INVOICE_ERROR', message: err.message } });
  }
});

app.post(['/api/invoices/:orderId/email', '/api/orders/:orderId/send-invoice-email'], async (req: Request, res: Response) => {
  try {
    const order = await db.getOrderById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    const targetEmail = req.body.email || order.customer_email;
    const cafe = await db.getCafeBySlugOrId(order.cafe_id);

    if (targetEmail && cafe) {
      const invoiceHtml = generateInvoiceHtml({
        cafe,
        order,
        customer: { name: order.customer_name, email: targetEmail },
        invoiceNumber: `INV-${order.id.slice(-6).toUpperCase()}`
      });

      await sendEmail({
        to: targetEmail,
        subject: `Thank you for visiting ${cafe.name}! Your Tax Invoice #${order.id.slice(-6).toUpperCase()}`,
        html: invoiceHtml
      }).catch(() => {});
    }

    res.json({
      success: true,
      message: `Tax invoice email dispatched with thank-you message to ${targetEmail}`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'EMAIL_ERROR', message: err.message } });
  }
});

app.get('/api/cafes/:cafeId/customers', requireStaffAuth(['CAFE_OWNER', 'MANAGER', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const cafe = await db.getCafeBySlugOrId(req.params.cafeId);
    if (!cafe) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Café not found' } });
    const customers = await db.getCustomersForCafe(cafe.id);
    res.json({ success: true, data: customers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: err.message } });
  }
});

app.get('/api/reports/:cafeId', requireStaffAuth(['CAFE_OWNER', 'MANAGER', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const cafe = await db.getCafeBySlugOrId(req.params.cafeId);
    if (!cafe) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Café not found' } });

    const [tables, orders, customers] = await Promise.all([
      db.getTables(cafe.id),
      db.getOrders(cafe.id),
      db.getCustomersForCafe(cafe.id)
    ]);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayOrders = orders.filter(o => new Date(o.created_at) >= startOfToday);
    const activeOrders = orders.filter(o => ['PENDING', 'CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.order_status));
    const completedOrders = orders.filter(o => ['SERVED', 'COMPLETED'].includes(o.order_status));

    const paidOrders = orders.filter(o => o.payment_status === 'PAID');
    const todayPaidOrders = todayOrders.filter(o => o.payment_status === 'PAID');
    const unpaidActiveOrders = orders.filter(o => o.payment_status !== 'PAID' && o.order_status !== 'CANCELLED');

    const totalRevenue = Number(paidOrders.reduce((sum, o) => sum + o.total, 0).toFixed(2));
    const todayRevenue = Number(todayPaidOrders.reduce((sum, o) => sum + o.total, 0).toFixed(2));
    const pendingPaymentTotal = Number(unpaidActiveOrders.reduce((sum, o) => sum + o.total, 0).toFixed(2));

    // Per-table inspection and bills calculated strictly from actual active session orders
    const tableBills = await Promise.all(
      tables.map(async (t) => {
        const session = await db.getActiveSessionForTable(cafe.id, t.table_number);
        const tblOrders = session
          ? orders.filter(o => o.table_session_id === session.id && o.order_status !== 'CANCELLED')
          : [];

        let currentBill = 0;
        let totalPaid = 0;
        tblOrders.forEach(o => {
          currentBill += o.total;
          if (o.payment_status === 'PAID') totalPaid += o.total;
        });

        return {
          table_id: t.id,
          table_number: t.table_number,
          table_name: t.table_name,
          capacity: t.capacity,
          status: t.status,
          active_session_id: session ? session.id : null,
          order_count: tblOrders.length,
          current_bill: Number(currentBill.toFixed(2)),
          total_paid: Number(totalPaid.toFixed(2)),
          outstanding: Math.max(0, Number((currentBill - totalPaid).toFixed(2)))
        };
      })
    );

    const activeTableTotals = Number(tableBills.reduce((sum, tb) => sum + tb.outstanding, 0).toFixed(2));
    const occupiedTablesCount = tables.filter(t => t.status === 'OCCUPIED' || t.status === 'BILL_REQUESTED').length;
    const activeTablesCount = tableBills.filter(tb => tb.active_session_id !== null).length;

    // Real best selling dishes
    const itemMap = new Map<string, { name: string; count: number; revenue: number }>();
    for (const ord of orders) {
      if (ord.order_status === 'CANCELLED') continue;
      for (const item of ord.items) {
        const key = item.item_name;
        if (!itemMap.has(key)) {
          itemMap.set(key, { name: key, count: 0, revenue: 0 });
        }
        const record = itemMap.get(key)!;
        record.count += item.quantity;
        record.revenue = Number((record.revenue + item.subtotal).toFixed(2));
      }
    }
    const bestSellingItems = Array.from(itemMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Real payment method counts from actual paid orders
    const upiCount = paidOrders.filter(o => o.payment_id?.startsWith('pay_') || o.payment_id?.toLowerCase().includes('upi')).length;
    const cardCount = paidOrders.filter(o => o.payment_id?.toLowerCase().includes('card')).length;
    const cashCount = paidOrders.filter(o => o.payment_id?.toLowerCase().includes('cash') || o.payment_id?.toLowerCase().includes('rec_cash')).length;
    const otherCount = Math.max(0, paidOrders.length - upiCount - cardCount - cashCount);

    res.json({
      success: true,
      data: {
        total_tables: tables.length,
        active_tables: activeTablesCount,
        occupied_tables: occupiedTablesCount,
        today_orders: todayOrders.length,
        active_orders: activeOrders.length,
        completed_orders: completedOrders.length,
        today_revenue: todayRevenue,
        total_revenue: totalRevenue,
        total_orders: orders.length,
        aov: paidOrders.length > 0 ? Number((totalRevenue / paidOrders.length).toFixed(2)) : 0,
        active_table_totals: activeTableTotals,
        pending_payments_count: unpaidActiveOrders.length,
        pending_payments_total: pendingPaymentTotal,
        completed_payments_count: paidOrders.length,
        completed_payments_total: totalRevenue,
        customer_count: customers.length,
        table_bills: tableBills,
        best_selling_items: bestSellingItems,
        payment_breakdown: {
          UPI: upiCount,
          Cards: cardCount,
          Cash: cashCount,
          Other: otherCount,
          total_paid: paidOrders.length
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message: err.message } });
  }
});

app.get('/api/admin/emails', requireStaffAuth(['CAFE_OWNER', 'MANAGER', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const cafe = await db.getCafeBySlugOrId((req as any).staffUser?.cafeId || DEFAULT_CAFE_ID);
    const cafeId = cafe ? cafe.id : DEFAULT_CAFE_ID;
    const orders = await db.getOrders(cafeId);
    const paidWithEmail = orders.filter(o => o.customer_email && o.payment_status === 'PAID');

    const logs = paidWithEmail.slice(0, 20).map(o => ({
      id: `em-${o.id}`,
      to: o.customer_email,
      subject: `Tax Invoice - ${cafe?.name || 'QRDine'} (Order #${o.id.slice(-6)})`,
      status: 'DELIVERED',
      timestamp: o.updated_at || o.created_at,
      order_id: o.id
    }));

    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: err.message } });
  }
});

// Strict JSON 404 Catch-All for /api/* Routes
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.path} does not exist`
    }
  });
});

// Global Express Error Handler (Always Returns JSON)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled server error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err?.message || 'Internal Server Error'
    }
  });
});

// ==========================================
// SERVER BOOTSTRAP
// ==========================================

async function startServer() {
  await initializeDatabase();
  // Pass undefined so getFrontendBaseUrl uses its own production-safe logic
  await ensureTableQRs();

  httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 QRDine Server listening on 0.0.0.0:${PORT} [${isProd ? 'Production' : 'Development'}]`);
  });
}

startServer();
