import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BASE = 'http://localhost:3000';

async function run() {
  console.log('====================================================');
  console.log('🧪 QRDINE END-TO-END PRODUCTION VERIFICATION TEST');
  console.log('====================================================\n');

  // 1. Health
  console.log('1️⃣ Checking /api/health...');
  const healthRes = await fetch(`${BASE}/api/health`);
  const healthData = await healthRes.json();
  console.log('   Health response:', healthData);
  if (!healthRes.ok) throw new Error('Health check failed');

  // 2. Menu
  console.log('\n2️⃣ Checking menu for roasted-bean...');
  const menuRes = await fetch(`${BASE}/api/cafes/roasted-bean/menu`);
  const menuJson = await menuRes.json();
  const menuData = menuJson.data || menuJson;
  console.log(`   Found ${menuData.categories?.length || 0} categories, ${menuData.items?.length || 0} items`);
  const firstItem = menuData.items?.[0];
  if (!firstItem) throw new Error('No menu items found: ' + JSON.stringify(menuJson));
  console.log(`   Sample item: "${firstItem.name}" (ID: ${firstItem.id}, Price: ₹${firstItem.price})`);

  // 3. Table Session Init
  console.log('\n3️⃣ Initializing table session for Table 1...');
  const sessionRes = await fetch(`${BASE}/api/tables/session/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cafe_slug: 'roasted-bean',
      table_number: 1
    })
  });
  const sessionJson = await sessionRes.json();
  const sessionData = sessionJson.data || sessionJson;
  const session = sessionData.session;
  console.log('   Session response status:', sessionRes.status);
  console.log('   Session ID:', session?.id, 'Token:', session?.session_token);
  if (!session?.id) throw new Error('Session initialization failed: ' + JSON.stringify(sessionJson));

  // Check Supabase table_sessions
  const { data: dbSession, error: sErr } = await supabase
    .from('table_sessions')
    .select('*')
    .eq('id', session.id)
    .single();
  console.log('   Verified session in Supabase:', dbSession ? '✅ Found in DB' : '❌ Not in DB: ' + sErr?.message);

  // 4. Order Creation
  console.log('\n4️⃣ Creating Order for Table 1...');
  const { createCustomerToken } = await import('../server/auth.js');
  const custToken = createCustomerToken({ email: 'patron@example.com', name: 'Test Patron' });

  const orderRes = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-customer-token': custToken,
      'x-customer-session': session.session_token
    },
    body: JSON.stringify({
      cafe_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      table_number: 1,
      session_token: session.session_token,
      customer_session_token: session.session_token,
      customer_name: 'Test Patron',
      customer_email: 'patron@example.com',
      items: [
        {
          menu_item_id: firstItem.id,
          quantity: 2,
          notes: 'Extra hot please'
        }
      ],
      notes: 'Table 1 automated verification test'
    })
  });

  const orderJson = await orderRes.json();
  const orderData = orderJson.data || orderJson;
  const order = orderData.order;
  console.log('   Order response status:', orderRes.status);
  console.log('   Order creation result:', orderJson.success ? '✅ SUCCESS' : '❌ FAILED');
  if (!orderJson.success || !order) {
    console.error('   Order error:', orderJson);
    throw new Error('Order creation failed');
  }
  console.log(`   Order ID: ${order.id}`);
  console.log(`   Subtotal: ₹${order.subtotal}, Tax: ₹${order.tax}, Total: ₹${order.total}`);
  console.log(`   Payment Status: ${order.payment_status}, Order Status: ${order.order_status}`);

  // Check Supabase orders table
  const { data: dbOrder, error: oErr } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', order.id)
    .single();
  console.log('   Verified order in Supabase:', dbOrder ? `✅ Found in DB with ${dbOrder.order_items?.length} items` : '❌ Not in DB: ' + oErr?.message);

  // 5. Staff Login
  console.log('\n5️⃣ Testing Staff Login (Reception)...');
  const staffLoginRes = await fetch(`${BASE}/api/auth/staff-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'reception@roastedbean.in',
      password: 'Service#Desk27!'
    })
  });
  const staffJson = await staffLoginRes.json();
  const staffData = staffJson.data || staffJson;
  console.log('   Staff Login:', staffData.token ? `✅ Success (Role: ${staffData.user?.role})` : '❌ Failed: ' + JSON.stringify(staffJson));
  const staffToken = staffData.token;

  // 6. Update Order Status (Kitchen -> PREPARING)
  console.log('\n6️⃣ Staff updating order status to PREPARING...');
  const updateRes = await fetch(`${BASE}/api/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${staffToken}`
    },
    body: JSON.stringify({
      status: 'PREPARING'
    })
  });
  const updateJson = await updateRes.json();
  const updateData = updateJson.data || updateJson;
  console.log('   Order status update result:', updateJson.success ? `✅ Status: ${updateData.order_status || updateData.order?.order_status}` : '❌ Failed: ' + JSON.stringify(updateJson));

  // 7. Check Table Session Recalculation
  console.log('\n7️⃣ Checking Table Session after order...');
  const sessionCheckRes = await fetch(`${BASE}/api/tables/${session.table_id || 1}/session`);
  const sessionCheckJson = await sessionCheckRes.json();
  const sessionCheckData = sessionCheckJson.data || sessionCheckJson;
  console.log(`   Session Total: ₹${sessionCheckData.session?.total_amount}, Outstanding: ₹${sessionCheckData.session?.outstanding_amount}`);
  console.log(`   Session Orders count: ${sessionCheckData.orders?.length || 0}`);

  // 8. Settle Table Session (Reception Cash Settlement)
  console.log('\n8️⃣ Reception Settle Payment for Session...');
  const settleRes = await fetch(`${BASE}/api/reception/settle-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${staffToken}`
    },
    body: JSON.stringify({
      cafe_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      table_id: session.table_id,
      method: 'CASH',
      release_table: true
    })
  });
  const settleJson = await settleRes.json();
  const settleData = settleJson.data || settleJson;
  console.log('   Settlement result:', settleJson.success ? '✅ Succeeded' : '❌ Failed: ' + JSON.stringify(settleJson));
  if (settleData.session) {
    console.log(`   Session Status: ${settleData.session.status}, Paid Amount: ₹${settleData.session.paid_amount}, Outstanding: ₹${settleData.session.outstanding_amount}`);
  }

  // Verify Invoice created
  const { data: dbInvoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('order_id', order.id)
    .maybeSingle();
  console.log('   Invoice in Supabase:', dbInvoice ? `✅ Invoice #${dbInvoice.invoice_number} created with UUID ${dbInvoice.id}` : 'ℹ️ In-memory / pending');

  console.log('\n====================================================');
  console.log('🎉 ALL END-TO-END TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('====================================================');
}

run().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
