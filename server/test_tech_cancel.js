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

async function testCancelFlow() {
  console.log('--- Testing Technician Cancel Booking Flow ---');

  // 1. Authenticate as technician
  const techLogin = await req('/auth/login', 'POST', { username: 'tech', password: 'tech123' });
  const techToken = techLogin.data?.token;
  if (!techToken) throw new Error('Tech login failed');
  console.log('1. Authenticated as technician.');

  // 2. Create ticket
  const createRes = await req('/tickets', 'POST', {
    customer_name: 'Cancel Test Customer',
    contact_number: '0917-123-4567',
    device_type: 'Laptop — Lenovo Legion',
    issue_description: 'Screen glitching test for cancellation UI',
    service_type: 'drop_off'
  });
  if (!createRes.ok) throw new Error('Create ticket failed: ' + JSON.stringify(createRes.data));
  const ticketId = createRes.data.id;
  const ticketRef = createRes.data.ticket_reference_id;
  console.log('2. Created ticket:', ticketRef);

  // 3. Technician cancels booking
  const cancelRes = await req(`/tickets/${ticketId}`, 'PUT', {
    status: 'Cancelled',
    work_log_note: 'Booking cancelled by technician.'
  }, techToken);
  if (!cancelRes.ok) throw new Error('Cancel ticket failed: ' + JSON.stringify(cancelRes.data));
  console.log('3. Technician cancelled booking. Status:', cancelRes.data.ticket.status);

  // 4. Verify ticket status is Cancelled
  const getRes = await req(`/tickets/${ticketId}`, 'GET', null, techToken);
  if (!getRes.ok || getRes.data.ticket.status !== 'Cancelled') {
    throw new Error('Ticket status is not Cancelled: ' + JSON.stringify(getRes.data));
  }
  console.log('4. Verified ticket status is Cancelled.');

  // 5. Verify work log was appended
  const logs = getRes.data.logs || [];
  const cancelLog = logs.find(l => l.work_notes && l.work_notes.includes('Booking cancelled by technician'));
  if (!cancelLog) throw new Error('Cancellation log not found');
  console.log('5. Verified cancellation work log entry is recorded.');

  // 6. Clean up
  const adminLogin = await req('/auth/login', 'POST', { username: 'admin', password: 'admin123' });
  await req(`/tickets/${ticketId}`, 'DELETE', null, adminLogin.data?.token);
  console.log('6. Cleaned up test ticket.');

  console.log('\n🎉 TECHNICIAN CANCEL BOOKING FLOW VERIFIED 100%!');
}

testCancelFlow().catch(err => {
  console.error(err);
  process.exit(1);
});
