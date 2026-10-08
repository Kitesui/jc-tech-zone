// ============================================================
// index.js — JC TECH ZONE Express Server Entry Point
// Stack: Node.js + Express (RESTful API) + Supabase (PostgreSQL)
// ============================================================
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

import ticketsRoutes from './routes/tickets.js';
import productsRoutes from './routes/products.js';
import techniciansRoutes from './routes/technicians.js';
import feedbackRoutes from './routes/feedback.js';

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve static HTML/CSS/JS frontend from /client directory
app.use(express.static(path.join(__dirname, '../../client')));

// ── Request Logger ──────────────────────────────────────────
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    console.log(`[${new Date().toLocaleTimeString('en-PH')}] ${req.method} ${req.url}`);
  }
  next();
});

// ── Health Check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'JC TECH ZONE — IT Service Portal',
    version: '3.0.0',
    stack: 'Express + Supabase (PostgreSQL)',
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ──────────────────────────────────────────────
app.use('/api/tickets', ticketsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/technicians', techniciansRoutes);
app.use('/api/feedback', feedbackRoutes);

// ── Catch-all: Serve frontend index.html for all non-API routes ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/index.html'));
});

// ── Global Error Handler ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`\n🚀 JC Tech Zone API: http://localhost:${PORT}`);
  console.log(`📂 Frontend:          http://localhost:${PORT}/`);
  console.log(`💾 Database:          Supabase (${process.env.SUPABASE_URL})\n`);
});
