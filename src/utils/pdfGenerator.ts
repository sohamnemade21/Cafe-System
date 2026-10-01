import { Order, Cafe } from '../types';

export async function generateInvoicePDF(order: Order, cafe: Cafe): Promise<any> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const currencySymbol = cafe.currency || 'INR';

  // Palette
  const darkStone = '#1c1917';
  const mutedStone = '#78716c';
  const amberAccent = '#b45309';

  // 1. Header Banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(darkStone);
  doc.text(cafe.name, 20, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(mutedStone);
  if (cafe.tag_line) {
    doc.text(cafe.tag_line, 20, 30);
  }
  doc.text(`${cafe.address} | Phone: ${cafe.phone}`, 20, 35);
  if (cafe.gst_number) {
    doc.text(`GSTIN: ${cafe.gst_number}`, 20, 40);
  }

  // Right Side - Invoice Meta
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(amberAccent);
  doc.text('TAX INVOICE', 190, 24, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(darkStone);
  doc.text(`Invoice No: INV-${order.id.slice(-6).toUpperCase()}`, 190, 31, { align: 'right' });
  doc.text(`Order ID: #${order.id}`, 190, 36, { align: 'right' });
  doc.text(`Date: ${new Date(order.created_at).toLocaleString()}`, 190, 41, { align: 'right' });

  // Divider Line
  doc.setDrawColor(220, 220, 220);
  doc.line(20, 46, 190, 46);

  // 2. Bill To & Table Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(darkStone);
  doc.text('BILL TO:', 20, 53);
  doc.text('DINE-IN LOCATION:', 120, 53);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(mutedStone);
  doc.text(`Customer: ${order.customer_name || 'Guest Diner'}`, 20, 59);
  doc.text(`Email: ${order.customer_email || 'Not provided'}`, 20, 64);
  if (order.customer_phone) {
    doc.text(`Phone: ${order.customer_phone}`, 20, 69);
  }

  doc.text(`Table: #${order.table_number}`, 120, 59);
  doc.text(`Payment Status: ${order.payment_status}`, 120, 64);
  doc.text(`Payment Ref: ${order.payment_id || 'RZP-' + order.id.slice(-5)}`, 120, 69);

  // Table header
  let y = 78;
  doc.setFillColor(245, 245, 244);
  doc.rect(20, y, 170, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(darkStone);
  doc.text('ITEM', 24, y + 5.5);
  doc.text('QTY', 120, y + 5.5, { align: 'center' });
  doc.text('UNIT PRICE', 150, y + 5.5, { align: 'right' });
  doc.text('AMOUNT', 186, y + 5.5, { align: 'right' });

  y += 12;

  // Items rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  order.items.forEach((item) => {
    doc.setTextColor(darkStone);
    doc.text(item.item_name, 24, y);

    // Variants subtitle if any
    if (item.selected_variants_json && item.selected_variants_json.length > 0) {
      const varsText = item.selected_variants_json.map((v) => v.name).join(', ');
      doc.setFontSize(8);
      doc.setTextColor(mutedStone);
      doc.text(`• ${varsText}`, 24, y + 4);
      doc.setFontSize(9);
    }

    doc.setTextColor(darkStone);
    doc.text(String(item.quantity), 120, y, { align: 'center' });
    doc.text(`${currencySymbol} ${item.unit_price.toFixed(2)}`, 150, y, { align: 'right' });
    doc.text(`${currencySymbol} ${item.subtotal.toFixed(2)}`, 186, y, { align: 'right' });

    y += (item.selected_variants_json && item.selected_variants_json.length > 0) ? 10 : 8;
  });

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(20, y, 190, y);
  y += 6;

  // Totals Section
  const totalsX = 135;
  const amountsX = 186;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(mutedStone);

  doc.text('Subtotal:', totalsX, y);
  doc.setTextColor(darkStone);
  doc.text(`${currencySymbol} ${order.subtotal.toFixed(2)}`, amountsX, y, { align: 'right' });
  y += 6;

  if (order.discount > 0) {
    doc.setTextColor('#16a34a'); // green
    doc.text(`Discount (${order.coupon_code || 'Promo'}):`, totalsX, y);
    doc.text(`-${currencySymbol} ${order.discount.toFixed(2)}`, amountsX, y, { align: 'right' });
    y += 6;
  }

  doc.setTextColor(mutedStone);
  doc.text(`GST (${cafe.tax_rate}%):`, totalsX, y);
  doc.setTextColor(darkStone);
  doc.text(`${currencySymbol} ${order.tax.toFixed(2)}`, amountsX, y, { align: 'right' });
  y += 6;

  if (order.service_charge > 0) {
    doc.setTextColor(mutedStone);
    doc.text(`Service Charge (${cafe.service_charge_rate}%):`, totalsX, y);
    doc.setTextColor(darkStone);
    doc.text(`${currencySymbol} ${order.service_charge.toFixed(2)}`, amountsX, y, { align: 'right' });
    y += 6;
  }

  // Grand Total Box
  y += 2;
  doc.setFillColor(254, 243, 199); // light amber
  doc.rect(totalsX - 5, y - 4, 60, 10, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(amberAccent);
  doc.text('Grand Total:', totalsX, y + 3);
  doc.text(`${currencySymbol} ${order.total.toFixed(2)}`, amountsX, y + 3, { align: 'right' });

  // Footer notes
  y += 24;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(mutedStone);
  doc.text('Thank you for dining with us at ' + cafe.name + '!', 105, y, { align: 'center' });
  doc.text('This is a computer-generated tax invoice verified via digital QR ordering.', 105, y + 5, { align: 'center' });

  return doc;
}
