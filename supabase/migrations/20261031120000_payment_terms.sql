-- How the business is actually paid.
--
--   Customers   An order that is DELIVERED is paid on terms: 30 or 60 days
--               from the day it is delivered, with no down payment. An order
--               the customer PICKS UP is paid at the shop, in full or in part.
--               Each customer has their usual term; a new order starts with it
--               and can be given the other one.
--   Suppliers   Raw materials are paid cash on delivery or by credit card.
--               A card payment is made when the order is placed; a COD one
--               when the delivery is received.
--
-- Additive: three columns on existing tables, a trigger and a function.
-- Existing orders with a delivery are given the 30-day term, which only
-- changes when a reminder would show; nothing is charged or moved.
-- Safe to re-run. Apply after 20261030120000_payments_settings_photos.sql.
-- Mirrored at the end of schema.sql (schemaInstall.test.js checks the copy).

-- ============================================================
-- Customers' usual term, and each order's
-- ============================================================
alter table public.customers add column if not exists payment_term_days smallint not null default 30;
alter table public.customers drop constraint if exists customers_payment_term_check;
alter table public.customers add constraint customers_payment_term_check check (payment_term_days in (30, 60));

-- Null on an order means it is not on terms: it is picked up and paid at the shop.
alter table public.orders add column if not exists payment_term_days smallint;
alter table public.orders drop constraint if exists orders_payment_term_check;
alter table public.orders add constraint orders_payment_term_check
  check (payment_term_days is null or payment_term_days in (30, 60));

-- Orders written before terms existed: the ones with a delivery go on the
-- usual 30 days, so an old unpaid delivery can show as due. Only rows still
-- null are touched, so a re-run leaves later choices alone.
update public.orders o set payment_term_days = 30
where o.payment_term_days is null
  and exists (select 1 from public.deliveries d where d.order_id = o.id);

-- The term is part of what an order costs the customer to carry, so after an
-- order is written only a manager changes it -- the rule orders_guard_money_update
-- applies to every other money field.
create or replace function private.guard_order_term()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if (select auth.jwt()) is null then return new; end if;
  if new.payment_term_days is distinct from old.payment_term_days
     and not private.is_manager_or_admin() then
    raise exception 'Only an administrator or a manager can change an order''s payment terms';
  end if;
  return new;
end;
$fn$;
revoke all on function private.guard_order_term() from public, anon, authenticated;
drop trigger if exists orders_guard_term on public.orders;
create trigger orders_guard_term before update of payment_term_days on public.orders
  for each row execute function private.guard_order_term();

-- ============================================================
-- Supplier orders: how they are paid, and whether they have been
-- ============================================================
alter table public.raw_material_orders add column if not exists payment_method text not null default 'cod';
alter table public.raw_material_orders drop constraint if exists raw_material_orders_payment_method_check;
alter table public.raw_material_orders add constraint raw_material_orders_payment_method_check
  check (payment_method in ('cod', 'card'));
alter table public.raw_material_orders add column if not exists paid_at timestamptz;

-- When a supplier order counts as paid follows from how it is paid: a card
-- payment at the moment it is placed, COD when the goods arrive. Kept by this
-- trigger rather than by whoever writes the row, so workshop_command needs no
-- change and no path can mark an order paid early or forget to.
create or replace function private.stamp_supplier_payment()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if new.status = 'Cancelled' then
    -- A cancelled card order stays paid: the money went out and is a matter
    -- for the supplier. A cancelled COD order was never paid.
    if new.payment_method = 'cod' then new.paid_at := null; end if;
    return new;
  end if;
  if new.payment_method = 'card' then
    new.paid_at := coalesce(new.paid_at, now());
  elsif new.status = 'Arrived' then
    new.paid_at := coalesce(new.paid_at, now());
  else
    new.paid_at := null;
  end if;
  return new;
end;
$fn$;
revoke all on function private.stamp_supplier_payment() from public, anon, authenticated;
drop trigger if exists raw_material_orders_payment on public.raw_material_orders;
create trigger raw_material_orders_payment before insert or update of status, payment_method, paid_at
  on public.raw_material_orders for each row execute function private.stamp_supplier_payment();

-- Orders already on file: arrived ones were paid on arrival.
update public.raw_material_orders set paid_at = coalesce(actual_delivery_date::timestamptz, created_at)
where status = 'Arrived' and paid_at is null;

-- Sets how a supplier order is paid. Placed orders call this straight after
-- workshop_command creates them; a manager can correct it until the delivery
-- arrives. Changing the record moves no money: it fixes what was written down.
create or replace function public.set_supplier_payment(p_order_id bigint, p_method text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  who text := private.caller_role();
  actor text;
  ord public.raw_material_orders;
begin
  if who is null or who not in ('Admin', 'Manager') then
    raise exception 'Only a manager or administrator can change how a supplier is paid.';
  end if;
  if p_method is null or p_method not in ('cod', 'card') then
    raise exception 'Choose cash on delivery or credit card.';
  end if;
  select * into ord from public.raw_material_orders where id = p_order_id for update;
  if not found then raise exception 'That supplier order no longer exists.'; end if;
  if ord.payment_method = p_method then
    return jsonb_build_object('id', ord.id, 'payment_method', ord.payment_method, 'paid_at', ord.paid_at);
  end if;
  if ord.status in ('Arrived', 'Cancelled') then
    raise exception 'This order is already closed, so how it was paid can no longer change.';
  end if;
  update public.raw_material_orders set payment_method = p_method where id = ord.id returning * into ord;
  select s.name into actor from public.staff s
    where lower(s.email) = lower((select auth.jwt()) ->> 'email') limit 1;
  insert into public.activity_log (id, type, staff_name, description, subject, at)
    values (nextval('private.workshop_id_seq'), 'stock', coalesce(actor, 'System'),
      format('Supplier order #%s is paid by %s', ord.id, case p_method when 'card' then 'credit card' else 'cash on delivery' end),
      format('Supplier order #%s', ord.id), now());
  return jsonb_build_object('id', ord.id, 'payment_method', ord.payment_method, 'paid_at', ord.paid_at);
end;
$fn$;
revoke all on function public.set_supplier_payment(bigint, text) from public, anon;
grant execute on function public.set_supplier_payment(bigint, text) to authenticated;
