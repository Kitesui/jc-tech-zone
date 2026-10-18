import http from 'http';
import assert from 'assert';

const BASE_URL = 'http://localhost:5000/api';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('Testing Feedback & CSAT Summary Flow...');

  // 1. Check GET /api/feedback/summary
  const sumRes = await request('GET', '/feedback/summary');
  assert.strictEqual(sumRes.status, 200, 'GET /feedback/summary failed: ' + JSON.stringify(sumRes));
  assert(typeof sumRes.data.total_reviews === 'number', 'total_reviews missing or not number');
  assert(typeof sumRes.data.average_rating === 'number', 'average_rating missing or not number');
  assert(typeof sumRes.data.positive_percentage === 'number', 'positive_percentage missing or not number');
  assert(sumRes.data.distribution && typeof sumRes.data.distribution[5] === 'number', 'distribution missing 5 star count');
  assert(Array.isArray(sumRes.data.reviews), 'reviews must be an array');
  console.log(`✓ GET /api/feedback/summary verified: ${sumRes.data.total_reviews} total reviews, avg rating ${sumRes.data.average_rating}★, ${sumRes.data.positive_percentage}% positive`);

  // 2. Admin login to verify GET /api/tickets/:id returns feedback
  const loginRes = await request('POST', '/auth/login', { username: 'admin', password: 'admin123' });
  assert.strictEqual(loginRes.status, 200, 'Admin login failed');
  const adminToken = loginRes.data.token;

  if (sumRes.data.reviews.length > 0) {
    const sampleReview = sumRes.data.reviews[0];
    const ticketId = sampleReview.ticket_id;
    const ticketRes = await request('GET', `/tickets/${ticketId}`, null, adminToken);
    assert.strictEqual(ticketRes.status, 200, 'GET /tickets/:id failed');
    assert(ticketRes.data.feedback, 'feedback field missing from GET /tickets/:id');
    assert.strictEqual(ticketRes.data.feedback.rating, sampleReview.rating, 'feedback rating mismatch');
    console.log(`✓ GET /api/tickets/:id verified: Successfully includes feedback object (rating: ${ticketRes.data.feedback.rating}★)`);
  }

  console.log('\n🎉 ALL FEEDBACK & CSAT SUMMARY CHECKS PASSED SUCCESSFULLY!\n');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
