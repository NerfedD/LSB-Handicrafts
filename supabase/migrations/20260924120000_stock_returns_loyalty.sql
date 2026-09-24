-- Stock ledger, damage, replacements, loyalty and role boundaries.
--
-- Non-destructive: it adds tables, columns, functions, policies and
-- constraints. No row is deleted or overwritten except the documented backfill
-- of deliveries.order_id from the existing "Order #N - " text. Safe to re-run.
-- Apply before deploying the matching client, then refresh open browser tabs.
-- Mirrored at the end of schema.sql (schemaInstall.test.js checks the copy).

-- ============================================================
-- Who is calling
-- ============================================================
-- The caller's role when they hold an Active staff row, otherwise null. Used by
-- the policies below; wrapped in (select ...) there so it runs once per
-- statement rather than once per row.
create or replace function private.caller_role()
returns text language sql stable security definer set search_path = '' as $fn$
  select s.role from public.staff s
  where lower(s.email) = lower((select auth.jwt()) ->> 'email') and s.status = 'Active'
  limit 1;
$fn$;
revoke all on function private.caller_role() from public, anon;
grant execute on function private.caller_role() to authenticated;

-- ============================================================
-- Stock movements: one row for every change to a shelf count
-- ============================================================
-- Written by a trigger on inventory and raw_materials, so no path that moves
-- stock can forget to record it. The trusted functions below say WHY by
-- setting a transaction-local context first; a change made with no context
-- (the SQL editor, say) is still recorded, as an adjustment.
create table if not exists public.stock_movements (
  id bigint primary key default nextval('private.record_id_seq'),
  inventory_id bigint references public.inventory(id) on delete set null,
  raw_material_id bigint references public.raw_materials(id) on delete set null,
  -- Snapshots, so the history still reads correctly after a rename or delete.
  item_code text not null,
  item_name text not null,
  quantity_change integer not null check (quantity_change <> 0),
  balance_after integer not null check (balance_after >= 0),
  kind text not null check (kind in (
    'opening', 'sale', 'dispatch', 'cancellation', 'return', 'replacement',
    'damage', 'adjustment', 'delivery', 'production', 'production_use', 'transfer')),
  reason text check (reason is null or char_length(reason) <= 200),
  note text check (note is null or char_length(note) <= 500),
  order_id bigint references public.orders(id) on delete set null,
  supplier_order_id bigint references public.raw_material_orders(id) on delete set null,
  batch_id bigint references public.production_batches(id) on delete set null,
  actor_staff_id bigint references public.staff(id) on delete set null,
  actor_name text not null,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_inventory_idx
  on public.stock_movements (inventory_id, created_at desc) where inventory_id is not null;
create index if not exists stock_movements_material_idx
  on public.stock_movements (raw_material_id, created_at desc) where raw_material_id is not null;
create index if not exists stock_movements_order_idx
  on public.stock_movements (order_id) where order_id is not null;
create index if not exists stock_movements_kind_idx on public.stock_movements (kind, created_at desc);
create index if not exists stock_movements_supplier_order_idx
  on public.stock_movements (supplier_order_id) where supplier_order_id is not null;
create index if not exists stock_movements_batch_idx
  on public.stock_movements (batch_id) where batch_id is not null;
create index if not exists stock_movements_actor_idx
  on public.stock_movements (actor_staff_id) where actor_staff_id is not null;

alter table public.stock_movements enable row level security;
revoke all on public.stock_movements from public, anon, authenticated;
grant select on public.stock_movements to authenticated;
drop policy if exists "Active staff read stock movements" on public.stock_movements;
create policy "Active staff read stock movements" on public.stock_movements for select
  to authenticated using ((select private.is_active_staff()));

create or replace function private.set_stock_context(
  p_kind text, p_reason text default null, p_note text default null,
  p_order_id bigint default null, p_supplier_order_id bigint default null, p_batch_id bigint default null)
returns void language sql volatile set search_path = '' as $fn$
  select set_config('lsb.movement', jsonb_build_object(
    'kind', p_kind, 'reason', p_reason, 'note', p_note, 'order_id', p_order_id,
    'supplier_order_id', p_supplier_order_id, 'batch_id', p_batch_id)::text, true);
$fn$;
revoke all on function private.set_stock_context(text, text, text, bigint, bigint, bigint) from public, anon, authenticated;

create or replace function private.record_stock_movement()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare
  ctx jsonb := nullif(current_setting('lsb.movement', true), '')::jsonb;
  delta integer;
  actor_id bigint;
  actor text;
begin
  if tg_op = 'INSERT' then delta := new.stock; else delta := new.stock - old.stock; end if;
  if delta = 0 then return new; end if;
  select s.id, s.name into actor_id, actor from public.staff s
    where lower(s.email) = lower((select auth.jwt()) ->> 'email') and s.status = 'Active' limit 1;
  insert into public.stock_movements(inventory_id, raw_material_id, item_code, item_name,
    quantity_change, balance_after, kind, reason, note, order_id, supplier_order_id, batch_id,
    actor_staff_id, actor_name)
  values (
    case when tg_table_name = 'inventory' then new.id end,
    case when tg_table_name = 'raw_materials' then new.id end,
    new.sku, new.name, delta, new.stock,
    coalesce(ctx ->> 'kind', case when tg_op = 'INSERT' then 'opening' else 'adjustment' end),
    ctx ->> 'reason', ctx ->> 'note',
    (ctx ->> 'order_id')::bigint, (ctx ->> 'supplier_order_id')::bigint, (ctx ->> 'batch_id')::bigint,
    actor_id, coalesce(actor, nullif((select auth.jwt()) ->> 'email', ''), 'System'));
  return new;
end;
$fn$;
revoke all on function private.record_stock_movement() from public, anon, authenticated;

-- The history starts from the counts as they stand: one opening entry for each
-- item that has stock and no history yet (so a re-run adds nothing). Changes
-- made before this migration remain in the activity log.
insert into public.stock_movements (inventory_id, item_code, item_name, quantity_change, balance_after, kind, note, actor_name)
select i.id, i.sku, i.name, i.stock, i.stock, 'opening', 'Count when the stock history began', 'System'
from public.inventory i
where i.stock > 0 and not exists (select 1 from public.stock_movements m where m.inventory_id = i.id);
insert into public.stock_movements (raw_material_id, item_code, item_name, quantity_change, balance_after, kind, note, actor_name)
select r.id, r.sku, r.name, r.stock, r.stock, 'opening', 'Count when the stock history began', 'System'
from public.raw_materials r
where r.stock > 0 and not exists (select 1 from public.stock_movements m where m.raw_material_id = r.id);

drop trigger if exists inventory_stock_movement on public.inventory;
create trigger inventory_stock_movement after insert or update of stock on public.inventory
  for each row execute function private.record_stock_movement();
drop trigger if exists raw_materials_stock_movement on public.raw_materials;
create trigger raw_materials_stock_movement after insert or update of stock on public.raw_materials
  for each row execute function private.record_stock_movement();

-- A shelf count moves only through a recorded, reasoned command. The browser
-- used to overwrite `stock` from the product form with an absolute number and
-- no reason. SECURITY INVOKER on purpose: inside the trusted functions
-- current_user is their owner, while a direct API write is `authenticated`.
create or replace function private.guard_direct_stock_change()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  if current_user in ('authenticated', 'anon') and new.stock is distinct from old.stock then
    raise exception 'Stock counts change only through a recorded movement. Use "Correct the count" or "Record damage".';
  end if;
  return new;
end;
$fn$;
revoke all on function private.guard_direct_stock_change() from public, anon, authenticated;
drop trigger if exists inventory_guard_stock on public.inventory;
create trigger inventory_guard_stock before update of stock on public.inventory
  for each row execute function private.guard_direct_stock_change();

-- ============================================================
-- stock_command: damage and count corrections
-- ============================================================
-- Same shape as order_command and workshop_command: one transaction, locked
-- rows, and a request id so a retried request replays its first answer rather
-- than deducting twice.
--
-- Raw material stock is also held as lots (oldest used first by production),
-- and the two must agree, so a decrease consumes lots oldest-first and an
-- increase opens a correction lot.
create table if not exists private.stock_requests (
  request_id uuid primary key,
  actor_id bigint not null,
  action text not null,
  payload jsonb not null,
  result jsonb not null,
  at timestamptz not null default now()
);
alter table private.stock_requests enable row level security;
revoke all on private.stock_requests from public, anon, authenticated;

create or replace function private.stock_command(p_action text, p_data jsonb, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  actor public.staff;
  previous private.stock_requests;
  result jsonb;
  target text := p_data ->> 'target';
  record_id bigint;
  amount integer;
  expected integer;
  delta integer;
  reason text := nullif(btrim(p_data ->> 'reason'), '');
  note text := nullif(btrim(p_data ->> 'note'), '');
  item public.inventory;
  mat public.raw_materials;
  lot public.raw_material_lots;
  take integer;
  left_to_take integer;
begin
  if auth.uid() is null then raise exception 'Please sign in again.'; end if;
  select * into actor from public.staff
    where lower(email) = lower(auth.jwt() ->> 'email') and status = 'Active';
  if actor.id is null then raise exception 'An active staff account is needed.'; end if;
  if p_request_id is null then raise exception 'A request reference is needed.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into previous from private.stock_requests where request_id = p_request_id;
  if found then
    if previous.actor_id <> actor.id or previous.action is distinct from p_action
       or previous.payload is distinct from p_data then
      raise exception 'This request has changed. Close the form and try again.';
    end if;
    return previous.result;
  end if;

  if p_action = 'record_damage' then
    if actor.role not in ('Admin', 'Manager', 'Production Staff') then
      raise exception 'Only production staff, managers or administrators can record damaged stock.';
    end if;
    if reason is null or reason not in ('broken', 'crushed', 'water', 'handling', 'other') then
      raise exception 'Choose what happened to the damaged stock.';
    end if;
  elsif p_action = 'correct_count' then
    if actor.role not in ('Admin', 'Manager') then
      raise exception 'Only a manager or administrator can correct a stock count.';
    end if;
    if reason is null or reason not in ('recount', 'found', 'missing', 'entry-error', 'other') then
      raise exception 'Choose why the count is being corrected.';
    end if;
  else
    raise exception 'That stock action is not supported.';
  end if;
  if reason = 'other' and note is null then
    raise exception 'Write a short note when the reason is "Something else".';
  end if;
  if char_length(coalesce(note, '')) > 500 then raise exception 'Keep the note under 500 characters.'; end if;
  if target is null or target not in ('product', 'material') then
    raise exception 'Choose a product or a raw material.';
  end if;
  if coalesce(p_data ->> 'id', '') !~ '^[0-9]{1,18}$' then raise exception 'Which item is not clear.'; end if;
  record_id := (p_data ->> 'id')::bigint;
  if coalesce(p_data ->> 'quantity', '') !~ '^[0-9]{1,10}$' then
    raise exception 'Enter a whole number.';
  end if;
  amount := least((p_data ->> 'quantity')::bigint, 2000000000)::integer;

  if target = 'product' then
    select * into item from public.inventory where id = record_id for update;
    if not found then raise exception 'That stock record no longer exists.'; end if;
    if p_action = 'record_damage' then
      if amount < 1 then raise exception 'Enter how many were damaged.'; end if;
      if amount > item.stock then
        raise exception 'Only % on the shelf, so % cannot be written off.', item.stock, amount;
      end if;
      delta := -amount;
    else
      expected := nullif(p_data ->> 'expectedStock', '')::integer;
      if expected is distinct from item.stock then
        raise exception using errcode = '40001',
          message = 'The shelf count changed since you opened this. Close it and look again.';
      end if;
      delta := amount - item.stock;
    end if;
  else
    select * into mat from public.raw_materials where id = record_id for update;
    if not found then raise exception 'That raw material no longer exists.'; end if;
    if p_action = 'record_damage' then
      if amount < 1 then raise exception 'Enter how many were damaged.'; end if;
      if amount > mat.stock then
        raise exception 'Only % on the shelf, so % cannot be written off.', mat.stock, amount;
      end if;
      delta := -amount;
    else
      expected := nullif(p_data ->> 'expectedStock', '')::integer;
      if expected is distinct from mat.stock then
        raise exception using errcode = '40001',
          message = 'The shelf count changed since you opened this. Close it and look again.';
      end if;
      delta := amount - mat.stock;
    end if;
  end if;
  if delta = 0 then raise exception 'That is already the count on record.'; end if;

  perform private.set_stock_context(
    case when p_action = 'record_damage' then 'damage' else 'adjustment' end, reason, note);

  if target = 'product' then
    update public.inventory set stock = stock + delta where id = item.id returning * into item;
    result := jsonb_build_object('target', 'product', 'inventory', to_jsonb(item));
  else
    if delta < 0 then
      left_to_take := -delta;
      for lot in select * from public.raw_material_lots
          where raw_material_id = mat.id and remaining > 0 order by id for update loop
        exit when left_to_take = 0;
        take := least(left_to_take, lot.remaining);
        update public.raw_material_lots set remaining = remaining - take where id = lot.id;
        left_to_take := left_to_take - take;
      end loop;
      if left_to_take <> 0 then
        raise exception 'The material lot counts do not match. Ask a manager to check them.';
      end if;
    else
      insert into public.raw_material_lots(raw_material_id, quantity, remaining, source)
        values (mat.id, delta, delta, 'Count correction');
    end if;
    update public.raw_materials set stock = stock + delta, updated_at = now()
      where id = mat.id returning * into mat;
    result := jsonb_build_object('target', 'material', 'material', to_jsonb(mat));
  end if;

  insert into private.stock_requests(request_id, actor_id, action, payload, result)
    values (p_request_id, actor.id, p_action, p_data, result);
  return result;
end;
$fn$;
revoke all on function private.stock_command(text, jsonb, uuid) from public, anon;
grant execute on function private.stock_command(text, jsonb, uuid) to authenticated;

create or replace function public.stock_command(p_action text, p_data jsonb, p_request_id uuid)
returns jsonb language sql security invoker set search_path = '' as $fn$
  select private.stock_command(p_action, p_data, p_request_id);
$fn$;
revoke all on function public.stock_command(text, jsonb, uuid) from public, anon;
grant execute on function public.stock_command(text, jsonb, uuid) to authenticated;

-- ============================================================
-- Supplier deliveries carry the supplier's own reference
-- ============================================================
alter table public.raw_material_orders add column if not exists delivery_reference text;
alter table public.raw_material_orders drop constraint if exists raw_material_orders_reference_len;
alter table public.raw_material_orders add constraint raw_material_orders_reference_len
  check (delivery_reference is null or char_length(delivery_reference) <= 80);

-- workshop_command, unchanged except that receiving stores the reference and
-- every stock update states its movement kind first.
create or replace function private.workshop_command(p_action text, p_data jsonb, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  actor public.staff; mat public.raw_materials; po public.raw_material_orders;
  batch public.production_batches; item public.inventory; product public.products;
  lot public.raw_material_lots; previous private.workshop_requests;
  result jsonb; record_id bigint; qty integer; damaged integer; good integer; reserved bigint;
  remaining_qty integer; take_qty integer; reason text; message text; subject text; reference text;
begin
  if auth.uid() is null then raise exception 'Please sign in again.'; end if;
  select * into actor from public.staff where lower(email)=lower(auth.jwt()->>'email') and status='Active';
  if actor.id is null then raise exception 'An active staff account is needed.'; end if;
  if p_request_id is null then raise exception 'A request reference is needed.'; end if;
  -- Serialize request retries before reading the idempotency record.
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into previous from private.workshop_requests where request_id=p_request_id;
  if found then
    if previous.actor_id <> actor.id or previous.action <> p_action or previous.payload <> p_data then
      raise exception 'This request has changed. Close the form and try again.';
    end if;
    return previous.result;
  end if;
  if p_action in ('save_material','save_order','order_status','save_recipe','review_claim','transfer_stock') and actor.role not in ('Admin','Manager') then
    raise exception 'Only a manager or administrator can approve this change.';
  end if;
  if p_action in ('start_batch','batch_status','complete_batch') and actor.role not in ('Admin','Manager','Production Staff') then
    raise exception 'Only production staff, managers or administrators can change a batch.';
  end if;
  record_id := nullif(p_data->>'id','')::bigint;
  reason := nullif(trim(p_data->>'reason'),'');

  case p_action
  when 'save_material' then
    if record_id is null then
      insert into public.raw_materials(sku,name,material_type,density,thickness_in,length_ft,width_ft,unit,low_stock_threshold)
      values (upper(trim(p_data->>'sku')),trim(p_data->>'name'),p_data->>'material_type',nullif(p_data->>'density','')::numeric,
        nullif(p_data->>'thickness_in','')::numeric,nullif(p_data->>'length_ft','')::numeric,nullif(p_data->>'width_ft','')::numeric,
        trim(p_data->>'unit'),(p_data->>'low_stock_threshold')::integer) returning * into mat;
    else
      update public.raw_materials set name=trim(p_data->>'name'),low_stock_threshold=(p_data->>'low_stock_threshold')::integer,updated_at=now()
      where id=record_id returning * into mat;
      if not found then raise exception 'This material no longer exists.'; end if;
    end if;
    result:=to_jsonb(mat); message:=format('saved raw material %s',mat.name); subject:=mat.sku;
  when 'save_order' then
    if record_id is not null then
      select * into po from public.raw_material_orders where id=record_id for update;
      if not found or po.status not in ('Ordered','Delivery Scheduled') then raise exception 'Only an order that has not left the supplier can be changed.'; end if;
    end if;
    if record_id is null then
      insert into public.raw_material_orders(supplier_id,raw_material_id,quantity_ordered,unit_price,expected_delivery_date,carrier_notes,status,created_by_staff_id)
      values ((p_data->>'supplier_id')::bigint,(p_data->>'raw_material_id')::bigint,(p_data->>'quantity_ordered')::integer,
        (p_data->>'unit_price')::numeric,nullif(p_data->>'expected_delivery_date','')::date,p_data->>'carrier_notes',
        case when nullif(p_data->>'expected_delivery_date','') is null then 'Ordered' else 'Delivery Scheduled' end,actor.id) returning * into po;
    else
      update public.raw_material_orders set expected_delivery_date=nullif(p_data->>'expected_delivery_date','')::date,
        carrier_notes=p_data->>'carrier_notes',status=case when nullif(p_data->>'expected_delivery_date','') is null then 'Ordered' else 'Delivery Scheduled' end
      where id=record_id returning * into po;
    end if;
    result:=to_jsonb(po); message:=format('saved supplier order #%s for %s material units',po.id,po.quantity_ordered);
  when 'order_status' then
    select * into po from public.raw_material_orders where id=record_id for update;
    if not found or not ((po.status='Delivery Scheduled' and p_data->>'status'='In Transit') or
      (po.status in ('Ordered','Delivery Scheduled') and p_data->>'status'='Cancelled')) then raise exception 'This supplier order cannot move to that step.'; end if;
    update public.raw_material_orders set status=p_data->>'status' where id=record_id returning * into po;
    result:=to_jsonb(po); message:=format('marked supplier order #%s as %s',po.id,po.status);
  when 'receive_delivery' then
    select * into po from public.raw_material_orders where id=record_id for update;
    if not found or po.status not in ('Ordered','Delivery Scheduled','In Transit') then raise exception 'This delivery is already received or cancelled.'; end if;
    qty:=(p_data->>'arrived')::integer; damaged:=(p_data->>'damaged')::integer;
    if qty is null or damaged is null or qty<0 or qty>2000000000 or damaged<0 or damaged>qty then raise exception 'Check the arrived and damaged counts.'; end if;
    if damaged>0 and (reason is null or reason not in ('Broken edges/corners','Crushed by strap/cargo','Water/dirt damage','Wrong density/thickness')) then raise exception 'Choose why the delivery was damaged.'; end if;
    reference:=nullif(btrim(p_data->>'reference'),'');
    if char_length(coalesce(reference,''))>80 then raise exception 'Keep the delivery reference under 80 characters.'; end if;
    select * into mat from public.raw_materials where id=po.raw_material_id for update;
    good:=qty-damaged;
    perform private.set_stock_context('delivery', null, reference, null, po.id, null);
    update public.raw_materials set stock=stock+good,updated_at=now() where id=mat.id;
    update public.raw_material_orders set status='Arrived',actual_delivery_date=(now() at time zone 'Asia/Manila')::date,
      quantity_arrived=qty,quantity_lost_transit=damaged,transit_loss_reason=case when damaged>0 then reason end,
      claim_status=case when qty<>quantity_ordered or damaged>0 then 'Needs review' else 'None' end,received_by_staff_id=actor.id,
      delivery_reference=reference
    where id=po.id returning * into po;
    if good>0 then insert into public.raw_material_lots(raw_material_id,order_id,quantity,remaining,source) values(mat.id,po.id,good,good,'Supplier delivery'); end if;
    result:=to_jsonb(po); subject:=mat.sku;
    message:=format('received %s %s of %s: %s usable, %s damaged; supplier claim: %s',qty,mat.unit,mat.name,good,damaged,po.claim_status);
  when 'review_claim' then
    if reason is null then raise exception 'Write how the supplier issue was settled.'; end if;
    update public.raw_material_orders set claim_status='Resolved',claim_notes=reason,claim_reviewed_by=actor.id,claim_reviewed_at=now()
    where id=record_id and claim_status='Needs review' returning * into po;
    if not found then raise exception 'This supplier claim no longer needs review.'; end if;
    result:=to_jsonb(po); message:=format('resolved supplier claim #%s: %s',po.id,reason);
  when 'save_recipe' then
    insert into public.production_recipes(product_id,raw_material_id,material_qty,output_qty)
    values((p_data->>'product_id')::bigint,(p_data->>'raw_material_id')::bigint,(p_data->>'material_qty')::integer,(p_data->>'output_qty')::integer)
    on conflict(product_id,raw_material_id) do update set material_qty=excluded.material_qty,output_qty=excluded.output_qty
    returning to_jsonb(production_recipes.*) into result;
    message:='saved a material recipe for production';
  when 'start_batch' then
    select * into product from public.products where id=(p_data->>'product_id')::bigint;
    if not found then raise exception 'Pick a finished product.'; end if;
    if (select count(*) from public.inventory where lower(sku)=lower(product.item_code)) <> 1 then raise exception 'This product needs one matching shelf record.'; end if;
    select * into item from public.inventory where lower(sku)=lower(product.item_code);
    qty:=(p_data->>'material_qty')::integer;
    select * into mat from public.raw_materials where id=(p_data->>'raw_material_id')::bigint for update;
    if not found then raise exception 'Pick the material for this batch.'; end if;
    select coalesce(sum(raw_material_used_qty),0) into reserved from public.production_batches where raw_material_id=mat.id and status in ('Queued','In Progress','Quality Check');
    if qty is null or qty<=0 or qty>mat.stock-reserved then raise exception 'There is not enough unallocated material for this batch.'; end if;
    if not exists(select 1 from public.staff where id=(p_data->>'assigned_staff_id')::bigint and status='Active' and role in ('Admin','Manager','Production Staff')) then raise exception 'Choose an active production worker or manager.'; end if;
    if nullif(p_data->>'order_id','') is not null and not exists(select 1 from public.orders where id=(p_data->>'order_id')::bigint and status='Pending') then raise exception 'Choose an order that is still waiting.'; end if;
    record_id:=nextval('private.workshop_id_seq');
    insert into public.production_batches(id,batch_code,target_product_id,inventory_id,raw_material_id,raw_material_used_qty,target_output_qty,assigned_staff_id,order_id,notes,created_by_staff_id)
    values(record_id,'BATCH-'||to_char(now(),'YYYY')||'-'||lpad((record_id-4000000000000000)::text,greatest(4,length((record_id-4000000000000000)::text)),'0'),product.id,item.id,mat.id,qty,(p_data->>'output_qty')::integer,
      (p_data->>'assigned_staff_id')::bigint,nullif(p_data->>'order_id','')::bigint,p_data->>'notes',actor.id) returning * into batch;
    result:=to_jsonb(batch); subject:=product.item_code; message:=format('queued %s for %s; allocated %s %s of %s',batch.batch_code,product.name,qty,mat.unit,mat.name);
  when 'batch_status' then
    select * into batch from public.production_batches where id=record_id for update;
    if not found or not ((batch.status='Queued' and p_data->>'status' in ('In Progress','Cancelled')) or
      (batch.status='In Progress' and p_data->>'status'='Quality Check')) then raise exception 'This batch cannot move to that step.'; end if;
    update public.production_batches set status=p_data->>'status',started_at=case when p_data->>'status'='In Progress' then now() else started_at end
      where id=record_id returning * into batch;
    result:=to_jsonb(batch); message:=format('moved %s to %s',batch.batch_code,batch.status);
  when 'complete_batch' then
    select * into batch from public.production_batches where id=record_id for update;
    if not found or batch.status<>'Quality Check' then raise exception 'Only a batch awaiting quality check can be finished.'; end if;
    qty:=(p_data->>'produced')::integer; damaged:=(p_data->>'damaged')::integer;
    if qty is null or damaged is null or qty<0 or qty>2000000000 or damaged<0 or damaged>qty then raise exception 'Check the produced and damaged counts.'; end if;
    if (damaged>0 or qty=0) and (reason is null or reason not in ('Broke during hotwire/cutting','Material void / density defect','Carving / dimension error','Floor / handling damage')) then raise exception 'Choose why the pieces were damaged.'; end if;
    good:=qty-damaged;
    select * into mat from public.raw_materials where id=batch.raw_material_id for update;
    remaining_qty:=(p_data->>'material_qty')::integer;
    select coalesce(sum(raw_material_used_qty),0) into reserved from public.production_batches where raw_material_id=mat.id and id<>batch.id and status in ('Queued','In Progress','Quality Check');
    if remaining_qty is null or remaining_qty<=0 or remaining_qty>mat.stock-reserved then raise exception 'There is not enough material left after other batches are allowed for.'; end if;
    select * into item from public.inventory where id=batch.inventory_id for update;
    if good % greatest(item.pack_size,1) <> 0 then raise exception 'Good pieces must fill whole selling packs of % pieces.',item.pack_size; end if;
    select * into product from public.products where id=batch.target_product_id;
    perform private.set_stock_context('production_use', null, null, batch.order_id, null, batch.id);
    update public.raw_materials set stock=stock-remaining_qty,updated_at=now() where id=mat.id;
    perform private.set_stock_context('production', null, null, batch.order_id, null, batch.id);
    update public.inventory set stock=stock+good/greatest(pack_size,1) where id=item.id;
    update public.production_batches set status='Completed',raw_material_used_qty=remaining_qty,good_output_qty=good,damaged_qty=damaged,
      defect_reason=case when damaged>0 or qty=0 then reason end,completed_by_staff_id=actor.id,completed_at=now() where id=batch.id returning * into batch;
    for lot in select * from public.raw_material_lots where raw_material_id=mat.id and remaining>0 order by id for update loop
      exit when remaining_qty=0;
      take_qty:=least(remaining_qty,lot.remaining);
      update public.raw_material_lots set remaining=remaining-take_qty where id=lot.id;
      insert into public.production_material_usage(batch_id,lot_id,quantity) values(batch.id,lot.id,take_qty);
      remaining_qty:=remaining_qty-take_qty;
    end loop;
    if remaining_qty<>0 then raise exception 'The material lot counts do not match. Ask a manager to check them.'; end if;
    if damaged>0 then insert into public.production_defect_logs(batch_id,product_id,damaged_quantity,reason,logged_by_staff_id)
      values(batch.id,product.id,damaged,reason,actor.id); end if;
    result:=to_jsonb(batch); subject:=product.item_code;
    message:=format('%s completed: %s pieces of %s added to shelf; %s nasira (%s); %s %s of %s consumed',batch.batch_code,good,product.name,damaged,coalesce(reason,'none'),batch.raw_material_used_qty,mat.unit,mat.name);
  when 'transfer_stock' then
    -- An explicit manager-approved move, never a copy of the same stock.
    select * into mat from public.raw_materials where id=(p_data->>'raw_material_id')::bigint for update;
    select * into item from public.inventory where id=(p_data->>'inventory_id')::bigint for update;
    if mat.id is null or item.id is null or item.product_type not in ('sheet','block') or lower(mat.sku)<>lower(item.sku) then raise exception 'Choose the matching sheet or block code.'; end if;
    -- Do not move stock with outstanding customer demand. Orders are locked for
    -- this short transaction because existing order writers predate these RPCs.
    lock table public.orders in share row exclusive mode;
    if exists(select 1 from public.orders o cross join lateral jsonb_array_elements(o.items) line
      where o.status='Pending' and line->>'productId'=item.id::text) then raise exception 'This material is on a waiting customer order. Settle that order before moving it.'; end if;
    qty:=(p_data->>'quantity')::integer;
    if qty is null or qty<=0 or qty>item.stock then raise exception 'Enter how many selling units to move from the shelf.'; end if;
    good:=qty*greatest(item.pack_size,1);
    perform private.set_stock_context('transfer', 'Moved to raw materials', null);
    update public.inventory set stock=stock-qty where id=item.id;
    perform private.set_stock_context('transfer', 'Moved from selling stock', null);
    update public.raw_materials set stock=stock+good,updated_at=now() where id=mat.id returning * into mat;
    insert into public.raw_material_lots(raw_material_id,quantity,remaining,source) values(mat.id,good,good,'Moved from selling stock: '||item.sku);
    result:=to_jsonb(mat); subject:=mat.sku; message:=format('moved %s selling units of %s off the shelf into %s raw material units',qty,item.name,good);
  else raise exception 'This workshop action is not supported.';
  end case;
  insert into public.activity_log(id,type,staff_name,description,subject,at)
    values(nextval('private.workshop_id_seq'),'stock',actor.name,message||'. Approved by '||actor.name||'.',subject,now());
  insert into private.workshop_requests values(p_request_id,actor.id,p_action,p_data,result);
  return result;
end $fn$;
revoke all on function private.workshop_command(text,jsonb,uuid) from public,anon;
grant execute on function private.workshop_command(text,jsonb,uuid) to authenticated;

-- ============================================================
-- Deliveries point at their order by id
-- ============================================================
-- The "Order #N - Name" text stays (every screen and the slip read it), but it
-- is no longer the only link. Backfilled only where the order exists; a
-- delivery raised by hand for a walk-in keeps a null order_id. RESTRICT:
-- orders are called off, never deleted, so their deliveries are never orphaned.
alter table public.deliveries add column if not exists order_id bigint;
do $migration$
begin
  if not exists (select 1 from pg_constraint where conname = 'deliveries_order_id_fkey') then
    alter table public.deliveries add constraint deliveries_order_id_fkey
      foreign key (order_id) references public.orders(id) on delete restrict not valid;
  end if;
end;
$migration$;
update public.deliveries d set order_id = o.id
  from public.orders o
  where d.order_id is null and starts_with(d.product, 'Order #' || o.id || ' - ');
alter table public.deliveries validate constraint deliveries_order_id_fkey;
create index if not exists deliveries_order_idx on public.deliveries (order_id) where order_id is not null;

-- Once linked, the link is not the browser's to move.
create or replace function private.guard_delivery_order_link()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  if current_user in ('authenticated', 'anon') and old.order_id is not null
     and new.order_id is distinct from old.order_id then
    raise exception 'A delivery cannot be moved to a different order.';
  end if;
  return new;
end;
$fn$;
revoke all on function private.guard_delivery_order_link() from public, anon, authenticated;
drop trigger if exists deliveries_guard_order_link on public.deliveries;
create trigger deliveries_guard_order_link before update of order_id on public.deliveries
  for each row execute function private.guard_delivery_order_link();

-- ============================================================
-- Orders: replacements, loyalty discount, and money guard
-- ============================================================
alter table public.orders
  add column if not exists replacement_history jsonb not null default '[]'::jsonb,
  add column if not exists discount_amount numeric not null default 0,
  add column if not exists promotion jsonb;
alter table public.orders drop constraint if exists orders_discount_amount_check;
alter table public.orders add constraint orders_discount_amount_check
  check (discount_amount >= 0 and discount_amount <= 1000000000);
alter table public.orders drop constraint if exists orders_promotion_shape;
alter table public.orders add constraint orders_promotion_shape
  check (promotion is null or jsonb_typeof(promotion) = 'object');
alter table public.orders drop constraint if exists orders_replacement_history_shape;
alter table public.orders add constraint orders_replacement_history_shape
  check (jsonb_typeof(replacement_history) = 'array');

create index if not exists orders_open_idx on public.orders (created_at) where status = 'Pending';

create or replace function public.orders_guard_money_update()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if (select auth.jwt()) is null then return new; end if;

  if private.is_manager_or_admin() then return new; end if;

  if new.total_amount        is distinct from old.total_amount
     or new.refunded_amount     is distinct from old.refunded_amount
     or new.refund_history      is distinct from old.refund_history
     or new.price_adjustments   is distinct from old.price_adjustments
     or new.replacement_history is distinct from old.replacement_history
     or new.discount_amount     is distinct from old.discount_amount
     or new.promotion           is distinct from old.promotion then
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

-- ------------------------------------------------------------
-- Loyalty rules: one explicit, editable row
-- ------------------------------------------------------------
-- A customer is a REGULAR after `regular_after_orders` finished orders and may
-- receive the reward after `reward_after_orders`. The reward is a percentage
-- off the items on a new order. Off until a manager switches it on.
create table if not exists public.loyalty_rules (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  regular_after_orders integer not null default 3 check (regular_after_orders between 1 and 1000),
  reward_after_orders integer not null default 5 check (reward_after_orders between 1 and 1000),
  reward_percent numeric(5,2) not null default 5 check (reward_percent > 0 and reward_percent <= 50),
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.loyalty_rules (id) values (1) on conflict (id) do nothing;

create or replace function private.stamp_loyalty_rules()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  new.updated_by := coalesce((select s.name from public.staff s
    where lower(s.email) = lower((select auth.jwt()) ->> 'email') limit 1), 'System');
  return new;
end;
$fn$;
revoke all on function private.stamp_loyalty_rules() from public, anon, authenticated;
drop trigger if exists loyalty_rules_stamp on public.loyalty_rules;
create trigger loyalty_rules_stamp before update on public.loyalty_rules
  for each row execute function private.stamp_loyalty_rules();

alter table public.loyalty_rules enable row level security;
revoke all on public.loyalty_rules from public, anon, authenticated;
grant select, update on public.loyalty_rules to authenticated;
drop policy if exists "Active staff read loyalty rules" on public.loyalty_rules;
create policy "Active staff read loyalty rules" on public.loyalty_rules for select
  to authenticated using ((select private.is_active_staff()));
drop policy if exists "Managers change loyalty rules" on public.loyalty_rules;
create policy "Managers change loyalty rules" on public.loyalty_rules for update to authenticated
  using ((select private.caller_role()) in ('Admin', 'Manager'))
  with check ((select private.caller_role()) in ('Admin', 'Manager'));

-- Per-customer totals across their WHOLE history, so screens do not have to
-- load every order to say who is a regular or who has not ordered in a year.
-- An order counts for a customer by id, or by name when it carries no id --
-- the same two threads utils/customers.js follows. Cancelled orders count
-- only as cancelled. security_invoker: the orders policies still apply.
create or replace view public.customer_order_stats with (security_invoker = true) as
select
  case when o.customer_id is not null then 'id:' || o.customer_id
       else 'name:' || lower(btrim(o.customer_name)) end as customer_key,
  count(*) filter (where o.status <> 'Cancelled') as order_count,
  count(*) filter (where o.status = 'Completed') as completed_count,
  count(*) filter (where o.status = 'Pending') as open_count,
  coalesce(sum(o.total_amount - o.refunded_amount) filter (where o.status <> 'Cancelled'), 0) as spent,
  max(o.created_at) filter (where o.status <> 'Cancelled') as last_order_at
from public.orders o
group by 1;
revoke all on public.customer_order_stats from public, anon;
grant select on public.customer_order_stats to authenticated;

-- A discount on an order is the loyalty reward and nothing else, applied only
-- to a customer who has earned it and never above the configured percentage.
-- Checked when the discount is written; later status changes do not re-judge
-- it, so switching the rules off does not strand orders already agreed.
create or replace function private.validate_order_promotion()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare
  rules public.loyalty_rules;
  cust public.customers;
  finished bigint;
  subtotal numeric;
  allowed numeric;
begin
  if (select auth.jwt()) is null then return new; end if;
  if tg_op = 'UPDATE' and new.discount_amount is not distinct from old.discount_amount
     and new.promotion is not distinct from old.promotion then
    return new;
  end if;
  if coalesce(new.discount_amount, 0) = 0 then
    new.promotion := null;
    return new;
  end if;
  if new.promotion ->> 'kind' is distinct from 'loyalty' then
    raise exception 'Only the loyalty reward can take money off an order here. Use "Fix the price" for anything else.';
  end if;
  select * into rules from public.loyalty_rules where id = 1;
  if not coalesce(rules.enabled, false) then raise exception 'The loyalty reward is switched off.'; end if;
  if new.customer_id is null then
    raise exception 'The loyalty reward needs the order to be for a saved customer.';
  end if;
  select * into cust from public.customers where id = new.customer_id;
  select count(*) into finished from public.orders o
    where o.status = 'Completed' and o.id is distinct from new.id
      and (o.customer_id = new.customer_id
        or (o.customer_id is null and lower(btrim(o.customer_name)) = lower(btrim(cust.name))));
  if finished < rules.reward_after_orders then
    raise exception '% has % finished orders; the loyalty reward starts at %.',
      cust.name, finished, rules.reward_after_orders;
  end if;
  select coalesce(sum(coalesce((line ->> 'lineTotal')::numeric,
      private.order_num(line ->> 'quantity') * private.order_num(coalesce(line ->> 'unitPrice', line ->> 'price')))), 0)
    into subtotal
    from jsonb_array_elements(case when jsonb_typeof(new.items) = 'array' then new.items else '[]'::jsonb end) line;
  allowed := round(subtotal * rules.reward_percent / 100, 2);
  if new.discount_amount > allowed then
    raise exception 'The loyalty discount can be at most % (% percent of the items).', allowed, rules.reward_percent;
  end if;
  new.promotion := jsonb_build_object('kind', 'loyalty', 'label', 'Loyalty reward',
    'percent', rules.reward_percent, 'finishedOrders', finished);
  return new;
end;
$fn$;
revoke all on function private.validate_order_promotion() from public, anon, authenticated;
drop trigger if exists orders_validate_promotion on public.orders;
create trigger orders_validate_promotion before insert or update of discount_amount, promotion on public.orders
  for each row execute function private.validate_order_promotion();

-- ------------------------------------------------------------
-- Replacing returned goods instead of refunding them
-- ------------------------------------------------------------
-- Worked out here from the saved order rather than from browser arithmetic:
-- what the customer holds on the line bounds what can come back, returned goods
-- go back on the shelf only when they are sellable, and the replacement leaves
-- the shelf once. The order's money and lines are untouched; the event is
-- appended to replacement_history. Called only from order_command.
create or replace function private.apply_order_replacement(actor public.staff, ord public.orders, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  line_index integer;
  line jsonb;
  ordered numeric;
  voided numeric;
  held numeric;
  already numeric;
  qty integer;
  replacement_qty integer;
  disposition text := p_data ->> 'disposition';
  reason text := p_data ->> 'reason';
  note text := nullif(btrim(p_data ->> 'note'), '');
  returned_id bigint;
  replacement_id bigint;
  replacement_row public.inventory;
  touched bigint[] := '{}';
  entry jsonb;
begin
  if ord.status = 'Cancelled' then
    raise exception 'This order was called off, so nothing on it can be replaced.';
  end if;
  if coalesce(p_data ->> 'lineIndex', '') !~ '^[0-9]{1,4}$' then raise exception 'Which line is not clear.'; end if;
  line_index := (p_data ->> 'lineIndex')::integer;
  if line_index >= jsonb_array_length(ord.items) then raise exception 'That line is not on this order.'; end if;
  line := ord.items -> line_index;
  ordered := (private.order_line_shape(jsonb_build_array(line)) -> 0 ->> 'stockUnits')::numeric;
  voided := coalesce((line ->> 'voidedUnits')::numeric, 0);
  held := coalesce((line ->> 'committedUnits')::numeric,
    case when ord.stock_committed_at is not null then greatest(0, ordered - voided) else 0 end);
  -- Take off what has already been replaced on this line. The order's lines and
  -- money are deliberately left alone by a replacement, so replacement_history
  -- is the only record that it happened: without this, `held` never shrinks and
  -- the same line can be replaced over and over, moving stock every time.
  already := coalesce((select sum(coalesce((e ->> 'quantity')::numeric, 0))
    from jsonb_array_elements(ord.replacement_history) e
    where (e ->> 'lineIndex')::integer = line_index), 0);
  held := greatest(0, held - already);

  if coalesce(p_data ->> 'quantity', '') !~ '^[0-9]{1,9}$' then raise exception 'Enter how many came back.'; end if;
  qty := (p_data ->> 'quantity')::integer;
  if qty < 1 or qty > held then
    raise exception 'Only goods the customer received can be replaced: up to % on this line.', held;
  end if;
  if disposition is null or disposition not in ('restock', 'scrap') then
    raise exception 'Say whether the returned goods can be sold again.';
  end if;
  if reason is null or reason not in ('damaged', 'wrong', 'defective') then
    raise exception 'Choose why the goods came back.';
  end if;
  if char_length(coalesce(note, '')) > 500 then raise exception 'Keep the note under 500 characters.'; end if;

  returned_id := nullif(line ->> 'productId', '')::bigint;
  replacement_id := coalesce(nullif(p_data ->> 'replacementProductId', '')::bigint, returned_id);
  if replacement_id is null then raise exception 'Choose what goes out as the replacement.'; end if;
  if coalesce(p_data ->> 'replacementQuantity', qty::text) !~ '^[0-9]{1,9}$' then
    raise exception 'Enter how many go out as the replacement.';
  end if;
  replacement_qty := coalesce((p_data ->> 'replacementQuantity')::integer, qty);
  if replacement_qty < 1 then raise exception 'Enter how many go out as the replacement.'; end if;
  if disposition = 'restock' and returned_id is null then
    raise exception 'This line is not a stocked product, so it cannot go back on the shelf.';
  end if;

  -- Same lock order as every other writer: ascending id.
  perform 1 from public.inventory
    where id in (returned_id, replacement_id) order by id for update;

  if disposition = 'restock' then
    perform private.set_stock_context('return', reason, note, ord.id);
    update public.inventory set stock = stock + qty where id = returned_id;
    if not found then raise exception 'The returned product is no longer on the shelf list.'; end if;
    touched := touched || returned_id;
  end if;

  select * into replacement_row from public.inventory where id = replacement_id;
  if not found then raise exception 'The replacement product is not on the shelf list.'; end if;
  if replacement_row.stock < replacement_qty then
    raise exception 'Only % of % on the shelf, so the replacement cannot go out.',
      replacement_row.stock, replacement_row.name;
  end if;
  perform private.set_stock_context('replacement', reason, note, ord.id);
  update public.inventory set stock = stock - replacement_qty where id = replacement_id;
  touched := touched || replacement_id;

  entry := jsonb_build_object(
    'id', gen_random_uuid(), 'lineIndex', line_index, 'productId', returned_id,
    'name', line ->> 'name', 'quantity', qty, 'disposition', disposition,
    'reason', reason, 'note', note,
    'replacementProductId', replacement_id, 'replacementName', replacement_row.name,
    'replacementQuantity', replacement_qty,
    'handledByStaffId', actor.id, 'handledBy', actor.name, 'replacedAt', now());
  update public.orders set replacement_history = replacement_history || jsonb_build_array(entry)
    where id = ord.id returning * into ord;

  return jsonb_build_object('order', to_jsonb(ord), 'delivery', null,
    'inventory', coalesce((select jsonb_agg(to_jsonb(i) order by i.id)
      from public.inventory i where i.id = any(touched)), '[]'::jsonb));
end;
$fn$;
revoke all on function private.apply_order_replacement(public.staff, public.orders, jsonb) from public, anon, authenticated;

-- order_command: as before, plus replacements, server-stamped refund entries,
-- a refund status rule, movement kinds, the delivery id link, and calling an
-- order off removing its unsent deliveries in the same transaction.
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
  if p_action not in ('dispatch', 'arrive') and (v_delivery_id is not null or p_data ? 'delivery') then
    raise exception 'This action cannot change a delivery.';
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

-- ============================================================
-- One stock row per code
-- ============================================================
-- Products and their stock rows are joined on code, case-insensitively, so two
-- rows with one code make "how many do we have" ambiguous. Created only when
-- the data allows it; supabase/integrity_check.sql lists any duplicates.
do $migration$
begin
  if exists (select 1 from public.inventory group by lower(sku) having count(*) > 1) then
    raise notice 'inventory has duplicate codes; the unique index was not created. Run supabase/integrity_check.sql.';
  else
    create unique index if not exists inventory_sku_lower_key on public.inventory (lower(sku));
    drop index if exists public.inventory_sku_idx;
  end if;
end;
$migration$;

-- ============================================================
-- Removing a product keeps its history
-- ============================================================
alter table public.products drop constraint if exists products_status_check;
alter table public.products add constraint products_status_check
  check (status in ('Active', 'Archived')) not valid;
do $migration$
begin
  if not exists (select 1 from public.products where status not in ('Active', 'Archived')) then
    alter table public.products validate constraint products_status_check;
  end if;
end;
$migration$;

-- A product anything has happened to is archived: hidden from the lists and
-- the order form, with its stock row and every reference kept. Only a product
-- nothing refers to is deleted, and then both rows go in one transaction.
create or replace function public.remove_product(p_product_id bigint, p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  product public.products;
  item public.inventory;
  referenced boolean;
begin
  if (select private.caller_role()) is distinct from 'Admin' then
    raise exception 'Only an administrator can remove a product.';
  end if;
  select * into product from public.products where id = p_product_id for update;
  if not found then raise exception 'That product no longer exists.'; end if;
  if product.revision is distinct from p_expected_revision then
    raise exception using errcode = '40001', message = 'This product changed. Refresh it before trying again.';
  end if;
  select * into item from public.inventory where lower(sku) = lower(product.item_code) for update;

  if item.id is not null and exists (
    select 1 from public.orders o
      cross join lateral jsonb_array_elements(case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end) line
    where o.status = 'Pending' and line ->> 'productId' = item.id::text) then
    raise exception 'This product is on an order that is still waiting. Finish or call off that order first.';
  end if;

  referenced := exists (select 1 from public.production_batches b where b.target_product_id = product.id)
    or exists (select 1 from public.production_recipes r where r.product_id = product.id)
    or exists (select 1 from public.production_defect_logs d where d.product_id = product.id)
    or (item.id is not null and (
      exists (select 1 from public.orders o
        cross join lateral jsonb_array_elements(case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end) line
        where line ->> 'productId' = item.id::text)
      or exists (select 1 from public.production_batches b where b.inventory_id = item.id)
      or exists (select 1 from public.stock_movements m where m.inventory_id = item.id and m.kind <> 'opening')));

  if referenced then
    update public.products set status = 'Archived', updated_at = now() where id = product.id;
    return jsonb_build_object('outcome', 'archived');
  end if;
  if item.id is not null then delete from public.inventory where id = item.id; end if;
  delete from public.products where id = product.id;
  return jsonb_build_object('outcome', 'deleted');
end;
$fn$;
revoke all on function public.remove_product(bigint, bigint) from public, anon;
grant execute on function public.remove_product(bigint, bigint) to authenticated;

-- ============================================================
-- A customer with an order still waiting cannot be removed
-- ============================================================
create or replace function private.guard_customer_delete()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if exists (select 1 from public.orders o where o.status = 'Pending'
      and (o.customer_id = old.id
        or (o.customer_id is null and lower(btrim(o.customer_name)) = lower(btrim(old.name))))) then
    raise exception '% still has an order waiting. Finish or call it off before removing them.', old.name;
  end if;
  return old;
end;
$fn$;
revoke all on function private.guard_customer_delete() from public, anon, authenticated;
drop trigger if exists customers_guard_delete on public.customers;
create trigger customers_guard_delete before delete on public.customers
  for each row execute function private.guard_customer_delete();

-- ============================================================
-- Role boundaries at the database
-- ============================================================
-- Products, prices and stock rows: managers and administrators.
drop policy if exists "Active staff insert products" on public.products;
drop policy if exists "Active staff update products" on public.products;
drop policy if exists "Managers insert products" on public.products;
drop policy if exists "Managers update products" on public.products;
create policy "Managers insert products" on public.products for insert
  with check ((select private.caller_role()) in ('Admin', 'Manager'));
create policy "Managers update products" on public.products for update
  using ((select private.caller_role()) in ('Admin', 'Manager'))
  with check ((select private.caller_role()) in ('Admin', 'Manager'));

drop policy if exists "Active staff insert inventory" on public.inventory;
drop policy if exists "Active staff update inventory" on public.inventory;
drop policy if exists "Managers insert inventory" on public.inventory;
drop policy if exists "Managers update inventory" on public.inventory;
create policy "Managers insert inventory" on public.inventory for insert
  with check ((select private.caller_role()) in ('Admin', 'Manager'));
create policy "Managers update inventory" on public.inventory for update
  using ((select private.caller_role()) in ('Admin', 'Manager'))
  with check ((select private.caller_role()) in ('Admin', 'Manager'));

-- Customer contact details: the roles that sell to and deliver to customers.
-- Production staff work from orders, which carry the name they need.
drop policy if exists "Active staff read customers" on public.customers;
drop policy if exists "Active staff insert customers" on public.customers;
drop policy if exists "Active staff update customers" on public.customers;
drop policy if exists "Customer roles read customers" on public.customers;
drop policy if exists "Sales roles insert customers" on public.customers;
drop policy if exists "Sales roles update customers" on public.customers;
create policy "Customer roles read customers" on public.customers for select
  using ((select private.caller_role()) in ('Admin', 'Manager', 'Sales Staff', 'Delivery Staff'));
create policy "Sales roles insert customers" on public.customers for insert
  with check ((select private.caller_role()) in ('Admin', 'Manager', 'Sales Staff'));
create policy "Sales roles update customers" on public.customers for update
  using ((select private.caller_role()) in ('Admin', 'Manager', 'Sales Staff'))
  with check ((select private.caller_role()) in ('Admin', 'Manager', 'Sales Staff'));

-- Supplier records: everybody may read who delivered what; managing them is a
-- manager's job, as ordering from them already is.
drop policy if exists "Active staff insert suppliers" on public.suppliers;
drop policy if exists "Active staff update suppliers" on public.suppliers;
drop policy if exists "Managers insert suppliers" on public.suppliers;
drop policy if exists "Managers update suppliers" on public.suppliers;
create policy "Managers insert suppliers" on public.suppliers for insert
  with check ((select private.caller_role()) in ('Admin', 'Manager'));
create policy "Managers update suppliers" on public.suppliers for update
  using ((select private.caller_role()) in ('Admin', 'Manager'))
  with check ((select private.caller_role()) in ('Admin', 'Manager'));

-- Orders are called off, never deleted: they are the record of a sale.
drop policy if exists "Admins delete orders" on public.orders;

-- A delivery that never left may be taken off the board by whoever may change
-- or call off its order. One that went out is a record and stays.
drop policy if exists "Admins delete deliveries" on public.deliveries;
drop policy if exists "Managers delete unsent deliveries" on public.deliveries;
create policy "Managers delete unsent deliveries" on public.deliveries for delete
  using ((select private.caller_role()) in ('Admin', 'Manager')
    and status not in ('On The Way', 'Delivered')
    and jsonb_array_length(coalesce(items_manifest, '[]'::jsonb)) = 0);

-- Screens read open work plus recent history; these keep that cheap.
create index if not exists deliveries_open_idx on public.deliveries (created_at) where status <> 'Delivered';
create index if not exists deliveries_created_at_idx on public.deliveries (created_at desc);
