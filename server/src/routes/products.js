// ============================================================
// routes/products.js — Products / Hardware Catalog REST API
// GET  /api/products           — list products with optional filters
// GET  /api/products/:id       — get one product
// POST /api/products           — create product (admin)
// PUT  /api/products/:id       — update product (admin)
// DELETE /api/products/:id     — delete product (admin)
// ============================================================
import express from 'express';
import supabase from '../db.js';

const router = express.Router();

// GET /api/products
router.get('/', async (req, res) => {
  const { category, search, available } = req.query;

  let query = supabase
    .from('products')
    .select('*')
    .order('item_name', { ascending: true });

  if (category && category !== 'all') query = query.eq('category', category);
  if (available === 'true') query = query.eq('is_available', true);
  if (search) {
    query = query.or(`item_name.ilike.%${search}%,category.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/products/categories — distinct categories
router.get('/categories', async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('category')
    .order('category', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  const cats = [...new Set(data.map(d => d.category))];
  res.json(cats);
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Product not found' });
  res.json(data);
});

// POST /api/products
router.post('/', async (req, res) => {
  const { item_name, category, description, price, stock_qty, image_url } = req.body;
  if (!item_name || !category || price == null) {
    return res.status(400).json({ error: 'item_name, category, and price are required' });
  }

  const { data, error } = await supabase
    .from('products')
    .insert([{
      item_name: item_name.trim(),
      category: category.trim(),
      description: description?.trim() || null,
      price: parseFloat(price),
      stock_qty: parseInt(stock_qty) || 0,
      image_url: image_url || null,
      is_available: true,
    }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/products/:id
router.put('/:id', async (req, res) => {
  const { item_name, category, description, price, stock_qty, image_url, is_available } = req.body;

  const { data, error } = await supabase
    .from('products')
    .update({
      item_name: item_name?.trim(),
      category: category?.trim(),
      description: description?.trim(),
      price: price != null ? parseFloat(price) : undefined,
      stock_qty: stock_qty != null ? parseInt(stock_qty) : undefined,
      image_url,
      is_available,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('products').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Product deleted' });
});

export default router;
