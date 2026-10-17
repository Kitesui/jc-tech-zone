import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import ticketsRoutes from './routes/tickets.js';
import productsRoutes from './routes/products.js';
import techniciansRoutes from './routes/technicians.js';
import feedbackRoutes from './routes/feedback.js';
import authRoutes from './routes/auth.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

const clientDir = path.join(__dirname, '../../client');

// Clean URLs: Redirect any direct *.html or root requests to clean professional route paths
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html') {
    const query = req.url.slice(req.path.length);
    return res.redirect(301, '/customer' + query);
  }
  if (req.path.endsWith('.html')) {
    const cleanPath = req.path.slice(0, -5);
    const query = req.url.slice(req.path.length);
    return res.redirect(301, cleanPath + query);
  }
  next();
});

// Professional Clean Route Handlers
app.get(['/customer', '/home'], (req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

app.get(['/track', '/tracking'], (req, res) => {
  res.sendFile(path.join(clientDir, 'track.html'));
});

app.get('/catalog', (req, res) => {
  res.sendFile(path.join(clientDir, 'catalog.html'));
});

app.get('/tech', (req, res) => {
  res.sendFile(path.join(clientDir, 'tech.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(clientDir, 'admin.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(clientDir, 'login.html'));
});

// Serve static frontend assets (css, js, images) from client directory
app.use(express.static(clientDir, {
  index: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  }
}));

app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    console.log(`[${new Date().toLocaleTimeString('en-PH')}] ${req.method} ${req.url}`);
  }
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'JC TECH ZONE — IT Service Portal',
    version: '3.0.0',
    stack: 'Express + Supabase (PostgreSQL)',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/technicians', techniciansRoutes);
app.use('/api/feedback', feedbackRoutes);

// Return JSON 404 for unhandled API routes to prevent HTML response crashing JSON clients
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route ${req.method} ${req.path} not found` });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`\n🚀 JC Tech Zone API: http://localhost:${PORT}`);
  console.log(`📂 Frontend:          http://localhost:${PORT}/`);
  console.log(`💾 Database:          Supabase (${process.env.SUPABASE_URL})\n`);
});
