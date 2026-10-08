// ============================================================
// seed.js — Seed initial data into Supabase for JC TECH ZONE
// Run: npm run seed  (from /server directory)
// ============================================================
import dotenv from 'dotenv';
dotenv.config();
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

  // ── Clear existing data ──────────────────────────────────
  console.log('🗑  Clearing existing data...');
  await clearTable('ticket_feedback');
  await clearTable('ticket_logs');
  await clearTable('tickets');
  await clearTable('technicians');
  await clearTable('products');

  // ── Seed Technicians ─────────────────────────────────────
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

  // ── Seed Products ────────────────────────────────────────
  console.log('🛒 Seeding product catalog...');
  const { data: prods, error: prodErr } = await supabase
    .from('products')
    .insert([
      // RAM
      { item_name: 'Kingston FURY Beast 16GB DDR5', category: 'RAM', description: 'DDR5-5200 CL40 — gaming and workstation performance RAM. Dual-channel ready.', price: 3850.00, stock_qty: 12, is_available: true },
      { item_name: 'Team T-Force Vulcan 8GB DDR4',  category: 'RAM', description: 'DDR4-3200 budget upgrade RAM, compatible with most B450/B550 boards.',        price: 1299.00, stock_qty: 8,  is_available: true },

      // Storage
      { item_name: 'Samsung 970 EVO Plus 1TB NVMe', category: 'Storage', description: 'M.2 PCIe 3.0 NVMe SSD — up to 3,500 MB/s read. Ideal laptop/PC upgrade.',   price: 4750.00, stock_qty: 7,  is_available: true },
      { item_name: 'Seagate Barracuda 2TB HDD',     category: 'Storage', description: '7200 RPM SATA 3.5" hard drive. Great for bulk storage and media servers.',    price: 2190.00, stock_qty: 15, is_available: true },
      { item_name: 'Kingston A400 480GB SATA SSD',  category: 'Storage', description: 'Entry-level SATA SSD — 500 MB/s read. Best budget PC/laptop upgrade.',        price: 1350.00, stock_qty: 20, is_available: true },

      // Power Supplies
      { item_name: 'Corsair CV550 550W 80+ Bronze',   category: 'Power Supply', description: '80 Plus Bronze certified PSU — stable power for mid-range builds.',  price: 2500.00, stock_qty: 5, is_available: true },
      { item_name: 'Seasonic Focus GX-850 850W Gold', category: 'Power Supply', description: 'Fully-modular 80+ Gold. Ultra-quiet fan with 10-yr warranty.',        price: 5800.00, stock_qty: 3, is_available: true },

      // PC Cases
      { item_name: 'NZXT H510 Compact ATX Mid Tower',  category: 'PC Case', description: 'Compact steel construction, tempered glass side panel, 2× USB-A front I/O.', price: 4200.00, stock_qty: 4, is_available: true },
      { item_name: 'Deepcool CC560 V2 Mid Tower',      category: 'PC Case', description: '4× ARGB fans included, tempered glass, supports up to E-ATX boards.',        price: 2750.00, stock_qty: 6, is_available: true },

      // Keyboards
      { item_name: 'Keychron K2 Wireless TKL',          category: 'Keyboard', description: 'Hot-swap Gateron switches, RGB, Bluetooth + USB-C. Mac/Win compatible.', price: 3400.00, stock_qty: 9,  is_available: true },
      { item_name: 'Royal Kludge RK61 60% Wireless',    category: 'Keyboard', description: 'Compact 60% layout, triple-mode (BT / 2.4G / USB). Blue switches.',      price: 1680.00, stock_qty: 11, is_available: true },

      // Networking
      { item_name: 'TP-Link Archer AX3000 WiFi 6 Router', category: 'Networking', description: 'WiFi 6, AX3000, dual-band. Ideal for WFH professionals and gamers.',  price: 3200.00, stock_qty: 6, is_available: true },
      { item_name: 'D-Link 8-Port Gigabit Unmanaged Switch', category: 'Networking', description: 'Plug-and-play 8-port Gigabit desktop switch for office networks.',  price: 980.00, stock_qty: 14, is_available: true },

      // Cooling
      { item_name: 'ID-Cooling SE-224-XT CPU Air Cooler', category: 'Cooling', description: '4 heat-pipes, 120mm PWM fan. Supports Intel LGA1700 & AMD AM5.',        price: 1150.00, stock_qty: 8, is_available: true },
      { item_name: 'Deepcool AK620 Dual-Tower Cooler',    category: 'Cooling', description: 'High-performance 260W TDP dual-tower CPU cooler with 2× 120mm fans.',     price: 2490.00, stock_qty: 4, is_available: true },
    ])
    .select();

  if (prodErr) { console.error('  ❌ Products error:', prodErr.message); }
  else { console.log(`  ✅ ${prods.length} products inserted.`); }

  // ── Seed Sample Tickets ──────────────────────────────────
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

  // ── Seed Ticket Logs ─────────────────────────────────────
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
