import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const anonClient = createClient(SUPABASE_URL, ANON_KEY);

async function testSync() {
  const { data, error } = await anonClient.auth.signInWithPassword({
    email: 'customer_a_test@roastedbean.in',
    password: 'KnownPassword123!'
  });
  if (error) {
    console.error('Sign in error:', error);
    return;
  }
  console.log('Got user session:', data.user.id, data.user.email);
  const token = data.session.access_token;

  console.log('Calling POST http://localhost:3000/api/customers/sync ...');
  const res = await fetch('http://localhost:3000/api/customers/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      auth_user_id: data.user.id,
      email: data.user.email,
      name: 'Customer A Test',
      phone: '+919876543210'
    })
  });
  const resJson = await res.json();
  console.log('Sync status:', res.status);
  console.log('Sync response:', resJson);
}

testSync().catch(console.error);
