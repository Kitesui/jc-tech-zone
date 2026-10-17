import express from 'express';
import { signToken, requireAuth } from '../auth.js';
import supabase from '../db.js';

const router = express.Router();

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';
const TECH_PASS = process.env.TECH_PASSWORD || 'tech123';

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const cleanUser = username.trim().toLowerCase();
  const cleanPass = password.trim();

  if (cleanUser === ADMIN_USER.toLowerCase() && cleanPass === ADMIN_PASS) {
    const user = {
      id: 'admin',
      username: 'admin',
      role: 'admin',
      name: 'System Administrator',
      email: 'admin@jctechzone.com',
    };
    const token = signToken(user);
    return res.json({ message: 'Login successful', token, user });
  }

  if (cleanUser === 'tech' && cleanPass === TECH_PASS) {
    const { data: defaultTech } = await supabase
      .from('technicians')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();

    const user = {
      id: defaultTech?.id || 'demo-tech',
      username: 'tech',
      role: 'technician',
      name: defaultTech?.full_name || 'Staff Technician',
      email: defaultTech?.email || 'tech@jctechzone.com',
    };
    const token = signToken(user);
    return res.json({ message: 'Login successful', token, user });
  }

  const safeUser = cleanUser.replace(/[,()]/g, '').trim();
  if (!safeUser) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const phoneDigits = safeUser.replace(/\D/g, '');
  const orParts = [
    `email.ilike.${safeUser}`,
    `full_name.ilike.%${safeUser}%`,
    `phone.ilike.%${safeUser}%`
  ];
  if (phoneDigits.length >= 7) {
    orParts.push(`phone.ilike.%${phoneDigits.slice(-7)}%`);
  }

  const { data: tech } = await supabase
    .from('technicians')
    .select('*')
    .or(orParts.join(','))
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (tech) {
    const rawPhoneDigits = (tech.phone || '').replace(/\D/g, '');
    const isPassValid = cleanPass === TECH_PASS || cleanPass === rawPhoneDigits;

    if (isPassValid) {
      const user = {
        id: tech.id,
        role: 'technician',
        name: tech.full_name,
        email: tech.email,
      };
      const token = signToken(user);
      return res.json({ message: 'Login successful', token, user });
    }
  }

  return res.status(401).json({ error: 'Invalid username or password' });
});

router.get('/me', requireAuth(), (req, res) => {
  res.json({ user: req.user });
});

export default router;
