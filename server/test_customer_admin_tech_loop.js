// End-to-End Simulation: Customer -> Admin -> Tech -> Repair -> Feedback -> Repeat
// Run: node server/test_customer_admin_tech_loop.js
import assert from 'assert';

const BASE = 'http://localhost:5000/api';

async function request(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function run() {
  console.log('===============================================================');
  console.log('STARTING END-TO-END FLOW SIMULATION');
  console.log('Customer -> Admin -> Tech -> Repair -> Feedback -> Repeat');
  console.log('===============================================================\n');

  // Setup staff tokens
  const adminLogin = await request('POST', '/auth/login', { username: 'admin', password: 'admin123' });
  assert.strictEqual(adminLogin.status, 200, 'Admin login failed');
  const adminToken = adminLogin.data.token;
  console.log('✓ Admin authenticated');

  const techLogin = await request('POST', '/auth/login', { username: 'tech', password: 'tech123' });
  assert.strictEqual(techLogin.status, 200, 'Tech login failed');
  const techToken = techLogin.data.token;
  console.log('✓ Tech authenticated');

  const techsList = await request('GET', '/technicians', null, adminToken);
  assert(techsList.data.length > 0, 'No technicians found in database');
  const assignedTech = techsList.data[0];
  console.log(`✓ Active technician selected for test: ${assignedTech.full_name} (${assignedTech.id})`);

  // =========================================================================
  // LOOP 1: DROP-OFF REPAIR LIFECYCLE
  // =========================================================================
  console.log('\n--- [LOOP 1: DROP-OFF REPAIR LIFECYCLE] ---');

  // STEP 1: CUSTOMER BOOKS DROP-OFF SERVICE
  console.log('\n[1. Customer Action: Booking Drop-Off Repair]');
  const dropOffPayload = {
    customer_name: 'Maria Clara Santos',
    contact_number: '0917-123-4567',
    service_type: 'drop_off',
    device_type: 'Laptop Repair — Lenovo ThinkPad E14',
    issue_description: 'Overheating under load, fan making grinding noise, requires thermal repasting.',
    estimated_cost: 0
  };
  const createDropOff = await request('POST', '/tickets', dropOffPayload);
  assert.strictEqual(createDropOff.status, 201, 'Drop-off booking creation failed');
  const ref1 = createDropOff.data.ticket_reference_id;
  const ticketId1 = createDropOff.data.id;
  assert(ref1 && ref1.startsWith('JCT-'), `Invalid reference ID format: ${ref1}`);
  console.log(`✓ Customer created booking: ID=${ticketId1}, Ref=${ref1}`);

  // CUSTOMER TRACKS IMMEDIATELY
  console.log('[1b. Customer Action: Track New Booking]');
  const track1 = await request('GET', `/tickets/track/${ref1}`);
  assert.strictEqual(track1.status, 200, 'Customer tracking failed');
  assert.strictEqual(track1.data.ticket.status, 'Received');
  assert.strictEqual(track1.data.ticket.assigned_technician_id, null, 'Ticket should initially be unassigned');
  assert.strictEqual(track1.data.feedback, null, 'Uncompleted ticket must have null feedback');
  assert(track1.data.logs.length >= 1, 'Initial work log missing');
  console.log(`✓ Customer tracking verified: Status is "${track1.data.ticket.status}", 0 feedback, logs present.`);

  // STEP 2: ADMIN DISPATCH & ASSIGNMENT
  console.log('\n[2. Admin Action: Triage, Assign Technician, Set Initial Estimate]');
  const adminUpdate1 = await request('PUT', `/tickets/${ticketId1}`, {
    assigned_technician_id: assignedTech.id,
    estimated_cost: 750.00,
    work_log_note: `Triage complete by Admin. Dispatched to ${assignedTech.full_name}.`
  }, adminToken);
  assert.strictEqual(adminUpdate1.status, 200, 'Admin ticket update failed');
  assert.strictEqual(adminUpdate1.data.ticket.assigned_technician_id, assignedTech.id);
  assert.strictEqual(Number(adminUpdate1.data.ticket.estimated_cost), 750.00);
  console.log(`✓ Admin assigned tech ${assignedTech.full_name} and set initial estimate to ₱750.00.`);

  // STEP 3: TECHNICIAN REPAIR LIFECYCLE
  console.log('\n[3. Technician Action: Diagnostic, Work Logs, Status Progression]');
  
  // 3a. Advance to Under Diagnostics
  const diagStep = await request('PUT', `/tickets/${ticketId1}`, {
    status: 'Under Diagnostics',
    work_log_note: 'Disassembled casing, inspected fan blades and heatsink pipes.'
  }, techToken);
  assert.strictEqual(diagStep.status, 200);
  assert.strictEqual(diagStep.data.ticket.status, 'Under Diagnostics');
  console.log('✓ Tech advanced status to "Under Diagnostics"');

  // 3b. Advance to In Progress
  const progStep = await request('PUT', `/tickets/${ticketId1}`, {
    status: 'In Progress',
    work_log_note: 'Ultrasonic cleaning performed on heatsink. Applying Arctic MX-4 thermal paste.'
  }, techToken);
  assert.strictEqual(progStep.status, 200);
  assert.strictEqual(progStep.data.ticket.status, 'In Progress');
  console.log('✓ Tech advanced status to "In Progress"');

  // 3c. Tech adds parts & labor log
  const logStep = await request('POST', `/tickets/${ticketId1}/logs`, {
    work_notes: 'Replaced ball bearing cooling fan assembly.',
    parts_used: 'Brushless DC Fan (ThinkPad E14 Gen 2)',
    labor_cost: 350.00
  }, techToken);
  assert.strictEqual(logStep.status, 201);
  assert.strictEqual(Number(logStep.data.labor_cost), 350.00);
  console.log('✓ Tech added detailed work log with parts and labor cost');

  // 3d. Advance to Ready for Pick-Up with Final Total Cost
  const readyStep = await request('PUT', `/tickets/${ticketId1}`, {
    status: 'Ready for Pick-Up',
    total_cost: 1650.00,
    work_log_note: 'Bench stress test passed. Thermals under 68°C. Ready for customer collection.'
  }, techToken);
  assert.strictEqual(readyStep.status, 200);
  assert.strictEqual(readyStep.data.ticket.status, 'Ready for Pick-Up');
  assert.strictEqual(Number(readyStep.data.ticket.estimated_cost), 1650.00);
  console.log('✓ Tech advanced status to "Ready for Pick-Up" with final bill ₱1,650.00');

  // 3e. Advance to Completed
  const completeStep = await request('PUT', `/tickets/${ticketId1}`, {
    status: 'Completed',
    work_log_note: 'Device collected by customer. Payment settled in cash.'
  }, techToken);
  assert.strictEqual(completeStep.status, 200);
  assert.strictEqual(completeStep.data.ticket.status, 'Completed');
  console.log('✓ Tech advanced status to "Completed"');

  // 3f. Security Check: Adding logs to Completed ticket must be blocked
  const blockedLog = await request('POST', `/tickets/${ticketId1}/logs`, {
    work_notes: 'Should fail because ticket is completed'
  }, techToken);
  assert.strictEqual(blockedLog.status, 400, 'Work log on Completed ticket was not blocked');
  console.log('✓ Security check passed: Work log mutation blocked on completed ticket');

  // STEP 4: CUSTOMER TRACKING & FEEDBACK SUBMISSION
  console.log('\n[4. Customer Action: Verify Completed Ticket & Submit Feedback]');
  const trackCompleted = await request('GET', `/tickets/track/${ref1}`);
  assert.strictEqual(trackCompleted.status, 200);
  assert.strictEqual(trackCompleted.data.ticket.status, 'Completed');
  assert.strictEqual(Number(trackCompleted.data.ticket.total_cost), 1650.00);
  console.log(`✓ Customer verified completed ticket: Final bill is ₱${trackCompleted.data.ticket.total_cost}`);

  // Customer submits feedback
  const feedbackRes = await request('POST', '/feedback', {
    ticket_id: ticketId1,
    rating: 5,
    comments: 'Excellent and fast service! My ThinkPad runs quiet and cool now.'
  });
  assert.strictEqual(feedbackRes.status, 201, 'Feedback submission failed');
  console.log('✓ Customer submitted 5-star review');

  // Customer edits feedback (upsert check)
  const feedbackEdit = await request('POST', '/feedback', {
    ticket_id: ticketId1,
    rating: 5,
    comments: 'Updated: Still running great after 24 hours. Highly recommended!'
  });
  assert.strictEqual(feedbackEdit.status, 201, 'Feedback update failed');
  assert.strictEqual(feedbackEdit.data.feedback.comments, 'Updated: Still running great after 24 hours. Highly recommended!');
  console.log('✓ Customer feedback updated cleanly without duplicate key violation');

  // Customer tracking reflects review
  const trackWithReview = await request('GET', `/tickets/track/${ref1}`);
  assert(trackWithReview.data.feedback, 'Feedback missing from tracking response');
  assert.strictEqual(trackWithReview.data.feedback.rating, 5);
  console.log('✓ Customer tracking displays verified feedback review');


  // =========================================================================
  // LOOP 2: HOME SERVICE BOOKING, CANCELLATION & REOPEN EDGE CASES
  // =========================================================================
  console.log('\n--- [LOOP 2: HOME SERVICE BOOKING & CANCELLATION] ---');

  // 1. Validation test: home service without address must fail
  const badHomeService = await request('POST', '/tickets', {
    customer_name: 'Jose Rizal',
    contact_number: '0922-333-4444',
    service_type: 'home_service',
    device_type: 'CCTV Installation',
    issue_description: 'Setup 4-channel security camera system',
    // address omitted
  });
  assert.strictEqual(badHomeService.status, 400, 'Home service without address should return 400');
  console.log('✓ Validation passed: Home service without address rejected with 400');

  // 2. Valid home service booking
  const goodHomeService = await request('POST', '/tickets', {
    customer_name: 'Jose Rizal',
    contact_number: '0922-333-4444',
    service_type: 'home_service',
    address: 'Bgy. Sto Nino, Marikina City',
    preferred_schedule: '2026-10-25T14:00',
    device_type: 'CCTV Installation — 4-Channel NVR',
    issue_description: 'Setup 4-channel security camera system',
    estimated_cost: 0 // Should enforce 800 base fee
  });
  assert.strictEqual(goodHomeService.status, 201);
  const ref2 = goodHomeService.data.ticket_reference_id;
  const ticketId2 = goodHomeService.data.id;
  assert.strictEqual(Number(goodHomeService.data.estimated_cost), 800.00);
  console.log(`✓ Home service booked: ID=${ticketId2}, Ref=${ref2}, Base Fee=₱800.00`);

  // 3. Admin views home service in calendar list
  const allTickets = await request('GET', '/tickets', null, adminToken);
  assert.strictEqual(allTickets.status, 200);
  const foundHome = allTickets.data.find(t => t.id === ticketId2);
  assert(foundHome, 'Home service ticket not found in admin tickets query');
  assert.strictEqual(foundHome.service_type, 'home_service');
  assert(foundHome.preferred_schedule, 'Preferred schedule not preserved');
  console.log('✓ Admin dispatch retrieved home service ticket with preferred schedule');

  // 4. Technician cancels booking upon customer request
  const cancelStep = await request('PUT', `/tickets/${ticketId2}`, {
    status: 'Cancelled',
    work_log_note: 'Customer requested cancellation due to scheduling conflict.'
  }, techToken);
  assert.strictEqual(cancelStep.status, 200);
  assert.strictEqual(cancelStep.data.ticket.status, 'Cancelled');
  console.log('✓ Tech marked ticket as "Cancelled"');

  // 5. Work logs locked on Cancelled ticket
  const cancelLogAttempt = await request('POST', `/tickets/${ticketId2}/logs`, {
    work_notes: 'Should fail on cancelled ticket'
  }, techToken);
  assert.strictEqual(cancelLogAttempt.status, 400);
  console.log('✓ Work logs locked on Cancelled ticket');

  // 6. Feedback blocked on Cancelled ticket
  const cancelFeedback = await request('POST', '/feedback', {
    ticket_id: ticketId2,
    rating: 3,
    comments: 'Cancelled booking'
  });
  assert.strictEqual(cancelFeedback.status, 400, 'Feedback should only be allowed on Completed tickets');
  console.log('✓ Feedback submission blocked on Cancelled ticket');


  // =========================================================================
  // LOOP 3: REPETITION & SEARCH INTEGRITY
  // =========================================================================
  console.log('\n--- [LOOP 3: REPETITION & SEARCH INTEGRITY] ---');

  // 1. Search by customer name with spaces and special chars
  const searchName = await request('GET', `/tickets?search=Maria%20Clara`, null, adminToken);
  assert.strictEqual(searchName.status, 200);
  assert(searchName.data.some(t => t.id === ticketId1), 'Search by name failed to find ticket');
  console.log('✓ Search by customer name found ticket');

  // 2. Search by reference ID
  const searchRef = await request('GET', `/tickets?search=${ref1}`, null, adminToken);
  assert.strictEqual(searchRef.status, 200);
  assert(searchRef.data.some(t => t.id === ticketId1), 'Search by ref ID failed to find ticket');
  console.log('✓ Search by reference ID found ticket');

  // 3. Cleanup test tickets
  console.log('\n--- [CLEANUP TEST DATA] ---');
  await request('DELETE', `/tickets/${ticketId1}`, null, adminToken);
  await request('DELETE', `/tickets/${ticketId2}`, null, adminToken);
  console.log('✓ Test tickets cleaned up successfully.');

  console.log('\n===============================================================');
  console.log('🎉 ALL 3 LIFECYCLE LOOPS COMPLETED WITH ZERO ERRORS OR BUGS!');
  console.log('===============================================================');
}

run().catch(err => {
  console.error('\n❌ SIMULATION ENCOUNTERED A BUG / FAILURE:', err);
  process.exit(1);
});
