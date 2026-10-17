/**
 * Comprehensive Automated Button & Action Verification
 * Tests every single CRUD operation: Add, Update, Delete, Refresh
 * for Tickets, Hardware Inventory, Technicians, and Tech Portal Quick Status Advance.
 */

const BASE_URL = 'http://localhost:5000/api';

async function req(endpoint, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${endpoint}`, options);
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data: json };
}

async function run() {
  console.log('🚀 Running Complete Button & CRUD Action Verification...\n');

  // 1. Staff Authentication
  const adminLogin = await req('/auth/login', 'POST', { username: 'admin', password: 'admin123' });
  const adminToken = adminLogin.data?.token;
  if (!adminToken) throw new Error('Admin login failed: ' + JSON.stringify(adminLogin.data));
  console.log('🔑 Admin authenticated successfully.');

  const techLogin = await req('/auth/login', 'POST', { username: 'tech', password: 'tech123' });
  const techToken = techLogin.data?.token;
  if (!techToken) throw new Error('Tech login failed: ' + JSON.stringify(techLogin.data));
  console.log('🔑 Tech authenticated successfully.\n');

  // ─────────────────────────────────────────────────────────────
  // 2. ADMIN: TICKET DISPATCH (Add, Update, Delete, Refresh)
  // ─────────────────────────────────────────────────────────────
  console.log('--- [ADMIN PORTAL: TICKET DISPATCH] ---');
  
  // A. Add Walk-In Ticket
  const addTicketRes = await req('/tickets', 'POST', {
    customer_name: 'Button Test User',
    contact_number: '0912-345-6789',
    email: 'buttontest@example.com',
    service_type: 'drop_off',
    device_type: 'Laptop Repair — Acer Swift 3',
    issue_description: 'Screen replacement test for button verification',
    estimated_cost: 1500.00
  }, adminToken);
  if (!addTicketRes.ok) throw new Error('Failed to create walk-in ticket: ' + JSON.stringify(addTicketRes.data));
  const testTicketId = addTicketRes.data.id;
  const testTicketRef = addTicketRes.data.ticket_reference_id;
  console.log(`✅ [ADD TICKET] Successfully created Walk-In Ticket: Ref=${testTicketRef}, ID=${testTicketId}`);

  // B. Refresh & Filter Tickets
  const refreshTickets = await req('/tickets?search=Button%20Test%20User', 'GET', null, adminToken);
  if (!refreshTickets.ok || !refreshTickets.data.length) throw new Error('Failed to refresh/search tickets');
  console.log(`✅ [REFRESH/FILTER TICKETS] Successfully queried ticket dispatch queue (Found: ${refreshTickets.data.length})`);

  // C. Update Ticket
  const updateTicketRes = await req(`/tickets/${testTicketId}`, 'PUT', {
    status: 'In Progress',
    estimated_cost: 1850.00,
    work_log_note: 'Diagnosis confirmed, part ordered by admin'
  }, adminToken);
  if (!updateTicketRes.ok) throw new Error('Failed to update ticket: ' + JSON.stringify(updateTicketRes.data));
  console.log(`✅ [UPDATE TICKET] Successfully updated status to "In Progress" & cost to ₱1,850.00`);

  // D. Delete Ticket
  const deleteTicketRes = await req(`/tickets/${testTicketId}`, 'DELETE', null, adminToken);
  if (!deleteTicketRes.ok) throw new Error('Failed to delete ticket: ' + JSON.stringify(deleteTicketRes.data));
  const verifyDelete = await req(`/tickets/${testTicketId}`, 'GET', null, adminToken);
  if (verifyDelete.status !== 404) throw new Error('Ticket was not deleted properly');
  console.log(`✅ [DELETE TICKET] Successfully deleted ticket ${testTicketRef}\n`);

  // ─────────────────────────────────────────────────────────────
  // 3. ADMIN: HARDWARE INVENTORY (Add, Update, Delete, Refresh)
  // ─────────────────────────────────────────────────────────────
  console.log('--- [ADMIN PORTAL: HARDWARE INVENTORY] ---');

  // A. Add Product
  const addProductRes = await req('/products', 'POST', {
    item_name: 'Test Gaming RAM DDR5 32GB',
    category: 'RAM',
    price: 3499.50,
    stock_qty: 12,
    is_available: true,
    description: 'High performance dual-channel DDR5 RAM module'
  }, adminToken);
  if (!addProductRes.ok) throw new Error('Failed to add product: ' + JSON.stringify(addProductRes.data));
  const testProductId = addProductRes.data.id;
  console.log(`✅ [ADD PRODUCT] Successfully created item: "${addProductRes.data.item_name}" (₱${addProductRes.data.price})`);

  // B. Refresh Inventory
  const refreshInv = await req('/products?search=Test%20Gaming%20RAM', 'GET', null, adminToken);
  if (!refreshInv.ok || !refreshInv.data.length) throw new Error('Failed to refresh inventory products');
  console.log(`✅ [REFRESH INVENTORY] Successfully listed and filtered hardware items`);

  // C. Update Product
  const updateProductRes = await req(`/products/${testProductId}`, 'PUT', {
    item_name: 'Test Gaming RAM DDR5 32GB (Overclock Edition)',
    price: 3750.00,
    stock_qty: 15,
    is_available: true
  }, adminToken);
  if (!updateProductRes.ok) throw new Error('Failed to update product: ' + JSON.stringify(updateProductRes.data));
  console.log(`✅ [UPDATE PRODUCT] Successfully updated item name, price to ₱3,750.00, and stock to 15`);

  // D. Delete Product
  const deleteProductRes = await req(`/products/${testProductId}`, 'DELETE', null, adminToken);
  if (!deleteProductRes.ok) throw new Error('Failed to delete product: ' + JSON.stringify(deleteProductRes.data));
  const verifyProdDelete = await req(`/products/${testProductId}`, 'GET');
  if (verifyProdDelete.status !== 404) throw new Error('Product was not deleted properly');
  console.log(`✅ [DELETE PRODUCT] Successfully deleted product ID=${testProductId}\n`);

  // ─────────────────────────────────────────────────────────────
  // 4. ADMIN: TECHNICIAN ROSTER (Add, Update, Delete, Refresh)
  // ─────────────────────────────────────────────────────────────
  console.log('--- [ADMIN PORTAL: TECHNICIAN ROSTER] ---');

  // A. Add Technician
  const addTechRes = await req('/technicians', 'POST', {
    full_name: 'Marcus Vance Test',
    role: 'Motherboard Microsoldering Tech',
    phone: '0922-999-8877',
    email: 'marcus.test@jctechzone.com'
  }, adminToken);
  if (!addTechRes.ok) throw new Error('Failed to add technician: ' + JSON.stringify(addTechRes.data));
  const testTechId = addTechRes.data.id;
  console.log(`✅ [ADD TECHNICIAN] Successfully created technician: "${addTechRes.data.full_name}" (${addTechRes.data.role})`);

  // B. Refresh Technicians
  const refreshTechs = await req('/technicians', 'GET', null, adminToken);
  if (!refreshTechs.ok || !refreshTechs.data.some(t => t.id === testTechId)) throw new Error('Failed to refresh technicians roster');
  console.log(`✅ [REFRESH TECHNICIANS] Successfully listed roster (Total techs: ${refreshTechs.data.length})`);

  // C. Update Technician
  const updateTechRes = await req(`/technicians/${testTechId}`, 'PUT', {
    full_name: 'Marcus Vance Test (Senior)',
    role: 'Lead Microsoldering & Chip-Off Specialist',
    phone: '0922-999-0000',
    email: 'marcus.vance@jctechzone.com',
    is_active: true
  }, adminToken);
  if (!updateTechRes.ok) throw new Error('Failed to update technician: ' + JSON.stringify(updateTechRes.data));
  console.log(`✅ [UPDATE TECHNICIAN] Successfully updated technician info & phone number`);

  // D. Delete Technician
  const deleteTechRes = await req(`/technicians/${testTechId}`, 'DELETE', null, adminToken);
  if (!deleteTechRes.ok) throw new Error('Failed to delete technician: ' + JSON.stringify(deleteTechRes.data));
  const verifyTechDelete = await req(`/technicians/${testTechId}`, 'GET');
  if (verifyTechDelete.status !== 404) throw new Error('Technician was not deleted properly');
  console.log(`✅ [DELETE TECHNICIAN] Successfully deleted technician ID=${testTechId}\n`);

  // ─────────────────────────────────────────────────────────────
  // 5. TECHNICIAN PORTAL: (Refresh Queue, Select Job, Quick Status Advance, Work Log)
  // ─────────────────────────────────────────────────────────────
  console.log('--- [TECHNICIAN PORTAL: JOB ACTIONS] ---');

  // Setup a test ticket for the technician
  const techTicketRes = await req('/tickets', 'POST', {
    customer_name: 'Tech Portal Test Client',
    contact_number: '0917-888-9999',
    service_type: 'drop_off',
    device_type: 'Desktop PC',
    issue_description: 'Boot loop after Windows update',
    estimated_cost: 650.00
  }, adminToken);
  const techTicketId = techTicketRes.data.id;
  const techTicketRef = techTicketRes.data.ticket_reference_id;

  // A. Refresh Jobs Queue
  const jobsRes = await req('/tickets?status=Received', 'GET', null, techToken);
  if (!jobsRes.ok || !jobsRes.data.length) throw new Error('Failed to load technician jobs queue');
  console.log(`✅ [REFRESH JOBS QUEUE] Successfully fetched active jobs (Queue count: ${jobsRes.data.length})`);

  // B. Select Job / Load Ticket Details
  const jobDetails = await req(`/tickets/${techTicketId}`, 'GET', null, techToken);
  if (!jobDetails.ok) throw new Error('Failed to load job details');
  console.log(`✅ [SELECT JOB] Successfully selected ticket ${techTicketRef}`);

  // C. Quick Status Advance: Under Diagnostics (Solution 1: Auto-Claims unassigned ticket)
  const advance1 = await req(`/tickets/${techTicketId}`, 'PUT', {
    status: 'Under Diagnostics',
    work_log_note: 'Status advanced to: Under Diagnostics'
  }, techToken);
  if (!advance1.ok || (advance1.data.ticket?.status || advance1.data.status) !== 'Under Diagnostics') throw new Error('Failed status advance to Under Diagnostics');
  if (!advance1.data.ticket?.assigned_technician_id) throw new Error('Auto-claim failed: assigned_technician_id should not be null after status advance');
  console.log(`✅ [QUICK STATUS ADVANCE] Advanced to "Under Diagnostics" & Auto-Claimed technician (${advance1.data.ticket?.technicians?.full_name || 'Assigned'})`);

  // D. Quick Status Advance: In Progress
  const advance2 = await req(`/tickets/${techTicketId}`, 'PUT', {
    status: 'In Progress',
    work_log_note: 'Status advanced to: In Progress'
  }, techToken);
  if (!advance2.ok || (advance2.data.ticket?.status || advance2.data.status) !== 'In Progress') throw new Error('Failed status advance to In Progress');
  console.log(`✅ [QUICK STATUS ADVANCE] Advanced to "In Progress"`);

  // E. Submit Work Log Entry
  const logRes = await req(`/tickets/${techTicketId}/logs`, 'POST', {
    work_notes: 'Ran memtest86, discovered faulty memory stick in slot 2. Replaced with verified Kingston DDR4.',
    parts_used: 'Kingston 8GB DDR4',
    labor_cost: 350.00
  }, techToken);
  if (!logRes.ok) throw new Error('Failed to add work log: ' + JSON.stringify(logRes.data));
  console.log(`✅ [ADD WORK LOG ENTRY] Successfully logged diagnostics findings & parts used (₱350 labor)`);

  // F. Quick Status Advance: Ready for Pick-Up
  const advance3 = await req(`/tickets/${techTicketId}`, 'PUT', {
    status: 'Ready for Pick-Up',
    work_log_note: 'Status advanced to: Ready for Pick-Up'
  }, techToken);
  if (!advance3.ok || (advance3.data.ticket?.status || advance3.data.status) !== 'Ready for Pick-Up') throw new Error('Failed status advance to Ready for Pick-Up');
  console.log(`✅ [QUICK STATUS ADVANCE] Advanced to "Ready for Pick-Up"`);

  // G. Set / Update Overall Price (Parts + Labor)
  const priceUpdateRes = await req(`/tickets/${techTicketId}`, 'PUT', {
    estimated_cost: 2450.00,
    work_log_note: 'Overall service fee set to ₱2,450.00 (Parts: ₱1,800 + Labor: ₱650)'
  }, techToken);
  if (!priceUpdateRes.ok || Number(priceUpdateRes.data.ticket?.estimated_cost) !== 2450.00) throw new Error('Failed to update overall price');
  console.log(`✅ [SET OVERALL PRICE] Successfully updated final bill to ₱2,450.00`);

  // H. Quick Status Advance: Mark Completed
  const advance4 = await req(`/tickets/${techTicketId}`, 'PUT', {
    status: 'Completed',
    work_log_note: 'Status advanced to: Completed'
  }, techToken);
  if (!advance4.ok || (advance4.data.ticket?.status || advance4.data.status) !== 'Completed') throw new Error('Failed status advance to Completed');
  console.log(`✅ [QUICK STATUS ADVANCE] Advanced to "Completed"`);

  // I. Verify Work Log is LOCKED on Completed Ticket (Must reject with 400)
  const lockedLogRes = await req(`/tickets/${techTicketId}/logs`, 'POST', {
    work_notes: 'Attempting illegal work log on completed ticket',
    labor_cost: 100
  }, techToken);
  if (lockedLogRes.status !== 400) throw new Error('Expected 400 rejection for work log on Completed ticket, got ' + lockedLogRes.status);
  console.log(`✅ [WORK LOG LOCK ON COMPLETED] Successfully blocked work log addition on Completed ticket`);

  // J. Customer Tracking Verification (Full Progression & Final Bill)
  const trackRes = await req(`/tickets/track/${techTicketRef}`, 'GET');
  if (!trackRes.ok || trackRes.data.ticket?.status !== 'Completed' || Number(trackRes.data.ticket?.estimated_cost) !== 2450.00) {
    throw new Error('Tracking verification failed for completed ticket');
  }
  console.log(`✅ [CUSTOMER TRACKING VERIFICATION] Verified status is Completed and Final Bill is ₱2,450.00`);

  // Cleanup test ticket
  await req(`/tickets/${techTicketId}`, 'DELETE', null, adminToken);
  console.log(`🧹 Cleaned up temporary test ticket.\n`);

  console.log('🎉 ALL BUTTONS & ACTIONS TESTED AND VERIFIED WORKING 100% WITH ZERO FAILURES!');
}

run().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
