// Run with the server up: BASE=http://localhost:5055 node server/test-ownership.mjs
import assert from 'node:assert';

const BASE = process.env.BASE || 'http://localhost:5000';
const PHONE = process.env.PHONE || '09626149898';
const call = async (method, path, token, body) => {
  const r = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const login = async (u) => (await call('POST', '/auth/login', null, { username: u, password: process.env.TECH_PASSWORD || 'tech123' })).body;

const admin = await call('POST', '/auth/login', null, { username: 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' });
const A = await login('cairo@jctechzone.com');
const B = await login('jake@jctechzone.com');
assert(A.token && B.token && A.user.id !== B.user.id, 'need two distinct technician logins');

const created = await call('POST', '/tickets', null, {
  customer_name: 'Ownership Test', contact_number: PHONE, service_type: 'drop_off',
  device_type: 'Test Laptop', issue_description: 'automated ownership test',
});
assert.equal(created.status, 201);
const id = created.body.id;

try {
  // A claims the unassigned ticket
  let r = await call('PUT', `/tickets/${id}`, A.token, { status: 'Under Diagnostics' });
  assert.equal(r.status, 200);
  assert.equal(r.body.ticket.assigned_technician_id, A.user.id, 'A should have claimed it');

  // B is blocked from update, log, and reassign
  r = await call('PUT', `/tickets/${id}`, B.token, { status: 'In Progress' });
  assert.equal(r.status, 403, 'B must not update A ticket');
  r = await call('POST', `/tickets/${id}/logs`, B.token, { work_notes: 'forged', technician_id: A.user.id });
  assert.equal(r.status, 403, 'B must not log on A ticket');
  r = await call('PUT', `/tickets/${id}`, B.token, { assigned_technician_id: B.user.id });
  assert.equal(r.status, 403, 'B must not steal A ticket');

  // A cannot forge a log as B; log is stamped with A
  r = await call('POST', `/tickets/${id}/logs`, A.token, { work_notes: 'real note', technician_id: B.user.id });
  assert.equal(r.status, 201);
  assert.equal(r.body.technician_id, A.user.id, 'log author must come from token');

  // A cannot hand the ticket to B; admin can
  r = await call('PUT', `/tickets/${id}`, A.token, { assigned_technician_id: B.user.id });
  assert.equal(r.body.ticket?.assigned_technician_id, A.user.id, 'tech cannot reassign');
  r = await call('PUT', `/tickets/${id}`, admin.body.token, { assigned_technician_id: B.user.id });
  assert.equal(r.status, 200);
  assert.equal(r.body.ticket.assigned_technician_id, B.user.id, 'admin can reassign');
  console.log('ALL OWNERSHIP CHECKS PASSED');
} finally {
  await call('DELETE', `/tickets/${id}`, admin.body.token);
}
