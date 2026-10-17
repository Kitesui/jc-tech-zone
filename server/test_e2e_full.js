import assert from 'assert';

const BASE = 'http://localhost:5000/api';
let adminToken = '';
let techToken = '';
let testTicketId = '';
let testTicketRef = '';
let selectedPart = null;

async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('🧪 Starting Full E2E Test Suite for JC TECH ZONE...\n');

  // 1. Health Check
  console.log('1️⃣  Testing Health Check...');
  const health = await request('/health');
  assert.strictEqual(health.status, 200, 'Health check failed');
  assert.strictEqual(health.data.status, 'online');
  console.log('   ✓ Health check online');

  // 2. Authentication
  console.log('\n2️⃣  Testing Staff Authentication & RBAC...');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  assert.strictEqual(adminLogin.status, 200, `Admin login failed: ${JSON.stringify(adminLogin.data)}`);
  assert(adminLogin.data.token, 'Admin token missing');
  assert.strictEqual(adminLogin.data.user.role, 'admin');
  adminToken = adminLogin.data.token;
  console.log('   ✓ Admin login successful');

  const techLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'tech', password: 'tech123' })
  });
  assert.strictEqual(techLogin.status, 200, `Tech login failed: ${JSON.stringify(techLogin.data)}`);
  assert(techLogin.data.token, 'Tech token missing');
  assert.strictEqual(techLogin.data.user.role, 'technician');
  techToken = techLogin.data.token;
  console.log('   ✓ Technician login successful');

  const invalidLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
  });
  assert.strictEqual(invalidLogin.status, 401, 'Invalid credentials should return 401');
  console.log('   ✓ Invalid credentials properly rejected (401)');

  const meCheck = await request('/auth/me', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(meCheck.status, 200);
  assert.strictEqual(meCheck.data.user.username, 'admin');
  console.log('   ✓ Token verification endpoint (/auth/me) functional');

  // 3. Hardware Catalog & Price Checker
  console.log('\n3️⃣  Testing Hardware Catalog & Price Checker...');
  const categories = await request('/products/categories');
  assert.strictEqual(categories.status, 200);
  assert(Array.isArray(categories.data) && categories.data.length > 0, 'Categories empty');
  console.log(`   ✓ Found ${categories.data.length} hardware categories`);

  const products = await request('/products');
  assert.strictEqual(products.status, 200);
  assert(Array.isArray(products.data) && products.data.length > 0, 'Products empty');
  selectedPart = products.data.find(p => p.stock_qty > 0) || products.data[0];
  console.log(`   ✓ Catalog contains ${products.data.length} verified products`);
  console.log(`   ✓ Selected part for repair test: "${selectedPart.item_name}" (₱${selectedPart.price})`);

  const searchCheck = await request('/products?search=SSD');
  assert.strictEqual(searchCheck.status, 200);
  console.log(`   ✓ Search query for "SSD" returned ${searchCheck.data.length} results`);

  // 4. Ticket Booking: In-Store Drop-off
  console.log('\n4️⃣  Testing Ticket Booking (Drop-Off Intake with Photo Attachment)...');
  const dropOffTicketData = {
    customer_name: 'Maria Santos',
    customer_phone: '09171234567',
    customer_email: 'maria.santos@gmail.com',
    service_type: 'drop_off',
    service_category: 'Laptop Repair',
    device_model: 'Asus ROG Zephyrus G14',
    serial_number: 'ROG-Z14-2024-PH',
    issue_description: 'Overheating under load, fan grinding noise, shuts down after 15 minutes of gaming.',
    photo_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  };

  const createDropOff = await request('/tickets', {
    method: 'POST',
    body: JSON.stringify(dropOffTicketData)
  });
  assert.strictEqual(createDropOff.status, 201, `Failed to create drop-off ticket: ${JSON.stringify(createDropOff.data)}`);
  assert(createDropOff.data.reference_id, 'Reference ID missing');
  testTicketId = createDropOff.data.id;
  testTicketRef = createDropOff.data.reference_id;
  console.log(`   ✓ Created drop-off ticket: ID=${testTicketId}, Ref=${testTicketRef}`);

  // 5. Ticket Booking: Home-Service On-Site
  console.log('\n5️⃣  Testing Ticket Booking (Home-Service on-site booking)...');
  const homeServiceData = {
    customer_name: 'Juan Dela Cruz',
    customer_phone: '09187654321',
    customer_email: 'juan.delacruz@yahoo.com',
    service_type: 'home_service',
    service_category: 'Network & WiFi Setup',
    device_model: 'TP-Link Mesh Deco X60 3-Pack',
    issue_description: 'Dead spots on 2nd floor, setup mesh backhaul and configure guest network.',
    preferred_date: '2026-10-20',
    time_slot: 'morning',
    address: 'Block 4 Lot 12, Golden Valley Subd.',
    city: 'Marikina City'
  };

  const createHomeService = await request('/tickets', {
    method: 'POST',
    body: JSON.stringify(homeServiceData)
  });
  assert.strictEqual(createHomeService.status, 201, `Failed to create home service: ${JSON.stringify(createHomeService.data)}`);
  assert.strictEqual(createHomeService.data.service_type, 'home_service');
  console.log(`   ✓ Created home service ticket: Ref=${createHomeService.data.reference_id}`);

  // 6. Live Ticket Tracking
  console.log('\n6️⃣  Testing Live Ticket Status Tracking (/tickets/track/:ref)...');
  const trackRes = await request(`/tickets/track/${testTicketRef}`);
  assert.strictEqual(trackRes.status, 200, `Track failed: ${JSON.stringify(trackRes.data)}`);
  assert.strictEqual(trackRes.data.ticket.reference_id, testTicketRef);
  assert.strictEqual(trackRes.data.ticket.status, 'Received');
  assert(trackRes.data.ticket.photo_url, 'Photo attachment missing in tracking response');
  console.log(`   ✓ Ticket tracked: Status="${trackRes.data.ticket.status}", Device="${trackRes.data.ticket.device_model}"`);

  // 7. Technicians List & Assignment
  console.log('\n7️⃣  Testing Technician List & Assignment (Admin)...');
  const techs = await request('/technicians', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(techs.status, 200);
  assert(Array.isArray(techs.data) && techs.data.length > 0, 'No technicians found');
  const tech = techs.data[0];
  console.log(`   ✓ Found technician: ${tech.name} (Specialty: ${tech.specialty || 'General'})`);

  const assignRes = await request(`/tickets/${testTicketId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      technician_id: tech.id,
      status: 'Under Diagnostics'
    })
  });
  assert.strictEqual(assignRes.status, 200, `Assignment failed: ${JSON.stringify(assignRes.data)}`);
  console.log(`   ✓ Assigned ticket to ${tech.name}, status updated to "Under Diagnostics"`);

  // 8. Technician Bench Terminal: Work Logs & Parts Used
  console.log('\n8️⃣  Testing Technician Work Logs & Parts Recording...');
  const workLogRes = await request(`/tickets/${testTicketId}/logs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${techToken}` },
    body: JSON.stringify({
      technician_name: 'Tech Alex',
      notes: 'Disassembled thermal unit. Found dried thermal paste and dust clogging left fan bearing. Ultrasonic cleaning performed.'
    })
  });
  assert.strictEqual(workLogRes.status, 201, `Work log failed: ${JSON.stringify(workLogRes.data)}`);
  console.log('   ✓ Diagnostic finding / work log successfully recorded');

  const updatePartsAndLabor = await request(`/tickets/${testTicketId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${techToken}` },
    body: JSON.stringify({
      status: 'Ready for Pick-Up',
      diagnosis: 'Heatsink repaste required + fan bearing lubricated',
      parts_used: JSON.stringify([{ id: selectedPart.id, name: selectedPart.item_name, qty: 1, price: selectedPart.price }]),
      parts_cost: selectedPart.price,
      labor_cost: 450,
      total_cost: Number(selectedPart.price) + 450
    })
  });
  assert.strictEqual(updatePartsAndLabor.status, 200);
  console.log(`   ✓ Parts recorded (₱${selectedPart.price}) + Labor (₱450) = Total (₱${Number(selectedPart.price) + 450})`);
  console.log('   ✓ Status updated to "Ready for Pick-Up"');

  // Verify tracking page sees the updated status, notes, and costs
  const trackUpdated = await request(`/tickets/track/${testTicketRef}`);
  assert.strictEqual(trackUpdated.data.ticket.status, 'Ready for Pick-Up');
  assert.strictEqual(Number(trackUpdated.data.ticket.total_cost), Number(selectedPart.price) + 450);
  assert(trackUpdated.data.work_logs.length >= 1, 'Work log missing on tracking page');
  console.log('   ✓ Verified Tracking Portal accurately displays work logs, parts, and total fee breakdown');

  // 9. Complete Ticket
  console.log('\n9️⃣  Testing Ticket Completion (Admin/Tech)...');
  const completeTicket = await request(`/tickets/${testTicketId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'Completed' })
  });
  assert.strictEqual(completeTicket.status, 200);
  console.log('   ✓ Ticket marked "Completed"');

  // 10. Customer Feedback & Admin Verification
  console.log('\n🔟 Testing Customer Feedback Submission & Admin Verification...');
  const feedbackRes = await request('/feedback', {
    method: 'POST',
    body: JSON.stringify({
      ticket_id: testTicketId,
      rating: 5,
      comment: 'Super fast laptop repair! Thermal temps dropped 25C and fans are whisper quiet. Very recommended!'
    })
  });
  assert.strictEqual(feedbackRes.status, 201, `Feedback failed: ${JSON.stringify(feedbackRes.data)}`);
  console.log('   ✓ 5-star customer feedback successfully submitted');

  const getFeedback = await request(`/feedback/${testTicketId}`);
  assert.strictEqual(getFeedback.status, 200);
  assert.strictEqual(getFeedback.data.rating, 5);
  console.log('   ✓ Customer feedback verified and retrieved');

  const allTickets = await request('/tickets', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(allTickets.status, 200);
  assert(allTickets.data.some(t => t.id === testTicketId), 'Test ticket not found in admin list');
  console.log(`   ✓ Admin tickets list verified: Total tickets = ${allTickets.data.length}`);

  console.log('\n🎉 ALL 10 TEST SECTIONS PASSED WITH ZERO FAILURES!\n');
}

run().catch(err => {
  console.error('\n❌ E2E Test Failed:', err);
  process.exit(1);
});
