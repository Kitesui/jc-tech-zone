// server/test_api.js — Single runnable smoke test
import assert from 'node:assert';
import supabase from './src/db.js';

const { data: prods, error: prodErr } = await supabase.from('products').select('id, item_name').limit(1);
assert(!prodErr, `Supabase products error: ${prodErr?.message}`);
assert(Array.isArray(prods), 'Expected products array from database');

const { data: techs, error: techErr } = await supabase.from('technicians').select('id, full_name').limit(1);
assert(!techErr, `Supabase technicians error: ${techErr?.message}`);
assert(Array.isArray(techs), 'Expected technicians array from database');

console.log('✓ Smoke check passed: Database connected, tables accessible.');
