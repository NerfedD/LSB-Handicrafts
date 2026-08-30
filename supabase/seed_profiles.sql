-- Sample customer / product / supplier rows, matching the records drawn in the
-- Figma mockups (screens #14-#22). Run this once after schema.sql if you want
-- the new profile screens to have something to show before real data exists.
--
-- Safe to re-run: every insert upserts on id. Delete the rows by hand when the
-- real records go in — `on conflict do update` will otherwise put them back.

insert into public.customers (id, name, contact_number, email, address, created_at, updated_at) values
  (1, 'Maria Santos',    '0917 123 4567', 'maria.santos@gmail.com',    'Davao City',        'August 15, 2026', 'August 30, 2026'),
  (2, 'Juan Dela Cruz',  '0920 456 7890', 'juan.delacruz@email.com',   'Davao City',        'August 15, 2026', 'August 28, 2026'),
  (3, 'Rosa Fernandez',  '0935 789 0123', 'rosa.fernandez@yahoo.com',  'Tagum City',        'August 16, 2026', 'August 26, 2026'),
  (4, 'Antonio Reyes',   '0908 234 5678', 'tony.reyes@gmail.com',      'Panabo City',       'August 16, 2026', 'August 25, 2026'),
  (5, 'Luz Villanueva',  '0945 678 9012', 'luz.villanueva@email.com',  'Davao City',        'August 17, 2026', 'August 24, 2026'),
  (6, 'Pedro Gonzales',  '0956 012 3456', 'pedro.gonzales@gmail.com',  'Digos City',        'August 17, 2026', 'August 22, 2026'),
  (7, 'Carmela Ramos',   '0961 345 6789', 'carmela.ramos@yahoo.com',   'Davao City',        'August 18, 2026', 'August 20, 2026'),
  (8, 'Eduardo Bautista','0977 567 8901', 'ed.bautista@email.com',     'Island Garden City','August 18, 2026', 'August 18, 2026')
on conflict (id) do update set
  name = excluded.name,
  contact_number = excluded.contact_number,
  email = excluded.email,
  address = excluded.address,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

insert into public.products (id, item_code, name, size, unit_price, low_stock_threshold, status, created_at, updated_at) values
  (1, 'HC-001', 'Handwoven Basket',    'Medium',  450.00, 10, 'Active',   'August 15, 2026', 'August 30, 2026'),
  (2, 'HC-002', 'Native Storage Box',  'Large',   850.00,  5, 'Active',   'August 15, 2026', 'August 28, 2026'),
  (3, 'HC-003', 'Decorative Woven Tray','Small',  300.00,  8, 'Active',   'August 16, 2026', 'August 26, 2026'),
  (4, 'HC-004', 'Bamboo Fruit Bowl',   'Large',   550.00,  6, 'Active',   'August 16, 2026', 'August 25, 2026'),
  (5, 'HC-005', 'Woven Wall Hanging',  'Medium', 1200.00,  3, 'Inactive', 'August 17, 2026', 'August 24, 2026'),
  (6, 'HC-006', 'Rattan Plant Holder', 'Small',   380.00, 12, 'Active',   'August 17, 2026', 'August 22, 2026'),
  (7, 'HC-007', 'Abaca Shoulder Bag',  'Medium',  750.00,  7, 'Active',   'August 18, 2026', 'August 20, 2026'),
  (8, 'HC-008', 'Coconut Shell Lamp',  'Small',   620.00,  4, 'Inactive', 'August 18, 2026', 'August 18, 2026')
on conflict (id) do update set
  item_code = excluded.item_code,
  name = excluded.name,
  size = excluded.size,
  unit_price = excluded.unit_price,
  low_stock_threshold = excluded.low_stock_threshold,
  status = excluded.status,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

insert into public.suppliers (id, name, contact_person, contact_number, email, address, created_at, updated_at) values
  (1, 'Davao Handicraft Materials',  'Ana Reyes',      '0917 234 5678', 'contact@davaohandicrafts.com', 'Davao City',        'August 20, 2026', 'August 30, 2026'),
  (2, 'Mindanao Native Materials',   'Carlos Santos',  '0920 345 6789', 'info@mindanaomaterials.com',   'Davao City',        'August 20, 2026', 'August 28, 2026'),
  (3, 'Tagum Weaving Cooperative',   'Rosa Villanueva','0935 456 7890', 'tagumweaving@email.com',       'Tagum City',        'August 21, 2026', 'August 26, 2026'),
  (4, 'Cotabato Bamboo Supplies',    'Jose Gonzales',  '0908 567 8901', 'cotabatobamboo@gmail.com',     'Cotabato City',     'August 21, 2026', 'August 24, 2026'),
  (5, 'Samal Island Crafts Co.',     'Liza Dela Cruz', '0945 678 9012', 'samalcrafts@email.com',        'Island Garden City','August 22, 2026', 'August 22, 2026'),
  (6, 'Digos Abaca Producers',       'Manuel Ramos',   '0956 789 0123', 'digosabaca@yahoo.com',         'Digos City',        'August 22, 2026', 'August 20, 2026')
on conflict (id) do update set
  name = excluded.name,
  contact_person = excluded.contact_person,
  contact_number = excluded.contact_number,
  email = excluded.email,
  address = excluded.address,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;
