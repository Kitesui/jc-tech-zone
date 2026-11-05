// Checks cookie-based sessions. Run with the server up: BASE=http://localhost:5000 node server/test-cookie.mjs
import assert from 'node:assert';

const BASE = process.env.BASE || 'http://localhost:5000';
const api = (method, path, { cookie, headers, body } = {}) =>
  fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }), ...headers },
    body: body && JSON.stringify(body),
  });

const login = await api('POST', '/auth/login', { body: { username: 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' } });
assert.equal(login.status, 200);
const setCookie = login.headers.get('set-cookie');
assert(setCookie, 'login must set a cookie');
assert(/jc_session=/.test(setCookie), 'cookie name');
assert(/HttpOnly/i.test(setCookie), 'cookie must be HttpOnly');
assert(/SameSite=Strict/i.test(setCookie), 'cookie must be SameSite=Strict');
const cookie = setCookie.split(';')[0];

// reads work with the cookie alone
assert.equal((await api('GET', '/auth/me', { cookie })).status, 200, 'cookie authenticates GET');
assert.equal((await api('GET', '/auth/me')).status, 401, 'no cookie, no access');

// writes via cookie need the custom header (CSRF guard)
const tech = { full_name: 'Cookie Test', phone: '0900-000-0000' };
let r = await api('POST', '/technicians', { cookie, body: tech });
assert.equal(r.status, 403, 'cookie write without X-Requested-With must be rejected');
r = await api('POST', '/technicians', { cookie, headers: { 'X-Requested-With': 'XMLHttpRequest' }, body: tech });
assert.equal(r.status, 201, 'cookie write with header must work');
const created = await r.json();
await api('DELETE', `/technicians/${created.id}`, { cookie, headers: { 'X-Requested-With': 'XMLHttpRequest' } });

// logout clears the cookie
const out = await api('POST', '/auth/logout');
assert(/Max-Age=0/.test(out.headers.get('set-cookie')), 'logout must expire the cookie');
console.log('ALL COOKIE CHECKS PASSED');
