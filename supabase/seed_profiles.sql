-- Sample customer / product / supplier rows, matching the records drawn in the
-- Figma mockups (screens #14-#22). Run this once after schema.sql if you want
-- the new profile screens to have something to show before real data exists.
--
-- Safe to re-run: every insert upserts on id. Delete the rows by hand when the
-- real records go in — `on conflict do update` will otherwise put them back.
--
-- The products block used to seed handicraft baskets (item codes HC-001..008),
-- which don't belong to this business. Editing this file does NOT remove rows
-- an earlier run already inserted — clear them once with:
--
--   delete from public.products where item_code like 'HC-%';

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

-- Catalog entries for the styro products. Mirrors the rows in
-- seed_inventory.sql, minus the stock columns — this table is the
-- hand-maintained catalog, not the stock ledger.
--
-- `size` is the label the dimension columns render to; the app recomputes it
-- from those columns, so this value is only a convenience for SQL readers.
insert into public.products
  (id, item_code, name, size, unit_price, low_stock_threshold, status, created_at, updated_at,
   product_type, diameter_in, thickness_in, length_ft, width_ft, unit, pack_size)
values
  (1, 'SB-010', 'Styro Ball 1"',     '1"',   60.00, 15, 'Active', 'August 15, 2026', 'August 30, 2026', 'ball', 1,   null, null, null, 'pack',  25),
  (2, 'SB-020', 'Styro Ball 2"',     '2"',   85.00, 20, 'Active', 'August 15, 2026', 'August 28, 2026', 'ball', 2,   null, null, null, 'pack',  12),
  (3, 'SB-030', 'Styro Ball 3"',     '3"',   25.00, 60, 'Active', 'August 16, 2026', 'August 26, 2026', 'ball', 3,   null, null, null, 'piece',  1),
  (4, 'SB-040', 'Styro Ball 4"',     '4"',   45.00, 50, 'Active', 'August 16, 2026', 'August 25, 2026', 'ball', 4,   null, null, null, 'piece',  1),
  (5, 'SB-060', 'Styro Ball 6"',     '6"',   95.00, 25, 'Active', 'August 17, 2026', 'August 24, 2026', 'ball', 6,   null, null, null, 'piece',  1),
  (6, 'SS-050-2X4', 'Styro Sheet 1/2" × 2ft × 4ft', '1/2" × 4ft × 2ft',  125.00, 50, 'Active',   'August 17, 2026', 'August 22, 2026', 'sheet', null, 0.5, 4, 2, 'sheet', 1),
  (7, 'SS-100-2X4', 'Styro Sheet 1" × 2ft × 4ft',   '1" × 4ft × 2ft',    180.00, 40, 'Active',   'August 18, 2026', 'August 20, 2026', 'sheet', null, 1,   4, 2, 'sheet', 1),
  (8, 'SS-200-4X8', 'Styro Sheet 2" × 4ft × 8ft',   '2" × 8ft × 4ft',   1150.00, 15, 'Active',   'August 18, 2026', 'August 18, 2026', 'sheet', null, 2,   8, 4, 'sheet', 1)
on conflict (id) do update set
  item_code = excluded.item_code,
  name = excluded.name,
  size = excluded.size,
  unit_price = excluded.unit_price,
  low_stock_threshold = excluded.low_stock_threshold,
  status = excluded.status,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  product_type = excluded.product_type,
  diameter_in = excluded.diameter_in,
  thickness_in = excluded.thickness_in,
  length_ft = excluded.length_ft,
  width_ft = excluded.width_ft,
  unit = excluded.unit,
  pack_size = excluded.pack_size;

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
