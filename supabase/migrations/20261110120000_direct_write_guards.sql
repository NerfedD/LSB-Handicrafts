-- Orders and deliveries cannot be rewritten around their commands, and money
-- handed back on a refund cannot be more than was received.
--
-- Stock was already safe from a direct write: inventory.stock moves only
-- inside the command functions (guard_direct_stock_change). The two tables
-- that DECIDE when stock moves were not. Any signed-in account could go
-- straight to the API and
--
--   write an order already "Completed", or flip a waiting one to it, with
--   nothing taken off the shelf;
--   set a line's committedUnits by hand, so a later cancel or re-open "put
--   back" goods that had never left;
--   move a delivery from "Not Yet Delivered" to "Delivered" without the
--   dispatch that counts what was loaded, or rewrite its manifest.
--
-- These guards close that. They follow guard_direct_stock_change: SECURITY
-- INVOKER, so inside order_command (security definer) current_user is the
-- function's owner and nothing here applies, while a browser's own write is
-- `authenticated`. Every screen keeps working: the app only ever inserts a
-- waiting order or an unsent delivery, and its row updates never touch the
-- columns the commands own.
--
-- REFUNDS. order_command let a refund run up to the order's total whatever
-- had been received, and recorded all of it as money "given back". Deliveries
-- are paid on 30 or 60 day terms, so most refunds happen before any payment:
-- the record said money went back that had never come in. The database now
-- works out, for each refund, how much is money handed back -- never more
-- than was paid beyond what the order still comes to -- and the rest comes
-- off what the customer owes. That matches what record_payment has always
-- charged (total less refunded less paid).
--
-- Additive: functions and triggers only. No row is changed. Safe to re-run.
-- Apply after 20261101120000_notifications.sql, before the matching client.
-- Mirrored at the end of schema.sql (schemaInstall.test.js checks the copy).

-- ============================================================
-- A line's fulfilment counters, for comparing two versions of an order
-- ============================================================
-- [[committed, voided], ...] in line order, read the way order_command reads
-- them: a line with no committedUnits on an order stamped as committed counts
-- as fully sent. Never raises on a counter that is not a number.
create or replace function private.order_line_counters(p_items jsonb, p_committed_at timestamptz)
returns jsonb language sql immutable set search_path = '' as $fn$
  select coalesce(jsonb_agg(jsonb_build_array(c.committed, c.voided) order by c.ord), '[]'::jsonb)
  from (
    select l.ord, l.voided,
      case when l.line ->> 'committedUnits' is not null then private.order_num(l.line ->> 'committedUnits')
           when p_committed_at is not null then greatest(0, l.ordered - l.voided)
           else 0 end as committed
    from (
      select line, ord,
        private.order_num(line ->> 'voidedUnits') as voided,
        coalesce((private.order_line_shape(jsonb_build_array(line)) -> 0 ->> 'stockUnits')::numeric, 0) as ordered
      from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end)
        with ordinality as t(line, ord)
    ) l
  ) c;
$fn$;
revoke all on function private.order_line_counters(jsonb, timestamptz) from public, anon;
grant execute on function private.order_line_counters(jsonb, timestamptz) to authenticated;

-- ============================================================
-- Orders: what a browser may write for itself
-- ============================================================
-- A new order is a waiting order nothing has happened to. After that the
-- browser may correct what the order SAYS (lines, customer, price, terms --
-- orders_guard_money_update decides who), but what has HAPPENED to it belongs
-- to order_command: its status, what has left, refunds and replacements.
create or replace function private.guard_order_direct_write()
returns trigger language plpgsql set search_path = '' as $fn$
declare
  was jsonb;
  now_is jsonb;
  kept integer;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;

  if jsonb_typeof(new.items) is distinct from 'array' then
    raise exception 'The lines on this order could not be read.';
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'Pending' then
      raise exception 'A new order starts as waiting. Mark it done once the goods have gone.';
    end if;
    if new.stock_committed_at is not null
       or coalesce(new.backorder_status, 'none') <> 'none'
       or exists (select 1 from jsonb_array_elements(new.items) line
         where private.order_num(line ->> 'committedUnits') <> 0
            or private.order_num(line ->> 'voidedUnits') <> 0) then
      raise exception 'A new order cannot say goods have already left. Stock moves when it is marked done or sent out.';
    end if;
    if coalesce(new.refunded_amount, 0) <> 0
       or coalesce(new.refund_history, '[]'::jsonb) <> '[]'::jsonb
       or coalesce(new.replacement_history, '[]'::jsonb) <> '[]'::jsonb
       or coalesce(new.price_adjustments, '[]'::jsonb) <> '[]'::jsonb then
      raise exception 'A new order cannot carry refunds, replacements or price corrections.';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'An order changes status when it is marked done, called off, put back to waiting or refunded, not by editing it.';
  end if;
  if new.stock_committed_at is distinct from old.stock_committed_at
     or new.backorder_status is distinct from old.backorder_status then
    raise exception 'What has left on an order is recorded when it is marked done or sent out, not by editing it.';
  end if;
  if new.refunded_amount is distinct from old.refunded_amount
     or new.refund_history is distinct from old.refund_history
     or new.replacement_history is distinct from old.replacement_history then
    raise exception 'Refunds and replacements are recorded with "Give money back" and "Replace goods", not by editing the order.';
  end if;

  -- Price corrections are a history: an entry can be added, never changed or
  -- removed. (Who may add one is orders_guard_money_update's question.)
  if jsonb_typeof(old.price_adjustments) = 'array' then
    kept := jsonb_array_length(old.price_adjustments);
    if jsonb_typeof(new.price_adjustments) is distinct from 'array'
       or jsonb_array_length(new.price_adjustments) < kept
       or (select coalesce(jsonb_agg(e order by n), '[]'::jsonb)
           from jsonb_array_elements(new.price_adjustments) with ordinality as t(e, n)
           where n <= kept) is distinct from old.price_adjustments then
      raise exception 'The record of price corrections can only be added to.';
    end if;
  end if;

  -- The counters say what has physically left and what was refunded. Once any
  -- of that has happened the lines are the receipt for it and stay as they
  -- are; before it, the lines may be rewritten but may not claim it.
  was := private.order_line_counters(old.items, old.stock_committed_at);
  now_is := private.order_line_counters(new.items, old.stock_committed_at);
  if old.stock_committed_at is not null
     or exists (select 1 from jsonb_array_elements(was) c
       where (c ->> 0)::numeric <> 0 or (c ->> 1)::numeric <> 0) then
    if now_is is distinct from was
       or private.order_line_shape(new.items) is distinct from private.order_line_shape(
            case when jsonb_typeof(old.items) = 'array' then old.items else '[]'::jsonb end) then
      raise exception 'Goods have already moved on this order, so its lines are the record of what went. They cannot be edited.';
    end if;
  elsif exists (select 1 from jsonb_array_elements(now_is) c
      where (c ->> 0)::numeric <> 0 or (c ->> 1)::numeric <> 0) then
    raise exception 'An order cannot be edited to say goods have left. Stock moves when it is marked done or sent out.';
  end if;

  return new;
end;
$fn$;
revoke all on function private.guard_order_direct_write() from public, anon;
grant execute on function private.guard_order_direct_write() to authenticated;
drop trigger if exists orders_guard_direct_write on public.orders;
create trigger orders_guard_direct_write before insert or update on public.orders
  for each row execute function private.guard_order_direct_write();

-- ============================================================
-- Deliveries: one stage at a time, and goods leave through dispatch
-- ============================================================
-- A delivery is raised unsent and moves along the five stages one step at a
-- time, forward or back. The step that takes goods off the shelf -- "Ready To
-- Go" to "On The Way" on a delivery raised for an order -- is order_command's
-- dispatch and nothing else, because that is where what was loaded is counted.
-- The manifest dispatch writes is the record of that departure and is not the
-- browser's to change. Two kinds of delivery have nothing left to count and
-- make that step as a plain move: one raised by hand, with no order behind it,
-- and one whose order is already finished -- its goods came off the shelf when
-- it was marked done (the board does not load orders finished long ago, so it
-- cannot send that one through dispatch).
create or replace function private.guard_delivery_direct_write()
returns trigger language plpgsql set search_path = '' as $fn$
declare
  stages constant text[] := array['Not Yet Delivered', 'Being Made', 'Ready To Go', 'On The Way', 'Delivered'];
  was integer;
  now_at integer;
  text_order bigint;
  order_status text;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'Not Yet Delivered' then
      raise exception 'A new delivery starts as not yet sent, and is moved on from the deliveries board.';
    end if;
    if jsonb_typeof(new.items_manifest) is distinct from 'array' or jsonb_array_length(new.items_manifest) <> 0 then
      raise exception 'What a delivery carried is recorded when it is sent out.';
    end if;
    return new;
  end if;

  if new.items_manifest is distinct from old.items_manifest then
    raise exception 'What a delivery carried is recorded when it is sent out, and cannot be edited afterwards.';
  end if;

  -- Linked by id where the row has one (deliveries_guard_order_link keeps that
  -- from moving), otherwise by the "Order #N - " text older rows rely on.
  if old.order_id is null and old.product ~ '^Order #[0-9]{1,18} - ' then
    text_order := substring(old.product from '^Order #([0-9]{1,18}) - ')::bigint;
    if not exists (select 1 from public.orders o where o.id = text_order) then text_order := null; end if;
  end if;
  select o.status into order_status from public.orders o where o.id = coalesce(old.order_id, text_order);

  if text_order is not null and not starts_with(coalesce(new.product, ''), 'Order #' || text_order || ' - ') then
    raise exception 'A delivery raised for an order stays with that order.';
  end if;

  if new.status is distinct from old.status then
    was := array_position(stages, old.status);
    now_at := array_position(stages, new.status);
    if now_at is null then
      raise exception 'That is not one of the delivery stages.';
    end if;
    -- A stage from before the five existed reads as the first, as the board shows it.
    if abs(now_at - coalesce(was, 1)) <> 1 and not (was is null and now_at = 1) then
      raise exception 'A delivery moves one stage at a time.';
    end if;
    if old.status = 'Ready To Go' and new.status = 'On The Way' then
      if order_status = 'Cancelled' then
        raise exception 'This order has been called off, so nothing can go out on it.';
      elsif order_status is distinct from 'Completed' and order_status is not null then
        raise exception 'Use "Send out" on the delivery, so what was loaded is counted and comes off the shelf.';
      end if;
    end if;
  end if;

  return new;
end;
$fn$;
revoke all on function private.guard_delivery_direct_write() from public, anon;
grant execute on function private.guard_delivery_direct_write() to authenticated;
drop trigger if exists deliveries_guard_direct_write on public.deliveries;
create trigger deliveries_guard_direct_write before insert or update on public.deliveries
  for each row execute function private.guard_delivery_direct_write();

-- ============================================================
-- Refunds: how much is money handed back
-- ============================================================
-- Stamped on the new refund entry as `handedBack`, by the database, when the
-- refund is saved. Money can go back only where the customer has paid more
-- than the order still comes to after the refund:
--
--   handed back = the least of   the refund's amount
--                 and            paid - earlier money handed back
--                                     - (total - refunded after this refund)
--
-- never below zero, and nothing at all when the customer chose to leave it on
-- their account. The rest of the amount comes off what they owe. So across an
-- order, money handed back can never exceed money received.
--
-- An entry written before this existed has no `handedBack`; it counts as money
-- handed back in full unless it was left on the account, which is what it
-- claimed at the time.
create or replace function private.refund_money_handed_back(p_history jsonb)
returns numeric language sql immutable set search_path = '' as $fn$
  select coalesce(sum(case
      when e ->> 'handedBack' is not null then private.order_num(e ->> 'handedBack')
      when e ->> 'method' = 'credit' then 0
      else private.order_num(e ->> 'amount') end), 0)
  from jsonb_array_elements(case when jsonb_typeof(p_history) = 'array' then p_history else '[]'::jsonb end) e;
$fn$;
revoke all on function private.refund_money_handed_back(jsonb) from public, anon;
grant execute on function private.refund_money_handed_back(jsonb) to authenticated;

create or replace function private.stamp_refund_money()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare
  last_at integer;
  entry jsonb;
  amount numeric;
  paid numeric;
  room numeric;
  handed numeric := 0;
begin
  -- Only a refund being added: the total given back went up by one new entry.
  if new.refunded_amount <= old.refunded_amount
     or jsonb_typeof(new.refund_history) is distinct from 'array'
     or jsonb_typeof(old.refund_history) is distinct from 'array'
     or jsonb_array_length(new.refund_history) <> jsonb_array_length(old.refund_history) + 1 then
    return new;
  end if;
  last_at := jsonb_array_length(new.refund_history) - 1;
  entry := new.refund_history -> last_at;
  amount := private.order_num(entry ->> 'amount');

  if entry ->> 'method' is distinct from 'credit' then
    select coalesce(sum(p.amount), 0) into paid from public.order_payments p where p.order_id = new.id;
    room := paid - private.refund_money_handed_back(old.refund_history)
      - greatest(0, new.total_amount - new.refunded_amount);
    handed := round(greatest(0, least(amount, room)), 2);
  end if;

  new.refund_history := jsonb_set(new.refund_history, array[last_at::text],
    entry || jsonb_build_object('handedBack', handed, 'offBalance', greatest(0, amount - handed)));
  return new;
end;
$fn$;
revoke all on function private.stamp_refund_money() from public, anon, authenticated;
drop trigger if exists orders_stamp_refund_money on public.orders;
create trigger orders_stamp_refund_money before update of refunded_amount, refund_history on public.orders
  for each row execute function private.stamp_refund_money();

-- A payment that money has already been handed back against stays on record:
-- removing it would leave more handed back than was ever received.
create or replace function private.guard_payment_removal()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare
  handed numeric;
  left_paid numeric;
begin
  -- No JWT at all means the table owner or the service role, as in the other
  -- guards: maintenance from the SQL editor is not the app removing a payment.
  if (select auth.jwt()) is null then return old; end if;
  select private.refund_money_handed_back(o.refund_history) into handed
    from public.orders o where o.id = old.order_id;
  if coalesce(handed, 0) = 0 then return old; end if;
  select coalesce(sum(p.amount), 0) into left_paid
    from public.order_payments p where p.order_id = old.order_id and p.id <> old.id;
  if left_paid < handed then
    raise exception 'Money has already been handed back against this payment (₱%), so it has to stay on record.',
      to_char(handed, 'FM999,999,999,990.00');
  end if;
  return old;
end;
$fn$;
revoke all on function private.guard_payment_removal() from public, anon, authenticated;
drop trigger if exists order_payments_guard_removal on public.order_payments;
create trigger order_payments_guard_removal before delete on public.order_payments
  for each row execute function private.guard_payment_removal();
