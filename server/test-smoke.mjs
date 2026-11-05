// End-to-end smoke test (acts like a browser: cookie session + X-Requested-With).
// Run: BASE=https://jc-tech-zone.onrender.com node server/test-smoke.mjs
// Creates and deletes its own tickets/product/technician. SMS goes to PHONE.
const BASE = process.env.BASE || 'http://localhost:5000';
const PHONE = process.env.PHONE || '09626149898';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';
const TECH_PASS = process.env.TECH_PASSWORD || 'tech123';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + detail}`);
};

class Session {
  cookie = '';
  async call(method, path, body) {
    const r = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...(this.cookie && { Cookie: this.cookie }) },
      body: body && JSON.stringify(body),
    });
    const sc = r.headers.get('set-cookie');
    if (sc && sc.includes('jc_session=') && !/Max-Age=0/.test(sc)) this.cookie = sc.split(';')[0];
    let json = {};
    try { json = await r.json(); } catch {}
    return { status: r.status, body: json };
  }
}

const guest = new Session(), admin = new Session(), tech = new Session();
const cleanup = { tickets: [], product: null, technician: null };
const firstId = (b) => b.id || b.ticket?.id || b.product?.id || b.technician?.id;

try {
  // ---- 1. pages and health ----
  for (const p of ['/customer', '/track', '/catalog', '/login', '/tech', '/admin', '/api/health']) {
    const r = await fetch(BASE + p);
    check(`page ${p} loads`, r.status === 200, `status ${r.status}`);
  }

  // ---- 2. public catalog and feedback summary ----
  let r = await guest.call('GET', '/api/products');
  check('catalog lists products', r.status === 200, `status ${r.status}`);
  r = await guest.call('GET', '/api/products/categories');
  check('catalog categories', r.status === 200, `status ${r.status}`);
  r = await guest.call('GET', '/api/feedback/summary');
  check('feedback summary', r.status === 200, `status ${r.status}`);

  // ---- 3. logins ----
  r = await admin.call('POST', '/api/auth/login', { username: 'admin', password: ADMIN_PASS });
  check('admin login + cookie session', r.status === 200 && !!admin.cookie, `status ${r.status}`);
  r = await tech.call('POST', '/api/auth/login', { username: 'cairo@jctechzone.com', password: TECH_PASS });
  check('technician login + cookie session', r.status === 200 && !!tech.cookie, `status ${r.status}`);
  r = await guest.call('POST', '/api/auth/login', { username: 'admin', password: 'wrong' });
  check('wrong password rejected', r.status === 401, `status ${r.status}`);

  // ---- 4. guest booking: drop-off ----
  r = await guest.call('POST', '/api/tickets', {
    customer_name: 'Smoke Test Dropoff', contact_number: PHONE, service_type: 'drop_off',
    device_type: 'Laptop Test', issue_description: 'smoke test drop-off',
  });
  const drop = r.body;
  const dropId = firstId(drop);
  if (dropId) cleanup.tickets.push(dropId);
  const dropRef = drop.ticket_reference_id || drop.ticket?.ticket_reference_id;
  check('guest drop-off booking creates ticket + reference id', r.status === 201 && !!dropRef, JSON.stringify(r.body));

  r = await guest.call('GET', `/api/tickets/track/${dropRef}`);
  check('customer tracks ticket by reference id', r.status === 200 && r.body.ticket?.status === 'Received', JSON.stringify(r.body).slice(0, 200));
  r = await guest.call('GET', '/api/tickets/track/JCT-0000-NOPE00');
  check('unknown reference id returns 404', r.status === 404, `status ${r.status}`);

  // ---- 5. guest booking: home service, slot rules ----
  const day = '2099-12-01';
  r = await guest.call('GET', `/api/tickets/home-service-slots?date=${day}`);
  check('home-service slots shows both slots free', r.status === 200 && r.body.slots?.every((s) => s.available), JSON.stringify(r.body));
  r = await guest.call('POST', '/api/tickets', {
    customer_name: 'Smoke Test Home AM', contact_number: PHONE, service_type: 'home_service',
    device_type: 'PC Test', issue_description: 'smoke test home morning', address: 'Marikina Test St',
    preferred_schedule: `${day}T09:00:00`,
  });
  const homeAM = r.body, homeAMId = firstId(homeAM);
  if (homeAMId) cleanup.tickets.push(homeAMId);
  check('home service morning booking', r.status === 201, JSON.stringify(r.body));
  const amSched = homeAM.ticket?.preferred_schedule || homeAM.preferred_schedule || '';
  check('morning slot stored as 9 AM', parseInt(amSched.substring(11, 13), 10) === 9, amSched);
  console.log(`      home service starting cost: ${homeAM.ticket?.estimated_cost ?? homeAM.estimated_cost}`);

  r = await guest.call('POST', '/api/tickets', {
    customer_name: 'Smoke Test Dup', contact_number: PHONE, service_type: 'home_service',
    device_type: 'x', issue_description: 'dup', address: 'x', preferred_schedule: `${day}T09:00:00`,
  });
  if (firstId(r.body) && r.status === 201) cleanup.tickets.push(firstId(r.body)); // never leave strays if a guard fails
  check('same morning slot cannot be double-booked', r.status === 400, `status ${r.status}`);
  r = await guest.call('POST', '/api/tickets', {
    customer_name: 'Smoke Test Home PM', contact_number: PHONE, service_type: 'home_service',
    device_type: 'PC Test', issue_description: 'smoke test home afternoon', address: 'Marikina Test St',
    preferred_schedule: `${day}T13:00:00`,
  });
  const homePMId = firstId(r.body);
  if (homePMId) cleanup.tickets.push(homePMId);
  check('afternoon slot on same day still bookable', r.status === 201, JSON.stringify(r.body));
  r = await guest.call('POST', '/api/tickets', {
    customer_name: 'Smoke Test Third', contact_number: PHONE, service_type: 'home_service',
    device_type: 'x', issue_description: 'third', address: 'x', preferred_schedule: `${day}T09:00:00`,
  });
  if (firstId(r.body) && r.status === 201) cleanup.tickets.push(firstId(r.body)); // never leave strays if a guard fails
  check('day is full after 2 bookings', r.status === 400, `status ${r.status}`);
  r = await guest.call('POST', '/api/tickets', { customer_name: 'x' });
  check('booking with missing fields rejected', r.status === 400, `status ${r.status}`);

  // ---- 6. staff views ----
  r = await guest.call('GET', '/api/tickets');
  check('guest cannot list tickets', r.status === 401, `status ${r.status}`);
  r = await admin.call('GET', '/api/tickets');
  check('admin sees new tickets', r.status === 200 && [dropId, homeAMId].every((id) => r.body.some((t) => t.id === id)));
  r = await admin.call('GET', `/api/tickets/${dropId}`);
  check('admin opens ticket detail', r.status === 200 && Array.isArray(r.body.logs), `status ${r.status}`);
  r = await admin.call('GET', '/api/technicians');
  check('admin lists technicians', r.status === 200 && r.body.length > 0, `status ${r.status}`);
  r = await guest.call('GET', '/api/technicians');
  check('guest cannot list technicians', r.status === 401, `status ${r.status}`);

  // ---- 7. technician work flow on the drop-off ticket ----
  r = await tech.call('GET', '/api/tickets');
  check('technician queue includes unassigned ticket', r.status === 200 && r.body.some((t) => t.id === dropId), `status ${r.status}`);
  r = await tech.call('PUT', `/api/tickets/${dropId}`, { status: 'Under Diagnostics' });
  check('technician claims + moves to Under Diagnostics', r.status === 200 && !!r.body.ticket?.assigned_technician_id, JSON.stringify(r.body).slice(0, 200));
  r = await tech.call('POST', `/api/tickets/${dropId}/logs`, { work_notes: 'replaced RAM', parts_used: 'DDR4 8GB', labor_cost: 500 });
  check('technician adds work log with cost', r.status === 201, JSON.stringify(r.body));
  r = await guest.call('GET', `/api/tickets/track/${dropRef}`);
  check('customer sees updated cost + log', Number(r.body.ticket?.estimated_cost) >= 500 && r.body.logs?.length >= 2, JSON.stringify(r.body.ticket?.estimated_cost));
  r = await tech.call('PUT', `/api/tickets/${dropId}`, { status: 'Ready for Pick-Up', estimated_cost: 1500 });
  check('technician sets final price + Ready for Pick-Up', r.status === 200 && Number(r.body.ticket?.estimated_cost) === 1500, JSON.stringify(r.body).slice(0, 200));
  r = await guest.call('POST', '/api/feedback', { ticket_id: dropId, rating: 5, comments: 'smoke' });
  check('feedback rejected before Completed', r.status === 400, `status ${r.status}`);
  r = await tech.call('PUT', `/api/tickets/${dropId}`, { status: 'Completed' });
  check('technician completes ticket', r.status === 200, JSON.stringify(r.body).slice(0, 200));
  r = await guest.call('POST', '/api/feedback', { ticket_id: dropId, rating: 5, comments: 'smoke test feedback' });
  check('customer submits feedback after Completed', r.status === 200 || r.status === 201, JSON.stringify(r.body));
  r = await guest.call('POST', '/api/feedback', { ticket_id: dropId, rating: 9 });
  check('invalid rating rejected', r.status === 400, `status ${r.status}`);

  // ---- 8. admin: assign, cancel, lock ----
  r = await admin.call('GET', '/api/technicians');
  const jake = r.body.find((t) => /jake/i.test(t.full_name)) || r.body[1];
  r = await admin.call('PUT', `/api/tickets/${homeAMId}`, { assigned_technician_id: jake.id });
  check('admin assigns technician', r.status === 200 && r.body.ticket?.assigned_technician_id === jake.id, JSON.stringify(r.body).slice(0, 200));
  r = await tech.call('PUT', `/api/tickets/${homeAMId}`, { status: 'In Progress' });
  check("technician blocked from another technician's ticket", r.status === 403, `status ${r.status}`);
  r = await admin.call('PUT', `/api/tickets/${homeAMId}`, { status: 'Cancelled' });
  check('admin cancels ticket', r.status === 200, `status ${r.status}`);
  r = await admin.call('PUT', `/api/tickets/${homeAMId}`, { status: 'In Progress' });
  check('cancelled ticket cannot be edited (admin)', r.status === 400, `status ${r.status}`);
  r = await guest.call('GET', `/api/tickets/track/${homeAM.ticket_reference_id || homeAM.ticket?.ticket_reference_id}`);
  check('customer sees Cancelled', r.body.ticket?.status === 'Cancelled', r.body.ticket?.status);
  r = await guest.call('GET', `/api/tickets/home-service-slots?date=${day}`);
  check('cancelled slot becomes free again', r.body.slots?.find((s) => s.id === '09:00')?.available === true, JSON.stringify(r.body.slots));

  // ---- 9. product add / edit / delete ----
  r = await tech.call('POST', '/api/products', { item_name: 'x', category: 'x', price: 1 });
  check('technician cannot add products', r.status === 403, `status ${r.status}`);
  r = await admin.call('POST', '/api/products', { item_name: 'Smoke Test Keyboard', category: 'Keyboards', price: 999, stock_qty: 3 });
  cleanup.product = firstId(r.body);
  check('admin adds product', r.status === 201 && !!cleanup.product, JSON.stringify(r.body));
  r = await admin.call('PUT', `/api/products/${cleanup.product}`, { price: 1099, stock_qty: 5 });
  check('admin edits product price + stock', r.status === 200, JSON.stringify(r.body));
  r = await guest.call('GET', `/api/products/${cleanup.product}`);
  check('catalog shows updated price', Number(r.body.price ?? r.body.product?.price) === 1099, JSON.stringify(r.body));
  r = await admin.call('POST', '/api/products', { item_name: 'bad', category: 'x', price: -5 });
  check('negative price rejected', r.status === 400, `status ${r.status}`);
  r = await admin.call('DELETE', `/api/products/${cleanup.product}`);
  check('admin deletes product', r.status === 200, `status ${r.status}`);
  cleanup.product = null;

  // ---- 10. technician add / edit / delete ----
  r = await admin.call('POST', '/api/technicians', { full_name: 'Smoke Test Tech', phone: '0900-111-2222', role: 'Tester' });
  cleanup.technician = firstId(r.body);
  check('admin adds technician', r.status === 201 && !!cleanup.technician, JSON.stringify(r.body));
  r = await admin.call('PUT', `/api/technicians/${cleanup.technician}`, { role: 'Senior Tester' });
  check('admin edits technician', r.status === 200, JSON.stringify(r.body));
  r = await admin.call('DELETE', `/api/technicians/${cleanup.technician}`);
  check('admin deletes technician', r.status === 200, `status ${r.status}`);
  cleanup.technician = null;

  // ---- 11. logout ----
  r = await admin.call('POST', '/api/auth/logout');
  check('logout', r.status === 200, `status ${r.status}`);
} catch (e) {
  check('test run completed without crashing', false, e.message);
} finally {
  // ---- 12. delete tickets (admin) and clean leftovers ----
  let delOk = true;
  for (const id of cleanup.tickets) {
    if (!admin.cookie) await admin.call('POST', '/api/auth/login', { username: 'admin', password: ADMIN_PASS });
    const r = await admin.call('DELETE', `/api/tickets/${id}`);
    if (r.status !== 200) delOk = false;
  }
  check('admin deletes test tickets', delOk);
  if (cleanup.product) await admin.call('DELETE', `/api/products/${cleanup.product}`);
  if (cleanup.technician) await admin.call('DELETE', `/api/technicians/${cleanup.technician}`);

  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

