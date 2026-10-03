import crypto from 'crypto';
import { Request } from 'express';

const isProd = process.env.NODE_ENV === 'production';
export const SESSION_SECRET = (process.env.SESSION_SECRET || 'qrdine-super-secure-production-hmac-key-2026').trim();

if (isProd && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.includes('fallback'))) {
  console.warn('⚠️ WARNING: Set a strong SESSION_SECRET in production.');
}

const EFFECTIVE_SECRET = SESSION_SECRET;

export interface StaffTokenPayload {
  id: string;
  userId?: string;
  cafeId: string;
  email: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'CAFE_OWNER' | 'MANAGER' | 'RECEPTION' | 'KITCHEN_STAFF' | 'WAITER';
  iat: number;
  exp: number;
}

export function hashPassword(password: string): string {
  return crypto
    .createHmac('sha256', EFFECTIVE_SECRET)
    .update(password)
    .digest('hex');
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;
  const hash = hashPassword(password);
  try {
    const hashBuf = Buffer.from(hash);
    const storedBuf = Buffer.from(storedHash);
    if (hashBuf.length === storedBuf.length && crypto.timingSafeEqual(hashBuf, storedBuf)) {
      return true;
    }
  } catch {}

  // Fallback for standard sha256 or direct comparison during migration
  const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
  return hash === storedHash || sha256Hash === storedHash || password === storedHash;
}

export function createStaffToken(user: {
  id: string;
  user_id?: string;
  cafe_id: string;
  email: string;
  full_name: string;
  role: string;
}): string {
  const payload: StaffTokenPayload = {
    id: user.id,
    userId: user.user_id,
    cafeId: user.cafe_id,
    email: user.email,
    fullName: user.full_name,
    role: user.role as any,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 7 // 7 days validity
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', EFFECTIVE_SECRET)
    .update(payloadStr)
    .digest('base64url');

  return `${payloadStr}.${signature}`;
}

export function verifyStaffToken(token: string): StaffTokenPayload | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadStr, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', EFFECTIVE_SECRET)
      .update(payloadStr)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload: StaffTokenPayload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    if (payload.exp) {
      // Support both seconds and milliseconds exp timestamps
      const now = payload.exp > 100000000000 ? Date.now() : Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return null; // Expired
      }
    }

    return payload;
  } catch {
    return null;
  }
}

export interface TableQrPayload {
  cafeId: string;
  cafeSlug: string;
  tableNumber: number;
  tableId: string;
  iat?: number;
}

export function createTableQrToken(data: {
  cafeId: string;
  cafeSlug: string;
  tableNumber: number;
  tableId: string;
}): string {
  const payload: TableQrPayload = {
    cafeId: data.cafeId,
    cafeSlug: data.cafeSlug,
    tableNumber: data.tableNumber,
    tableId: data.tableId,
    iat: Math.floor(Date.now() / 1000)
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', EFFECTIVE_SECRET)
    .update(`table_qr:${payloadStr}`)
    .digest('base64url');

  return `${payloadStr}.${signature}`;
}

export function verifyTableQrToken(token: string): TableQrPayload | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.trim().split('.');
    if (parts.length !== 2) return null;

    const [payloadStr, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', EFFECTIVE_SECRET)
      .update(`table_qr:${payloadStr}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload: TableQrPayload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    if (!payload.cafeId || !payload.tableNumber) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function verifyCustomerAuth(reqOrToken: Request | string): Promise<{ email: string; authUserId: string; name?: string } | null> {
  let token: string | null = null;
  if (typeof reqOrToken === 'string') {
    token = reqOrToken.startsWith('Bearer ') ? reqOrToken.slice(7).trim() : reqOrToken.trim();
  } else if (reqOrToken && typeof reqOrToken === 'object') {
    const authHeader = reqOrToken.headers?.authorization;
    token = (reqOrToken.headers?.['x-customer-token'] as string) || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null);
  }

  if (!token) {
    if (!isProd && reqOrToken && typeof reqOrToken === 'object') {
      const custEmail = (reqOrToken.headers?.['x-customer-email'] as string) || (reqOrToken.headers?.['x-customer-auth-id'] as string);
      if (custEmail) {
        return {
          email: custEmail.toLowerCase(),
          authUserId: (reqOrToken.headers?.['x-customer-auth-id'] as string) || crypto.randomUUID(),
          name: (reqOrToken.headers?.['x-customer-name'] as string) || custEmail.split('@')[0]
        };
      }
    }
    return null;
  }

  // 1. Verify via Supabase Auth if Supabase is connected
  try {
    const { getSupabaseServer } = await import('./db.js');
    const supabase = getSupabaseServer();
    if (supabase) {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        return {
          email: (data.user.email || '').toLowerCase(),
          authUserId: data.user.id,
          name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email?.split('@')[0]
        };
      }
    }
  } catch {}

  // 2. Verify via signed customer token (HMAC signed)
  try {
    const parts = token.split('.');
    if (parts.length === 2) {
      const [payloadStr, signature] = parts;
      const expectedSignature = crypto.createHmac('sha256', EFFECTIVE_SECRET).update(payloadStr).digest('base64url');
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expectedSignature);
      if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
        const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
        if (payload.email && (!payload.exp || payload.exp > Math.floor(Date.now() / 1000))) {
          return {
            email: payload.email.toLowerCase(),
            authUserId: payload.authUserId || payload.id || `auth-${payload.email}`,
            name: payload.name
          };
        }
      }
    }
  } catch {}

  // 3. Fallback for testing with mock Supabase token
  if (token.startsWith('sb_test_cust_') || token.startsWith('ey')) {
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (payload.email) {
          return {
            email: payload.email.toLowerCase(),
            authUserId: payload.sub || payload.id || `auth-${payload.email}`,
            name: payload.user_metadata?.full_name || payload.email.split('@')[0]
          };
        }
      }
    } catch {}
  }

  // 4. Fallback for development/testing via custom headers
  if (!isProd && reqOrToken && typeof reqOrToken === 'object') {
    const custEmail = (reqOrToken.headers?.['x-customer-email'] as string) || (reqOrToken.headers?.['x-customer-auth-id'] as string);
    if (custEmail) {
      return {
        email: custEmail.toLowerCase(),
        authUserId: (reqOrToken.headers?.['x-customer-auth-id'] as string) || crypto.randomUUID(),
        name: (reqOrToken.headers?.['x-customer-name'] as string) || custEmail.split('@')[0]
      };
    }
  }

  return null;
}

export function createCustomerToken(payload: { email: string; authUserId?: string; name?: string; exp?: number }): string {
  const data = {
    ...payload,
    authUserId: payload.authUserId || crypto.randomUUID(),
    exp: payload.exp || Math.floor(Date.now() / 1000) + 7 * 86400
  };
  const payloadStr = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = crypto.createHmac('sha256', EFFECTIVE_SECRET).update(payloadStr).digest('base64url');
  return `${payloadStr}.${signature}`;
}
