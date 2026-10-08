// ============================================================
// routes/technicians.js — Technicians REST API
// GET  /api/technicians        — list all active technicians
// GET  /api/technicians/:id    — get one technician
// POST /api/technicians        — create technician (admin)
// PUT  /api/technicians/:id    — update technician (admin)
// ============================================================
import express from 'express';
import supabase from '../db.js';

const router = express.Router();

// GET /api/technicians — list all technicians
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('technicians')
    .select('*')
    .order('full_name', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/technicians/:id — single technician
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('technicians')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Technician not found' });
  res.json(data);
});

// POST /api/technicians — add new technician
router.post('/', async (req, res) => {
  const { full_name, email, phone, role } = req.body;
  if (!full_name || !phone) {
    return res.status(400).json({ error: 'full_name and phone are required' });
  }

  const { data, error } = await supabase
    .from('technicians')
    .insert([{ full_name: full_name.trim(), email, phone: phone.trim(), role: role || 'Technician', is_active: true }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/technicians/:id — update technician
router.put('/:id', async (req, res) => {
  const { full_name, email, phone, role, is_active } = req.body;

  const { data, error } = await supabase
    .from('technicians')
    .update({ full_name, email, phone, role, is_active })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
