// Self-check for SSE scoping: staff get all events, customers only their own ref.
import assert from 'assert';
import express from 'express';
import eventsRoutes, { broadcast } from './src/events.js';
import { signToken } from './src/auth.js';

const app = express().use('/api/events', eventsRoutes);
const server = app.listen(0);
const base = `http://localhost:${server.address().port}/api/events`;

async function listen(qs) {
  const ctl = new AbortController();
  const res = await fetch(`${base}?${qs}`, { signal: ctl.signal });
  const got = [];
  if (res.ok) (async () => {
    try {
      for await (const chunk of res.body) {
        const m = Buffer.from(chunk).toString().match(/data: (.*)/);
        if (m) got.push(JSON.parse(m[1]).ref);
      }
    } catch {}
  })();
  return { res, got, stop: () => ctl.abort() };
}

const staff = await listen(`token=${signToken({ id: 'a', role: 'admin' })}`);
const mine = await listen('ref=JCT-1');
const other = await listen('ref=JCT-2');
const bad = await listen('token=garbage');

assert.strictEqual(bad.res.status, 401, 'bad token rejected');
broadcast('JCT-1');
await new Promise(r => setTimeout(r, 200));
assert.deepStrictEqual(staff.got, ['JCT-1'], 'staff receives all');
assert.deepStrictEqual(mine.got, ['JCT-1'], 'customer receives own ref');
assert.deepStrictEqual(other.got, [], 'customer does not receive other refs');

[staff, mine].forEach(c => (c.got.length = 0));
broadcast('JCT-1', { to: 'staff', title: 's' });
broadcast('JCT-1', { to: 'customer', title: 'c' });
await new Promise(r => setTimeout(r, 200));
assert.strictEqual(staff.got.length, 1, 'staff skips customer-only notes');
assert.strictEqual(mine.got.length, 1, 'customer skips staff-only notes');

const shop = await listen('ref=catalog');
[staff, mine, shop].forEach(c => (c.got.length = 0));
broadcast('CATALOG');
await new Promise(r => setTimeout(r, 200));
assert.deepStrictEqual(shop.got, ['CATALOG'], 'catalog watcher gets product changes');
assert.strictEqual(staff.got.length, 1, 'staff get product changes');
assert.strictEqual(mine.got.length, 0, 'ticket tracker ignores product changes');

// Verify technician-specific assignment and self-action scoping
const tech1 = await listen(`token=${signToken({ id: 'tech-1', role: 'technician' })}`);
const tech2 = await listen(`token=${signToken({ id: 'tech-2', role: 'technician' })}`);
[staff, tech1, tech2].forEach(c => (c.got.length = 0));

// Admin 'a' assigns ticket to 'tech-1'
broadcast('JCT-1', { to: 'staff', by: 'a', tech_id: 'tech-1', title: 'Ticket assigned to you' });
await new Promise(r => setTimeout(r, 200));

assert.strictEqual(staff.got.length, 0, 'admin does NOT receive technician-assigned notification');
assert.strictEqual(tech2.got.length, 0, 'other technicians do NOT receive assignment notification');
assert.strictEqual(tech1.got.length, 1, 'assigned technician receives assignment notification');

console.log('✓ SSE scoping OK (including tech_id & self-action)');
[staff, mine, other, tech1, tech2].forEach(c => c.stop());
server.close();
process.exit(0);
