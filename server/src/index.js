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

// Serve static frontend from client directory with no-cache for instant live updates.
app.use(express.static(path.join(__dirname, '../../client'), {
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/index.html'));
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
