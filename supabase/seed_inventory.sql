-- Starter styro catalog: balls and sheets in the sizes LSB actually stocks.
-- Run this once after schema.sql, on a demo or fresh project.
--
-- It writes BOTH halves of each product -- the stock row here and the matching
-- catalogue entry at the bottom. An earlier version wrote only the stock rows,
-- which left counted stock that no screen could show or sell.
--
-- Safe to re-run: rows that already exist are left exactly as they are, so a
-- re-run never overwrites a count that is being tracked for real. Opening
-- counts appear in each product's stock history.
--
-- SKU scheme:
--   balls   SB-{diameter x 10}            SB-040 = 4"
--   sheets  SS-{thickness x 100}-{L}X{W}  SS-100-2X4 = 1" thick, 2ft x 4ft
--
-- `stock` counts selling units, not pieces: SB-010 below holds 40 PACKS of 25.

insert into public.inventory
  (id, sku, name, category, price, stock, max_stock, status,
   product_type, diameter_in, thickness_in, length_ft, width_ft,
   unit, pack_size, low_stock_threshold, reserved, is_cuttable)
values
  -- Styro balls
  (1,  'SB-010', 'Styro Ball 1"',      'Styro Balls',   60.00,  40, 120, 'In Stock',  'ball', 1,    null, null, null, 'pack',  25, 15, 0, false),
  (2,  'SB-015', 'Styro Ball 1-1/2"',  'Styro Balls',   90.00,  32, 100, 'In Stock',  'ball', 1.5,  null, null, null, 'pack',  25, 12, 0, false),
  (3,  'SB-020', 'Styro Ball 2"',      'Styro Balls',   85.00,  48, 150, 'In Stock',  'ball', 2,    null, null, null, 'pack',  12, 20, 0, false),
  (4,  'SB-030', 'Styro Ball 3"',      'Styro Balls',   25.00, 220, 500, 'In Stock',  'ball', 3,    null, null, null, 'piece',  1, 60, 0, false),
  (5,  'SB-040', 'Styro Ball 4"',      'Styro Balls',   45.00,  45, 300, 'Low Stock', 'ball', 4,    null, null, null, 'piece',  1, 50, 0, false),
  (6,  'SB-050', 'Styro Ball 5"',      'Styro Balls',   70.00,  90, 200, 'In Stock',  'ball', 5,    null, null, null, 'piece',  1, 30, 0, false),
  (7,  'SB-060', 'Styro Ball 6"',      'Styro Balls',   95.00,  60, 150, 'In Stock',  'ball', 6,    null, null, null, 'piece',  1, 25, 0, false),
  (8,  'SB-080', 'Styro Ball 8"',      'Styro Balls',  160.00,  18,  80, 'Low Stock', 'ball', 8,    null, null, null, 'piece',  1, 20, 0, false),

  -- Styro sheets. All cuttable, so any of them can back a cut-to-size order.
  (9,  'SS-050-2X4', 'Styro Sheet 1/2" × 2ft × 4ft', 'Styro Sheets',  125.00, 200, 400, 'In Stock',  'sheet', null, 0.5, 4, 2, 'sheet', 1, 50, 0, true),
  (10, 'SS-100-2X4', 'Styro Sheet 1" × 2ft × 4ft',   'Styro Sheets',  180.00,  10, 300, 'Low Stock', 'sheet', null, 1,   4, 2, 'sheet', 1, 40, 0, true),
  (11, 'SS-200-2X4', 'Styro Sheet 2" × 2ft × 4ft',   'Styro Sheets',  320.00,  75, 200, 'In Stock',  'sheet', null, 2,   4, 2, 'sheet', 1, 25, 0, true),
  (12, 'SS-100-4X8', 'Styro Sheet 1" × 4ft × 8ft',   'Styro Sheets',  620.00,  55, 150, 'In Stock',  'sheet', null, 1,   8, 4, 'sheet', 1, 20, 0, true),
  (13, 'SS-200-4X8', 'Styro Sheet 2" × 4ft × 8ft',   'Styro Sheets', 1150.00,  34, 120, 'In Stock',  'sheet', null, 2,   8, 4, 'sheet', 1, 15, 0, true),
  (14, 'SS-300-4X8', 'Styro Sheet 3" × 4ft × 8ft',   'Styro Sheets', 1680.00,  12,  80, 'In Stock',  'sheet', null, 3,   8, 4, 'sheet', 1, 10, 0, true),
  (15, 'SS-400-4X8', 'Styro Sheet 4" × 4ft × 8ft',   'Styro Sheets', 2200.00,   6,  60, 'Low Stock', 'sheet', null, 4,   8, 4, 'sheet', 1,  8, 0, true)
on conflict do nothing;

-- The catalogue half: one entry per stock row above, joined on code.
insert into public.products
  (item_code, name, size, unit_price, low_stock_threshold, status,
   product_type, diameter_in, thickness_in, length_ft, width_ft, unit, pack_size)
select i.sku, i.name, i.category, i.price, i.low_stock_threshold, 'Active',
  i.product_type, i.diameter_in, i.thickness_in, i.length_ft, i.width_ft, i.unit, i.pack_size
from public.inventory i
where i.id between 1 and 15
  and not exists (select 1 from public.products p where lower(p.item_code) = lower(i.sku));
