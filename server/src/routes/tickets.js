import express from 'express';
import crypto from 'crypto';
import supabase from '../db.js';
import { requireAuth } from '../auth.js';
import { broadcast } from '../events.js';

const router = express.Router();

const generateReferenceId = () => `JCT-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

function normalizeTicket(t) {
  if (!t) return t;
  return {
    ...t,
    reference_id: t.ticket_reference_id,
    device_model: t.device_type,
    photo_url: t.attachment_url,
    total_cost: t.estimated_cost,
  };
}

router.post('/', async (req, res) => {
  const {
    customer_name,
    contact_number,
    customer_phone,
    phone,
    email,
    customer_email,
    service_type,
    device_type,
    device_model,
    issue_description,
    address,
    preferred_schedule,
    estimated_cost,
    attachment_url,
    photo_url,
    assigned_technician_id,
  } = req.body;

  const finalName = (customer_name || '').trim();
  const finalContact = (contact_number || customer_phone || phone || '').trim();
  const finalEmail = (email || customer_email || '').trim() || null;
  const finalDevice = (device_type || device_model || '').trim() || null;
  const finalIssue = (issue_description || '').trim();
  const finalAttachment = attachment_url || photo_url || null;

  if (!finalName || !finalContact || !service_type || !finalIssue) {
    return res.status(400).json({ error: 'Missing required fields: customer_name, contact_number, service_type, issue_description' });
  }
  if (!['home_service', 'drop_off'].includes(service_type)) {
    return res.status(400).json({ error: 'service_type must be "home_service" or "drop_off"' });
  }
  if (service_type === 'home_service' && !address) {
    return res.status(400).json({ error: 'address is required for home_service bookings' });
  }

  const baseFee = service_type === 'home_service' ? 800.00 : 0.00;
  const parsedCost = parseFloat(estimated_cost);
  const initialCost = !isNaN(parsedCost) ? Math.max(parsedCost, baseFee) : baseFee;

  let createdTicket = null;
  let insertErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ticket_reference_id = generateReferenceId();
    const { data, error } = await supabase
      .from('tickets')
      .insert([{
        ticket_reference_id,
        customer_name: finalName,
        contact_number: finalContact,
        email: finalEmail,
        service_type,
        device_type: finalDevice,
        issue_description: finalIssue,
        address: address ? address.trim() : null,
        preferred_schedule: preferred_schedule || null,
        estimated_cost: initialCost,
        attachment_url: finalAttachment,
        assigned_technician_id: assigned_technician_id || null,
        status: 'Received',
      }])
      .select()
      .single();

    if (!error) {
      createdTicket = data;
      insertErr = null;
      break;
    }
    insertErr = error;
    if (error.code !== '23505') break;
  }

  if (insertErr || !createdTicket) return res.status(400).json({ error: insertErr ? insertErr.message : 'Failed to create ticket' });

  // Insert initial log
  const initialNote = service_type === 'home_service'
    ? 'Home-service booking received. Fixed Home Service Fee: ₱800.00.'
    : 'Drop-off booking received via online portal. Ticket dispatched.';

  await supabase.from('ticket_logs').insert([{
    ticket_id: createdTicket.id,
    work_notes: initialNote,
    status_change: 'Received',
  }]);

  broadcast(createdTicket.ticket_reference_id, {
    to: 'staff',
    title: 'New ticket',
    message: `${createdTicket.ticket_reference_id} · ${service_type === 'home_service' ? 'Home service' : 'Drop-off'} from ${finalName}`,
  });
  const normalized = normalizeTicket(createdTicket);
  res.status(201).json({
    message: 'Ticket created',
    ...normalized,
    ticket: normalized
  });
});

router.get('/track/:ref', async (req, res) => {
  const ref = req.params.ref.trim().toUpperCase();

  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('*, technicians(id, full_name, role)')
    .eq('ticket_reference_id', ref)
    .single();

  if (error || !ticket) return res.status(404).json({ error: 'No ticket found with this reference ID' });

  const { data: logs } = await supabase
    .from('ticket_logs')
    .select('*, technicians(full_name)')
    .eq('ticket_id', ticket.id)
    .order('created_at', { ascending: true });

  const { data: feedback } = await supabase
    .from('ticket_feedback')
    .select('*')
    .eq('ticket_id', ticket.id)
    .maybeSingle();

  res.json({
    ticket: normalizeTicket(ticket),
    logs: logs || [],
    work_logs: logs || [],
    feedback: feedback || null
  });
});

router.get('/', requireAuth(['admin', 'technician']), async (req, res) => {
  const { status, technician_id, search } = req.query;

  let query = supabase
    .from('tickets')
    .select('*, technicians(id, full_name, role)')
    .order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);
  if (technician_id) query = query.eq('assigned_technician_id', technician_id);
  if (search) {
    const cleanSearch = search.replace(/[,()]/g, ' ').trim();
    if (cleanSearch) {
      query = query.or(
        `ticket_reference_id.ilike.%${cleanSearch}%,customer_name.ilike.%${cleanSearch}%,contact_number.ilike.%${cleanSearch}%,device_type.ilike.%${cleanSearch}%`
      );
    }
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(normalizeTicket));
});

router.get('/:id', requireAuth(['admin', 'technician']), async (req, res) => {
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('*, technicians(id, full_name, role, phone)')
    .eq('id', req.params.id)
    .single();

  if (error || !ticket) return res.status(404).json({ error: 'Ticket not found' });

  const { data: logs } = await supabase
    .from('ticket_logs')
    .select('*, technicians(full_name)')
    .eq('ticket_id', ticket.id)
    .order('created_at', { ascending: true });

  const { data: feedback } = await supabase
    .from('ticket_feedback')
    .select('*')
    .eq('ticket_id', ticket.id)
    .maybeSingle();

  res.json({
    ticket: normalizeTicket(ticket),
    logs: logs || [],
    work_logs: logs || [],
    feedback: feedback || null
  });
});

router.put('/:id', requireAuth(['admin', 'technician']), async (req, res) => {
  const {
    status,
    assigned_technician_id,
    technician_id,
    estimated_cost,
    total_cost,
    parts_cost,
    diagnosis,
    work_log_note,
    notes,
    parts_used,
    labor_cost,
    status_change,
  } = req.body;

  const { data: current, error: fetchErr } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (fetchErr || !current) return res.status(404).json({ error: 'Ticket not found' });

  const updates = { updated_at: new Date().toISOString() };
  if (status) updates.status = status;
  
  let techId = assigned_technician_id !== undefined ? assigned_technician_id : technician_id;
  // Auto-claim unassigned tickets when technician updates status
  if (!techId && !current.assigned_technician_id && req.user && req.user.role === 'technician' && req.user.id !== 'admin' && req.user.id !== 'demo-tech') {
    techId = req.user.id;
  }
  if (techId !== undefined) updates.assigned_technician_id = techId || null;

  if (total_cost !== undefined) updates.estimated_cost = parseFloat(total_cost) || 0;
  else if (estimated_cost !== undefined) updates.estimated_cost = parseFloat(estimated_cost) || 0;

  const { data: updated, error: updateErr } = await supabase
    .from('tickets')
    .update(updates)
    .eq('id', req.params.id)
    .select('*, technicians(id, full_name, role, phone)')
    .single();

  if (updateErr) return res.status(400).json({ error: updateErr.message });

  const noteContent = (work_log_note || notes || diagnosis || '').trim();
  if (noteContent || (status && status !== current.status)) {
    const partsStr = typeof parts_used === 'object' ? JSON.stringify(parts_used) : parts_used;
    await supabase.from('ticket_logs').insert([{
      ticket_id: req.params.id,
      technician_id: techId || current.assigned_technician_id || null,
      work_notes: noteContent || `Status changed to: ${status}`,
      parts_used: partsStr || null,
      labor_cost: labor_cost ? parseFloat(labor_cost) : 0,
      status_change: status && status !== current.status ? status : null,
    }]);
  }

  const { data: logs } = await supabase
    .from('ticket_logs')
    .select('*, technicians(full_name)')
    .eq('ticket_id', req.params.id)
    .order('created_at', { ascending: true });

  const ref = updated.ticket_reference_id;
  const statusChanged = status && status !== current.status;
  const costChanged = updates.estimated_cost !== undefined && Number(updates.estimated_cost) !== Number(current.estimated_cost);
  const assigned = updates.assigned_technician_id && updates.assigned_technician_id !== current.assigned_technician_id;
  broadcast(ref, statusChanged || costChanged ? {
    to: 'customer',
    title: statusChanged ? 'Status updated' : 'Cost updated',
    message: statusChanged ? `Your ticket is now: ${status}` : 'The estimated cost of your repair was updated.',
  } : {});
  if (statusChanged) broadcast(ref, { to: 'staff', by: req.user.id, title: 'Status updated', message: `${ref} → ${status}` });
  if (assigned) broadcast(ref, { to: 'staff', by: req.user.id, tech_id: updates.assigned_technician_id, title: 'Ticket assigned to you', message: `${ref} · ${updated.customer_name}` });
  res.json({ message: 'Ticket updated', ticket: normalizeTicket(updated), logs: logs || [], work_logs: logs || [] });
});

router.post('/:id/logs', requireAuth(['admin', 'technician']), async (req, res) => {
  const { work_notes, notes, technician_id, parts_used, labor_cost, status_change } = req.body;
  const noteText = (work_notes || notes || '').trim();
  if (!noteText) return res.status(400).json({ error: 'work_notes is required' });

  // Guard: Work logs are locked on Completed or Cancelled tickets
  const { data: ticket, error: ticketErr } = await supabase
    .from('tickets')
    .select('status, assigned_technician_id, ticket_reference_id')
    .eq('id', req.params.id)
    .single();

  if (ticketErr || !ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.status === 'Completed' || ticket.status === 'Cancelled') {
    return res.status(400).json({ error: `Cannot add work logs to a ticket that is already ${ticket.status}.` });
  }

  const effectiveTech = technician_id || (req.user && req.user.role === 'technician' && req.user.id !== 'admin' && req.user.id !== 'demo-tech' ? req.user.id : null);
  if (!ticket.assigned_technician_id && effectiveTech) {
    await supabase.from('tickets').update({ assigned_technician_id: effectiveTech }).eq('id', req.params.id);
  }

  const partsStr = typeof parts_used === 'object' ? JSON.stringify(parts_used) : parts_used;

  const { data, error } = await supabase
    .from('ticket_logs')
    .insert([{
      ticket_id: req.params.id,
      technician_id: effectiveTech || ticket.assigned_technician_id || null,
      work_notes: noteText,
      parts_used: partsStr || null,
      labor_cost: labor_cost ? parseFloat(labor_cost) : 0,
      status_change: status_change || null,
    }])
    .select('*, technicians(full_name)')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  broadcast(ticket.ticket_reference_id, { to: 'customer', title: 'New repair note', message: 'The technician added an update to your ticket.' });
  res.status(201).json(data);
});

router.delete('/:id', requireAuth(['admin']), async (req, res) => {
  const { error } = await supabase.from('tickets').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  broadcast();
  res.json({ message: 'Ticket deleted' });
});

export default router;
