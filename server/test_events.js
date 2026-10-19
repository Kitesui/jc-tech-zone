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

console.log('✓ SSE scoping OK');
[staff, mine, other].forEach(c => c.stop());
server.close();
process.exit(0);
