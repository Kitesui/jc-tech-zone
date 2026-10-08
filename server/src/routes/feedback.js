// ============================================================
// routes/feedback.js — Customer Ratings & Feedback REST API
// POST /api/feedback   — submit rating & comment (public)
// GET  /api/feedback/:ticket_id  — get feedback for a ticket
// ============================================================
import express from 'express';
import supabase from '../db.js';

const router = express.Router();

// POST /api/feedback
router.post('/', async (req, res) => {
  const { ticket_id, rating, comments } = req.body;
  if (!ticket_id || !rating) {
    return res.status(400).json({ error: 'ticket_id and rating are required' });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  // Verify ticket exists and is Completed
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, status')
    .eq('id', ticket_id)
    .single();

  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.status !== 'Completed') {
    return res.status(400).json({ error: 'Feedback can only be submitted for Completed tickets' });
  }

  // Upsert (one feedback per ticket)
  const { data, error } = await supabase
    .from('ticket_feedback')
    .upsert([{ ticket_id, rating: parseInt(rating), comments: comments?.trim() || null }], { onConflict: 'ticket_id' })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ message: 'Feedback submitted, thank you!', feedback: data });
});

// GET /api/feedback/:ticket_id
router.get('/:ticket_id', async (req, res) => {
  const { data, error } = await supabase
    .from('ticket_feedback')
    .select('*')
    .eq('ticket_id', req.params.ticket_id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || null);
});

export default router;
