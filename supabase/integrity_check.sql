-- Data integrity report. READ-ONLY: every statement below is a SELECT.
--
-- Run it in the SQL editor before applying a migration that adds constraints,
-- and whenever the numbers on screen look wrong. Each row is one check; `found`
-- is how many records fail it, and `what_to_do` says how to put them right.
-- Nothing is fixed automatically: the corrections at the bottom are commented
-- out, and each one should be read, adapted and run deliberately.

with lines as (
  select o.id as order_id, o.status, l.value as line
  from public.orders o
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end) l
)
select * from (values
  ('Stock rows sharing a code',
   (select count(*) from (select 1 from public.inventory group by lower(sku) having count(*) > 1) d),
   'Blocks the one-row-per-code index. Merge the counts into one row by hand, then delete the extra rows.'),
  ('Stock rows with no catalogue entry',
   (select count(*) from public.inventory i
     where not exists (select 1 from public.products p where lower(p.item_code) = lower(i.sku))),
   'Invisible on the Products screen and cannot be ordered. Create the catalogue entry (correction A) or remove the row.'),
  ('Catalogue entries with no stock row',
   (select count(*) from public.products p
     where not exists (select 1 from public.inventory i where lower(p.item_code) = lower(i.sku))),
   'Shown as "stock not tracked". Add a count from the product form, or archive the product.'),
  ('Order lines pointing at a stock row that no longer exists',
   (select count(*) from lines where nullif(line ->> 'productId', '') is not null
     and not exists (select 1 from public.inventory i where i.id::text = line ->> 'productId')),
   'History only: the line keeps its name and price. Harmful only on an order still waiting -- call it off or rewrite it.'),
  ('... of which on orders still waiting',
   (select count(*) from lines where status = 'Pending' and nullif(line ->> 'productId', '') is not null
     and not exists (select 1 from public.inventory i where i.id::text = line ->> 'productId')),
   'These orders cannot be completed. Change the order (manager) to a product that exists.'),
  ('Order lines with more delivered and refunded than ordered',
   (select count(*) from lines
     where coalesce((line ->> 'committedUnits')::numeric, 0) + coalesce((line ->> 'voidedUnits')::numeric, 0)
       > coalesce((line ->> 'stockUnits')::numeric, (line ->> 'quantity')::numeric, 0)),
   'Inspect by hand; order_command refuses to add to these.'),
  ('Deliveries naming an order that does not exist',
   (select count(*) from public.deliveries d where d.order_id is null and d.product ~ '^Order #[0-9]+ - '
     and not exists (select 1 from public.orders o where starts_with(d.product, 'Order #' || o.id || ' - '))),
   'Left unlinked by the migration. Correct the text, or leave it as a walk-in delivery.'),
  ('Refund totals that disagree with the refund history',
   (select count(*) from public.orders o
     where o.refunded_amount <> coalesce((select sum((e ->> 'amount')::numeric) from jsonb_array_elements(o.refund_history) e), 0)),
   'The history is the record; set refunded_amount to its sum.'),
  ('Orders refunded beyond their total',
   (select count(*) from public.orders where refunded_amount > total_amount),
   'Check with whoever gave the money back.'),
  ('Waiting orders stamped as finished with the shelf',
   (select count(*) from public.orders where status = 'Pending' and stock_committed_at is not null),
   'Re-open or complete the order through the app so the stock follows.'),
  ('Raw material counts that disagree with their lots',
   (select count(*) from public.raw_materials m
     where m.stock <> coalesce((select sum(remaining) from public.raw_material_lots l where l.raw_material_id = m.id), 0)),
   'Production will refuse to finish a batch. Correct the count from the app so a correction lot is recorded.'),
  ('Orders with a customer name matching exactly one customer but no link',
   (select count(*) from public.orders o where o.customer_id is null
     and (select count(*) from public.customers c where lower(btrim(c.name)) = lower(btrim(o.customer_name))) = 1),
   'Optional: link them (correction B) so a later rename keeps their history.')
) as report(check_name, found, what_to_do)
order by found desc, check_name;

-- ---------------------------------------------------------------------------
-- Corrections. Commented out on purpose: read each, check the rows it touches
-- with the SELECT beside it, then run it inside a transaction.
-- ---------------------------------------------------------------------------

-- A) Give each stock row that has no catalogue entry one, copying its name,
--    price and measurements. Review first:
--      select id, sku, name, stock from public.inventory i
--      where not exists (select 1 from public.products p where lower(p.item_code) = lower(i.sku));
--
-- insert into public.products (item_code, name, size, unit_price, low_stock_threshold, status,
--   product_type, diameter_in, thickness_in, length_ft, width_ft, unit, pack_size)
-- select i.sku, i.name, i.category, i.price, i.low_stock_threshold, 'Active',
--   i.product_type, i.diameter_in, i.thickness_in, i.length_ft, i.width_ft, i.unit, i.pack_size
-- from public.inventory i
-- where not exists (select 1 from public.products p where lower(p.item_code) = lower(i.sku));

-- B) Link orders to the one customer whose name they carry:
--
-- update public.orders o set customer_id = c.id
-- from (select lower(btrim(name)) as key, min(id) as id, count(*) as n
--       from public.customers group by 1) c
-- where o.customer_id is null and c.n = 1 and c.key = lower(btrim(o.customer_name));
