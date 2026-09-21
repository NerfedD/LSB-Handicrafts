-- Review follow-up for BUG-01/02/05/06. Apply before the updated client.
-- Locks serialize writes; revisions also reject arithmetic from stale browsers.
alter table public.orders add column if not exists revision bigint not null default 0;
alter table public.deliveries add column if not exists revision bigint not null default 0;

create or replace function private.bump_record_revision()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  new.revision := old.revision + 1;
  return new;
end;
$fn$;
revoke all on function private.bump_record_revision() from public, anon, authenticated;
drop trigger if exists orders_revision on public.orders;
create trigger orders_revision before update on public.orders
  for each row execute function private.bump_record_revision();
drop trigger if exists deliveries_revision on public.deliveries;
create trigger deliveries_revision before update on public.deliveries
  for each row execute function private.bump_record_revision();

-- Normalization may add default fields, but cannot alter the agreed line.
-- The original guard compared only product, quantity and unit price.
create or replace function private.order_line_shape(items jsonb)
returns jsonb language sql immutable set search_path = '' as $fn$
  select coalesce(jsonb_agg(jsonb_build_object(
    'productId', nullif(line ->> 'productId', ''),
    'kind', coalesce(nullif(line ->> 'kind', ''), case when line ->> 'productId' is not null then 'catalog' else 'custom' end),
    'name', coalesce(line ->> 'name', ''),
    'notes', coalesce(line ->> 'notes', ''),
    'quantity', private.order_num(line ->> 'quantity'),
    'unitPrice', private.order_num(coalesce(line ->> 'unitPrice', line ->> 'price')),
    'listPrice', line -> 'listPrice',
    'lineTotal', coalesce((line ->> 'lineTotal')::numeric,
      private.order_num(coalesce(line ->> 'unitPrice', line ->> 'price')) * private.order_num(line ->> 'quantity')),
    'stockUnits', coalesce((line ->> 'stockUnits')::numeric,
      case when coalesce(line ->> 'kind', case when line ->> 'productId' is not null then 'catalog' else 'custom' end) = 'custom'
        then 0 else private.order_num(line ->> 'quantity') end)
  ) order by ord), '[]'::jsonb)
  from jsonb_array_elements(items) with ordinality as t(line, ord);
$fn$;
revoke all on function private.order_line_shape(jsonb) from public, anon;
grant execute on function private.order_line_shape(jsonb) to authenticated;

create or replace function private.order_command(p_action text, p_data jsonb, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  actor public.staff;
  ord public.orders;
  dlv public.deliveries;
  previous private.order_requests;
  result jsonb;
  delta jsonb;
  order_id bigint;
  delivery_id bigint;
  moved_id bigint;
  left_on_shelf integer;
  touched bigint[] := '{}';
  patch jsonb := coalesce(p_data -> 'order', '{}'::jsonb);
  next_items jsonb;
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

  order_id := nullif(p_data ->> 'orderId', '')::bigint;
  delivery_id := nullif(p_data ->> 'deliveryId', '')::bigint;
  select * into ord from public.orders where id = order_id for update;
  if not found then raise exception 'That order no longer exists.'; end if;
  if ord.revision is distinct from (p_data ->> 'expectedRevision')::bigint then
    raise exception using errcode = '40001', message = 'This order changed. Refresh it before trying again.';
  end if;

  if delivery_id is not null then
    select * into dlv from public.deliveries where id = delivery_id for update;
    if not found then raise exception 'That delivery no longer exists.'; end if;
    if dlv.revision is distinct from (p_data ->> 'expectedDeliveryRevision')::bigint then
      raise exception using errcode = '40001', message = 'This delivery changed. Refresh it before trying again.';
    end if;
    if not starts_with(dlv.product, 'Order #' || order_id || ' - ') then
      raise exception 'That delivery belongs to a different order.';
    end if;
  end if;

  if p_action in ('refund', 'cancel', 'reopen') and actor.role not in ('Admin', 'Manager') then
    raise exception 'Only an administrator or a manager can do that.';
  end if;
  if p_action <> 'refund' and patch ?| array['refundedAmount', 'refundHistory', 'totalAmount'] then
    raise exception 'Money changes must use the refund or price correction controls.';
  end if;
  if p_action not in ('dispatch', 'arrive') and (delivery_id is not null or p_data ? 'delivery') then
    raise exception 'This action cannot change a delivery.';
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

  -- All callers lock shared shelf rows in the same order to avoid deadlocks.
  for product_key, movement in
    select key, value::numeric from jsonb_each_text(received_deltas) order by key::bigint
  loop
    if movement = 0 then continue; end if;
    update public.inventory set stock = stock + movement::integer where id = product_key::bigint
      returning id, stock into moved_id, left_on_shelf;
    if not found then raise exception 'One of the products on this order is not on the shelf list.'; end if;
    if left_on_shelf < 0 then raise exception 'There is not enough of one of these products left to do that.'; end if;
    touched := touched || moved_id;
  end loop;

  update public.orders set
    items = next_items,
    status = coalesce(patch ->> 'status', status),
    stock_committed_at = case when patch ? 'stockCommittedAt'
      then nullif(patch ->> 'stockCommittedAt', '')::timestamptz else stock_committed_at end,
    backorder_status = coalesce(patch ->> 'backorderStatus', backorder_status),
    refunded_amount = coalesce((patch ->> 'refundedAmount')::numeric, refunded_amount),
    refund_history = coalesce(patch -> 'refundHistory', refund_history)
  where id = order_id returning * into ord;

  if delivery_id is not null then
    update public.deliveries set
      status = p_data -> 'delivery' ->> 'status',
      items_manifest = coalesce(p_data -> 'delivery' -> 'itemsManifest', items_manifest)
    where id = delivery_id returning * into dlv;
  end if;

  result := jsonb_build_object('order', to_jsonb(ord),
    'delivery', case when dlv.id is not null then to_jsonb(dlv) else null end,
    'inventory', coalesce((select jsonb_agg(to_jsonb(i) order by i.id)
      from public.inventory i where i.id = any(touched)), '[]'::jsonb));
  insert into private.order_requests(request_id, actor_id, action, payload, result)
    values (p_request_id, actor.id, p_action, p_data, result);
  return result;
end;
$fn$;
revoke all on function private.order_command(text, jsonb, uuid) from public, anon;
grant execute on function private.order_command(text, jsonb, uuid) to authenticated;
