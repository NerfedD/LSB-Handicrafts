-- BUG-15: orders found their customer by name, so renaming one lost their history.
--
-- `orders` stores customer_name and nothing else, and four separate places in
-- the app match on lower(trim(name)) to work out whose order it is: the index in
-- utils/customers, the summary beside it, the lookup that feeds the order screen
-- its customer, and the check that stops a customer being deleted while an order
-- of theirs is still waiting. Correct a spelling on a customer card and all four
-- stop finding their orders at once -- the orders are still there, the thread
-- back to the person is what breaks. Two customers who genuinely share a name
-- have the opposite problem: they have always shared a history.
--
-- README.md and PRODUCT.md both carried this as a known gap whose fix "needs a
-- foreign key and data migration". This is that.
--
-- LINKED WHERE IT IS CERTAIN, NAME-MATCHED WHERE IT IS NOT. The order form takes
-- the customer as free text with a datalist of suggestions, deliberately, so a
-- walk-in can be served without being enrolled first. An order can therefore name
-- somebody who is not a customer record at all, and those rows have no id to
-- carry. So the name match does not go away -- it stops being the only thing
-- holding the two together.
--
-- The backfill links only where exactly ONE customer bears the name. Two people
-- called the same thing stay unlinked rather than be guessed between: picking
-- wrong here would attach one person's spending to another, which is worse than
-- the gap being closed.

alter table public.orders
  add column if not exists customer_id bigint
  references public.customers(id) on delete set null;

-- ON DELETE SET NULL, not CASCADE and not RESTRICT. Removing a customer must not
-- delete their orders and must not be blocked by them; the order survives and
-- falls back to the name it already stores, which is exactly how every order
-- behaved before this column existed.

update public.orders o
set customer_id = c.id
from (
  select lower(trim(name)) as key, min(id) as id, count(*) as n
  from public.customers
  group by lower(trim(name))
) c
where o.customer_id is null
  and c.n = 1
  and c.key = lower(trim(o.customer_name));

-- Partial: the rows worth looking up by customer are the linked ones, and an
-- index over a column that is null for every walk-in is mostly empty pages.
create index if not exists orders_customer_id_idx
  on public.orders (customer_id)
  where customer_id is not null;

-- Who an order belongs to is the same kind of decision as what is on it, and
-- the screens reserve both for a manager. customer_name was already guarded;
-- the id has to be guarded with it, or the rename it is meant to survive could
-- simply be done against the id instead.
create or replace function public.orders_guard_money_update()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if (select auth.jwt()) is null then return new; end if;

  if private.is_manager_or_admin() then return new; end if;

  if new.total_amount      is distinct from old.total_amount
     or new.refunded_amount   is distinct from old.refunded_amount
     or new.refund_history    is distinct from old.refund_history
     or new.price_adjustments is distinct from old.price_adjustments then
    raise exception 'Only an administrator or a manager can give money back or change what an order costs';
  end if;

  if old.status = 'Completed' and new.status is distinct from old.status then
    raise exception 'Only an administrator or a manager can put a finished order back to waiting';
  end if;

  if old.status is distinct from 'Cancelled' and new.status = 'Cancelled' then
    raise exception 'Only an administrator or a manager can call off an order';
  end if;

  if private.order_line_shape(new.items) is distinct from private.order_line_shape(old.items) then
    raise exception 'Only an administrator or a manager can change what is on an order';
  end if;

  if new.customer_name is distinct from old.customer_name
     or new.customer_id is distinct from old.customer_id then
    raise exception 'Only an administrator or a manager can change who an order is for';
  end if;

  return new;
end;
$fn$;

revoke all on function public.orders_guard_money_update() from public, anon, authenticated;

drop trigger if exists orders_guard_money_update on public.orders;
create trigger orders_guard_money_update
  before update on public.orders
  for each row execute function public.orders_guard_money_update();
