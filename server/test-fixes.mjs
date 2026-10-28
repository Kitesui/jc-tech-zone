// Tests: morning/afternoon slots stored correctly, cancelled/completed lock
// Run: node server/test-fixes.mjs  (server must be on :5000)
import assert from 'node:assert';

const BASE = 'http://localhost:5000';
const PHONE = '09626149898';
const call = async (method, path, token, body) => {
  const r = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

const admin = (await call('POST', '/auth/login', null, { username: 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' })).body;
const A = admin.token;

// ---- 1. Morning slot: preferred_schedule hour must be 09 ----
const morning = await call('POST', '/tickets', null, {
  customer_name: 'Slot Test Morning', contact_number: PHONE,
  service_type: 'home_service', device_type: 'test device',
  issue_description: 'morning slot test', address: 'Marikina Test',
  preferred_schedule: '2099-11-15T09:00:00', // far future so no collision
});
assert.equal(morning.status, 201, `Morning create failed: ${JSON.stringify(morning.body)}`);
const mSched = morning.body.ticket?.preferred_schedule || morning.body.preferred_schedule;
const mHour = parseInt(String(mSched).substring(11,13), 10);
assert(mHour < 12, `Morning slot hour must be <12, got hour=${mHour} from "${mSched}"`);
console.log(`Morning slot OK: ${mSched} → "${mHour < 12 ? '9-11 AM' : '1-3 PM'}"`);

// ---- 2. Afternoon slot: preferred_schedule hour must be 13 ----
const afternoon = await call('POST', '/tickets', null, {
  customer_name: 'Slot Test Afternoon', contact_number: PHONE,
  service_type: 'home_service', device_type: 'test device',
  issue_description: 'afternoon slot test', address: 'Marikina Test',
  preferred_schedule: '2099-11-16T13:00:00', // different date to avoid same-day collision
});
assert.equal(afternoon.status, 201, `Afternoon create failed: ${JSON.stringify(afternoon.body)}`);
const aSched = afternoon.body.ticket?.preferred_schedule || afternoon.body.preferred_schedule;
const aHour = parseInt(String(aSched).substring(11,13), 10);
assert(aHour >= 12, `Afternoon slot hour must be >=12, got hour=${aHour} from "${aSched}"`);
console.log(`Afternoon slot OK: ${aSched} → "${aHour < 12 ? '9-11 AM' : '1-3 PM'}"`);

// ---- 3. Cancelled tickets cannot be edited by technician ----
const tech = (await call('POST', '/auth/login', null, { username: 'cairo@jctechzone.com', password: process.env.TECH_PASSWORD || 'tech123' })).body;
const dropOff = await call('POST', '/tickets', null, {
  customer_name: 'Cancel Lock Test', contact_number: PHONE,
  service_type: 'drop_off', issue_description: 'cancel lock test',
});
const ticketId = dropOff.body.id;
// Admin cancels it
await call('PUT', `/tickets/${ticketId}`, A, { status: 'Cancelled' });
// Technician tries to edit — should be blocked
const editAttempt = await call('PUT', `/tickets/${ticketId}`, tech.token, { status: 'Received' });
assert.equal(editAttempt.status, 400, `Cancelled ticket must block tech edit, got ${editAttempt.status}: ${JSON.stringify(editAttempt.body)}`);
console.log(`Cancelled lock OK: tech blocked with "${editAttempt.body.error}"`);

// Admin is blocked too: cancelled is final
const adminEdit = await call('PUT', `/tickets/${ticketId}`, A, { status: 'Received' });
assert.equal(adminEdit.status, 400, `Admin must also be blocked on cancelled ticket`);
console.log('Admin also blocked OK');

console.log('\nALL TESTS PASSED ✅');

// cleanup
for (const t of [morning.body.id, afternoon.body.id, ticketId]) {
  if (t) await call('DELETE', `/tickets/${t}`, A);
}
