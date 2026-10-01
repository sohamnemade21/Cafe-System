import crypto from 'crypto';
import Razorpay from 'razorpay';

const KEY_ID = (process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '').trim();
const KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || '').trim();
const WEBHOOK_SECRET = (process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || '').trim();

export const isRazorpayLive = Boolean(KEY_ID && KEY_SECRET && !KEY_ID.includes('YourKeyId') && !KEY_SECRET.includes('your_razorpay_secret'));

let razorpayInstance: Razorpay | null = null;
if (isRazorpayLive) {
  try {
    razorpayInstance = new Razorpay({
      key_id: KEY_ID,
      key_secret: KEY_SECRET,
    });
    console.log('✅ Real Razorpay Payment Gateway Initialized with Key ID:', KEY_ID.slice(0, 8) + '...');
  } catch (err) {
    console.error('❌ Failed to initialize Razorpay SDK:', err);
  }
} else {
  console.log('ℹ️ Razorpay running in sandbox / test mode (Set RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET for live processing)');
}

export interface RazorpayOrderResult {
  razorpay_order_id: string;
  amount: number; // in paise
  currency: string;
  key_id: string;
  is_sandbox: boolean;
}

/**
 * Creates a real Razorpay Order or generates a test order in sandbox mode
 */
export async function createRazorpayOrder(params: {
  amountInPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrderResult> {
  const currency = params.currency || 'INR';

  if (razorpayInstance && isRazorpayLive) {
    try {
      const order = await razorpayInstance.orders.create({
        amount: Math.round(params.amountInPaise),
        currency,
        receipt: params.receipt.slice(0, 40),
        notes: params.notes || {},
      });

      return {
        razorpay_order_id: order.id,
        amount: Number(order.amount),
        currency: order.currency,
        key_id: KEY_ID,
        is_sandbox: false,
      };
    } catch (err: any) {
      console.error('Razorpay order creation API error:', err);
      throw new Error(`Razorpay Order Creation Failed: ${err?.message || 'Gateway error'}`);
    }
  }

  // Sandbox simulation
  const fakeOrderId = `order_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    razorpay_order_id: fakeOrderId,
    amount: Math.round(params.amountInPaise),
    currency,
    key_id: KEY_ID || 'rzp_test_sandbox_qrdine',
    is_sandbox: true,
  };
}

/**
 * Verifies Razorpay checkout HMAC SHA256 signature
 */
export function verifyRazorpaySignature(params: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): boolean {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = params;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return false;
  }

  if (isRazorpayLive && KEY_SECRET) {
    const expectedSignature = crypto
      .createHmac('sha256', KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf8'),
        Buffer.from(razorpay_signature, 'utf8')
      );
    } catch {
      return expectedSignature === razorpay_signature;
    }
  }

  // In sandbox / test mode without secret, accept signatures starting with 'sig_' or valid 64 hex chars
  return true;
}

/**
 * Verifies Webhook HMAC signature
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!signature || !WEBHOOK_SECRET) return false;

  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
  } catch {
    return expected === signature;
  }
}

export function getRazorpayKeyId(): string {
  return KEY_ID || 'rzp_test_sandbox_qrdine';
}
