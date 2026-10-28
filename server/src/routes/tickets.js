import express from 'express';
import crypto from 'crypto';
import supabase from '../db.js';
import { requireAuth } from '../auth.js';
import { broadcast } from '../events.js';
import { sendSMS } from '../sms.js';

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

// Technicians may only touch unassigned (claim) or their own tickets; admins unrestricted.
const notOwner = (user, assignedId) => user.role === 'technician' && assignedId && assignedId !== user.id;
const OWNER_ERR = { error: 'Forbidden: you can only update tickets assigned to you' };

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

  let finalSchedule = preferred_schedule || null;
  let homeSlotLabel = '';

  if (service_type === 'home_service') {
    if (!address) {
      return res.status(400).json({ error: 'address is required for home_service bookings' });
    }
    if (!preferred_schedule) {
      return res.status(400).json({ error: 'preferred_schedule date and time slot are required for home_service bookings' });
    }

    const dateMatch = String(preferred_schedule).match(/^(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) {
      return res.status(400).json({ error: 'Invalid preferred_schedule format. Expected YYYY-MM-DD date.' });
    }
    const schedDate = dateMatch[1];
    const schedHour = new Date(preferred_schedule).getHours();
    const isMorning = schedHour < 12;
    finalSchedule = `${schedDate}T${isMorning ? '09:00:00' : '13:00:00'}`;
    homeSlotLabel = isMorning ? 'Morning (9:00 AM – 11:00 AM)' : 'Afternoon (1:00 PM – 3:00 PM)';

    // Enforce 2 daily home services limit (morning & afternoon) & prevent slot collisions
    const { data: existingBookings, error: slotErr } = await supabase
      .from('tickets')
      .select('id, preferred_schedule, status')
      .eq('service_type', 'home_service')
      .neq('status', 'Cancelled');

    if (slotErr) return res.status(500).json({ error: slotErr.message });

    const dayVisits = (existingBookings || []).filter(t => t.preferred_schedule && t.preferred_schedule.startsWith(schedDate));
    if (dayVisits.length >= 2) {
      return res.status(400).json({
        error: `All 2 daily home service slots for ${schedDate} are fully booked. Only 2 visits (Morning 9-11 AM & Afternoon 1-3 PM) are conducted daily.`
      });
    }

    const slotTaken = dayVisits.some(t => {
      const h = new Date(t.preferred_schedule).getHours();
      return isMorning ? (h < 12) : (h >= 12);
    });

    if (slotTaken) {
      return res.status(400).json({
        error: `The ${homeSlotLabel} slot on ${schedDate} is already booked. Please choose the alternative slot or another date.`
      });
    }
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
        preferred_schedule: finalSchedule,
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
    ? `Home service booking registered (${homeSlotLabel || 'On-site'}) for address: ${address.trim()}. Fixed Mobilization Fee: ₱800.00.`
    : 'Drop-off booking received via online portal. Ticket dispatched.';

  await supabase.from('ticket_logs').insert([{
    ticket_id: createdTicket.id,
    work_notes: initialNote,
    status_change: 'Received',
  }]);

  broadcast(createdTicket.ticket_reference_id, {
    to: 'staff',
    title: 'New ticket',
    message: `${createdTicket.ticket_reference_id} · ${service_type === 'home_service' ? `Home service (${homeSlotLabel})` : 'Drop-off'} from ${finalName}`,
  });

  if (finalContact) {
    const serviceLabel = service_type === 'home_service' ? `Home Service (${homeSlotLabel || 'On-site'})` : 'Drop-off';
    const cleanDevice = finalDevice ? finalDevice.replace(/[\u2013\u2014]/g, '-') : '';
    const deviceLabel = cleanDevice ? `\nDevice: ${cleanDevice}` : '';

    const smsText = `JC Tech Zone: Hi ${finalName}! Your repair booking is confirmed.\nTicket: ${createdTicket.ticket_reference_id}${deviceLabel}\nService: ${serviceLabel}\nTrack status anytime on our website with your Ticket ID.`;

    sendSMS(finalContact, smsText).catch(err => console.error('[SMS ERROR]', err.message));
  }
  const normalized = normalizeTicket(createdTicket);
  res.status(201).json({
    message: 'Ticket created',
    ...normalized,
    ticket: normalized
  });
});

router.get('/home-service-slots', async (req, res) => {
  const date = (req.query.date || '').trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Valid date query parameter (YYYY-MM-DD) is required' });
  }

  const { data, error } = await supabase
    .from('tickets')
    .select('id, preferred_schedule, status')
    .eq('service_type', 'home_service')
    .neq('status', 'Cancelled');

  if (error) return res.status(500).json({ error: error.message });

  const dayVisits = (data || []).filter(t => t.preferred_schedule && t.preferred_schedule.startsWith(date));
  let morningTaken = false;
  let afternoonTaken = false;

  for (const t of dayVisits) {
    const h = new Date(t.preferred_schedule).getHours();
    if (h < 12) morningTaken = true;
    else afternoonTaken = true;
  }

  res.json({
    date,
    slots: [
      { id: '09:00', label: 'Morning (9:00 AM – 11:00 AM)', available: !morningTaken },
      { id: '13:00', label: 'Afternoon (1:00 PM – 3:00 PM)', available: !afternoonTaken }
    ],
    totalBooked: dayVisits.length,
    isFullyBooked: morningTaken && afternoonTaken
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
  const [{ data: ticket, error }, { data: logs }, { data: feedback }] = await Promise.all([
    supabase.from('tickets').select('*, technicians(id, full_name, role, phone)').eq('id', req.params.id).single(),
    supabase.from('ticket_logs').select('*, technicians(full_name)').eq('ticket_id', req.params.id).order('created_at', { ascending: true }),
    supabase.from('ticket_feedback').select('*').eq('ticket_id', req.params.id).maybeSingle(),
  ]);

  if (error || !ticket) return res.status(404).json({ error: 'Ticket not found' });

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
  if (current.status === 'Cancelled') {
    return res.status(400).json({ error: 'This ticket has been cancelled and cannot be edited.' });
  }
  if (current.status === 'Completed' && req.user.role !== 'admin') {
    return res.status(400).json({ error: 'This ticket is already completed and cannot be edited.' });
  }
  if (notOwner(req.user, current.assigned_technician_id)) return res.status(403).json(OWNER_ERR);

  const updates = { updated_at: new Date().toISOString() };
  if (status) updates.status = status;
  
  let techId = assigned_technician_id !== undefined ? assigned_technician_id : technician_id;
  if (req.user.role === 'technician') {
    // Technicians cannot reassign to others; they can only claim an unassigned ticket as themselves
    techId = current.assigned_technician_id ? undefined : req.user.id;
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

  if (updated.contact_number && (statusChanged || costChanged)) {
    const custName = updated.customer_name ? `Hi ${updated.customer_name}, ` : '';
    const deviceStr = updated.device_type ? ` for ${updated.device_type.replace(/[\u2013\u2014]/g, '-')}` : '';
    const finalCostNum = parseFloat(updated.estimated_cost) || 0;
    const costFormatted = `P${finalCostNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const statusNorm = (status || '').toLowerCase();
    let smsText = '';

    if (statusNorm === 'completed') {
      smsText = `JC Tech Zone: ${custName}your repair${deviceStr} (Ticket ${ref}) is COMPLETED!\nTotal: ${costFormatted}\nThank you for choosing JC Tech Zone!`;
    } else if (statusNorm === 'ready for pick-up') {
      smsText = `JC Tech Zone: ${custName}your device${deviceStr} (Ticket ${ref}) is READY FOR PICK-UP!\nAmount Due: ${costFormatted}\nPlease bring your Ticket ID when claiming.`;
    } else if (costChanged && !statusChanged) {
      smsText = `JC Tech Zone: ${custName}the total fee for Ticket ${ref} was finalized at ${costFormatted}.\nTrack status anytime with your Ticket ID.`;
    } else if (statusChanged) {
      smsText = `JC Tech Zone: ${custName}Ticket ${ref} update: Status is now "${status}".\nTrack status anytime with your Ticket ID.`;
    }

    if (smsText) {
      sendSMS(updated.contact_number, smsText).catch(err => console.error('[SMS ERROR]', err.message));
    }
  }

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
    .select('status, assigned_technician_id, ticket_reference_id, estimated_cost')
    .eq('id', req.params.id)
    .single();

  if (ticketErr || !ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (notOwner(req.user, ticket.assigned_technician_id)) return res.status(403).json(OWNER_ERR);
  if (ticket.status === 'Completed' || ticket.status === 'Cancelled') {
    return res.status(400).json({ error: `Cannot add work logs to a ticket that is already ${ticket.status}.` });
  }

  // Identity comes from the verified token for technicians; body technician_id is admin-only
  const effectiveTech = req.user.role === 'technician' ? (req.user.id === 'demo-tech' ? null : req.user.id) : (technician_id || null);
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

  // Logged labor/parts cost is part of the customer's bill (on top of the base fee).
  const logged = parseFloat(labor_cost) || 0;
  if (logged > 0) {
    const newTotal = (parseFloat(ticket.estimated_cost) || 0) + logged;
    await supabase.from('tickets').update({ estimated_cost: newTotal, updated_at: new Date().toISOString() }).eq('id', req.params.id);
  }
  broadcast(ticket.ticket_reference_id, { to: 'customer', title: logged > 0 ? 'Cost updated' : 'New repair note', message: logged > 0 ? 'The estimated cost of your repair was updated.' : 'The technician added an update to your ticket.' });
  res.status(201).json(data);
});

router.delete('/:id', requireAuth(['admin']), async (req, res) => {
  const { error } = await supabase.from('tickets').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  broadcast();
  res.json({ message: 'Ticket deleted' });
});

export default router;
