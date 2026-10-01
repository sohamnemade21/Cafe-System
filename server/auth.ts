import crypto from 'crypto';
import { Request } from 'express';
import { supabaseServer } from './db.js';

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

const isProd = process.env.NODE_ENV === 'production';
const SESSION_SECRET = (process.env.SESSION_SECRET || '').trim() || (isProd ? '' : 'qrdine-dev-session-secret-key-2026');

if (isProd && !SESSION_SECRET) {
  console.warn('⚠️ WARNING: SESSION_SECRET is not set in production. Please configure SESSION_SECRET in your environment variables.');
}

const EFFECTIVE_SECRET = SESSION_SECRET || 'qrdine-fallback-production-key-change-me';

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
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

export async function verifyCustomerAuth(req: Request): Promise<{ email: string; authUserId: string; name?: string } | null> {
  const authHeader = req.headers.authorization;
  const customJwt = (req.headers['x-customer-token'] as string) || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);
  const authIdHeader = req.headers['x-customer-auth-id'] as string;
  const emailHeader = req.headers['x-customer-email'] as string;

  if (customJwt && supabaseServer) {
    try {
      const { data, error } = await supabaseServer.auth.getUser(customJwt);
      if (!error && data?.user) {
        return {
          email: (data.user.email || '').toLowerCase(),
          authUserId: data.user.id,
          name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email?.split('@')[0]
        };
      }
    } catch {}
  }

  if (emailHeader && authIdHeader) {
    return {
      email: emailHeader.trim().toLowerCase(),
      authUserId: authIdHeader.trim()
    };
  }

  return null;
}
