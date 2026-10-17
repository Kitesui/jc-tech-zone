import dotenv from 'dotenv';
dotenv.config();
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function clearTable(table) {
  const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) console.warn(`  ⚠ Could not clear ${table}:`, error.message);
}

async function seed() {
  console.log('\n🌱 JC TECH ZONE — Seeding Supabase database...\n');

  console.log('🗑  Clearing existing data...');
  await clearTable('ticket_feedback');
  await clearTable('ticket_logs');
  await clearTable('tickets');
  await clearTable('technicians');
  await clearTable('products');

  console.log('👷 Seeding technicians...');
  const { data: techs, error: techErr } = await supabase
    .from('technicians')
    .insert([
      { full_name: 'Cairo Angela Ledesma',   email: 'cairo@jctechzone.com',   phone: '0917-555-0101', role: 'Lead Diagnostics Specialist', is_active: true },
      { full_name: 'Jake S. Velsis',          email: 'jake@jctechzone.com',    phone: '0918-555-0202', role: 'Field Technician', is_active: true },
      { full_name: 'Icel Macabingkil',        email: 'icel@jctechzone.com',    phone: '0919-555-0303', role: 'Shop Technician', is_active: true },
      { full_name: 'Katherine Paula Busita',  email: 'kath@jctechzone.com',    phone: '0920-555-0404', role: 'Network Specialist', is_active: true },
    ])
    .select();

  if (techErr) { console.error('  ❌ Technicians error:', techErr.message); } 
  else { console.log(`  ✅ ${techs.length} technicians inserted.`); }

  console.log('🛒 Seeding 174 product catalog items...');
  const productsList = JSON.parse(
    fs.readFileSync(new URL('./data/products.json', import.meta.url), 'utf8')
  );
  let insertedCount = 0;
  const chunkSize = 50;
  for (let i = 0; i < productsList.length; i += chunkSize) {
    const batch = productsList.slice(i, i + chunkSize);
    const { error: prodErr } = await supabase.from('products').insert(batch);
    if (prodErr) {
      console.error(`  ❌ Products batch error (${i}-${i + batch.length}):`, prodErr.message);
    } else {
      insertedCount += batch.length;
    }
  }
  console.log(`  ✅ ${insertedCount} products inserted.`);

  console.log('🎫 Seeding sample tickets...');
  const techIds = techs.map(t => t.id);

  const { data: sampleTickets, error: ticketErr } = await supabase
    .from('tickets')
    .insert([
      {
        ticket_reference_id: 'JCT-2026-DEMO1',
        customer_name: 'Maria Santos',
        contact_number: '0917-123-4567',
        email: 'maria@example.com',
        service_type: 'drop_off',
        device_type: 'Laptop',
        issue_description: 'Laptop screen has a crack and the backlight is flickering intermittently.',
        status: 'Under Diagnostics',
        assigned_technician_id: techIds[0],
        estimated_cost: 2500.00,
        attachment_url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500' viewBox='0 0 800 500'><rect width='800' height='500' fill='%230a0f18'/><rect x='40' y='40' width='720' height='420' rx='8' fill='%2305080e' stroke='%231e3050' stroke-width='4'/><path d='M100 120 L250 240 L380 180 L520 310 L680 200' stroke='%23ef4444' stroke-width='3' fill='none'/><path d='M250 240 L290 380 M380 180 L420 80' stroke='%23f59e0b' stroke-width='2' stroke-dasharray='4' fill='none'/><circle cx='250' cy='240' r='6' fill='%23ef4444'/><circle cx='520' cy='310' r='6' fill='%23ef4444'/><text x='70' y='90' fill='%2300d8ff' font-family='monospace' font-size='18' font-weight='bold'>JC TECH ZONE DIAGNOSTICS: CRACKED LCD MATRIX</text><text x='70' y='125' fill='%23e2e8f0' font-family='monospace' font-size='14'>PANEL: 14.0 FHD IPS // SERIAL: NV140FHM-N49</text><text x='70' y='420' fill='%23f59e0b' font-family='monospace' font-size='13'>[!] CRACK TRACE AT (X:250, Y:240) // BACKLIGHT PWM FLICKER</text></svg>",
      },
      {
        ticket_reference_id: 'JCT-2026-DEMO2',
        customer_name: 'Rodrigo Dela Cruz',
        contact_number: '0918-987-6543',
        email: null,
        service_type: 'home_service',
        device_type: 'Desktop PC',
        issue_description: 'PC randomly restarts while playing games. Possibly overheating or PSU issue.',
        address: '28 Marikina Heights, Marikina City',
        preferred_schedule: '2026-10-05T14:00:00+08:00',
        status: 'Received',
        estimated_cost: 0.00,
      },
      {
        ticket_reference_id: 'JCT-2026-DEMO3',
        customer_name: 'Joyce Reyes',
        contact_number: '0920-111-2222',
        email: 'joyce@example.com',
        service_type: 'drop_off',
        device_type: 'Desktop PC',
        issue_description: 'No display output after installing new GPU. Boot LED shows POST error.',
        status: 'Completed',
        assigned_technician_id: techIds[2],
        estimated_cost: 500.00,
      },
    ])
    .select();

  if (ticketErr) { console.error('  ❌ Tickets error:', ticketErr.message); }
  else { console.log(`  ✅ ${sampleTickets.length} tickets inserted.`); }

  if (sampleTickets && sampleTickets.length >= 1) {
    console.log('📋 Seeding ticket logs...');
    const { error: logErr } = await supabase.from('ticket_logs').insert([
      {
        ticket_id: sampleTickets[0].id,
        technician_id: techIds[0],
        work_notes: 'Device received. LCD panel visually inspected — confirmed cracked digitizer. Backlight PWM circuit shows irregularity. Ordered replacement panel.',
        status_change: 'Under Diagnostics',
        parts_used: 'Replacement LCD panel (14" FHD IPS)',
        labor_cost: 500.00,
      },
      {
        ticket_id: sampleTickets[1].id,
        work_notes: 'Booking confirmed. Field technician to visit October 5, 2026 at 2:00 PM.',
        status_change: 'Received',
      },
      {
        ticket_id: sampleTickets[2].id,
        technician_id: techIds[2],
        work_notes: 'Checked GPU seating and PCIe slot — GPU was not fully seated. Reseated GPU, cleared CMOS. System booted successfully. Stress-tested for 30 minutes without issues.',
        status_change: 'Completed',
        parts_used: 'None',
        labor_cost: 500.00,
      },
    ]);
    if (logErr) console.error('  ❌ Logs error:', logErr.message);
    else console.log('  ✅ Ticket logs inserted.');

    // Seed feedback for completed ticket
    const { error: fbErr } = await supabase.from('ticket_feedback').insert([{
      ticket_id: sampleTickets[2].id,
      rating: 5,
      comments: 'Super fast and professional! Fixed the PC in no time. Highly recommend JC Tech Zone!',
    }]);
    if (fbErr) console.error('  ❌ Feedback error:', fbErr.message);
    else console.log('  ✅ Ticket feedback inserted.');
  }

  console.log('\n✅ Seeding complete! JC Tech Zone database is ready.\n');
}

seed().catch(err => {
  console.error('\n❌ Fatal seeding error:', err);
  process.exit(1);
});
