// server/test_api.js — Single runnable smoke test
import assert from 'node:assert';
import supabase from './src/db.js';
import { signToken, verifyToken } from './src/auth.js';

// 1. Database accessibility check
const { data: prods, error: prodErr } = await supabase.from('products').select('id, item_name');
assert(!prodErr, `Supabase products error: ${prodErr?.message}`);
assert(Array.isArray(prods) && prods.length === 174, `Expected 174 products in database, found ${prods?.length}`);

const { data: techs, error: techErr } = await supabase.from('technicians').select('id, full_name').limit(1);
assert(!techErr, `Supabase technicians error: ${techErr?.message}`);
assert(Array.isArray(techs), 'Expected technicians array from database');

// 2. Auth token signature & verification check
const testPayload = { role: 'admin', name: 'Test Administrator', id: 'admin' };
const token = signToken(testPayload);
assert(typeof token === 'string' && token.includes('.'), 'Expected valid signed token string');

const verified = verifyToken(token);
assert(verified && verified.role === 'admin', 'Expected token verification to match signed payload');

const invalid = verifyToken('invalid.token');
assert(invalid === null, 'Expected invalid token to return null');

console.log('✓ Smoke check passed: Database connected, tables accessible, auth signed & verified.');
