import assert from 'assert';

// Test dataset matching actual structure
const sampleInventory = [
  { id: '1', item_name: 'Kingston 500GB NVMe SSD', category: 'Storage', price: 2450, stock_qty: 12, is_available: true, description: 'High-speed PCIe 4.0' },
  { id: '2', item_name: 'Corsair Vengeance 16GB DDR4', category: 'RAM', price: 3200, stock_qty: 0, is_available: true, description: '3200MHz CL16' },
  { id: '3', item_name: 'Logitech G102 Lightsync Mouse', category: 'Peripherals', price: 1100, stock_qty: 5, is_available: false, description: 'RGB Gaming Mouse' }
];

const sampleTechs = [
  { id: 't1', full_name: 'Danilo Cruz', role: 'Senior Technician', phone: '09171234567', email: 'danilo@jctech.com', is_active: true },
  { id: 't2', full_name: 'Maria Santos', role: 'Diagnostics Specialist', phone: '09289876543', email: 'maria@jctech.com', is_active: true },
  { id: 't3', full_name: 'Arnel Ramos', role: 'Field Repair Tech', phone: '09395551234', email: null, is_active: false }
];

// Test inventory filter logic
function filterInventory(all, cat, search) {
  let filtered = all;
  if (cat) filtered = filtered.filter(i => (i.category || '') === cat);
  if (search) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(i =>
      (i.item_name || '').toLowerCase().includes(q) ||
      (i.category || '').toLowerCase().includes(q) ||
      (i.description || '').toLowerCase().includes(q)
    );
  }
  return filtered;
}

// Test technician filter logic
function filterTechs(all, status, search) {
  let filtered = all;
  if (status === 'active') filtered = filtered.filter(t => t.is_active);
  else if (status === 'inactive') filtered = filtered.filter(t => !t.is_active);
  if (search) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(t =>
      (t.full_name || '').toLowerCase().includes(q) ||
      (t.role || '').toLowerCase().includes(q) ||
      (t.phone || '').toLowerCase().includes(q) ||
      (t.email || '').toLowerCase().includes(q)
    );
  }
  return filtered;
}

// 1. Inventory filters
assert.strictEqual(filterInventory(sampleInventory, '', '').length, 3);
assert.strictEqual(filterInventory(sampleInventory, 'RAM', '').length, 1);
assert.strictEqual(filterInventory(sampleInventory, '', 'nvme').length, 1);
assert.strictEqual(filterInventory(sampleInventory, '', 'pcie').length, 1, 'Should search description');
assert.strictEqual(filterInventory(sampleInventory, 'Storage', 'ram').length, 0);

// 2. Technician filters
assert.strictEqual(filterTechs(sampleTechs, '', '').length, 3);
assert.strictEqual(filterTechs(sampleTechs, 'active', '').length, 2);
assert.strictEqual(filterTechs(sampleTechs, 'inactive', '').length, 1);
assert.strictEqual(filterTechs(sampleTechs, '', 'maria').length, 1);
assert.strictEqual(filterTechs(sampleTechs, '', '0939').length, 1, 'Should search phone');
assert.strictEqual(filterTechs(sampleTechs, '', 'Diagnostics').length, 1, 'Should search role');
assert.strictEqual(filterTechs(sampleTechs, 'active', 'arnel').length, 0, 'Inactive tech should not match active filter');

console.log('✅ All inventory and technician search/filter logic tests passed!');
