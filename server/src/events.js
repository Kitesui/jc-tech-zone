import express from 'express';
import { verifyToken } from './auth.js';

// Server-Sent Events: staff (token) get every ticket change, customers (ref) only their own.
// ponytail: in-process client set, so one server instance only. Scale-out needs Redis/pg LISTEN.
const clients = new Map(); // res -> ref | null (null = staff)

// note = { title, message, to?: 'staff'|'customer', by?, tech_id? }; omit for a silent data refresh.
export function broadcast(ref = null, note = {}) {
  for (const [res, scope] of clients) {
    if (!scope && note.to === 'customer') continue;
    if (scope && note.to === 'staff') continue;
    if (!scope || scope === ref || !ref) res.write(`data: ${JSON.stringify({ ref, ...note })}\n\n`);
  }
}

setInterval(() => clients.forEach((_, res) => res.write(': ping\n\n')), 25000).unref();

const router = express.Router();

router.get('/', (req, res) => {
  let scope = null;
  if (req.query.ref) {
    scope = String(req.query.ref).trim().toUpperCase();
  } else {
    const user = verifyToken(req.query.token);
    if (!user || !['admin', 'technician'].includes(user.role)) return res.sendStatus(401);
  }

  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  clients.set(res, scope);
  req.on('close', () => clients.delete(res));
});

export default router;
