import express from 'express';
import supabase from '../db.js';
import { broadcast } from '../events.js';

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
    .select('id, status, ticket_reference_id')
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
  broadcast(ticket.ticket_reference_id);
  res.status(201).json({ message: 'Feedback submitted, thank you!', feedback: data });
});

router.get('/summary', async (req, res) => {
  const { data: reviews, error } = await supabase
    .from('ticket_feedback')
    .select(`
      id,
      ticket_id,
      rating,
      comments,
      created_at,
      tickets (
        id,
        ticket_reference_id,
        customer_name,
        device_type,
        status,
        technicians (
          id,
          full_name
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const total = reviews ? reviews.length : 0;
  let sum = 0;
  let positive = 0;
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  (reviews || []).forEach(r => {
    const star = Math.max(1, Math.min(5, parseInt(r.rating) || 0));
    sum += star;
    distribution[star] = (distribution[star] || 0) + 1;
    if (star >= 4) positive += 1;
  });

  const average = total > 0 ? parseFloat((sum / total).toFixed(2)) : 0;
  const positive_percentage = total > 0 ? parseFloat(((positive / total) * 100).toFixed(1)) : 0;

  res.json({
    total_reviews: total,
    average_rating: average,
    positive_percentage,
    distribution,
    reviews: reviews || []
  });
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
