import express from 'express';
import supabase from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

function normalizeTech(t) {
  if (!t) return t;
  return {
    ...t,
    name: t.full_name,
    specialty: t.role,
  };
}

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('technicians')
    .select('*')
    .order('full_name', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(normalizeTech));
});

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('technicians')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Technician not found' });
  res.json(normalizeTech(data));
});

router.post('/', requireAuth(['admin']), async (req, res) => {
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

router.put('/:id', requireAuth(['admin']), async (req, res) => {
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

router.delete('/:id', requireAuth(['admin']), async (req, res) => {
  // Unassign any tickets currently assigned to this technician to prevent foreign key errors
  await supabase
    .from('tickets')
    .update({ assigned_technician_id: null })
    .eq('assigned_technician_id', req.params.id);

  const { error } = await supabase
    .from('technicians')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Technician deleted successfully' });
});

export default router;
