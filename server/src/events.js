import express from 'express';
import { verifyToken } from './auth.js';

// Server-Sent Events: staff (token) get every ticket change, customers (ref) only their own.
// ponytail: in-process client set, so one server instance only. Scale-out needs Redis/pg LISTEN.
const clients = new Map(); // res -> { scope: ref | null, user: object | null }

// note = { title, message, to?: 'staff'|'customer', by?, tech_id? }; omit for a silent data refresh.
export function broadcast(ref = null, note = {}) {
  for (const [res, client] of clients) {
    const scope = client?.scope !== undefined ? client.scope : client;
    const user = client?.user || null;

    if (!scope && note.to === 'customer') continue;
    if (scope && note.to === 'staff') continue;

    // Targeted notification: if note.tech_id is set, only deliver notification note
    // to that specific technician! Never send "Ticket assigned to you" to admin or other staff.
    if (note.title && note.tech_id && user?.id !== note.tech_id) continue;

    // Self-action: do not send notification note back to the user who triggered the action.
    if (note.title && note.by && user?.id === note.by) continue;

    if (!scope || scope === ref || !ref) res.write(`data: ${JSON.stringify({ ref, ...note })}\n\n`);
  }
}

setInterval(() => clients.forEach((_, res) => res.write(': ping\n\n')), 25000).unref();

const router = express.Router();

router.get('/', (req, res) => {
  let scope = null;
  let user = null;
  if (req.query.ref) {
    scope = String(req.query.ref).trim().toUpperCase();
  } else {
    user = verifyToken(req.query.token);
    if (!user || !['admin', 'technician'].includes(user.role)) return res.sendStatus(401);
  }

  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  clients.set(res, { scope, user });
  req.on('close', () => clients.delete(res));
});

export default router;
