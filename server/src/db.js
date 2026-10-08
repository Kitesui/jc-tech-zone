// ============================================================
// db.js — Supabase (PostgreSQL) Client for JC TECH ZONE
// Uses @supabase/supabase-js with service_role key (bypasses RLS)
// ============================================================
// dotenv must be loaded here — ES module imports are hoisted,
// so db.js executes before dotenv.config() in index.js.
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

export default supabase;
