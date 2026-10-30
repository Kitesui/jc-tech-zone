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

router.get('/', requireAuth(['admin', 'technician']), async (req, res) => {
  let q = supabase.from('technicians').select('*').order('full_name', { ascending: true });
  // Technicians may only see their own record, never the staff directory
  if (req.user.role === 'technician') q = q.eq('id', req.user.id);
  const { data, error } = await q;

  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(normalizeTech));
});

router.get('/:id', requireAuth(['admin', 'technician']), async (req, res) => {
  if (req.user.role === 'technician' && req.params.id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
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

  const updates = {};
  if (full_name !== undefined) {
    const cleanName = full_name?.trim();
    if (!cleanName) return res.status(400).json({ error: 'full_name cannot be empty' });
    updates.full_name = cleanName;
  }
  if (phone !== undefined) {
    const cleanPhone = phone?.trim();
    if (!cleanPhone) return res.status(400).json({ error: 'phone cannot be empty' });
    updates.phone = cleanPhone;
  }
  if (email !== undefined) updates.email = email?.trim() || null;
  if (role !== undefined) updates.role = role?.trim() || 'Technician';
  if (is_active !== undefined) updates.is_active = Boolean(is_active);

  const { data, error } = await supabase
    .from('technicians')
    .update(updates)
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

  // Nullify technician reference in work logs so audit logs are preserved without foreign key violation
  await supabase
    .from('ticket_logs')
    .update({ technician_id: null })
    .eq('technician_id', req.params.id);

  const { error } = await supabase
    .from('technicians')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Technician deleted successfully' });
});

export default router;
