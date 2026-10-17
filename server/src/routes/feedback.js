import express from 'express';
import supabase from '../db.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { ticket_id, rating, comments, comment } = req.body;
  const finalComment = (comments || comment || '').trim() || null;

  if (!ticket_id || !rating) {
    return res.status(400).json({ error: 'ticket_id and rating are required' });
  }
  const numRating = parseInt(rating);
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, status')
    .eq('id', ticket_id)
    .single();

  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.status !== 'Completed') {
    return res.status(400).json({ error: 'Feedback can only be submitted for Completed tickets' });
  }

  // Enforce single feedback submission per ticket.
  const { data, error } = await supabase
    .from('ticket_feedback')
    .upsert([{ ticket_id, rating: numRating, comments: finalComment }], { onConflict: 'ticket_id' })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ message: 'Feedback submitted, thank you!', feedback: data });
});

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
