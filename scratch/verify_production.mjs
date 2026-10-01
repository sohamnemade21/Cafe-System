import http from 'http';

function check(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request('http://localhost:3000' + path, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function runTests() {
  console.log('=== RUNNING PRODUCTION VERIFICATION SUITE ===\n');

  // 1. Health
  const health = await check('/health');
  console.log('1. GET /health:', health.status, health.body?.status === 'healthy' ? 'PASS' : 'FAIL');

  // 2. Staff Logins
  const ownerRes = await check('/api/auth/staff-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'cafeOwnerAdmin', password: 'HarborTable#Cafe27!' })
  });
  console.log('2. Owner Login (cafeOwnerAdmin):', ownerRes.status, ownerRes.body?.success ? 'PASS' : 'FAIL', 'Role:', ownerRes.body?.data?.user?.role);
  const ownerToken = ownerRes.body?.data?.token;

  const kitchenRes = await check('/api/auth/staff-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'kitchenLead', password: 'Kitchen#Shift27!' })
  });
  console.log('3. Kitchen Login (kitchenLead):', kitchenRes.status, kitchenRes.body?.success ? 'PASS' : 'FAIL', 'Role:', kitchenRes.body?.data?.user?.role);
  const kitchenToken = kitchenRes.body?.data?.token;

  const receptionRes = await check('/api/auth/staff-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'serviceDesk', password: 'Service#Desk27!' })
  });
  console.log('4. Reception Login (serviceDesk):', receptionRes.status, receptionRes.body?.success ? 'PASS' : 'FAIL', 'Role:', receptionRes.body?.data?.user?.role);
  const receptionToken = receptionRes.body?.data?.token;

  // 3. Cafe & Tables
  const cafeRes = await check('/api/cafes/roasted-bean');
  console.log('5. GET /api/cafes/roasted-bean:', cafeRes.status, cafeRes.body?.data?.name);
  const cafeId = cafeRes.body?.data?.id;

  const tablesRes = await check('/api/tables/' + cafeId);
  console.log('6. GET /api/tables/:cafeId (Count):', tablesRes.body?.data?.length, 'Tables: ' + tablesRes.body?.data?.map(t => '#' + t.table_number).join(', '));

  // 4. QR Session Init (Table 4)
  const sessionRes = await check('/api/tables/session/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cafeSlug: 'roasted-bean', tableNumber: 4, customerName: 'Production Tester' })
  });
  console.log('7. Session Init Table 4:', sessionRes.status, sessionRes.body?.success ? 'PASS' : 'FAIL', 'Session ID:', sessionRes.body?.data?.session?.id);
  const session = sessionRes.body?.data?.session;

  // 5. Category Creation by Owner
  const catCreateRes = await check('/api/cafes/' + cafeId + '/categories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + ownerToken
    },
    body: JSON.stringify({
      name: 'Artisan Bakes',
      description: 'Freshly baked sourdough and croissants',
      display_order: 3
    })
  });
  console.log('8. Owner Create Category:', catCreateRes.status, catCreateRes.body?.success ? 'PASS' : 'FAIL', 'Cat ID:', catCreateRes.body?.data?.id);
  const newCatId = catCreateRes.body?.data?.id;

  // 6. Menu Item Creation by Owner
  const itemCreateRes = await check('/api/cafes/' + cafeId + '/menu-items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + ownerToken
    },
    body: JSON.stringify({
      name: 'Artisan Almond Croissant',
      description: 'Double baked flaky croissant filled with almond frangipane',
      price: 220,
      category_id: newCatId || 'cat_bakery',
      is_vegetarian: true,
      is_available: true,
      is_bestseller: true,
      preparation_time: 5,
      image_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600'
    })
  });
  console.log('9. Owner Create Menu Item:', itemCreateRes.status, itemCreateRes.body?.success ? 'PASS' : 'FAIL', 'Item ID:', itemCreateRes.body?.data?.id);
  const newItemId = itemCreateRes.body?.data?.id;

  // 7. Customer Order Placement (Food Order, Payment Status = UNPAID)
  const orderRes = await check('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cafe_id: cafeId,
      table_id: session?.table_id,
      table_session_id: session?.id,
      customer_name: 'Production Tester',
      items: [
        {
          menu_item_id: newItemId,
          name: 'Artisan Almond Croissant',
          price: 220,
          quantity: 2,
          notes: 'Warm please'
        }
      ],
      special_instructions: 'Serve immediately'
    })
  });
  console.log('10. Customer Place Order (Unpaid Food Order):', orderRes.status, orderRes.body?.success ? 'PASS' : 'FAIL', 'Order Status:', orderRes.body?.data?.order_status, 'Payment Status:', orderRes.body?.data?.payment_status, 'Total:', orderRes.body?.data?.total);
  const orderId = orderRes.body?.data?.id;

  // 8. Kitchen Status Transitions
  const prepRes = await check('/api/orders/' + orderId + '/status', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + kitchenToken
    },
    body: JSON.stringify({ order_status: 'PREPARING' })
  });
  console.log('11. Kitchen Update -> PREPARING:', prepRes.status, prepRes.body?.data?.order_status);

  const readyRes = await check('/api/orders/' + orderId + '/status', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + kitchenToken
    },
    body: JSON.stringify({ order_status: 'READY' })
  });
  console.log('12. Kitchen Update -> READY:', readyRes.status, readyRes.body?.data?.order_status);

  const servedRes = await check('/api/orders/' + orderId + '/status', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + kitchenToken
    },
    body: JSON.stringify({ order_status: 'SERVED' })
  });
  console.log('13. Kitchen Update -> SERVED:', servedRes.status, servedRes.body?.data?.order_status);

  // 9. Post-Meal Payment Choice: Pay at Reception
  const payReqRes = await check('/api/payments/request-reception-settlement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: orderId,
      tableSessionId: session?.id,
      customerEmail: 'guest@example.com'
    })
  });
  console.log('14. Customer Selects "Pay At Reception":', payReqRes.status, payReqRes.body?.success ? 'PASS' : 'FAIL', payReqRes.body?.message);

  // 10. Reception Dashboard Overview
  const recepOverview = await check('/api/reception/' + cafeId + '/overview', {
    headers: { 'Authorization': 'Bearer ' + receptionToken }
  });
  console.log('15. Reception Overview:', recepOverview.status, recepOverview.body?.success ? 'PASS' : 'FAIL', 'Active Sessions:', recepOverview.body?.data?.activeSessions?.length);

  // 11. Reception Confirms Settlement / Paid
  const confirmPayRes = await check('/api/reception/orders/' + orderId + '/mark-paid', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + receptionToken
    },
    body: JSON.stringify({ payment_method: 'CASH', customer_email: 'guest@example.com' })
  });
  console.log('16. Reception Confirms CASH Payment:', confirmPayRes.status, confirmPayRes.body?.success ? 'PASS' : 'FAIL', 'New Payment Status:', confirmPayRes.body?.data?.order?.payment_status);

  // 12. Create New Table (Table 7) by Owner
  const createTableRes = await check('/api/tables', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + ownerToken
    },
    body: JSON.stringify({
      cafe_id: cafeId,
      table_number: 7,
      name: 'Rooftop Lounge 7',
      capacity: 6
    })
  });
  console.log('17. Owner Create Table 7:', createTableRes.status, createTableRes.body?.success ? 'PASS' : 'FAIL', 'QR Code exists:', Boolean(createTableRes.body?.data?.qr_code_svg));

  // 13. Audit Logs verification
  const auditRes = await check('/api/reports/' + cafeId + '/audit-logs', {
    headers: { 'Authorization': 'Bearer ' + ownerToken }
  });
  console.log('18. Audit Logs Generated (Count):', auditRes.body?.data?.length);

  console.log('\n=== VERIFICATION COMPLETE ===');
}

runTests().catch(console.error);
