interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

const RESEND_API_KEY = (process.env.RESEND_API_KEY || '').trim();
const RESEND_FROM_EMAIL = (process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev').trim();

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!RESEND_API_KEY || RESEND_API_KEY.includes('your_resend_api_key')) {
    console.log(`[Email Simulation] To: ${to} | Subject: ${subject}`);
    return { success: true, id: `mock-email-${Date.now()}` };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `QRDine Orders <${RESEND_FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Resend email API error:', data);
      return { success: false, error: data?.message || 'Failed to send email' };
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('Resend email dispatch failed:', err);
    return { success: false, error: err?.message || 'Email service error' };
  }
}

export function generateInvoiceHtml(params: {
  cafe: { name: string; address: string; phone: string; gst_number?: string; currency: string };
  order: { id: string; table_number: number; items: any[]; subtotal: number; tax: number; service_charge: number; discount: number; total: number; created_at: string };
  customer: { name?: string; email: string };
  invoiceNumber: string;
  couponReward?: { code: string; discount_value: number; discount_type: string };
}): string {
  const { cafe, order, customer, invoiceNumber, couponReward } = params;
  const itemsHtml = order.items
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #f0f0f0;">
      <td style="padding: 12px 8px; font-size: 14px; color: #1c1917;">
        <strong>${item.item_name}</strong>
        ${item.selected_variants_json && item.selected_variants_json.length > 0
          ? `<br/><span style="font-size: 12px; color: #78716c;">${item.selected_variants_json.map((v: any) => v.name).join(', ')}</span>`
          : ''}
      </td>
      <td style="padding: 12px 8px; font-size: 14px; color: #1c1917; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px 8px; font-size: 14px; color: #1c1917; text-align: right;">${cafe.currency}${(item.unit_price || 0).toFixed(2)}</td>
      <td style="padding: 12px 8px; font-size: 14px; color: #1c1917; text-align: right; font-weight: bold;">${cafe.currency}${(item.subtotal || item.unit_price * item.quantity).toFixed(2)}</td>
    </tr>
  `
    )
    .join('');

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Tax Invoice - ${cafe.name}</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f8; margin: 0; padding: 24px; color: #1c1917;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e7e5e4;">
      
      <!-- Header -->
      <div style="background: #1c1917; color: #ffffff; padding: 28px 24px; text-align: center;">
        <h1 style="margin: 0 0 6px; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">${cafe.name}</h1>
        <p style="margin: 0; font-size: 13px; color: #a8a29e;">${cafe.address} · Tel: ${cafe.phone}</p>
        ${cafe.gst_number ? `<p style="margin: 4px 0 0; font-size: 12px; color: #78716c;">GSTIN: ${cafe.gst_number}</p>` : ''}
      </div>

      <!-- Invoice Meta -->
      <div style="padding: 20px 24px; background: #fafaf9; border-bottom: 1px solid #e7e5e4; display: flex; justify-content: space-between;">
        <div>
          <div style="font-size: 11px; font-weight: bold; color: #78716c; text-transform: uppercase;">Tax Invoice Number</div>
          <div style="font-size: 14px; font-weight: bold; color: #1c1917;">${invoiceNumber}</div>
          <div style="font-size: 12px; color: #a8a29e; margin-top: 4px;">Date: ${new Date(order.created_at).toLocaleString()}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; font-weight: bold; color: #78716c; text-transform: uppercase;">Dine-In Table</div>
          <div style="font-size: 16px; font-weight: 800; color: #1c1917;">Table #${order.table_number}</div>
          <div style="font-size: 12px; color: #16a34a; font-weight: bold; margin-top: 4px;">● PAID ONLINE</div>
        </div>
      </div>

      <!-- Customer Info -->
      <div style="padding: 16px 24px; border-bottom: 1px solid #f0f0f0;">
        <span style="font-size: 12px; color: #78716c;">Billed to: </span>
        <strong style="font-size: 13px; color: #1c1917;">${customer.name || 'Guest Diner'}</strong>
        <span style="font-size: 12px; color: #a8a29e;">(${customer.email})</span>
      </div>

      <!-- Items Table -->
      <div style="padding: 20px 24px;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 2px solid #e7e5e4; font-size: 12px; color: #78716c; text-transform: uppercase;">
              <th style="padding: 8px; text-align: left;">Item</th>
              <th style="padding: 8px; text-align: center;">Qty</th>
              <th style="padding: 8px; text-align: right;">Rate</th>
              <th style="padding: 8px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <!-- Totals -->
        <div style="margin-top: 20px; padding-top: 16px; border-top: 2px solid #e7e5e4; width: 100%;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #57534e; margin-bottom: 6px;">
            <span>Subtotal:</span>
            <span>${cafe.currency}${order.subtotal.toFixed(2)}</span>
          </div>
          ${order.discount > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #16a34a; margin-bottom: 6px;">
            <span>Discount:</span>
            <span>-${cafe.currency}${order.discount.toFixed(2)}</span>
          </div>` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #57534e; margin-bottom: 6px;">
            <span>GST / Tax:</span>
            <span>${cafe.currency}${order.tax.toFixed(2)}</span>
          </div>
          ${order.service_charge > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #57534e; margin-bottom: 6px;">
            <span>Service Charge:</span>
            <span>${cafe.currency}${order.service_charge.toFixed(2)}</span>
          </div>` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; color: #1c1917; margin-top: 12px; padding-top: 12px; border-top: 1px dashed #d6d3d1;">
            <span>Grand Total Paid:</span>
            <span>${cafe.currency}${order.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <!-- Coupon Reward Banner if available -->
      ${couponReward ? `
      <div style="margin: 0 24px 20px; background: #f0fdf4; border: 1px dashed #22c55e; border-radius: 12px; padding: 16px; text-align: center;">
        <div style="font-size: 12px; font-weight: bold; color: #15803d; text-transform: uppercase;">🎁 Special Reward For Your Next Visit!</div>
        <div style="font-size: 20px; font-weight: 900; color: #166534; margin: 6px 0; letter-spacing: 1px;">${couponReward.code}</div>
        <div style="font-size: 12px; color: #15803d;">Enjoy ${couponReward.discount_value}${couponReward.discount_type === 'PERCENTAGE' ? '%' : ' OFF'} on your next dine-in visit!</div>
      </div>` : ''}

      <!-- Footer -->
      <div style="background: #fafaf9; border-top: 1px solid #e7e5e4; padding: 16px 24px; text-align: center; font-size: 12px; color: #78716c;">
        <p style="margin: 0;">Thank you for dining with us! Powered by <strong>QRDine Digital Hospitality Engine</strong></p>
      </div>
    </div>
  </body>
  </html>
  `;
}
