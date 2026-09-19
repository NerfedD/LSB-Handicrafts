-- BUG-06: the database let anybody active rewrite an order.
--
-- The UPDATE policy on public.orders is private.is_active_staff() for both
-- USING and WITH CHECK, deliberately -- marking an order done is the ordinary
-- work of the shop and must stay open to everyone. WHICH COLUMNS may change was
-- meant to be answered by orders_guard_money_update(), and it only ever asked
-- about money: total_amount, refunded_amount, refund_history, price_adjustments,
-- and undoing a Completed order.
--
-- So three things the screens reserve for an administrator or a manager were
-- not reserved at all once a request went straight to the API:
--
--   what is on the order   canEdit is canHandleMoney() in OrderDetailPage, so
--                          "Change this order" is manager-only on screen. The
--                          database accepted a rewritten `items` from a Sales,
--                          Production or Delivery account.
--   who it is for          same screen, same gate, same hole on customer_name.
--   calling it off         "Call off order" is canHandleMoney() too, and both
--                          paths that write Cancelled are manager-only on
--                          screen. Pending -> Cancelled was unguarded here
--                          because the existing check only fires on
--                          old.status = 'Completed'.
--
-- WHY `items` IS NOT COMPARED WHOLE, which is the trap in fixing this. Marking
-- an order done LEGITIMATELY rewrites items: commitOrder stamps each line's
-- committedUnits, and a dispatch does the same. Comparing the column would
-- therefore block the one action this policy is deliberately open for.
--
-- Worse, the app normalises lines on the way through (normalizeItem in
-- src/utils/orderItems.js) and ADDS fields while doing it -- `kind` and a `price`
-- mirror of unitPrice appear on a line that was stored without them, and numbers
-- stored as strings come back as numbers. A whole-column comparison would call
-- all of that a change and refuse ordinary staff at random, on exactly the rows
-- with the oldest data.
--
-- So only the COMMERCIAL shape is compared -- which products, how many, at what
-- price -- read through ->> and cast to numeric, so 5 and "5" are the same
-- number and an added `kind` or `price` key is invisible. The fulfilment
-- counters are what staff are allowed to move, and they are not in the
-- projection at all.

create or replace function private.order_num(value text)
returns numeric language sql immutable set search_path = '' as $fn$
  -- Never raises. A line carrying something that is not a number at all is
  -- read as 0 on both sides of the comparison, so it cannot by itself look
  -- like an edit.
  select case when value ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' then value::numeric else 0 end;
$fn$;

create or replace function private.order_line_shape(items jsonb)
returns jsonb language sql immutable set search_path = '' as $fn$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'p', nullif(line ->> 'productId', ''),
        'q', private.order_num(line ->> 'quantity'),
        -- unitPrice falling back to price is what normalizeItem does; matching
        -- it here keeps a normalised line equal to the one it came from.
        'u', private.order_num(coalesce(nullif(line ->> 'unitPrice', ''), line ->> 'price'))
      )
      order by ord
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(
         case when jsonb_typeof(items) = 'array' then items else '[]'::jsonb end
       ) with ordinality as t(line, ord);
$fn$;

revoke all on function private.order_num(text)          from public, anon;
revoke all on function private.order_line_shape(jsonb)  from public, anon;
grant execute on function private.order_num(text)         to authenticated;
grant execute on function private.order_line_shape(jsonb) to authenticated;

create or replace function public.orders_guard_money_update()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  -- No JWT at all means the table owner or the service role: SQL editor,
  -- migrations, seeds. Those bypass RLS already, so guarding them here only
  -- blocks legitimate maintenance - including running this very file.
  if (select auth.jwt()) is null then return new; end if;

  if private.is_manager_or_admin() then return new; end if;

  if new.total_amount      is distinct from old.total_amount
     or new.refunded_amount   is distinct from old.refunded_amount
     or new.refund_history    is distinct from old.refund_history
     or new.price_adjustments is distinct from old.price_adjustments then
    -- Written for a person: humanizeError in src/utils/storageManager.js passes
    -- messages shaped like this straight through to the toast rather than
    -- replacing them with a generic one.
    raise exception 'Only an administrator or a manager can give money back or change what an order costs';
  end if;

  -- UNDOING A FINISHED ORDER IS THE SAME KIND OF DECISION as refunding one, so
  -- it is gated with them rather than left to whoever wrote the order.
  --
  -- Marking an order done stays open to everybody -- it is the ordinary work of
  -- the shop, and old.status is 'Pending' on that path, so this never fires for
  -- it. What this catches is the way BACK: Completed to anything else puts
  -- goods back on the shelf and contradicts what a customer was already told.
  if old.status = 'Completed' and new.status is distinct from old.status then
    raise exception 'Only an administrator or a manager can put a finished order back to waiting';
  end if;

  -- Calling an order off is the same decision as refunding it, and the screen
  -- already treats it that way.
  if old.status is distinct from 'Cancelled' and new.status = 'Cancelled' then
    raise exception 'Only an administrator or a manager can call off an order';
  end if;

  if private.order_line_shape(new.items) is distinct from private.order_line_shape(old.items) then
    raise exception 'Only an administrator or a manager can change what is on an order';
  end if;

  if new.customer_name is distinct from old.customer_name then
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
