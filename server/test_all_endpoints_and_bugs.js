import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5000';

let adminToken = '';
let techToken = '';
let createdTicketId = '';
let createdTicketRef = '';
let createdProductId = '';
let createdTechId = '';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAILED: ${message}`);
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }
  return { status: res.status, headers: res.headers, data };
}

async function runAllTests() {
  console.log('\n===============================================================');
  console.log('🚀 COMPREHENSIVE ENDPOINT, BUTTON & BUG AUDIT SUITE');
  console.log(`Target: ${BASE_URL}`);
  console.log('===============================================================\n');

  // --- 1. HEALTH & ROUTING CHECKS ---
  console.log('--- [1. HEALTH & PAGE ROUTING] ---');
  {
    const rHealth = await request('/api/health');
    assert(rHealth.status === 200 && rHealth.data?.status === 'online', 'GET /api/health returns 200 online');

    const rRoot = await fetch(`${BASE_URL}/`, { redirect: 'manual' });
    assert(rRoot.status === 301 && rRoot.headers.get('location')?.includes('/customer'), 'GET / redirects 301 to /customer');

    const rIndexHtml = await fetch(`${BASE_URL}/index.html`, { redirect: 'manual' });
    assert(rIndexHtml.status === 301 && rIndexHtml.headers.get('location')?.includes('/customer'), 'GET /index.html redirects 301 to /customer');

    const rCustomer = await request('/customer');
    assert(rCustomer.status === 200, 'GET /customer serves 200');

    const rTrack = await request('/track');
    assert(rTrack.status === 200, 'GET /track serves 200');

    const rCatalog = await request('/catalog');
    assert(rCatalog.status === 200, 'GET /catalog serves 200');

    const rTech = await request('/tech');
    assert(rTech.status === 200, 'GET /tech serves 200');

    const rAdmin = await request('/admin');
    assert(rAdmin.status === 200, 'GET /admin serves 200');

    const rLogin = await request('/login');
    assert(rLogin.status === 200, 'GET /login serves 200');

    const r404Api = await request('/api/non-existent-endpoint-xyz');
    assert(r404Api.status === 404 && r404Api.data?.error, 'Unhandled /api/* returns JSON 404');
  }

  // --- 2. AUTHENTICATION ENDPOINTS & ACCESS CONTROL ---
  console.log('\n--- [2. AUTHENTICATION & ACCESS CONTROL] ---');
  {
    // Admin login
    const rAdminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' })
    });
    assert(rAdminLogin.status === 200 && rAdminLogin.data?.token && rAdminLogin.data?.user?.role === 'admin', 'POST /api/auth/login as admin succeeds');
    adminToken = rAdminLogin.data?.token;

    // Tech login
    const rTechLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'tech', password: process.env.TECH_PASSWORD || 'tech123' })
    });
    assert(rTechLogin.status === 200 && rTechLogin.data?.token && rTechLogin.data?.user?.role === 'technician', 'POST /api/auth/login as tech succeeds');
    techToken = rTechLogin.data?.token;

    // Invalid login
    const rBadPass = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword!' })
    });
    assert(rBadPass.status === 401, 'POST /api/auth/login with wrong password returns 401');

    const rMissingUser = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: '', password: '' })
    });
    assert(rMissingUser.status === 400, 'POST /api/auth/login with empty credentials returns 400');

    // /api/auth/me
    const rMeAdmin = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(rMeAdmin.status === 200 && rMeAdmin.data?.user?.role === 'admin', 'GET /api/auth/me with admin token returns user');

    const rMeNoToken = await request('/api/auth/me');
    assert(rMeNoToken.status === 401, 'GET /api/auth/me without token returns 401');

    const rMeBadToken = await request('/api/auth/me', {
      headers: { Authorization: 'Bearer this-is-not-a-valid-jwt' }
    });
    assert(rMeBadToken.status === 401, 'GET /api/auth/me with invalid token returns 401');
  }

  // --- 3. HARDWARE PRODUCTS CRUD & PERMISSIONS ---
  console.log('\n--- [3. PRODUCTS API CRUD & VALIDATION] ---');
  {
    // List products
    const rProds = await request('/api/products');
    assert(rProds.status === 200 && Array.isArray(rProds.data) && rProds.data.length > 0, 'GET /api/products returns product array');

    // Filter categories
    const rCats = await request('/api/products/categories');
    assert(rCats.status === 200 && Array.isArray(rCats.data) && rCats.data.length > 0, 'GET /api/products/categories returns categories');

    // Search products
    const rSearch = await request('/api/products?search=SSD');
    assert(rSearch.status === 200 && Array.isArray(rSearch.data), 'GET /api/products?search=SSD returns filtered results');

    // Unauthorized creation (tech cannot create products)
    const rTechCreateProd = await request('/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${techToken}` },
      body: JSON.stringify({ item_name: 'Tech Prod', category: 'Storage', price: 500 })
    });
    assert(rTechCreateProd.status === 403, 'POST /api/products by technician is blocked (403)');

    // Validation: missing required fields
    const rBadProd = await request('/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ item_name: '' })
    });
    assert(rBadProd.status === 400, 'POST /api/products missing fields returns 400');

    // Validation: negative price
    const rNegPrice = await request('/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ item_name: 'Neg Price Prod', category: 'RAM', price: -100 })
    });
    assert(rNegPrice.status === 400, 'POST /api/products negative price returns 400');

    // Valid creation by admin
    const rCreateProd = await request('/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        item_name: 'Test Endpoint Audit NVMe SSD 1TB',
        category: 'Storage',
        description: 'Gen 4x4 M.2 NVMe SSD for audit testing',
        price: 3450.00,
        stock_qty: 12
      })
    });
    assert(rCreateProd.status === 201 && rCreateProd.data?.id, 'POST /api/products creates product (201)');
    createdProductId = rCreateProd.data?.id;

    // Get product by id
    const rGetProd = await request(`/api/products/${createdProductId}`);
    assert(rGetProd.status === 200 && rGetProd.data?.item_name === 'Test Endpoint Audit NVMe SSD 1TB', 'GET /api/products/:id returns created item');

    // Update product
    const rUpdateProd = await request(`/api/products/${createdProductId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ price: 3200.00, stock_qty: 15 })
    });
    assert(rUpdateProd.status === 200 && rUpdateProd.data?.price === 3200, 'PUT /api/products/:id updates price (200)');

    // Delete product
    const rDelProd = await request(`/api/products/${createdProductId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(rDelProd.status === 200, 'DELETE /api/products/:id deletes product (200)');
  }

  // --- 4. TECHNICIANS ROSTER CRUD & VALIDATION ---
  console.log('\n--- [4. TECHNICIANS API CRUD & VALIDATION] ---');
  {
    // List technicians
    const rTechs = await request('/api/technicians');
    assert(rTechs.status === 200 && Array.isArray(rTechs.data) && rTechs.data.length > 0, 'GET /api/technicians returns technician roster');

    // Validation: missing phone
    const rBadTech = await request('/api/technicians', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ full_name: 'Incomplete Tech' })
    });
    assert(rBadTech.status === 400, 'POST /api/technicians missing phone returns 400');

    // Valid technician creation
    const rCreateTech = await request('/api/technicians', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        full_name: 'Audit Tech Specialist',
        phone: '0917-888-9999',
        email: 'audit_tech@jctechzone.com',
        role: 'Hardware Bench Auditor'
      })
    });
    assert(rCreateTech.status === 201 && rCreateTech.data?.id, 'POST /api/technicians creates technician (201)');
    createdTechId = rCreateTech.data?.id;

    // Get technician by ID
    const rGetTech = await request(`/api/technicians/${createdTechId}`);
    assert(rGetTech.status === 200 && rGetTech.data?.full_name === 'Audit Tech Specialist', 'GET /api/technicians/:id returns technician');

    // Update technician
    const rUpdateTech = await request(`/api/technicians/${createdTechId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ phone: '0917-888-0000', role: 'Senior Auditor' })
    });
    assert(rUpdateTech.status === 200 && rUpdateTech.data?.phone === '0917-888-0000', 'PUT /api/technicians/:id updates details');

    // Delete technician (safe unassign check)
    const rDelTech = await request(`/api/technicians/${createdTechId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(rDelTech.status === 200, 'DELETE /api/technicians/:id deletes technician cleanly (200)');
  }

  // --- 5. TICKETING SYSTEM FULL WORKFLOW & PERMISSION BOUNDARIES ---
  console.log('\n--- [5. TICKETING WORKFLOW & BOUNDARIES] ---');
  {
    // Validation: missing required fields
    const rBadTicket = await request('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ customer_name: 'Test Customer' })
    });
    assert(rBadTicket.status === 400, 'POST /api/tickets missing required fields returns 400');

    // Validation: home service requires address
    const rHomeNoAddress = await request('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({
        customer_name: 'Test Customer',
        contact_number: '0917-111-2222',
        service_type: 'home_service',
        issue_description: 'PC refuses to boot'
      })
    });
    assert(rHomeNoAddress.status === 400, 'POST /api/tickets home service without address returns 400');

    // Valid drop_off ticket creation
    const rCreateTicket = await request('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({
        customer_name: 'John Audit Doe',
        contact_number: '0917-333-4444',
        email: 'john_audit@example.com',
        service_type: 'drop_off',
        device_type: 'Custom Desktop PC',
        issue_description: 'GPU fans spinning at 100% with no video display output.',
        estimated_cost: 0
      })
    });
    assert(rCreateTicket.status === 201 && rCreateTicket.data?.id, 'POST /api/tickets creates drop_off ticket (201)');
    createdTicketId = rCreateTicket.data?.id;
    createdTicketRef = rCreateTicket.data?.ticket_reference_id;

    // Public tracking check by reference
    const rTrackTicket = await request(`/api/tickets/track/${createdTicketRef}`);
    assert(rTrackTicket.status === 200 && rTrackTicket.data?.ticket?.status === 'Received', 'GET /api/tickets/track/:ref returns ticket in Received status');

    // Tracking with lowercase ref (case insensitive tolerance)
    const rTrackLower = await request(`/api/tickets/track/${createdTicketRef.toLowerCase()}`);
    assert(rTrackLower.status === 200 && rTrackLower.data?.ticket?.id === createdTicketId, 'GET /api/tickets/track/:ref works case-insensitively');

    // Non-existent ref tracking
    const rTrackFake = await request('/api/tickets/track/JCT-9999-FAKE99');
    assert(rTrackFake.status === 404, 'GET /api/tickets/track/:ref for invalid ref returns 404');

    // Admin & Tech list tickets with filter
    const rListTickets = await request('/api/tickets?status=Received', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(rListTickets.status === 200 && Array.isArray(rListTickets.data), 'GET /api/tickets?status=Received returns array');

    // Unauthenticated access to /api/tickets blocked
    const rUnauthList = await request('/api/tickets');
    assert(rUnauthList.status === 401, 'GET /api/tickets without auth token returns 401');

    // Technician advances status to Under Diagnostics
    const rAdvanceDiag = await request(`/api/tickets/${createdTicketId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${techToken}` },
      body: JSON.stringify({ status: 'Under Diagnostics', notes: 'Disassembled GPU, testing VRM rail voltages.' })
    });
    assert(rAdvanceDiag.status === 200 && rAdvanceDiag.data?.ticket?.status === 'Under Diagnostics', 'PUT /api/tickets/:id advances to Under Diagnostics');

    // Technician advances to In Progress
    const rAdvanceProg = await request(`/api/tickets/${createdTicketId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${techToken}` },
      body: JSON.stringify({ status: 'In Progress' })
    });
    assert(rAdvanceProg.status === 200 && rAdvanceProg.data?.ticket?.status === 'In Progress', 'PUT /api/tickets/:id advances to In Progress');

    // Adding work log
    const rAddLog = await request(`/api/tickets/${createdTicketId}/logs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${techToken}` },
      body: JSON.stringify({
        work_notes: 'Replaced shorted MOSFET on secondary VRM bank. Applied Thermal Grizzly paste.',
        parts_used: 'Fairchild N-Channel MOSFET 30V',
        labor_cost: 650
      })
    });
    assert(rAddLog.status === 201 && rAddLog.data?.work_notes, 'POST /api/tickets/:id/logs adds diagnostic log (201)');

    // Technician advances to Ready for Pick-Up & sets final bill
    const rAdvanceReady = await request(`/api/tickets/${createdTicketId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${techToken}` },
      body: JSON.stringify({
        status: 'Ready for Pick-Up',
        total_cost: 1850.00,
        notes: 'Bench tested under FurMark stress test for 1 hour at 67°C. Ready for pick-up.'
      })
    });
    assert(rAdvanceReady.status === 200 && rAdvanceReady.data?.ticket?.status === 'Ready for Pick-Up' && rAdvanceReady.data?.ticket?.total_cost === 1850, 'PUT /api/tickets/:id advances to Ready for Pick-Up with final price');

    // Technician completes ticket
    const rAdvanceComplete = await request(`/api/tickets/${createdTicketId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${techToken}` },
      body: JSON.stringify({ status: 'Completed', notes: 'Customer paid ₱1,850.00 and collected unit.' })
    });
    assert(rAdvanceComplete.status === 200 && rAdvanceComplete.data?.ticket?.status === 'Completed', 'PUT /api/tickets/:id advances to Completed');

    // Integrity check: Adding work log on COMPLETED ticket must be rejected
    const rAddLogOnCompleted = await request(`/api/tickets/${createdTicketId}/logs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${techToken}` },
      body: JSON.stringify({ work_notes: 'Trying to add log on closed ticket' })
    });
    assert(rAddLogOnCompleted.status === 400, 'POST /api/tickets/:id/logs on Completed ticket is blocked (400)');
  }

  // --- 6. FEEDBACK & CSAT METRICS ---
  console.log('\n--- [6. CUSTOMER FEEDBACK & CSAT SUMMARY] ---');
  {
    // Feedback validation: rating out of bounds
    const rBadRating = await request('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ ticket_id: createdTicketId, rating: 6 })
    });
    assert(rBadRating.status === 400, 'POST /api/feedback with rating > 5 returns 400');

    // Feedback validation: missing ticket_id
    const rMissingTicket = await request('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ rating: 5 })
    });
    assert(rMissingTicket.status === 400, 'POST /api/feedback missing ticket_id returns 400');

    // Valid feedback submission
    const rSubmitFeedback = await request('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({
        ticket_id: createdTicketId,
        rating: 5,
        comments: 'Outstanding repair service! GPU is running completely silent and cool now.'
      })
    });
    assert(rSubmitFeedback.status === 201 && rSubmitFeedback.data?.feedback?.rating === 5, 'POST /api/feedback submits 5-star review (201)');

    // Duplicate feedback on same ticket: should update smoothly via upsert without crashing
    const rDupFeedback = await request('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({
        ticket_id: createdTicketId,
        rating: 5,
        comments: 'Updated review: Still running great after 2 days!'
      })
    });
    assert(rDupFeedback.status === 201, 'POST /api/feedback handles review update without duplicate key crash');

    // Verify feedback summary aggregation
    const rSummary = await request('/api/feedback/summary');
    assert(
      rSummary.status === 200 &&
      rSummary.data?.total_reviews > 0 &&
      rSummary.data?.average_rating >= 1 &&
      rSummary.data?.average_rating <= 5,
      'GET /api/feedback/summary returns accurate CSAT metrics'
    );
  }

  // --- 7. DELETION & CASCADING INTEGRITY ---
  console.log('\n--- [7. DELETION & FOREIGN KEY INTEGRITY] ---');
  {
    // Tech cannot delete ticket (admin only)
    const rTechDelTicket = await request(`/api/tickets/${createdTicketId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${techToken}` }
    });
    assert(rTechDelTicket.status === 403, 'DELETE /api/tickets/:id by tech is blocked (403)');

    // Admin deletes completed ticket with existing logs and feedback
    // Check if delete handles FK constraints cleanly or reports error
    const rAdminDelTicket = await request(`/api/tickets/${createdTicketId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(rAdminDelTicket.status === 200, 'DELETE /api/tickets/:id by admin removes ticket with logs and feedback');
  }

  console.log('\n===============================================================');
  console.log(`SUMMARY: ${passedTests}/${totalTests} tests passed (${failedTests} failed)`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
