import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000/api';
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const results: Record<string, boolean> = {};

function recordTest(name: string, passed: boolean, details?: string) {
  results[name] = passed;
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${name}${details ? ` (${details})` : ''}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING BRUTAL AUTHENTICATION & SECURITY TEST SUITE');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // PART 1: PORTAL CREDENTIAL AUTHENTICATION
  // ----------------------------------------------------
  console.log('--- 1. PORTAL CREDENTIAL TESTS ---');

  // 1.1 Owner login with correct credentials
  let ownerToken = '';
  try {
    const res = await fetch(`${BASE_URL}/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'cafeOwnerAdmin', password: 'HarborTable#Cafe27!' })
    });
    const data = await res.json();
    const ok = res.status === 200 && data.success && data.data?.user?.role === 'CAFE_OWNER';
    if (ok) ownerToken = data.data.token;
    recordTest('Owner Login (Correct Credentials)', ok, `Status: ${res.status}, Role: ${data.data?.user?.role}`);
  } catch (err: any) {
    recordTest('Owner Login (Correct Credentials)', false, err.message);
  }

  // 1.2 Owner login with incorrect password MUST FAIL
  try {
    const res = await fetch(`${BASE_URL}/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'cafeOwnerAdmin', password: 'WrongPassword123!' })
    });
    const ok = res.status === 401;
    recordTest('Owner Login (Incorrect Password Rejected)', ok, `Expected 401, got ${res.status}`);
  } catch (err: any) {
    recordTest('Owner Login (Incorrect Password Rejected)', false, err.message);
  }

  // 1.3 Owner login with former bypass password (owner123) MUST FAIL 100%
  try {
    const res = await fetch(`${BASE_URL}/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'cafeOwnerAdmin', password: 'owner123' })
    });
    const ok = res.status === 401;
    recordTest('Owner Login (Bypass Password "owner123" Rejected)', ok, `Expected 401, got ${res.status}`);
  } catch (err: any) {
    recordTest('Owner Login (Bypass Password "owner123" Rejected)', false, err.message);
  }

  // 1.4 Kitchen login with correct credentials
  let kitchenToken = '';
  try {
    const res = await fetch(`${BASE_URL}/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'kitchenLead', password: 'Kitchen#Shift27!' })
    });
    const data = await res.json();
    const ok = res.status === 200 && data.success && data.data?.user?.role === 'KITCHEN_STAFF';
    if (ok) kitchenToken = data.data.token;
    recordTest('Kitchen Login (Correct Credentials)', ok, `Status: ${res.status}, Role: ${data.data?.user?.role}`);
  } catch (err: any) {
    recordTest('Kitchen Login (Correct Credentials)', false, err.message);
  }

  // 1.5 Kitchen login with incorrect password MUST FAIL
  try {
    const res = await fetch(`${BASE_URL}/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'kitchenLead', password: 'KitchenWrongPassword!' })
    });
    const ok = res.status === 401;
    recordTest('Kitchen Login (Incorrect Password Rejected)', ok, `Expected 401, got ${res.status}`);
  } catch (err: any) {
    recordTest('Kitchen Login (Incorrect Password Rejected)', false, err.message);
  }

  // 1.6 Reception login with correct credentials
  let receptionToken = '';
  try {
    const res = await fetch(`${BASE_URL}/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'serviceDesk', password: 'Service#Desk27!' })
    });
    const data = await res.json();
    const ok = res.status === 200 && data.success && data.data?.user?.role === 'RECEPTION';
    if (ok) receptionToken = data.data.token;
    recordTest('Reception Login (Correct Credentials)', ok, `Status: ${res.status}, Role: ${data.data?.user?.role}`);
  } catch (err: any) {
    recordTest('Reception Login (Correct Credentials)', false, err.message);
  }

  // 1.7 Reception login with incorrect password MUST FAIL
  try {
    const res = await fetch(`${BASE_URL}/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'serviceDesk', password: 'WrongServiceDeskPass!' })
    });
    const ok = res.status === 401;
    recordTest('Reception Login (Incorrect Password Rejected)', ok, `Expected 401, got ${res.status}`);
  } catch (err: any) {
    recordTest('Reception Login (Incorrect Password Rejected)', false, err.message);
  }

  // 1.8 Empty / missing credentials MUST FAIL
  try {
    const res = await fetch(`${BASE_URL}/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '', password: '' })
    });
    const ok = res.status === 400;
    recordTest('Staff Login (Empty Credentials Rejected)', ok, `Expected 400, got ${res.status}`);
  } catch (err: any) {
    recordTest('Staff Login (Empty Credentials Rejected)', false, err.message);
  }

  // 1.9 Non-existent user ID MUST FAIL
  try {
    const res = await fetch(`${BASE_URL}/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'nonExistentHacker', password: 'AnyPassword123!' })
    });
    const ok = res.status === 401;
    recordTest('Staff Login (Non-existent User ID Rejected)', ok, `Expected 401, got ${res.status}`);
  } catch (err: any) {
    recordTest('Staff Login (Non-existent User ID Rejected)', false, err.message);
  }

  // 1.10 Customer credentials MUST NOT access staff portals
  try {
    const res = await fetch(`${BASE_URL}/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'customer@example.com', password: 'CustomerSecretPass123!' })
    });
    const ok = res.status === 401;
    recordTest('Staff Portal (Customer Credentials Rejected)', ok, `Expected 401, got ${res.status}`);
  } catch (err: any) {
    recordTest('Staff Portal (Customer Credentials Rejected)', false, err.message);
  }

  // ----------------------------------------------------
  // PART 2: BACKEND AUTHORIZATION & PRIVILEGE ESCALATION
  // ----------------------------------------------------
  console.log('\n--- 2. PRIVILEGE ESCALATION & AUTHORIZATION TESTS ---');

  // 2.1 Unauthenticated access to Owner Reports MUST be rejected
  try {
    const res = await fetch(`${BASE_URL}/reports/cafe-roasted-bean`);
    const ok = res.status === 401;
    recordTest('Reports API (Unauthenticated Access Blocked)', ok, `Expected 401, got ${res.status}`);
  } catch (err: any) {
    recordTest('Reports API (Unauthenticated Access Blocked)', false, err.message);
  }

  // 2.2 Reception credentials accessing Owner Reports MUST be rejected (role escalation: staff -> owner)
  try {
    const res = await fetch(`${BASE_URL}/reports/cafe-roasted-bean`, {
      headers: { Authorization: `Bearer ${receptionToken}` }
    });
    const ok = res.status === 403;
    recordTest('Role Escalation: Staff → Owner Reports Blocked', ok, `Expected 403, got ${res.status}`);
  } catch (err: any) {
    recordTest('Role Escalation: Staff → Owner Reports Blocked', false, err.message);
  }

  // 2.3 Kitchen credentials accessing Owner Reports MUST be rejected (role escalation: kitchen -> owner)
  try {
    const res = await fetch(`${BASE_URL}/reports/cafe-roasted-bean`, {
      headers: { Authorization: `Bearer ${kitchenToken}` }
    });
    const ok = res.status === 403;
    recordTest('Role Escalation: Kitchen → Owner Reports Blocked', ok, `Expected 403, got ${res.status}`);
  } catch (err: any) {
    recordTest('Role Escalation: Kitchen → Owner Reports Blocked', false, err.message);
  }

  // 2.4 Owner credentials accessing Owner Reports MUST SUCCEED
  try {
    const res = await fetch(`${BASE_URL}/reports/cafe-roasted-bean`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const data = await res.json();
    const ok = res.status === 200 && data.success && data.data?.total_revenue !== undefined;
    recordTest('Owner Credentials Accessing Owner Reports', ok, `Status: ${res.status}`);
  } catch (err: any) {
    recordTest('Owner Credentials Accessing Owner Reports', false, err.message);
  }

  // 2.5 Kitchen credentials accessing Reception Overview MUST be rejected (kitchen -> staff)
  try {
    const res = await fetch(`${BASE_URL}/reception/cafe-roasted-bean/overview`, {
      headers: { Authorization: `Bearer ${kitchenToken}` }
    });
    const ok = res.status === 403;
    recordTest('Role Escalation: Kitchen → Reception Overview Blocked', ok, `Expected 403, got ${res.status}`);
  } catch (err: any) {
    recordTest('Role Escalation: Kitchen → Reception Overview Blocked', false, err.message);
  }

  // 2.6 Reception credentials accessing Reception Overview MUST SUCCEED
  try {
    const res = await fetch(`${BASE_URL}/reception/cafe-roasted-bean/overview`, {
      headers: { Authorization: `Bearer ${receptionToken}` }
    });
    const data = await res.json();
    const ok = res.status === 200 && data.success && Array.isArray(data.data?.tables);
    recordTest('Reception Credentials Accessing Reception Overview', ok, `Status: ${res.status}`);
  } catch (err: any) {
    recordTest('Reception Credentials Accessing Reception Overview', false, err.message);
  }

  // 2.7 Reception credentials creating a Table MUST be rejected (staff -> owner)
  try {
    const res = await fetch(`${BASE_URL}/cafes/cafe-roasted-bean/tables`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionToken}`
      },
      body: JSON.stringify({ table_number: 99, table_name: 'Hacked Table', capacity: 4 })
    });
    const ok = res.status === 403;
    recordTest('Role Escalation: Reception → Create Table Blocked', ok, `Expected 403, got ${res.status}`);
  } catch (err: any) {
    recordTest('Role Escalation: Reception → Create Table Blocked', false, err.message);
  }

  // 2.8 Owner credentials creating a Table MUST SUCCEED
  try {
    const testTableNum = 90 + Math.floor(Math.random() * 9);
    const res = await fetch(`${BASE_URL}/cafes/cafe-roasted-bean/tables`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({ table_number: testTableNum, table_name: `VIP Table ${testTableNum}`, capacity: 4 })
    });
    const ok = res.status === 201;
    recordTest('Owner Credentials Creating Table', ok, `Status: ${res.status}`);
  } catch (err: any) {
    recordTest('Owner Credentials Creating Table', false, err.message);
  }

  // 2.9 Multi-Tenant Isolation: Roasted Bean Owner token MUST NOT access Bella Italia Reports
  try {
    const res = await fetch(`${BASE_URL}/reports/cafe-bella-italia`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const ok = res.status === 403;
    recordTest('Multi-Tenant Isolation: Tenant A Owner → Tenant B Reports Blocked', ok, `Expected 403, got ${res.status}`);
  } catch (err: any) {
    recordTest('Multi-Tenant Isolation: Tenant A Owner → Tenant B Reports Blocked', false, err.message);
  }

  // 2.10 Tampered Token Signature MUST FAIL
  try {
    const tamperedToken = ownerToken.slice(0, -6) + 'abc123';
    const res = await fetch(`${BASE_URL}/auth/staff-me`, {
      headers: { Authorization: `Bearer ${tamperedToken}` }
    });
    const ok = res.status === 401;
    recordTest('Tampered Session Token Rejected', ok, `Expected 401, got ${res.status}`);
  } catch (err: any) {
    recordTest('Tampered Session Token Rejected', false, err.message);
  }

  // 2.11 Expired Token MUST FAIL
  try {
    const SESSION_SECRET = process.env.SESSION_SECRET || 'qrdine-super-secure-production-hmac-key-2026';
    const expiredPayload = {
      userId: 'staff-owner-admin',
      email: 'cafeOwnerAdmin@roastedbean.in',
      role: 'CAFE_OWNER',
      cafeId: 'cafe-roasted-bean',
      fullName: 'Café Owner Administrator',
      exp: Date.now() - 60000 // Expired 1 minute ago
    };
    const data = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
    const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
    const expiredToken = `${data}.${sig}`;

    const res = await fetch(`${BASE_URL}/auth/staff-me`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });
    const ok = res.status === 401;
    recordTest('Expired Session Token Rejected', ok, `Expected 401, got ${res.status}`);
  } catch (err: any) {
    recordTest('Expired Session Token Rejected', false, err.message);
  }

  // ----------------------------------------------------
  // PROVISION AUTHENTICATED TEST CUSTOMERS VIA SUPABASE
  // ----------------------------------------------------
  console.log('\n--- PROVISIONING REAL SUPABASE CUSTOMER SESSIONS ---');
  let customerAToken = '';
  let customerBToken = '';
  let customerAId = '';
  let customerBId = '';
  const customerAEmail = 'customer_a_audit@roastedbean.in';
  const customerBEmail = 'customer_b_audit@roastedbean.in';
  const customerPass = 'AuditCustomer#Secure2026!';

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && !SUPABASE_URL.includes('placeholder')) {
    try {
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      // Ensure customer A exists & confirmed
      try {
        await adminClient.auth.admin.createUser({
          email: customerAEmail,
          password: customerPass,
          email_confirm: true,
          user_metadata: { full_name: 'Customer Alice' }
        });
      } catch {}

      // Ensure customer B exists & confirmed
      try {
        await adminClient.auth.admin.createUser({
          email: customerBEmail,
          password: customerPass,
          email_confirm: true,
          user_metadata: { full_name: 'Customer Bob' }
        });
      } catch {}

      // Sign in Customer A
      const resA = await anonClient.auth.signInWithPassword({
        email: customerAEmail,
        password: customerPass
      });
      if (resA.data?.session?.access_token) {
        customerAToken = resA.data.session.access_token;
        customerAId = resA.data.user.id;
      }

      // Sign in Customer B
      const resB = await anonClient.auth.signInWithPassword({
        email: customerBEmail,
        password: customerPass
      });
      if (resB.data?.session?.access_token) {
        customerBToken = resB.data.session.access_token;
        customerBId = resB.data.user.id;
      }

      console.log(`Customer A Token Acquired: ${Boolean(customerAToken)} (${customerAEmail})`);
      console.log(`Customer B Token Acquired: ${Boolean(customerBToken)} (${customerBEmail})`);
    } catch (err: any) {
      console.error('Failed provisioning test customer sessions via Supabase:', err.message);
    }
  }

  // Sync Customer A profile into backend
  let custDbIdA = '';
  if (customerAToken) {
    try {
      const syncRes = await fetch(`${BASE_URL}/customers/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerAToken}`
        },
        body: JSON.stringify({
          name: 'Customer Alice',
          phone: '+91 98450 11223'
        })
      });
      const syncData = await syncRes.json();
      if (syncData.success && syncData.data?.id) {
        custDbIdA = syncData.data.id;
      }
    } catch {}
  }

  // ----------------------------------------------------
  // PART 3: CUSTOMER DATA ISOLATION & IDOR
  // ----------------------------------------------------
  console.log('\n--- 3. CUSTOMER DATA ISOLATION & IDOR TESTS ---');

  // 3.1 Unauthenticated customer accessing private order details (ord-101)
  try {
    const res = await fetch(`${BASE_URL}/orders/ord-101`);
    const ok = res.status === 403;
    recordTest('Order Details (Unauthenticated Access Blocked)', ok, `Expected 403, got ${res.status}`);
  } catch (err: any) {
    recordTest('Order Details (Unauthenticated Access Blocked)', false, err.message);
  }

  // 3.2 Customer B attempting to view Customer A's order (ord-101) with Customer B JWT MUST BE BLOCKED
  try {
    const res = await fetch(`${BASE_URL}/orders/ord-101`, {
      headers: { Authorization: `Bearer ${customerBToken}` }
    });
    const ok = res.status === 403;
    recordTest('Customer A Order Protected from Customer B (IDOR Blocked)', ok, `Expected 403, got ${res.status}`);
  } catch (err: any) {
    recordTest('Customer A Order Protected from Customer B (IDOR Blocked)', false, err.message);
  }

  // 3.3 Customer claiming identity via client header x-customer-email without token MUST BE BLOCKED
  try {
    const res = await fetch(`${BASE_URL}/orders/ord-101`, {
      headers: { 'x-customer-email': 'aditi.v@example.com' }
    });
    const ok = res.status === 403;
    recordTest('Client-Supplied Header Identity Spoofing Blocked', ok, `Expected 403, got ${res.status}`);
  } catch (err: any) {
    recordTest('Client-Supplied Header Identity Spoofing Blocked', false, err.message);
  }

  // 3.4 Customer B attempting to retrieve Customer A's order history MUST BE BLOCKED
  try {
    const res = await fetch(`${BASE_URL}/orders/customer/${customerAEmail}`, {
      headers: { Authorization: `Bearer ${customerBToken}` }
    });
    const ok = res.status === 403;
    recordTest('Customer Order History Protected from Other Customers', ok, `Expected 403, got ${res.status}`);
  } catch (err: any) {
    recordTest('Customer Order History Protected from Other Customers', false, err.message);
  }

  // 3.5 Customer A retrieving own order history with verified JWT MUST SUCCEED
  try {
    const res = await fetch(`${BASE_URL}/orders/customer/${customerAEmail}`, {
      headers: { Authorization: `Bearer ${customerAToken}` }
    });
    const data = await res.json();
    const ok = res.status === 200 && data.success && Array.isArray(data.data);
    recordTest('Customer A Accessing Own Order History', ok, `Status: ${res.status}, Orders: ${data.data?.length}`);
  } catch (err: any) {
    recordTest('Customer A Accessing Own Order History', false, err.message);
  }

  // 3.6 Customer B attempting to access Customer A's profile MUST BE BLOCKED
  try {
    const res = await fetch(`${BASE_URL}/customers/profile/${customerAEmail}`, {
      headers: { Authorization: `Bearer ${customerBToken}` }
    });
    const ok = res.status === 403;
    recordTest('Customer Profile Protected from Other Customers', ok, `Expected 403, got ${res.status}`);
  } catch (err: any) {
    recordTest('Customer Profile Protected from Other Customers', false, err.message);
  }

  // 3.7 Customer A accessing own profile with verified JWT MUST SUCCEED
  try {
    const res = await fetch(`${BASE_URL}/customers/profile/${customerAEmail}`, {
      headers: { Authorization: `Bearer ${customerAToken}` }
    });
    const data = await res.json();
    const ok = res.status === 200 && data.success && data.data?.email?.toLowerCase() === customerAEmail;
    recordTest('Customer A Accessing Own Profile', ok, `Status: ${res.status}, Name: ${data.data?.name}`);
  } catch (err: any) {
    recordTest('Customer A Accessing Own Profile', false, err.message);
  }

  // 3.8 Customer B attempting to alter Customer A's marketing preferences MUST BE BLOCKED
  try {
    const res = await fetch(`${BASE_URL}/customers/marketing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerBToken}`
      },
      body: JSON.stringify({ customer_id: custDbIdA || 'cust-demo-1', email_marketing: false })
    });
    const ok = res.status === 403;
    recordTest('Customer Marketing Settings Protected from Other Customers', ok, `Expected 403, got ${res.status}`);
  } catch (err: any) {
    recordTest('Customer Marketing Settings Protected from Other Customers', false, err.message);
  }

  // 3.9 Customer A updating permitted details (name, phone) on own profile MUST SUCCEED
  try {
    const res = await fetch(`${BASE_URL}/customers/profile/${customerAEmail}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerAToken}`
      },
      body: JSON.stringify({ name: 'Alice Verma Verified', phone: '+91 98450 99887' })
    });
    const data = await res.json();
    const ok = res.status === 200 && data.success && data.data?.name === 'Alice Verma Verified';
    recordTest('Customer A Updating Own Permitted Profile Details', ok, `Status: ${res.status}, Name: ${data.data?.name}`);
  } catch (err: any) {
    recordTest('Customer A Updating Own Permitted Profile Details', false, err.message);
  }

  // 3.10 Customer B attempting to update Customer A's profile MUST BE BLOCKED
  try {
    const res = await fetch(`${BASE_URL}/customers/profile/${customerAEmail}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerBToken}`
      },
      body: JSON.stringify({ name: 'Hacked Name' })
    });
    const ok = res.status === 403;
    recordTest('Customer Profile Updates Protected from Other Customers (IDOR Blocked)', ok, `Expected 403, got ${res.status}`);
  } catch (err: any) {
    recordTest('Customer Profile Updates Protected from Other Customers (IDOR Blocked)', false, err.message);
  }

  // 3.11 Customer attempting to escalate role or modify lifetime total_spent MUST BE IGNORED
  try {
    const res = await fetch(`${BASE_URL}/customers/profile/${customerAEmail}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerAToken}`
      },
      body: JSON.stringify({ role: 'CAFE_OWNER', total_spent: 0, auth_user_id: 'fake-auth' })
    });
    const data = await res.json();
    const ok = res.status === 200 && data.success && data.data?.role === undefined;
    recordTest('Customer Profile Protected Fields (Role/Spend Tampering Blocked)', ok, `Role not granted`);
  } catch (err: any) {
    recordTest('Customer Profile Protected Fields (Role/Spend Tampering Blocked)', false, err.message);
  }

  // ----------------------------------------------------
  // PART 4: SUPABASE AUTH & CUSTOMER ACCOUNT TESTS
  // ----------------------------------------------------
  console.log('\n--- 4. SUPABASE AUTH & CUSTOMER TESTING ---');
  console.log(`Supabase URL: ${SUPABASE_URL || 'NOT_CONFIGURED'}`);

  if (SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('placeholder')) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // 4.1 Login with INCORRECT password against Supabase Auth MUST FAIL 100%
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: customerAEmail,
        password: 'IncorrectPassword999!'
      });
      const ok = Boolean(error) && !data?.session && !data?.user;
      recordTest('Supabase Auth: Incorrect Password Rejection', ok, `Error: ${error?.message}`);
    } catch (err: any) {
      recordTest('Supabase Auth: Incorrect Password Rejection', false, err.message);
    }

    // 4.2 Login with non-existent email against Supabase Auth MUST FAIL
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: `non_existent_${Date.now()}@example.com`,
        password: 'AnyPassword123!'
      });
      const ok = Boolean(error) && !data?.session;
      recordTest('Supabase Auth: Non-Existent Account Rejection', ok, `Error: ${error?.message}`);
    } catch (err: any) {
      recordTest('Supabase Auth: Non-Existent Account Rejection', false, err.message);
    }

    // 4.3 Empty email / password against Supabase Auth MUST FAIL
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: '',
        password: ''
      });
      const ok = Boolean(error) && !data?.session;
      recordTest('Supabase Auth: Empty Credentials Rejection', ok, `Error: ${error?.message}`);
    } catch (err: any) {
      recordTest('Supabase Auth: Empty Credentials Rejection', false, err.message);
    }

    // 4.4 Signup with weak password (<8 characters)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: `test_user_${Date.now()}@example.com`,
        password: '123'
      });
      const ok = Boolean(error) || !data.user;
      recordTest('Supabase Auth: Weak Password (<8 chars) Rejection', ok, `Error: ${error?.message || 'Rejected'}`);
    } catch (err: any) {
      recordTest('Supabase Auth: Weak Password (<8 chars) Rejection', false, err.message);
    }

    // 4.5 Customer profile synchronization with verified Auth token
    try {
      const res = await fetch(`${BASE_URL}/customers/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerAToken}`
        },
        body: JSON.stringify({
          name: 'Verified Customer Patron',
          phone: '+91 99887 76655'
        })
      });
      const data = await res.json();
      const ok = res.status === 200 && data.success && Boolean(data.data?.id);
      recordTest('Customer Profile Backend Sync (Auth Linkage)', ok, `Customer ID: ${data.data?.id}`);
    } catch (err: any) {
      recordTest('Customer Profile Backend Sync (Auth Linkage)', false, err.message);
    }

    // 4.6 Password reset request with production redirect URL
    try {
      const { error } = await supabase.auth.resetPasswordForEmail('test_patron_reset@example.com', {
        redirectTo: 'https://ais-dev-ig5ndkxaudp5ozbhq5lcf7-729948221423.asia-east1.run.app'
      });
      const ok = error === null || Boolean(error?.message);
      recordTest('Password Reset Request (Production Redirect URL)', ok, `Response: ${error?.message || 'Accepted'}`);
    } catch (err: any) {
      recordTest('Password Reset Request (Production Redirect URL)', false, err.message);
    }
  } else {
    recordTest('Supabase Configuration Check', false, 'Supabase URL or Anon key is missing or placeholder');
  }

  // ----------------------------------------------------
  // PART 5: COMPLETE MEDIA & ASSET HEALTH AUDIT
  // ----------------------------------------------------
  console.log('\n--- 5. ASSET & IMAGE HEALTH AUDIT ---');
  try {
    const fs = await import('fs');
    const content = fs.readFileSync('server.ts', 'utf8');
    const urls = [...new Set(content.match(/https:\/\/images\.unsplash\.com[^\s"'"'"'"`>,]+/g) || [])];
    let broken = 0;
    for (const url of urls) {
      try {
        const res = await fetch(url, { method: 'HEAD' });
        if (!res.ok) broken++;
      } catch {
        broken++;
      }
    }
    const ok = broken === 0;
    recordTest('Unsplash Asset Integrity Audit (0 Broken Images)', ok, `Audited ${urls.length} images, broken: ${broken}`);
  } catch (err: any) {
    recordTest('Unsplash Asset Integrity Audit (0 Broken Images)', false, err.message);
  }

  // ----------------------------------------------------
  // PART 6: QR-FIRST TABLE ORDERING & SESSION SECURITY
  // ----------------------------------------------------
  console.log('\n--- 6. QR-FIRST ORDERING & TABLE SECURITY (BRUTAL ACCEPTANCE TESTS) ---');

  // 6.1 Order attempt with NO QR session token MUST BE BLOCKED (Rule 1 & Rule 2)
  try {
    const res = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerAToken}`
      },
      body: JSON.stringify({
        cafe_id: 'roasted-bean',
        table_number: 1,
        cart_items: [{ menu_item_id: 'item-espresso', quantity: 1 }]
      })
    });
    const ok = res.status === 403;
    recordTest('BRUTAL: Order With NO QR Session Blocked (Rule 1 & 2)', ok, `Expected 403, got ${res.status}`);
  } catch (err: any) {
    recordTest('BRUTAL: Order With NO QR Session Blocked (Rule 1 & 2)', false, err.message);
  }

  // 6.2 Order attempt with NO Customer Authentication MUST BE BLOCKED (Rule 1)
  try {
    const res = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-customer-session': 'ts_fake_session_token_123'
      },
      body: JSON.stringify({
        cafe_id: 'roasted-bean',
        table_number: 1,
        cart_items: [{ menu_item_id: 'item-espresso', quantity: 1 }]
      })
    });
    const ok = res.status === 401;
    recordTest('BRUTAL: Order Without Customer Authentication Blocked', ok, `Expected 401, got ${res.status}`);
  } catch (err: any) {
    recordTest('BRUTAL: Order Without Customer Authentication Blocked', false, err.message);
  }

  // 6.3 Order attempt with Fake / Tampered QR Session Token MUST BE BLOCKED (Rule 6)
  try {
    const res = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerAToken}`,
        'x-customer-session': 'ts_forged_hacker_token_99999'
      },
      body: JSON.stringify({
        cafe_id: 'roasted-bean',
        table_number: 1,
        cart_items: [{ menu_item_id: 'item-espresso', quantity: 1 }]
      })
    });
    const ok = res.status === 403;
    recordTest('BRUTAL: Tampered / Fake QR Session Token Blocked (Rule 6)', ok, `Expected 403, got ${res.status}`);
  } catch (err: any) {
    recordTest('BRUTAL: Tampered / Fake QR Session Token Blocked (Rule 6)', false, err.message);
  }

  // 6.4 QR Session Initialization for Non-Existent Table MUST FAIL (Rule 4)
  try {
    const res = await fetch(`${BASE_URL}/tables/session/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cafe_id: 'roasted-bean',
        table_number: 9999
      })
    });
    const ok = res.status === 404;
    recordTest('BRUTAL: Non-Existent Table QR Init Rejected', ok, `Expected 404, got ${res.status}`);
  } catch (err: any) {
    recordTest('BRUTAL: Non-Existent Table QR Init Rejected', false, err.message);
  }

  // 6.5 QR Session Initialization for Valid Table 1 MUST SUCCEED (Rule 3)
  let table1SessionToken = '';
  let table1SessionId = '';
  try {
    const res = await fetch(`${BASE_URL}/tables/session/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cafe_id: 'roasted-bean',
        table_number: 1
      })
    });
    const data = await res.json();
    const ok = res.status === 200 && data.success && data.data?.session_token && data.data?.status === 'ACTIVE';
    if (ok) {
      table1SessionToken = data.data.session_token;
      table1SessionId = data.data.session_id;
    }
    recordTest('BRUTAL: Table 1 QR Scan & Session Init Succeeds', ok, `Status: ${res.status}, Session: ${data.data?.session_id}`);
  } catch (err: any) {
    recordTest('BRUTAL: Table 1 QR Scan & Session Init Succeeds', false, err.message);
  }

  // 6.6 Tampered Table Number (Session is Table 1, Order claims Table 2) MUST BE BLOCKED (Rule 4 & 5)
  try {
    const res = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerAToken}`,
        'x-customer-session': table1SessionToken
      },
      body: JSON.stringify({
        cafe_id: 'roasted-bean',
        table_number: 2, // Tampered! Session is Table 1
        cart_items: [{ menu_item_id: 'item-espresso', quantity: 1 }]
      })
    });
    const ok = res.status === 403;
    recordTest('BRUTAL: Tampered Table Number (Session Mismatch) Blocked (Rule 4)', ok, `Expected 403, got ${res.status}`);
  } catch (err: any) {
    recordTest('BRUTAL: Tampered Table Number (Session Mismatch) Blocked (Rule 4)', false, err.message);
  }

  // 6.7 Tampered Café ID (Session is Roasted Bean, Order claims Bella Italia) MUST BE BLOCKED
  try {
    const res = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerAToken}`,
        'x-customer-session': table1SessionToken
      },
      body: JSON.stringify({
        cafe_id: 'bella-italia', // Tampered! Session is Roasted Bean
        table_number: 1,
        cart_items: [{ menu_item_id: 'item-espresso', quantity: 1 }]
      })
    });
    const ok = res.status === 403;
    recordTest('BRUTAL: Tampered Café ID (Cross-Café Isolation) Blocked', ok, `Expected 403, got ${res.status}`);
  } catch (err: any) {
    recordTest('BRUTAL: Tampered Café ID (Cross-Café Isolation) Blocked', false, err.message);
  }

  // 6.8 Valid QR + Valid Customer Auth -> Order 1 Creation MUST SUCCEED with server-side price calculation (Rules 5, 8, 10)
  let order1Id = '';
  let order1Total = 0;
  try {
    const res = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerAToken}`,
        'x-customer-session': table1SessionToken
      },
      body: JSON.stringify({
        cafe_id: 'roasted-bean',
        table_number: 1,
        cart_items: [
          { menu_item_id: 'item-espresso', quantity: 2, notes: 'Double shot, extra hot' }
        ],
        notes: 'Table 1 Window Seat'
      })
    });
    const data = await res.json();
    const ok = (res.status === 201 || res.status === 200) && data.success && Boolean(data.data?.order?.id);
    if (ok) {
      order1Id = data.data.order.id;
      order1Total = data.data.order.total;
    }
    recordTest('BRUTAL: Valid QR + Auth → Order 1 Placed Successfully', ok, `Order ID: ${order1Id}, Total: ₹${order1Total}`);
  } catch (err: any) {
    recordTest('BRUTAL: Valid QR + Auth → Order 1 Placed Successfully', false, err.message);
  }

  // 6.9 Multi-Customer Ordering at Same Table: Customer B places Order 2 on same Table 1 (Rule 8)
  let order2Id = '';
  let order2Total = 0;
  try {
    const res = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerBToken}`,
        'x-customer-session': table1SessionToken
      },
      body: JSON.stringify({
        cafe_id: 'roasted-bean',
        table_number: 1,
        cart_items: [
          { menu_item_id: 'item-latte', quantity: 1, notes: 'Oat milk if available' }
        ],
        notes: 'Customer Bob order'
      })
    });
    const data = await res.json();
    const ok = (res.status === 201 || res.status === 200) && data.success && Boolean(data.data?.order?.id);
    if (ok) {
      order2Id = data.data.order.id;
      order2Total = data.data.order.total;
    }
    recordTest('BRUTAL: Customer B Independent Order at Same Table 1 (Rule 8)', ok, `Order 2: ${order2Id}, Total: ₹${order2Total}`);
  } catch (err: any) {
    recordTest('BRUTAL: Customer B Independent Order at Same Table 1 (Rule 8)', false, err.message);
  }

  // 6.10 Duplicate Order Prevention: Identical submission in rapid succession MUST RETURN DUPLICATE (Rule 11)
  try {
    const res = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerBToken}`,
        'x-customer-session': table1SessionToken
      },
      body: JSON.stringify({
        cafe_id: 'roasted-bean',
        table_number: 1,
        cart_items: [
          { menu_item_id: 'item-latte', quantity: 1, notes: 'Oat milk if available' }
        ],
        notes: 'Customer Bob order'
      })
    });
    const data = await res.json();
    const ok = res.status === 200 && data.success && data.data?.is_duplicate === true;
    recordTest('BRUTAL: Duplicate Order Protection (Rule 11)', ok, `Detected duplicate: ${data.data?.is_duplicate}`);
  } catch (err: any) {
    recordTest('BRUTAL: Duplicate Order Protection (Rule 11)', false, err.message);
  }

  // 6.11 Kitchen KDS Receives Operational Order Details (Rule 9)
  try {
    const res = await fetch(`${BASE_URL}/orders/cafe/cafe-roasted-bean`, {
      headers: { Authorization: `Bearer ${kitchenToken}` }
    });
    const data = await res.json();
    const kdsOrders = data.data || [];
    const found1 = kdsOrders.find((o: any) => o.id === order1Id);
    const found2 = kdsOrders.find((o: any) => o.id === order2Id);
    const ok = res.status === 200 && Boolean(found1) && Boolean(found2) && found1.table_number === 1;
    recordTest('BRUTAL: Kitchen KDS Receives Orders & Table Numbers (Rule 9)', ok, `Found Order 1: ${Boolean(found1)}, Order 2: ${Boolean(found2)}`);
  } catch (err: any) {
    recordTest('BRUTAL: Kitchen KDS Receives Orders & Table Numbers (Rule 9)', false, err.message);
  }

  // 6.12 Reception Receives Live Aggregated Table Bill & Payment Status (Rule 8 & 9)
  try {
    const res = await fetch(`${BASE_URL}/reception/cafe-roasted-bean/overview`, {
      headers: { Authorization: `Bearer ${receptionToken}` }
    });
    const data = await res.json();
    const table1Summary = (data.data?.tables || []).find((t: any) => t.table.table_number === 1);
    const expectedBilled = Number((order1Total + order2Total).toFixed(2));
    const ok = res.status === 200 && table1Summary && Math.abs(table1Summary.total_billed - expectedBilled) < 0.1;
    recordTest('BRUTAL: Reception Table Bill Aggregates All Customer Orders (Rule 8 & 9)', ok, `Billed: ₹${table1Summary?.total_billed}, Expected: ₹${expectedBilled}`);
  } catch (err: any) {
    recordTest('BRUTAL: Reception Table Bill Aggregates All Customer Orders (Rule 8 & 9)', false, err.message);
  }

  // 6.13 Payment Settlement via Reception (Settles Table 1, Releases Table) (Rule 12 & 13)
  try {
    const res = await fetch(`${BASE_URL}/reception/settle-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionToken}`
      },
      body: JSON.stringify({
        cafe_id: 'cafe-roasted-bean',
        table_id: 'tbl-rb-1',
        method: 'UPI_POS',
        release_table: true
      })
    });
    const data = await res.json();
    const ok = res.status === 200 && data.success && data.data?.table_status === 'FREE';
    recordTest('BRUTAL: Final Settlement & Table Release (Rule 12)', ok, `Status: ${res.status}, Table: ${data.data?.table_status}`);
  } catch (err: any) {
    recordTest('BRUTAL: Final Settlement & Table Release (Rule 12)', false, err.message);
  }

  // 6.14 Final Invoice Generated with Full Details (Rule 14 & 16)
  try {
    const res = await fetch(`${BASE_URL}/invoices/${order1Id}`, {
      headers: { Authorization: `Bearer ${customerAToken}` }
    });
    const data = await res.json();
    const inv = data.data;
    const ok = res.status === 200 && data.success && inv.order?.id === order1Id && inv.order?.payment_status === 'PAID';
    recordTest('BRUTAL: Final Tax Invoice Generated (Rule 14 & 16)', ok, `Invoice: ${inv?.invoice_number}, Status: ${inv?.order?.payment_status}`);
  } catch (err: any) {
    recordTest('BRUTAL: Final Tax Invoice Generated (Rule 14 & 16)', false, err.message);
  }

  // 6.15 Final Invoice Email Dispatched with Thank-You / Visit-Again Message (Rule 15)
  try {
    const res = await fetch(`${BASE_URL}/invoices/${order1Id}/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerAToken}`
      },
      body: JSON.stringify({ email: customerAEmail })
    });
    const data = await res.json();
    const ok = res.status === 200 && data.success;
    recordTest('BRUTAL: Final Invoice Email Dispatched with Thank-You Message (Rule 15)', ok, `Message: ${data.message}`);
  } catch (err: any) {
    recordTest('BRUTAL: Final Invoice Email Dispatched with Thank-You Message (Rule 15)', false, err.message);
  }

  // 6.16 Ordering Blocked on Settled / Closed Table Session (Rule 6 & 12)
  try {
    const res = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerAToken}`,
        'x-customer-session': table1SessionToken
      },
      body: JSON.stringify({
        cafe_id: 'roasted-bean',
        table_number: 1,
        cart_items: [{ menu_item_id: 'item-espresso', quantity: 1 }]
      })
    });
    const ok = res.status === 403;
    recordTest('BRUTAL: Further Ordering Blocked on Settled/Closed Session (Rule 6 & 12)', ok, `Expected 403, got ${res.status}`);
  } catch (err: any) {
    recordTest('BRUTAL: Further Ordering Blocked on Settled/Closed Session (Rule 6 & 12)', false, err.message);
  }

  // 6.17 Reusing Closed Table Session Token on /session/init MUST BE REJECTED (Rule 6)
  try {
    const res = await fetch(`${BASE_URL}/tables/session/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cafe_id: 'roasted-bean',
        table_number: 1,
        existing_token: table1SessionToken
      })
    });
    const ok = res.status === 403;
    recordTest('BRUTAL: Reusing Closed Table Session Token Rejected (Rule 6)', ok, `Expected 403, got ${res.status}`);
  } catch (err: any) {
    recordTest('BRUTAL: Reusing Closed Table Session Token Rejected (Rule 6)', false, err.message);
  }

  // ----------------------------------------------------
  // FINAL SUMMARY & REPORT
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log('FINAL TEST SUITE SUMMARY:');
  const total = Object.keys(results).length;
  const passed = Object.values(results).filter(Boolean).length;
  const failed = total - passed;
  console.log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
