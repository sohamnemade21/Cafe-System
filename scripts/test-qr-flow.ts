import 'dotenv/config';
import { db, generateTableQr } from '../server/db.js';
import { createTableQrToken, verifyTableQrToken } from '../server/auth.js';

async function testQrFlow() {
  console.log('==============================================');
  console.log('RUNNING PRODUCTION QR GENERATION & VERIFY TEST');
  console.log('==============================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string, details?: string) {
    if (condition) {
      passed++;
      console.log(`✅ PASS: ${desc}${details ? ` (${details})` : ''}`);
    } else {
      failed++;
      console.error(`❌ FAIL: ${desc}${details ? ` (${details})` : ''}`);
    }
  }

  // 1. Fetch tables 1-6 for roasted-bean
  const tables = await db.getTables('roasted-bean');
  assert(tables.length >= 6, 'Fetched at least 6 production tables', `Found: ${tables.length}`);

  const qrTokens = new Set<string>();
  const qrDataUrls = new Set<string>();

  for (const t of tables.slice(0, 6)) {
    assert(
      typeof t.qr_code_url === 'string' && t.qr_code_url.startsWith('data:image/png;base64,'),
      `Table #${t.table_number} has valid real data:image/png QR code`,
      `Length: ${t.qr_code_url?.length} chars`
    );

    assert(
      typeof t.qr_token === 'string' && t.qr_token.length > 20,
      `Table #${t.table_number} has secure signed QR token`,
      `Token: ${t.qr_token?.slice(0, 20)}...`
    );

    if (t.qr_token) qrTokens.add(t.qr_token);
    if (t.qr_code_url) qrDataUrls.add(t.qr_code_url);

    // Verify token resolves cryptographically
    if (t.qr_token) {
      const payload = verifyTableQrToken(t.qr_token);
      assert(
        payload !== null && payload.tableNumber === t.table_number,
        `Table #${t.table_number} token cryptographically validates to Table #${t.table_number}`,
        `Payload tableNumber: ${payload?.tableNumber}`
      );
    }
  }

  assert(qrTokens.size >= 6, 'All 6 tables have unique secure QR tokens', `Unique: ${qrTokens.size}`);
  assert(qrDataUrls.size >= 6, 'All 6 tables have unique QR images', `Unique: ${qrDataUrls.size}`);

  // 2. Tampered Token Test
  const validToken = Array.from(qrTokens)[0];
  const tamperedToken = validToken.slice(0, -5) + 'AAAAA';
  const tamperedPayload = verifyTableQrToken(tamperedToken);
  assert(tamperedPayload === null, 'Tampered QR token is strictly rejected as invalid');

  // 3. Add Table 7 Test
  const testTableNum = 70 + Math.floor(Math.random() * 10);
  const createdTable = await db.createTable('roasted-bean', {
    table_number: testTableNum,
    table_name: `Table ${testTableNum} - Rooftop Terrace`,
    capacity: 4
  });

  assert(
    createdTable.table_number === testTableNum,
    `Successfully created Table #${testTableNum}`
  );
  assert(
    typeof createdTable.qr_code_url === 'string' && createdTable.qr_code_url.startsWith('data:image/png;base64,'),
    `New Table #${testTableNum} immediately has real generated QR data URL`
  );
  assert(
    typeof createdTable.qr_token === 'string' && createdTable.qr_token.length > 20,
    `New Table #${testTableNum} immediately has secure signed QR token`
  );

  if (createdTable.qr_token) {
    const payload = verifyTableQrToken(createdTable.qr_token);
    assert(
      payload?.tableNumber === testTableNum,
      `New Table #${testTableNum} QR token correctly resolves to Table #${testTableNum}`
    );
  }

  // Verify created table persists when fetching tables again
  const refreshedTables = await db.getTables('roasted-bean');
  const foundRefreshed = refreshedTables.find(t => t.table_number === testTableNum);
  assert(
    Boolean(foundRefreshed && foundRefreshed.qr_code_url?.startsWith('data:image/png;base64,')),
    `New Table #${testTableNum} persists with real QR image upon refresh`
  );

  console.log('\n==============================================');
  console.log(`TOTAL: ${passed} PASSED, ${failed} FAILED`);
  console.log('==============================================');

  if (failed > 0) {
    process.exit(1);
  }
}

testQrFlow().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
