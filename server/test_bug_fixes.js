// Automated Verification Check for All Bug Fixes
// Run: node server/test_bug_fixes.js
import assert from 'assert';

const BASE = 'http://localhost:5000/api';

async function run() {
  console.log('--- 1. Authenticate as Admin ---');
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200, 'Admin login failed');
  const token = loginData.token;
  console.log('✓ Admin authenticated');

  console.log('--- 2. Test PostgREST Search With Commas & Parentheses ---');
  const ticketSearchRes = await fetch(`${BASE}/tickets?search=Santos,%20(Maria)`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(ticketSearchRes.status, 200, 'Tickets search with comma/parens crashed');
  const tickets = await ticketSearchRes.json();
  assert(Array.isArray(tickets), 'Tickets search did not return an array');
  console.log('✓ Tickets search handled commas and parentheses without PGRST100 crash');

  const productSearchRes = await fetch(`${BASE}/products?search=RTX,%20(4060)`);
  assert.strictEqual(productSearchRes.status, 200, 'Products search with comma/parens crashed');
  const products = await productSearchRes.json();
  assert(Array.isArray(products), 'Products search did not return an array');
  console.log('✓ Products search handled commas and parentheses without PGRST100 crash');

  console.log('--- 3. Test Auth Login With Special Delimiters ---');
  const badAuthRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'user,with(parens)@test.com', password: 'wrong' })
  });
  assert.strictEqual(badAuthRes.status, 401, 'Auth login with commas/parens should return 401 instead of crashing');
  console.log('✓ Auth login sanitized input and cleanly returned 401');

  console.log('--- 4. Test Unhandled API Routes Return JSON 404 (Not HTML 200) ---');
  const unknownApiRes = await fetch(`${BASE}/unknown-route-test`);
  assert.strictEqual(unknownApiRes.status, 404, 'Unknown API route did not return 404');
  const contentType = unknownApiRes.headers.get('content-type') || '';
  assert(contentType.includes('application/json'), 'Unknown API route did not return JSON');
  const unknownJson = await unknownApiRes.json();
  assert(unknownJson.error, 'No error message in 404 JSON response');
  console.log('✓ Unhandled API route returned JSON 404 cleanly');

  console.log('--- 5. Test Walk-In Ticket Technician Assignment Ingestion ---');
  const techRes = await fetch(`${BASE}/technicians`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const techs = await techRes.json();
  const testTech = techs[0];
  assert(testTech, 'No technician available for testing');

  const createTicketRes = await fetch(`${BASE}/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Walkin Tech Test',
      contact_number: '09998887777',
      device_type: 'Laptop — Asus Zenbook',
      service_type: 'drop_off',
      issue_description: 'Testing assigned technician intake',
      assigned_technician_id: testTech.id
    })
  });
  assert.strictEqual(createTicketRes.status, 201, 'Ticket creation failed');
  const createdTicket = await createTicketRes.json();
  assert.strictEqual(createdTicket.assigned_technician_id, testTech.id, 'assigned_technician_id was not saved');
  console.log(`✓ Walk-in ticket correctly assigned to technician: ${testTech.full_name}`);

  console.log('--- 6. Test Home-Service Booking With Invalid Cost Enforces Base Fee ---');
  const homeServiceRes = await fetch(`${BASE}/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Base Fee Test Customer',
      contact_number: '09887776655',
      service_type: 'home_service',
      address: '123 Test Street, Marikina City',
      device_type: 'Desktop Repair — Custom Rig',
      issue_description: 'Random reboot under load',
      estimated_cost: 'invalid_string' // Should not cause NaN / null
    })
  });
  assert.strictEqual(homeServiceRes.status, 201, 'Home-service ticket creation failed');
  const homeTicket = await homeServiceRes.json();
  assert.strictEqual(Number(homeTicket.estimated_cost), 800.00, 'Invalid cost bypassed 800 base fee');
  console.log('✓ Home-service booking with non-numeric cost correctly defaulted to ₱800.00 base fee');

  console.log('--- 7. Test Work Log Creation Inherits Assigned Technician When Omitted ---');
  const logRes = await fetch(`${BASE}/tickets/${createdTicket.id}/logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      work_notes: 'Automated bench test note without explicit tech id'
    })
  });
  assert.strictEqual(logRes.status, 201, 'Log creation failed');
  const createdLog = await logRes.json();
  assert.strictEqual(createdLog.technician_id, testTech.id, 'Log failed to attribute assigned technician');
  console.log('✓ Work log properly inherited assigned technician');

  console.log('--- 8. Test Public Tracking Route Excludes Technician Phone ---');
  const trackRes = await fetch(`${BASE}/tickets/track/${createdTicket.ticket_reference_id}`);
  assert.strictEqual(trackRes.status, 200, 'Tracking route failed');
  const trackData = await trackRes.json();
  assert(trackData.ticket.technicians, 'Technician data missing');
  assert.strictEqual(trackData.ticket.technicians.phone, undefined, 'Private technician phone was leaked on public tracking endpoint');
  console.log('✓ Public tracking endpoint protects technician personal phone number');

  console.log('--- 9. Test Technician Deletion With Historical Work Logs ---');
  const newTechRes = await fetch(`${BASE}/technicians`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      full_name: 'Temp Tech For FK Test',
      phone: '09001112222',
      email: 'temp.fk.test@jctechzone.com',
      role: 'Junior Bench Tech'
    })
  });
  assert.strictEqual(newTechRes.status, 201, 'Failed to create temp tech');
  const tempTech = await newTechRes.json();

  const tempLogRes = await fetch(`${BASE}/tickets/${createdTicket.id}/logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      technician_id: tempTech.id,
      work_notes: 'Initial diagnosis by temp tech',
      parts_used: 'Thermal paste'
    })
  });
  assert.strictEqual(tempLogRes.status, 201, 'Failed to add work log');

  const delTechRes = await fetch(`${BASE}/technicians/${tempTech.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(delTechRes.status, 200, 'Technician deletion failed with foreign key violation');
  console.log('✓ Technician deleted cleanly; historical logs preserved without FK error');

  // Cleanup test tickets
  await fetch(`${BASE}/tickets/${createdTicket.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  await fetch(`${BASE}/tickets/${homeTicket.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✓ Cleaned up test tickets');

  console.log('--- 10. Test Flexible Technician Authentication (Name & Phone Digits) ---');
  const techLoginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Cairo Angela', password: 'tech123' })
  });
  assert.strictEqual(techLoginRes.status, 200, 'Technician login by name failed');
  const techLoginData = await techLoginRes.json();
  assert.strictEqual(techLoginData.user.role, 'technician', 'Wrong role for technician login');
  console.log('✓ Technician successfully logged in using full name');

  console.log('--- 11. Test Product Validation Rejects Negative Price ---');
  const negProductRes = await fetch(`${BASE}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      item_name: 'Negative Price Item',
      category: 'Storage',
      price: -50.00
    })
  });
  assert.strictEqual(negProductRes.status, 400, 'Negative price was not rejected');
  console.log('✓ Product rejected negative price with 400 error');

  console.log('--- 12. Test Technician Update Rejects Empty Name ---');
  const emptyNameRes = await fetch(`${BASE}/technicians/${testTech.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      full_name: '   '
    })
  });
  assert.strictEqual(emptyNameRes.status, 400, 'Empty full_name was not rejected');
  console.log('✓ Technician update rejected empty name with 400 error');

  console.log('\n========================================');
  console.log('ALL VERIFICATION CHECKS PASSED (12/12)!');
  console.log('========================================');
}

run().catch(err => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
