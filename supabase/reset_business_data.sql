-- ============================================================================
-- START FRESH: empty every business table, keep the staff accounts.
-- ============================================================================
--
-- A ONE-TIME SCRIPT, deliberately not a button. Run it once in the Supabase
-- SQL editor (Dashboard -> SQL Editor -> New query -> paste -> Run) to clear
-- the test and QA data before the shop starts using the system for real.
-- Nothing in the app can do this, so nothing in the app can do it by mistake
-- to real orders later.
--
-- WHAT GOES (every row, no undo -- take a backup first if you might want it):
--   orders, deliveries, customers
--   products, stock rows, product photos, product categories
--   suppliers, raw materials, supplier orders, material lots
--   production batches, recipes, material usage, damage records
--   the stock history and the activity log
--   the loyalty reward settings (put back to their defaults: off, 3 orders to
--   become a regular, a 5% reward every 5th order)
--   the request-replay records the app uses to stop a double-click saving twice
--
-- WHAT STAYS:
--   every staff account (public.staff) and every sign-in (auth.users), so
--   everybody signs in exactly as before with the same username and password.
--
-- WHY TRUNCATE AND NOT DELETE: a DELETE fires the per-row guards (a customer
-- with a waiting order cannot be removed, every removal writes an activity
-- entry). Those guards are right for daily work and wrong for a clean slate.
-- TRUNCATE empties the tables in one step without running them, and returns
-- the space to the database at once -- which is what matters on the free plan.
--
-- SAFETY CATCH: the script refuses to run until you change the word below
-- from 'no' to 'yes'. It also runs as ONE transaction, so if anything fails
-- part-way nothing at all is removed.
-- ============================================================================

begin;

do $guard$
declare
  i_am_sure text := 'no';   -- <-- change 'no' to 'yes' to really run it
begin
  if i_am_sure is distinct from 'yes' then
    raise exception 'Nothing was removed. Change i_am_sure to ''yes'' near the top of the script, then run it again.';
  end if;
end
$guard$;

-- What is there before, so the result can be checked against it.
select 'before' as moment,
  (select count(*) from public.orders)            as orders,
  (select count(*) from public.deliveries)        as deliveries,
  (select count(*) from public.customers)         as customers,
  (select count(*) from public.products)          as products,
  (select count(*) from public.suppliers)         as suppliers,
  (select count(*) from public.raw_materials)     as raw_materials,
  (select count(*) from public.production_batches) as batches,
  (select count(*) from public.stock_movements)   as stock_history,
  (select count(*) from public.activity_log)      as activity_log,
  (select count(*) from public.staff)             as staff_kept;

-- One statement, so the tables that point at each other (a delivery at its
-- order, a batch at its product, a lot at its supplier order) are emptied
-- together and no foreign key has to be satisfied in between. The staff table
-- is NOT in the list and nothing in the list is referenced by it, so no
-- CASCADE is used: if a table is ever added that points at one of these, this
-- fails loudly instead of silently emptying something nobody named.
truncate table
  public.production_material_usage,
  public.production_defect_logs,
  public.raw_material_lots,
  public.production_batches,
  public.production_recipes,
  public.raw_material_orders,
  public.raw_materials,
  public.stock_movements,
  public.deliveries,
  public.orders,
  public.customers,
  public.product_images,
  public.inventory,
  public.products,
  public.product_categories,
  public.suppliers,
  public.activity_log,
  private.order_requests,
  private.workshop_requests,
  private.stock_requests,
  private.audited_sessions;

-- The loyalty settings are one row the app expects to exist, so they are put
-- back to the defaults rather than removed.
delete from public.loyalty_rules;
insert into public.loyalty_rules (id) values (1);

-- The one line the new activity log starts with, so whoever opens it next
-- sees why it is empty rather than wondering what went wrong.
insert into public.activity_log (type, staff_name, description, subject, at, source)
values ('account', 'System', 'cleared all test data for a fresh start; staff accounts were kept',
        'reset', now(), 'server');

select 'after' as moment,
  (select count(*) from public.orders)            as orders,
  (select count(*) from public.deliveries)        as deliveries,
  (select count(*) from public.customers)         as customers,
  (select count(*) from public.products)          as products,
  (select count(*) from public.suppliers)         as suppliers,
  (select count(*) from public.raw_materials)     as raw_materials,
  (select count(*) from public.production_batches) as batches,
  (select count(*) from public.stock_movements)   as stock_history,
  (select count(*) from public.activity_log)      as activity_log,
  (select count(*) from public.staff)             as staff_kept;

commit;
