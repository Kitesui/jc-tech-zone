import express from 'express';
import supabase from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { category, search, available } = req.query;

  let query = supabase
    .from('products')
    .select('*')
    .order('item_name', { ascending: true });

  if (category && category !== 'all') query = query.eq('category', category);
  if (available === 'true') query = query.eq('is_available', true);
  if (search) {
    const cleanSearch = search.replace(/[,()]/g, ' ').trim();
    if (cleanSearch) {
      query = query.or(`item_name.ilike.%${cleanSearch}%,category.ilike.%${cleanSearch}%,description.ilike.%${cleanSearch}%`);
    }
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/categories', async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('category')
    .order('category', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  const cats = [...new Set(data.map(d => d.category))];
  res.json(cats);
});

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Product not found' });
  res.json(data);
});

router.post('/', requireAuth(['admin']), async (req, res) => {
  const { item_name, category, description, price, stock_qty, image_url } = req.body;
  if (!item_name || !category || price == null) {
    return res.status(400).json({ error: 'item_name, category, and price are required' });
  }

  const numPrice = parseFloat(price);
  if (isNaN(numPrice) || numPrice < 0) {
    return res.status(400).json({ error: 'price must be a valid non-negative number' });
  }
  const numStock = parseInt(stock_qty);
  const finalStock = !isNaN(numStock) && numStock >= 0 ? numStock : 0;

  const { data, error } = await supabase
    .from('products')
    .insert([{
      item_name: item_name.trim(),
      category: category.trim(),
      description: description?.trim() || null,
      price: numPrice,
      stock_qty: finalStock,
      image_url: image_url || null,
      is_available: true,
    }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

router.put('/:id', requireAuth(['admin']), async (req, res) => {
  const { item_name, category, description, price, stock_qty, image_url, is_available } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  if (item_name !== undefined) {
    const clean = item_name?.trim();
    if (!clean) return res.status(400).json({ error: 'item_name cannot be empty' });
    updates.item_name = clean;
  }
  if (category !== undefined) {
    const clean = category?.trim();
    if (!clean) return res.status(400).json({ error: 'category cannot be empty' });
    updates.category = clean;
  }
  if (description !== undefined) updates.description = description?.trim() || null;
  if (price !== undefined) {
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) return res.status(400).json({ error: 'price must be a valid non-negative number' });
    updates.price = numPrice;
  }
  if (stock_qty !== undefined) {
    const numStock = parseInt(stock_qty);
    if (isNaN(numStock) || numStock < 0) return res.status(400).json({ error: 'stock_qty must be a valid non-negative integer' });
    updates.stock_qty = numStock;
  }
  if (image_url !== undefined) updates.image_url = image_url;
  if (is_available !== undefined) updates.is_available = Boolean(is_available);

  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', requireAuth(['admin']), async (req, res) => {
  const { error } = await supabase.from('products').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Product deleted' });
});

export default router;
