-- The medium-risk findings of the November 2026 audit: goods counted back
-- where they really are, records that cannot be quietly rewritten, and the
-- role lines the screens already draw.
--
--   Refund after a replacement   a refund cannot put back on the shelf goods
--                                a replacement already swapped for another
--                                product.
--   Calling off, re-opening      refused while a run is on the way or has
--                                delivered goods; they are not on the shelf.
--   A run that comes back        new order_command action return_run puts what
--                                the run carried back on the shelf and the run
--                                back to "Ready To Go". Moving it back by hand
--                                is refused for a waiting order's run.
--   A run that goes out short    the run for what was left behind is raised in
--                                the same transaction as the dispatch.
--   Promised stock               completing or loading an order cannot take
--                                stock promised to an order written earlier;
--                                a manager or administrator may.
--   Price corrections            a total moves only with a correction that
--                                names the old and new totals, stamped with
--                                who and when by the database -- except while
--                                nothing has happened to the order.
--   Product codes                one product per code in any capitalisation; a
--                                code cannot be changed by a direct write.
--   Removing products            only through remove_product: the direct
--                                DELETE policies are gone. Archiving and
--                                putting back on sale are administrators'
--                                (new restore_product).
--   Batch output                 at most twice the pieces planned; more needs
--                                a manager to change the target first.
--   Deliveries and production    deliveries are written by the roles that may
--                                read them (customer addresses), so Production
--                                Staff no longer write blind.
--   Order and delivery status    check constraints on the stored values.
--
-- Additive apart from replacing functions and two policies. No row is
-- changed; the constraints and the unique index are validated against the
-- data and skipped with a notice where the data does not allow them.
-- Safe to re-run. Apply after 20261110120000_direct_write_guards.sql.
-- Mirrored at the end of schema.sql (schemaInstall.test.js checks the copy).

-- ============================================================
-- Stored status values
-- ============================================================
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('Pending', 'Completed', 'Cancelled')) not valid;
alter table public.deliveries drop constraint if exists deliveries_status_check;
alter table public.deliveries add constraint deliveries_status_check
  check (status in ('Not Yet Delivered', 'Being Made', 'Ready To Go', 'On The Way', 'Delivered')) not valid;
do $migration$
begin
  if not exists (select 1 from public.orders where status not in ('Pending', 'Completed', 'Cancelled')) then
    alter table public.orders validate constraint orders_status_check;
  else
    raise notice 'orders has a status outside Pending, Completed and Cancelled; orders_status_check checks new writes only.';
  end if;
  if not exists (select 1 from public.deliveries
      where status not in ('Not Yet Delivered', 'Being Made', 'Ready To Go', 'On The Way', 'Delivered')) then
    alter table public.deliveries validate constraint deliveries_status_check;
  else
    raise notice 'deliveries has a status outside the five stages; deliveries_status_check checks new writes only.';
  end if;
end;
$migration$;

-- ============================================================
-- What waiting orders written before this one still need
-- ============================================================
-- reserved_units, narrowed to the orders ahead of one order in the queue:
-- written earlier (by created_at, then id). Those are the orders whose promise
-- this one may not take.
create or replace function private.reserved_before(p_inventory_id bigint, p_order public.orders)
returns numeric language sql stable security definer set search_path = '' as $fn$
  select coalesce(sum(greatest(0, s.ordered - s.committed - s.voided)), 0)
  from (
    select l.ordered, l.voided,
      coalesce((l.line ->> 'committedUnits')::numeric,
        case when l.stock_committed_at is not null then greatest(0, l.ordered - l.voided) else 0 end) as committed
    from (
      select line, o.stock_committed_at,
        (private.order_line_shape(jsonb_build_array(line)) -> 0 ->> 'stockUnits')::numeric as ordered,
        coalesce((line ->> 'voidedUnits')::numeric, 0) as voided
      from public.orders o
      cross join lateral jsonb_array_elements(case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end) line
      where o.status = 'Pending' and o.id <> p_order.id
        and (coalesce(o.created_at, '-infinity'::timestamptz), o.id)
          < (coalesce(p_order.created_at, '-infinity'::timestamptz), p_order.id)
        and line ->> 'productId' = p_inventory_id::text
    ) l
  ) s;
$fn$;
revoke all on function private.reserved_before(bigint, public.orders) from public, anon;
grant execute on function private.reserved_before(bigint, public.orders) to authenticated;

-- ============================================================
-- A run that came back undelivered
-- ============================================================
-- Called only from order_command, after it has locked the order and the run
-- and checked both revisions. What goes back is what the run's manifest says
-- it carried -- line for line, the manifest is written in the order's line
-- order -- never more than the order says has left. The run goes back to
-- "Ready To Go" with no manifest, ready to be loaded again, and a run raised
-- for what it left behind comes off the board if it never left: the returned
-- run now carries everything again.
create or replace function private.apply_run_return(actor public.staff, ord public.orders, dlv public.deliveries)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  manifest jsonb;
  run_items jsonb;
  n integer;
  mline jsonb;
  oline jsonb;
  back numeric;
  ordered numeric;
  voided numeric;
  committed numeric;
  product_id bigint;
  touched bigint[] := '{}';
  removed jsonb := '[]'::jsonb;
  still_out boolean;
  still_owed boolean;
begin
  if actor.role not in ('Admin', 'Manager', 'Sales Staff', 'Delivery Staff') then
    raise exception 'Only sales or delivery staff, or a manager, can bring a delivery back.';
  end if;
  if dlv.id is null or dlv.status <> 'On The Way' then
    raise exception 'Only a delivery that is on the way can come back.';
  end if;
  if ord.status <> 'Pending' then
    raise exception 'This order is no longer waiting, so what its delivery carried cannot be put back here. Ask a manager to correct the count.';
  end if;
  manifest := case when jsonb_typeof(dlv.items_manifest) = 'array' then dlv.items_manifest else '[]'::jsonb end;
  if jsonb_array_length(manifest) = 0 then
    raise exception 'Nothing was recorded as loaded on this delivery, so there is nothing to put back.';
  end if;
  if jsonb_typeof(ord.items) is distinct from 'array' or jsonb_array_length(manifest) <> jsonb_array_length(ord.items) then
    raise exception 'What this delivery carried no longer matches the order. Ask a manager to check it.';
  end if;

  -- Every line's counter written out, so clearing the order's "all sent"
  -- stamp below cannot change what a line without one is read as.
  select coalesce(jsonb_agg(t.line || jsonb_build_object('committedUnits',
      coalesce(private.order_num(t.line ->> 'committedUnits')
          * case when t.line ->> 'committedUnits' is not null then 1 end,
        case when ord.stock_committed_at is not null
          then greatest(0, (private.order_line_shape(jsonb_build_array(t.line)) -> 0 ->> 'stockUnits')::numeric
            - private.order_num(t.line ->> 'voidedUnits'))
          else 0 end)) order by t.pos), '[]'::jsonb)
    into run_items
  from jsonb_array_elements(ord.items) with ordinality as t(line, pos);

  -- Same lock order as every other writer: ascending id.
  perform 1 from public.inventory
    where id in (select nullif(e ->> 'productId', '')::bigint from jsonb_array_elements(manifest) e)
    order by id for update;
  perform private.set_stock_context('cancellation', 'Came back on the delivery',
    format('Delivery #%s came back undelivered', dlv.id), ord.id);

  for n in 0 .. jsonb_array_length(manifest) - 1 loop
    mline := manifest -> n;
    oline := run_items -> n;
    back := private.order_num(mline ->> 'deliveredQty');
    continue when back = 0;
    if back < 0 or back <> trunc(back) then
      raise exception 'What this delivery carried could not be read. Ask a manager to check it.';
    end if;
    if nullif(mline ->> 'productId', '') is distinct from nullif(oline ->> 'productId', '') then
      raise exception 'What this delivery carried no longer matches the order. Ask a manager to check it.';
    end if;
    committed := private.order_num(oline ->> 'committedUnits');
    if back > committed then
      raise exception 'This delivery says it carried more than the order says has gone out. Ask a manager to check it.';
    end if;
    run_items := jsonb_set(run_items, array[n::text], oline || jsonb_build_object('committedUnits', committed - back));
    product_id := nullif(oline ->> 'productId', '')::bigint;
    if product_id is not null then
      update public.inventory set stock = stock + back::integer where id = product_id;
      if not found then raise exception 'One of the products on this delivery is not on the shelf list.'; end if;
      touched := touched || product_id;
    end if;
  end loop;

  select bool_or(private.order_num(l ->> 'committedUnits') > 0),
         bool_or((private.order_line_shape(jsonb_build_array(l)) -> 0 ->> 'stockUnits')::numeric
           - private.order_num(l ->> 'committedUnits') - private.order_num(l ->> 'voidedUnits') > 0)
    into still_out, still_owed
  from jsonb_array_elements(run_items) l;

  update public.orders set
    items = run_items,
    stock_committed_at = case when coalesce(still_owed, false) then null else stock_committed_at end,
    backorder_status = case when coalesce(still_out, false) and coalesce(still_owed, false) then 'partial' else 'none' end
  where id = ord.id returning * into ord;

  update public.deliveries set status = 'Ready To Go', items_manifest = '[]'::jsonb
    where id = dlv.id returning * into dlv;

  with gone as (
    delete from public.deliveries d
    where d.parent_delivery_id = dlv.id
      and d.status not in ('On The Way', 'Delivered')
      and jsonb_array_length(coalesce(d.items_manifest, '[]'::jsonb)) = 0
    returning d.id)
  select coalesce(jsonb_agg(id), '[]'::jsonb) into removed from gone;

  return jsonb_build_object('order', to_jsonb(ord), 'delivery', to_jsonb(dlv), 'removedDeliveries', removed,
    'inventory', coalesce((select jsonb_agg(to_jsonb(i) order by i.id)
      from public.inventory i where i.id = any(touched)), '[]'::jsonb));
end;
$fn$;
revoke all on function private.apply_run_return(public.staff, public.orders, public.deliveries) from public, anon, authenticated;

-- ============================================================
-- order_command
-- ============================================================
-- As before, plus: return_run; a short dispatch raises its follow-up run in
-- the same transaction (`followUp`: { driver, dueOn }); cancel and reopen are
-- refused while goods are on a van or with the customer; a refund cannot put
-- back goods a replacement swapped for another product; and only a manager
-- or administrator may complete or load an order with stock promised to an
-- order written before it.
create or replace function private.order_command(p_action text, p_data jsonb, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  actor public.staff;
  ord public.orders;
  dlv public.deliveries;
  previous private.order_requests;
  result jsonb;
  delta jsonb;
  v_order_id bigint;
  v_delivery_id bigint;
  moved_id bigint;
  left_on_shelf integer;
  touched bigint[] := '{}';
  patch jsonb := coalesce(p_data -> 'order', '{}'::jsonb);
  next_items jsonb;
  next_refunds jsonb;
  new_entry jsonb;
  old_line jsonb;
  new_line jsonb;
  n integer;
  ordered numeric;
  old_committed numeric;
  old_voided numeric;
  new_committed numeric;
  new_voided numeric;
  expected_deltas jsonb := '{}'::jsonb;
  received_deltas jsonb := '{}'::jsonb;
  product_key text;
  movement numeric;
  removed jsonb := '[]'::jsonb;
  swapped numeric;
  ahead numeric;
  follow_up public.deliveries;
  left_behind text;
begin
  if auth.uid() is null then raise exception 'Please sign in again.'; end if;
  select * into actor from public.staff
    where lower(email) = lower(auth.jwt() ->> 'email') and status = 'Active';
  if actor.id is null then raise exception 'An active staff account is needed.'; end if;
  if p_request_id is null then raise exception 'A request reference is needed.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into previous from private.order_requests where request_id = p_request_id;
  if found then
    if previous.actor_id <> actor.id or previous.action is distinct from p_action or previous.payload is distinct from p_data then
      raise exception 'This request has changed. Close the form and try again.';
    end if;
    return previous.result;
  end if;

  v_order_id := nullif(p_data ->> 'orderId', '')::bigint;
  v_delivery_id := nullif(p_data ->> 'deliveryId', '')::bigint;
  select * into ord from public.orders where id = v_order_id for update;
  if not found then raise exception 'That order no longer exists.'; end if;
  if ord.revision is distinct from (p_data ->> 'expectedRevision')::bigint then
    raise exception using errcode = '40001', message = 'This order changed. Refresh it before trying again.';
  end if;

  if v_delivery_id is not null then
    select * into dlv from public.deliveries where id = v_delivery_id for update;
    if not found then raise exception 'That delivery no longer exists.'; end if;
    if dlv.revision is distinct from (p_data ->> 'expectedDeliveryRevision')::bigint then
      raise exception using errcode = '40001', message = 'This delivery changed. Refresh it before trying again.';
    end if;
    if dlv.order_id is distinct from v_order_id
       and not (dlv.order_id is null and starts_with(dlv.product, 'Order #' || v_order_id || ' - ')) then
      raise exception 'That delivery belongs to a different order.';
    end if;
  end if;

  if p_action in ('refund', 'cancel', 'reopen', 'replace') and actor.role not in ('Admin', 'Manager') then
    raise exception 'Only an administrator or a manager can do that.';
  end if;
  if p_action <> 'refund' and patch ?| array['refundedAmount', 'refundHistory', 'totalAmount'] then
    raise exception 'Money changes must use the refund or price correction controls.';
  end if;
  if p_action not in ('dispatch', 'arrive', 'return_run') and (v_delivery_id is not null or p_data ? 'delivery') then
    raise exception 'This action cannot change a delivery.';
  end if;

  -- A run that came back undelivered: the goods go back on the shelf and the
  -- run goes back to "Ready To Go". Worked out from what the run's own
  -- manifest says it carried, not from anything the browser sends.
  if p_action = 'return_run' then
    result := private.apply_run_return(actor, ord, dlv);
    insert into private.order_requests(request_id, actor_id, action, payload, result)
      values (p_request_id, actor.id, p_action, p_data, result);
    return result;
  end if;

  -- Calling an order off, or putting a finished one back to waiting, puts
  -- what it took off the shelf back on it. That is only true of goods that
  -- are in the building: not of goods on a van, and not of goods a delivery
  -- has already handed to the customer.
  if p_action in ('cancel', 'reopen') then
    if exists (select 1 from public.deliveries d
        where (d.order_id = ord.id or (d.order_id is null and starts_with(d.product, 'Order #' || ord.id || ' - ')))
          and d.status = 'On The Way') then
      raise exception 'A delivery for this order is on the way. Mark it delivered, or mark that it came back, first.';
    end if;
    if exists (select 1 from public.deliveries d
        where (d.order_id = ord.id or (d.order_id is null and starts_with(d.product, 'Order #' || ord.id || ' - ')))
          and d.status = 'Delivered') then
      raise exception 'Goods on this order have been delivered to the customer, so they are not on the shelf to put back. Give the money back instead, and say whether the goods came back.';
    end if;
  end if;

  if p_action = 'replace' then
    result := private.apply_order_replacement(actor, ord, p_data);
    insert into private.order_requests(request_id, actor_id, action, payload, result)
      values (p_request_id, actor.id, p_action, p_data, result);
    return result;
  end if;

  case p_action
    when 'complete' then
      if ord.status <> 'Pending' or patch ->> 'status' is distinct from 'Completed' then
        raise exception 'Only an order that is still waiting can be marked done.';
      end if;
    when 'reopen' then
      if ord.status <> 'Completed' or patch ->> 'status' is distinct from 'Pending' then
        raise exception 'Only a finished order can be put back to waiting.';
      end if;
    when 'cancel' then
      if ord.status = 'Cancelled' or ord.refunded_amount > 0 or patch ->> 'status' is distinct from 'Cancelled' then
        raise exception 'This order cannot be called off. Check its status and refunds.';
      end if;
    when 'refund' then
      if coalesce((patch ->> 'refundedAmount')::numeric, 0) <= ord.refunded_amount
        or (patch ->> 'refundedAmount')::numeric > ord.total_amount
        or jsonb_array_length(coalesce(patch -> 'refundHistory', '[]'::jsonb)) <> jsonb_array_length(ord.refund_history) + 1
        or (patch -> 'refundHistory') - (jsonb_array_length(patch -> 'refundHistory') - 1) <> ord.refund_history
        or patch ? 'totalAmount' then
        raise exception 'The refund must add to the saved history without exceeding what was paid.';
      end if;
      new_entry := (patch -> 'refundHistory') -> -1;
      if coalesce((new_entry ->> 'amount')::numeric, -1)
         <> (patch ->> 'refundedAmount')::numeric - ord.refunded_amount then
        raise exception 'The refund entry does not match the amount given back.';
      end if;
      -- Everything paid back calls the order off; anything less leaves it be.
      if (patch ->> 'refundedAmount')::numeric >= ord.total_amount then
        if patch ->> 'status' is distinct from 'Cancelled' then
          raise exception 'Giving everything back calls the order off. Refresh the order and try again.';
        end if;
      elsif patch ? 'status' and patch ->> 'status' is distinct from ord.status then
        raise exception 'A partial refund does not change the order status.';
      end if;
      -- Who and when come from the database, not from the browser.
      next_refunds := jsonb_set(patch -> 'refundHistory',
        array[(jsonb_array_length(patch -> 'refundHistory') - 1)::text],
        new_entry || jsonb_build_object('refundedAt', now(), 'refundedByStaffId', actor.id,
          'refundedBy', actor.name));
    when 'dispatch' then
      if ord.status = 'Cancelled' then
        raise exception 'This order has been called off, so nothing can go out on it.';
      end if;
      if dlv.id is null or dlv.status <> 'Ready To Go'
        or p_data -> 'delivery' ->> 'status' is distinct from 'On The Way'
        or patch ? 'status' then
        raise exception 'Only a ready delivery can be sent out.';
      end if;
    when 'arrive' then
      if dlv.id is null or dlv.status <> 'On The Way'
        or p_data -> 'delivery' ->> 'status' is distinct from 'Delivered'
        or ord.status <> 'Pending' or patch ->> 'status' is distinct from 'Completed' then
        raise exception 'Only a delivery on the way can finish its waiting order.';
      end if;
    else raise exception 'That order action is not supported.';
  end case;

  next_items := coalesce(patch -> 'items', ord.items);
  if private.order_line_shape(next_items) is distinct from private.order_line_shape(ord.items) then
    raise exception 'Order actions cannot rewrite the agreed items. Use the order editor.';
  end if;

  -- Validate stock deltas against the counters, even for direct RPC callers.
  for n in 0 .. jsonb_array_length(ord.items) - 1 loop
    old_line := ord.items -> n;
    new_line := next_items -> n;
    ordered := (private.order_line_shape(jsonb_build_array(old_line)) -> 0 ->> 'stockUnits')::numeric;
    old_voided := coalesce((old_line ->> 'voidedUnits')::numeric, 0);
    old_committed := coalesce((old_line ->> 'committedUnits')::numeric,
      case when ord.stock_committed_at is not null then greatest(0, ordered - old_voided) else 0 end);
    new_voided := coalesce((new_line ->> 'voidedUnits')::numeric, 0);
    new_committed := coalesce((new_line ->> 'committedUnits')::numeric, old_committed);
    if new_committed < 0 or new_voided < 0 or new_committed + new_voided > ordered
      or new_committed <> trunc(new_committed) or new_voided <> trunc(new_voided) then
      raise exception 'The stock counts on this order are not valid.';
    end if;
    if p_action <> 'refund' and new_voided <> old_voided then
      raise exception 'Only a refund can void goods.';
    end if;
    if (p_action in ('complete', 'dispatch') and new_committed < old_committed)
      or (p_action in ('reopen', 'cancel') and new_committed <> 0)
      or (p_action = 'refund' and (new_committed > old_committed or new_voided < old_voided)) then
      raise exception 'The stock change does not match this action.';
    end if;
    if p_action in ('complete', 'arrive') and new_committed + new_voided <> ordered then
      raise exception 'Goods are still owed on this order.';
    end if;
    if p_action = 'arrive' and new_committed <> old_committed then
      raise exception 'Arrival cannot change what was loaded.';
    end if;
    product_key := nullif(old_line ->> 'productId', '');
    if product_key is not null then
      movement := old_committed - new_committed;
      -- A replacement that sent out a DIFFERENT product took some of this
      -- line's goods back and left the customer holding the other product.
      -- Those goods were already dealt with by the replacement, so a refund
      -- cannot put them on the shelf a second time.
      if p_action = 'refund' then
        swapped := coalesce((select sum(private.order_num(e ->> 'quantity'))
          from jsonb_array_elements(case when jsonb_typeof(ord.replacement_history) = 'array' then ord.replacement_history else '[]'::jsonb end) e
          where e ->> 'lineIndex' = n::text
            and nullif(e ->> 'replacementProductId', '') is distinct from product_key), 0);
        movement := least(movement, greatest(0, old_committed - swapped));
      end if;
      expected_deltas := jsonb_set(expected_deltas, array[product_key],
        to_jsonb(coalesce((expected_deltas ->> product_key)::numeric, 0) + movement));
    end if;
  end loop;

  for delta in select value from jsonb_array_elements(coalesce(p_data -> 'deltas', '[]'::jsonb)) loop
    product_key := nullif(delta ->> 'productId', '');
    movement := (delta ->> 'delta')::numeric;
    if product_key is null or movement is null or movement <> trunc(movement) or not expected_deltas ? product_key then
      raise exception 'A stock change on this order could not be read.';
    end if;
    received_deltas := jsonb_set(received_deltas, array[product_key],
      to_jsonb(coalesce((received_deltas ->> product_key)::numeric, 0) + movement));
  end loop;
  for product_key, movement in select key, value::numeric from jsonb_each_text(expected_deltas) loop
    if p_action = 'refund' then
      -- Returned goods may be scrapped instead of restocked.
      if coalesce((received_deltas ->> product_key)::numeric, 0) < 0
        or coalesce((received_deltas ->> product_key)::numeric, 0) > movement then
        raise exception 'Only returned goods can go back on the shelf.';
      end if;
    elsif coalesce((received_deltas ->> product_key)::numeric, 0) <> movement then
      raise exception 'The shelf movement does not match the goods on the order.';
    end if;
  end loop;

  -- 'arrive' moves no stock; reopen and cancel put goods back.
  perform private.set_stock_context(case p_action
    when 'complete' then 'sale' when 'dispatch' then 'dispatch' when 'refund' then 'return'
    else 'cancellation' end, null, null, v_order_id);
  -- All callers lock shared shelf rows in the same order to avoid deadlocks.
  for product_key, movement in
    select key, value::numeric from jsonb_each_text(received_deltas) order by key::bigint
  loop
    if movement = 0 then continue; end if;
    -- Checked before writing: the stock >= 0 constraint would otherwise refuse
    -- the update first, with a message written for a database administrator.
    select id, stock into moved_id, left_on_shelf from public.inventory
      where id = product_key::bigint for update;
    if not found then raise exception 'One of the products on this order is not on the shelf list.'; end if;
    if left_on_shelf + movement < 0 then
      raise exception 'There is not enough of one of these products left to do that.';
    end if;
    -- What is promised to orders written earlier stays theirs. Taking it is a
    -- manager's decision, not something that happens because this order was
    -- marked done or loaded first.
    if movement < 0 and p_action in ('complete', 'dispatch') and actor.role not in ('Admin', 'Manager') then
      ahead := private.reserved_before(moved_id, ord);
      if left_on_shelf + movement < ahead then
        raise exception 'Only % of these are free for this order: % on the shelf are promised to orders written before it. A manager can let this order go first.',
          greatest(left_on_shelf - ahead, 0)::bigint, ahead::bigint;
      end if;
    end if;
    update public.inventory set stock = stock + movement::integer where id = moved_id;
    touched := touched || moved_id;
  end loop;

  update public.orders set
    items = next_items,
    status = coalesce(patch ->> 'status', status),
    stock_committed_at = case when patch ? 'stockCommittedAt'
      then nullif(patch ->> 'stockCommittedAt', '')::timestamptz else stock_committed_at end,
    backorder_status = coalesce(patch ->> 'backorderStatus', backorder_status),
    refunded_amount = coalesce((patch ->> 'refundedAmount')::numeric, refunded_amount),
    refund_history = coalesce(next_refunds, refund_history)
  where id = v_order_id returning * into ord;

  if v_delivery_id is not null then
    update public.deliveries set
      status = p_data -> 'delivery' ->> 'status',
      items_manifest = coalesce(p_data -> 'delivery' -> 'itemsManifest', items_manifest)
    where id = v_delivery_id returning * into dlv;
  end if;

  -- A run that went out short raises the run for what was left behind in the
  -- same transaction, so the goods can never be owed with nothing on the board
  -- to carry them. No second charge: the shortfall was the shop's.
  if p_action = 'dispatch' and jsonb_typeof(p_data -> 'followUp') = 'object' then
    select string_agg(format('%s × %s', l.owed, coalesce(l.line ->> 'name', 'item')), ', ' order by l.pos) into left_behind
    from (
      select t.line, t.pos,
        (private.order_line_shape(jsonb_build_array(t.line)) -> 0 ->> 'stockUnits')::numeric
          - private.order_num(t.line ->> 'committedUnits') - private.order_num(t.line ->> 'voidedUnits') as owed
      from jsonb_array_elements(ord.items) with ordinality as t(line, pos)
    ) l
    where l.owed > 0;
    if left_behind is not null then
      if char_length(coalesce(p_data -> 'followUp' ->> 'driver', '')) > 120 then
        raise exception 'Keep the driver''s name under 120 characters.';
      end if;
      if coalesce(p_data -> 'followUp' ->> 'dueOn', '') <> '' and p_data -> 'followUp' ->> 'dueOn' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise exception 'Enter the promised date for what was left behind as a calendar date.';
      end if;
      insert into public.deliveries (order_id, product, size, location, amount, status, driver, due_on,
          parent_delivery_id, items_manifest, created_at)
        values (ord.id, 'Order #' || ord.id || ' - ' || ord.customer_name || ' (backorder)', left_behind,
          dlv.location, 0, 'Not Yet Delivered', nullif(btrim(p_data -> 'followUp' ->> 'driver'), ''),
          nullif(p_data -> 'followUp' ->> 'dueOn', '')::date, dlv.id, '[]'::jsonb, now())
        returning * into follow_up;
    end if;
  end if;

  -- A run that never left is a plan, and the plan is off with the order. A run
  -- that went out is the record of a journey and stays.
  if p_action = 'cancel' then
    with gone as (
      delete from public.deliveries d
      where (d.order_id = v_order_id
          or (d.order_id is null and starts_with(d.product, 'Order #' || v_order_id || ' - ')))
        and d.status not in ('On The Way', 'Delivered')
        and jsonb_array_length(coalesce(d.items_manifest, '[]'::jsonb)) = 0
      returning d.id)
    select coalesce(jsonb_agg(id), '[]'::jsonb) into removed from gone;
  end if;

  result := jsonb_build_object('order', to_jsonb(ord),
    'delivery', case when dlv.id is not null then to_jsonb(dlv) else null end,
    'followUp', case when follow_up.id is not null then to_jsonb(follow_up) else null end,
    'removedDeliveries', removed,
    'inventory', coalesce((select jsonb_agg(to_jsonb(i) order by i.id)
      from public.inventory i where i.id = any(touched)), '[]'::jsonb));
  insert into private.order_requests(request_id, actor_id, action, payload, result)
    values (p_request_id, actor.id, p_action, p_data, result);
  return result;
end;
$fn$;
revoke all on function private.order_command(text, jsonb, uuid) from public, anon;
grant execute on function private.order_command(text, jsonb, uuid) to authenticated;

-- The signed-in person's name, for stamping a record. SECURITY DEFINER for the
-- same reason as caller_role: the guards that call it run as the caller.
create or replace function private.caller_name()
returns text language sql stable security definer set search_path = '' as $fn$
  select s.name from public.staff s
  where lower(s.email) = lower((select auth.jwt()) ->> 'email') and s.status = 'Active'
  limit 1;
$fn$;
revoke all on function private.caller_name() from public, anon;
grant execute on function private.caller_name() to authenticated;

-- ============================================================
-- Orders: a total moves only with a recorded price correction
-- ============================================================
-- guard_order_direct_write, as before, plus the rule on the total.
create or replace function private.guard_order_direct_write()
returns trigger language plpgsql set search_path = '' as $fn$
declare
  was jsonb;
  now_is jsonb;
  kept integer;
  appended integer;
  entry jsonb;
  who text;
  untouched boolean;
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
  kept := case when jsonb_typeof(old.price_adjustments) = 'array' then jsonb_array_length(old.price_adjustments) else 0 end;
  if jsonb_typeof(old.price_adjustments) = 'array' then
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

  -- A total that moves is explained. While nothing has happened to an order
  -- -- still waiting, nothing sent, refunded or price-corrected -- rewriting
  -- it rewrites its total too, and that is the order editor's job. After
  -- that the total moves only with a price correction that names the total
  -- it changed from and to. Who made it, and when, is the database's to say.
  appended := case when jsonb_typeof(new.price_adjustments) = 'array'
    then jsonb_array_length(new.price_adjustments) - kept else 0 end;
  if appended > 1 then
    raise exception 'Correct the price one change at a time.';
  end if;
  if appended = 1 then
    entry := new.price_adjustments -> (jsonb_array_length(new.price_adjustments) - 1);
    if round(private.order_num(entry ->> 'newTotal'), 2) <> round(coalesce(new.total_amount, 0), 2)
       or round(private.order_num(entry ->> 'oldTotal'), 2) <> round(coalesce(old.total_amount, 0), 2) then
      raise exception 'A price correction has to give the total it changed from and the total it changed to.';
    end if;
    who := private.caller_name();
    new.price_adjustments := jsonb_set(new.price_adjustments,
      array[(jsonb_array_length(new.price_adjustments) - 1)::text],
      entry || jsonb_build_object('changedBy', coalesce(who, entry ->> 'changedBy'), 'changedAt', now()));
  elsif new.total_amount is distinct from old.total_amount then
    untouched := old.status = 'Pending' and old.stock_committed_at is null and kept = 0
      and coalesce(jsonb_array_length(case when jsonb_typeof(old.refund_history) = 'array' then old.refund_history end), 0) = 0
      and not exists (select 1 from jsonb_array_elements(was) c
        where (c ->> 0)::numeric <> 0 or (c ->> 1)::numeric <> 0);
    if not untouched then
      raise exception 'The total on this order changes only with "Fix the price", which keeps the old total and the reason.';
    end if;
  end if;
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
-- Deliveries: a run comes back through return_run
-- ============================================================
-- guard_delivery_direct_write, as before, plus the step back from "On The
-- Way" for a waiting order's loaded run.
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
    -- A run that went out carrying an order's goods and comes back undelivered
    -- has its goods put back on the shelf by order_command's return_run.
    if old.status = 'On The Way' and new.status = 'Ready To Go' and order_status = 'Pending'
       and jsonb_typeof(old.items_manifest) = 'array' and jsonb_array_length(old.items_manifest) > 0 then
      raise exception 'Use "Came back undelivered" on the delivery, so what it carried goes back on the shelf.';
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

-- Deliveries carry the customer's address, so the roles that may not read one
-- (Production Staff) may not write one either. Reading was narrowed by the
-- QA-BUG-20261018-01 fix; writing was left open, which let production write
-- rows it could not then see.
drop policy if exists "Active staff insert deliveries" on public.deliveries;
drop policy if exists "Active staff update deliveries" on public.deliveries;
drop policy if exists "Customer roles insert deliveries" on public.deliveries;
drop policy if exists "Customer roles update deliveries" on public.deliveries;
create policy "Customer roles insert deliveries" on public.deliveries for insert
  with check ((select private.caller_role()) in ('Admin', 'Manager', 'Sales Staff', 'Delivery Staff'));
create policy "Customer roles update deliveries" on public.deliveries for update
  using ((select private.caller_role()) in ('Admin', 'Manager', 'Sales Staff', 'Delivery Staff'))
  with check ((select private.caller_role()) in ('Admin', 'Manager', 'Sales Staff', 'Delivery Staff'));

-- ============================================================
-- Products: one per code, removed and put back only through their functions
-- ============================================================
do $migration$
begin
  if exists (select 1 from public.products group by lower(item_code) having count(*) > 1) then
    raise notice 'products has item codes that differ only in capitals; products_item_code_lower_key was not created. Run supabase/integrity_check.sql.';
  else
    create unique index if not exists products_item_code_lower_key on public.products (lower(item_code));
  end if;
end;
$migration$;

-- The catalogue entry and its stock row are joined on code, so a code that
-- changes under them disconnects the product from its stock and history.
-- Whether a product is on sale is remove_product's and restore_product's.
create or replace function private.guard_product_identity()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_table_name = 'products' then
    if tg_op = 'INSERT' then
      if new.status is distinct from 'Active' then
        raise exception 'A new product starts on sale.';
      end if;
      return new;
    end if;
    if lower(new.item_code) is distinct from lower(old.item_code) then
      raise exception 'A product''s code cannot be changed: its stock and history are filed under it.';
    end if;
    if new.status is distinct from old.status then
      raise exception 'A product is taken off sale with "Remove" and put back with "Put it back on sale", by an administrator.';
    end if;
  elsif tg_op = 'UPDATE' and lower(new.sku) is distinct from lower(old.sku) then
    raise exception 'A stock record''s code cannot be changed: it is how the product finds its stock.';
  end if;
  return new;
end;
$fn$;
revoke all on function private.guard_product_identity() from public, anon;
grant execute on function private.guard_product_identity() to authenticated;
drop trigger if exists products_guard_identity on public.products;
create trigger products_guard_identity before insert or update on public.products
  for each row execute function private.guard_product_identity();
drop trigger if exists inventory_guard_identity on public.inventory;
create trigger inventory_guard_identity before update of sku on public.inventory
  for each row execute function private.guard_product_identity();

-- A product or its stock row is removed only by remove_product, which archives
-- one with any history and refuses while an order is waiting for it. The
-- direct DELETE policies let an administrator skip all of that.
drop policy if exists "Admins delete products" on public.products;
drop policy if exists "Admins delete inventory" on public.inventory;

-- An archived product goes back on sale. Same hand as archiving it.
create or replace function public.restore_product(p_product_id bigint, p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare product public.products;
begin
  if (select private.caller_role()) is distinct from 'Admin' then
    raise exception 'Only an administrator can put a product back on sale.';
  end if;
  select * into product from public.products where id = p_product_id for update;
  if not found then raise exception 'That product no longer exists.'; end if;
  if product.revision is distinct from p_expected_revision then
    raise exception using errcode = '40001', message = 'This product changed. Refresh it before trying again.';
  end if;
  update public.products set status = 'Active', updated_at = now() where id = product.id;
  return jsonb_build_object('outcome', 'restored');
end;
$fn$;
revoke all on function public.restore_product(bigint, bigint) from public, anon;
grant execute on function public.restore_product(bigint, bigint) to authenticated;

-- ============================================================
-- Batch output: at most twice what was planned
-- ============================================================
-- A slip of the keyboard on "Pieces made" put a million pieces on the shelf
-- from one block. Real batches come in above their target -- the most so far
-- is 1.7 times -- so the line is drawn at twice. Where more really came out,
-- a manager changes the batch's target (edit_batch) and it is finished again.
-- A request already saved is not re-checked: its retry replays.
create or replace function private.guard_batch_output(p_data jsonb, p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $fn$
declare
  batch public.production_batches;
  made bigint;
begin
  if p_request_id is not null
     and exists (select 1 from private.workshop_requests where request_id = p_request_id) then
    return;
  end if;
  if coalesce(p_data ->> 'id', '') !~ '^[0-9]{1,18}$' or coalesce(p_data ->> 'produced', '') !~ '^[0-9]{1,10}$' then
    return; -- workshop_precheck and workshop_command say what is wrong
  end if;
  select * into batch from public.production_batches where id = (p_data ->> 'id')::bigint;
  if not found then return; end if;
  made := (p_data ->> 'produced')::bigint;
  if made > 2 * batch.target_output_qty::bigint then
    raise exception '% pieces is more than twice the % planned for %. If that many really came out, a manager changes the batch''s target first.',
      made, batch.target_output_qty, batch.batch_code;
  end if;
end;
$fn$;
revoke all on function private.guard_batch_output(jsonb, uuid) from public, anon;
grant execute on function private.guard_batch_output(jsonb, uuid) to authenticated;

create or replace function public.workshop_command(p_action text, p_data jsonb, p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $fn$
begin
  if p_action in ('batch_step_back', 'cancel_batch', 'edit_batch', 'delete_batch', 'reopen_batch',
                  'cancel_supplier_order', 'delete_supplier_order', 'delete_recipe') then
    return private.workshop_corrections(p_action, p_data, p_request_id);
  end if;
  perform private.workshop_precheck(p_action, p_data, p_request_id);
  if p_action = 'complete_batch' then
    perform private.guard_batch_output(p_data, p_request_id);
  end if;
  if p_action = 'save_order' then
    perform private.refuse_archived_supplier(p_data, p_request_id);
    perform private.amend_supplier_order(p_data, p_request_id);
  end if;
  return private.workshop_command(p_action, p_data, p_request_id);
end;
$fn$;
revoke all on function public.workshop_command(text, jsonb, uuid) from public, anon;
grant execute on function public.workshop_command(text, jsonb, uuid) to authenticated;
