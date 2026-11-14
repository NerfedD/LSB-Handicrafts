begin;

-- Batch handoff, reversible reservations and loose pieces.
alter table public.production_batches
  add column if not exists revision bigint not null default 0,
  add column if not exists material_reserved boolean not null default true,
  add column if not exists reported_output_qty integer,
  add column if not exists reported_damaged_qty integer,
  add column if not exists reported_at timestamptz,
  add column if not exists reported_by_staff_id bigint references public.staff(id),
  add column if not exists made_by_staff_id bigint references public.staff(id),
  add column if not exists shelf_pack_size integer;
alter table public.production_batches drop constraint if exists production_batches_batch_code_key;
create index if not exists production_batches_code_idx on public.production_batches(batch_code);
drop trigger if exists production_batches_revision on public.production_batches;
create trigger production_batches_revision before update on public.production_batches
  for each row execute function private.bump_record_revision();

alter table public.inventory add column if not exists loose_pieces integer not null default 0;
alter table public.inventory drop constraint if exists inventory_loose_pieces_check;
alter table public.inventory add constraint inventory_loose_pieces_check
  check (loose_pieces >= 0 and loose_pieces < greatest(pack_size,1));
alter table public.stock_movements
  add column if not exists loose_change integer not null default 0,
  add column if not exists loose_balance_after integer;
alter table public.stock_movements drop constraint if exists stock_movements_quantity_change_check;
alter table public.stock_movements drop constraint if exists stock_movements_any_change_check;
alter table public.stock_movements add constraint stock_movements_any_change_check
  check (quantity_change <> 0 or loose_change <> 0);

create or replace function private.guard_loose_pieces()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  if tg_op = 'UPDATE' and new.pack_size is distinct from old.pack_size and old.loose_pieces <> 0 then
    raise exception 'Pack the loose pieces before changing the selling pack size.';
  end if;
  if current_user in ('authenticated','anon') and new.loose_pieces is distinct from
      (case when tg_op = 'INSERT' then 0 else old.loose_pieces end) then
    raise exception 'Loose pieces change only through a recorded stock movement.';
  end if;
  return new;
end;
$fn$;
revoke all on function private.guard_loose_pieces() from public, anon, authenticated;
drop trigger if exists inventory_guard_loose_pieces on public.inventory;
create trigger inventory_guard_loose_pieces before insert or update of loose_pieces, pack_size on public.inventory
  for each row execute function private.guard_loose_pieces();

create or replace function private.check_batch_revision(batch public.production_batches, payload jsonb)
returns void language plpgsql set search_path = '' as $fn$
begin
  if payload ? 'expectedRevision' and (payload->>'expectedRevision')::bigint is distinct from batch.revision then
    raise exception 'This batch has changed. Open it again to see the latest details.';
  end if;
end;
$fn$;
revoke all on function private.check_batch_revision(public.production_batches,jsonb) from public, anon, authenticated;

create or replace function private.record_stock_movement()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare
  ctx jsonb := nullif(current_setting('lsb.movement', true), '')::jsonb;
  delta integer; loose_delta integer := 0; loose_balance integer;
  actor_id bigint;
  actor text;
begin
  if tg_op = 'INSERT' then delta := new.stock; else delta := new.stock - old.stock; end if;
  if tg_table_name = 'inventory' then
    loose_balance := new.loose_pieces;
    loose_delta := loose_balance - case when tg_op = 'INSERT' then 0 else old.loose_pieces end;
  end if;
  if delta = 0 and loose_delta = 0 then return new; end if;
  select s.id, s.name into actor_id, actor from public.staff s
    where lower(s.email) = lower((select auth.jwt()) ->> 'email') and s.status = 'Active' limit 1;
  insert into public.stock_movements(inventory_id, raw_material_id, item_code, item_name,
    quantity_change, balance_after, kind, reason, note, order_id, supplier_order_id, batch_id,
    actor_staff_id, actor_name, loose_change, loose_balance_after)
  values (
    case when tg_table_name = 'inventory' then new.id end,
    case when tg_table_name = 'raw_materials' then new.id end,
    new.sku, new.name, delta, new.stock,
    coalesce(ctx ->> 'kind', case when tg_op = 'INSERT' then 'opening' else 'adjustment' end),
    ctx ->> 'reason', ctx ->> 'note',
    (ctx ->> 'order_id')::bigint, (ctx ->> 'supplier_order_id')::bigint, (ctx ->> 'batch_id')::bigint,
    actor_id, coalesce(actor, nullif((select auth.jwt()) ->> 'email', ''), 'System'), loose_delta, loose_balance);
  return new;
end;
$fn$;

drop trigger if exists inventory_stock_movement on public.inventory;
create trigger inventory_stock_movement after insert or update of stock, loose_pieces on public.inventory
  for each row execute function private.record_stock_movement();

create or replace function private.workshop_precheck(p_action text, p_data jsonb, p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $fn$
declare
  who text := private.caller_role();
  mat public.raw_materials;
  product public.products;
  free bigint;
  wanted integer;
  notes text;
begin
  if p_request_id is not null
     and exists (select 1 from private.workshop_requests where request_id = p_request_id) then
    return;
  end if;
  -- The permission message belongs to workshop_command; it says it first.
  if who is null then return; end if;
  if p_action in ('save_order', 'save_recipe', 'transfer_stock') and who not in ('Admin', 'Manager') then return; end if;
  if p_action in ('start_batch', 'complete_batch') and who not in ('Admin', 'Manager', 'Production Staff') then return; end if;

  if p_action = 'save_order' then
    -- A correction to an order not yet sent may carry a new quantity or price.
    if nullif(p_data ->> 'id', '') is not null then
      if p_data ? 'quantity_ordered' then
        perform private.whole_count(p_data, 'quantity_ordered', 'The quantity ordered', 1);
      end if;
      if p_data ? 'unit_price' and (btrim(coalesce(p_data ->> 'unit_price', '')) !~ '^([0-9]{1,9}(\.[0-9]{1,2})?|\.[0-9]{1,2})$'
         or (p_data ->> 'unit_price')::numeric > 100000000) then
        raise exception 'Enter the price per unit as an amount from 0 to 100,000,000, with at most 2 decimal places.';
      end if;
    end if;
    if nullif(p_data ->> 'id', '') is null then
      if coalesce(p_data ->> 'supplier_id', '') !~ '^[0-9]{1,18}$'
         or not exists (select 1 from public.suppliers where id = (p_data ->> 'supplier_id')::bigint) then
        raise exception 'Choose a supplier from the list.';
      end if;
      if coalesce(p_data ->> 'raw_material_id', '') !~ '^[0-9]{1,18}$' then
        raise exception 'Choose the material to order.';
      end if;
      select * into mat from public.raw_materials where id = (p_data ->> 'raw_material_id')::bigint;
      if not found then raise exception 'That raw material no longer exists.'; end if;
      if mat.status = 'Archived' then
        raise exception '% is no longer in use. Put it back in use before ordering it.', mat.name;
      end if;
      perform private.whole_count(p_data, 'quantity_ordered', 'The quantity ordered', 1);
      if btrim(coalesce(p_data ->> 'unit_price', '')) !~ '^([0-9]{1,9}(\.[0-9]{1,2})?|\.[0-9]{1,2})$'
         or (p_data ->> 'unit_price')::numeric > 100000000 then
        raise exception 'Enter the price per unit as an amount from 0 to 100,000,000, with at most 2 decimal places.';
      end if;
    end if;
    if coalesce(p_data ->> 'expected_delivery_date', '') <> ''
       and p_data ->> 'expected_delivery_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'Enter the promised date as a calendar date.';
    end if;
    notes := p_data ->> 'carrier_notes';
    if char_length(coalesce(notes, '')) > 1000 then
      raise exception 'Keep the courier notes to 1,000 characters.';
    end if;

  elsif p_action in ('start_batch', 'save_recipe') then
    if coalesce(p_data ->> 'product_id', '') !~ '^[0-9]{1,18}$' then raise exception 'Choose the finished product.'; end if;
    select * into product from public.products where id = (p_data ->> 'product_id')::bigint;
    if not found then raise exception 'That product no longer exists.'; end if;
    if product.status = 'Archived' then
      raise exception '% is no longer sold, so it cannot be planned for production.', product.name;
    end if;
    if coalesce(p_data ->> 'raw_material_id', '') !~ '^[0-9]{1,18}$' then raise exception 'Choose the raw material.'; end if;
    select * into mat from public.raw_materials where id = (p_data ->> 'raw_material_id')::bigint;
    if not found then raise exception 'That raw material no longer exists.'; end if;
    if mat.status = 'Archived' then
      raise exception '% is no longer in use. Choose another material, or put it back in use first.', mat.name;
    end if;
    if p_action = 'save_recipe' then
      perform private.whole_count(p_data, 'material_qty', 'The material needed', 1);
      perform private.whole_count(p_data, 'output_qty', 'The pieces produced', 1);
    else
      perform private.whole_count(p_data, 'output_qty', 'The target pieces', 1);
      wanted := private.whole_count(p_data, 'material_qty', 'The material to set aside', 1);
      select mat.stock - coalesce(sum(b.raw_material_used_qty), 0) into free
        from public.production_batches b
        where b.raw_material_id = mat.id and b.status in ('Queued', 'In Progress', 'Quality Check') and b.material_reserved;
      if free <= 0 then
        raise exception '% has none free: every unit on the shelf is set aside for other batches or used up. Order more, or choose another material.', mat.name;
      end if;
      if wanted > free then
        raise exception 'Only % % of % are free after other batches. Set aside % or fewer, or order more.',
          free, mat.unit, mat.name, free;
      end if;
    end if;

  elsif p_action = 'complete_batch' then
    perform private.whole_count(p_data, 'produced', 'The pieces produced', 0);
    perform private.whole_count(p_data, 'damaged', 'The damaged pieces', 0);
    perform private.whole_count(p_data, 'material_qty', 'The material used', 1);

  elsif p_action = 'receive_delivery' then
    perform private.whole_count(p_data, 'arrived', 'The quantity unloaded', 0);
    perform private.whole_count(p_data, 'damaged', 'The damaged quantity', 0);

  elsif p_action = 'transfer_stock' then
    perform private.whole_count(p_data, 'quantity', 'The selling units to move', 1);
  end if;
end;
$fn$;

create or replace function private.workshop_command(p_action text, p_data jsonb, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  actor public.staff; mat public.raw_materials; po public.raw_material_orders;
  batch public.production_batches; item public.inventory; product public.products;
  lot public.raw_material_lots; previous private.workshop_requests;
  result jsonb; record_id bigint; qty integer; damaged integer; good integer; reserved bigint;
  remaining_qty integer; take_qty integer; shelf_pieces bigint; started timestamptz; reason text; message text; subject text; reference text;
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
    -- Adding one, and correcting every detail of one, live in private.save_material.
    mat := private.save_material(actor, p_data);
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
    select coalesce(sum(raw_material_used_qty),0) into reserved from public.production_batches where raw_material_id=mat.id and status in ('Queued','In Progress','Quality Check') and material_reserved;
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
    perform private.check_batch_revision(batch, p_data);
    if p_data->>'status' <> 'Cancelled' and not batch.material_reserved then
      select * into mat from public.raw_materials where id=batch.raw_material_id for update;
      select coalesce(sum(raw_material_used_qty),0) into reserved from public.production_batches
        where raw_material_id=mat.id and status in ('Queued','In Progress','Quality Check') and material_reserved;
      if mat.status = 'Archived' or batch.raw_material_used_qty > mat.stock-reserved then
        raise exception 'There is not enough material to set aside again. Change the batch or receive more stock.';
      end if;
    end if;
    if p_data->>'status' = 'Quality Check' then
      qty := private.whole_count(p_data, 'produced', 'The pieces made', 0);
      damaged := private.whole_count(p_data, 'damaged', 'The damaged pieces', 0);
      if damaged > qty then raise exception 'Damaged pieces cannot be more than the pieces made.'; end if;
      -- The same line guard_batch_output draws at finishing, so a slip here is
      -- caught by the maker rather than by the checker.
      if qty::bigint > 2 * batch.target_output_qty::bigint then
        raise exception '% pieces is more than twice the % planned for %. If that many really came out, a manager changes the batch''s target first.',
          qty, batch.target_output_qty, batch.batch_code;
      end if;
    end if;
    started := clock_timestamp();
    update public.production_batches set status=p_data->>'status',
      material_reserved=p_data->>'status' <> 'Cancelled',
      started_at=case when p_data->>'status'='In Progress' then started else started_at end,
      batch_code=case when p_data->>'status'='In Progress' and batch_code !~ '^BATCH-[0-9]{4}-[0-9]{4}-[0-9]{4}$'
        and started_at is null then 'BATCH-' || to_char(started at time zone 'Asia/Manila','YYYY-MMDD-HH24MI') else batch_code end,
      reported_output_qty=qty, reported_damaged_qty=damaged,
      reported_at=case when p_data->>'status'='Quality Check' then started end,
      reported_by_staff_id=case when p_data->>'status'='Quality Check' then actor.id end,
      made_by_staff_id=case when p_data->>'status'='Quality Check' then assigned_staff_id end
      where id=record_id returning * into batch;
    result:=to_jsonb(batch); subject:='batch:'||batch.id;
    message:=format('moved %s to %s',batch.batch_code,batch.status);
    if batch.status='Quality Check' then
      message:=message||format(' with %s made, %s damaged and %s good',qty,damaged,qty-damaged);
    end if;
  when 'complete_batch' then
    select * into batch from public.production_batches where id=record_id for update;
    if not found or batch.status<>'Quality Check' then raise exception 'Only a batch awaiting quality check can be finished.'; end if;
    perform private.check_batch_revision(batch, p_data);
    qty:=(p_data->>'produced')::integer; damaged:=(p_data->>'damaged')::integer;
    if qty is null or damaged is null or qty<0 or qty>2000000000 or damaged<0 or damaged>qty then raise exception 'Check the produced and damaged counts.'; end if;
    if (damaged>0 or qty=0) and (reason is null or reason not in ('Broke during hotwire/cutting','Material void / density defect','Carving / dimension error','Floor / handling damage')) then raise exception 'Choose why the pieces were damaged.'; end if;
    good:=qty-damaged;
    select * into mat from public.raw_materials where id=batch.raw_material_id for update;
    remaining_qty:=(p_data->>'material_qty')::integer;
    select coalesce(sum(raw_material_used_qty),0) into reserved from public.production_batches where raw_material_id=mat.id and id<>batch.id and status in ('Queued','In Progress','Quality Check') and material_reserved;
    if remaining_qty is null or remaining_qty<=0 or remaining_qty>mat.stock-reserved then raise exception 'There is not enough material left after other batches are allowed for.'; end if;
    select * into item from public.inventory where id=batch.inventory_id for update;
    shelf_pieces := item.loose_pieces::bigint + good;
    select * into product from public.products where id=batch.target_product_id;
    perform private.set_stock_context('production_use', null, null, batch.order_id, null, batch.id);
    update public.raw_materials set stock=stock-remaining_qty,updated_at=now() where id=mat.id;
    perform private.set_stock_context('production', null, null, batch.order_id, null, batch.id);
    if good > 0 then
      update public.inventory set stock=stock+shelf_pieces/greatest(pack_size,1),
        loose_pieces=shelf_pieces%greatest(pack_size,1) where id=item.id;
    end if;
    update public.production_batches set status='Completed',raw_material_used_qty=remaining_qty,good_output_qty=good,damaged_qty=damaged,
      defect_reason=case when damaged>0 or qty=0 then reason end,completed_by_staff_id=actor.id,completed_at=clock_timestamp(),
      made_by_staff_id=coalesce(made_by_staff_id,assigned_staff_id), shelf_pack_size=greatest(item.pack_size,1), material_reserved=false
      where id=batch.id returning * into batch;
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
    message:=format('%s completed: %s pieces of %s added to shelf; %s damaged (%s); %s %s of %s consumed',batch.batch_code,good,product.name,damaged,coalesce(reason,'none'),batch.raw_material_used_qty,mat.unit,mat.name);
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
  insert into public.activity_log(id,type,staff_name,actor_staff_id,description,subject,at)
    values(nextval('private.workshop_id_seq'),'stock',actor.name,actor.id,message||'. Approved by '||actor.name||'.',subject,now());
  insert into private.workshop_requests values(p_request_id,actor.id,p_action,p_data,result);
  return result;
end $fn$;

create or replace function private.workshop_corrections(p_action text, p_data jsonb, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  actor public.staff; mat public.raw_materials; po public.raw_material_orders;
  batch public.production_batches; item public.inventory; recipe public.production_recipes;
  usage_row public.production_material_usage; previous private.workshop_requests;
  result jsonb; record_id bigint; reason text; message text; subject text;
  wanted integer; free bigint; packs bigint; used bigint; owed numeric; new_notes text; shelf_pieces bigint; next_loose integer; product public.products;
begin
  if auth.uid() is null then raise exception 'Please sign in again.'; end if;
  select * into actor from public.staff where lower(email)=lower(auth.jwt()->>'email') and status='Active';
  if actor.id is null then raise exception 'An active staff account is needed.'; end if;
  if p_request_id is null then raise exception 'A request reference is needed.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into previous from private.workshop_requests where request_id=p_request_id;
  if found then
    if previous.actor_id <> actor.id or previous.action <> p_action or previous.payload <> p_data then
      raise exception 'This request has changed. Close the form and try again.';
    end if;
    return previous.result;
  end if;

  if p_action = 'batch_step_back' and actor.role not in ('Admin','Manager','Production Staff') then
    raise exception 'Only production staff, managers or administrators can change a batch.';
  end if;
  if p_action = 'cancel_batch' and actor.role not in ('Admin','Manager','Production Staff') then
    raise exception 'Only production staff, managers or administrators can cancel a batch.';
  end if;
  if p_action in ('edit_batch','cancel_supplier_order','delete_recipe') and actor.role not in ('Admin','Manager') then
    raise exception 'Only a manager or administrator can make this correction.';
  end if;
  if p_action in ('delete_batch','reopen_batch','delete_supplier_order') and actor.role <> 'Admin' then
    raise exception 'Only an administrator can make this correction.';
  end if;

  record_id := nullif(p_data->>'id','')::bigint;
  reason := nullif(btrim(p_data->>'reason'),'');
  if p_action in ('cancel_batch','delete_batch','reopen_batch','cancel_supplier_order','delete_supplier_order') then
    if reason is null then raise exception 'Write why, so the activity log explains it.'; end if;
    if char_length(reason) > 500 then raise exception 'Keep the reason to 500 characters.'; end if;
  end if;

  case p_action
  when 'batch_step_back' then
    select * into batch from public.production_batches where id=record_id for update;
    if not found or batch.status not in ('In Progress','Quality Check') then
      raise exception 'Only a batch in production or in quality check can go back a step.';
    end if;
    perform private.check_batch_revision(batch, p_data);
    select * into mat from public.raw_materials where id=batch.raw_material_id for update;
    wanted := case when batch.material_reserved then batch.raw_material_used_qty else 0 end;
    update public.production_batches
      set status = case when batch.status='Quality Check' then 'In Progress' else 'Queued' end,
          started_at = case when batch.status='In Progress' then null else started_at end,
          material_reserved=false, reported_output_qty=null, reported_damaged_qty=null,
          reported_at=null, reported_by_staff_id=null, made_by_staff_id=null
      where id=batch.id returning * into batch;
    result:=to_jsonb(batch); subject:='batch:'||batch.id;
    message:=format('moved %s back to %s and released %s %s', batch.batch_code, batch.status, wanted, mat.unit);

  when 'cancel_batch' then
    select * into batch from public.production_batches where id=record_id for update;
    if not found or batch.status not in ('Queued','In Progress','Quality Check') then
      raise exception 'Only an unfinished batch can be cancelled.';
    end if;
    if batch.status <> 'Queued' and actor.role not in ('Admin','Manager') then
      raise exception 'A batch already in production is cancelled by a manager or administrator.';
    end if;
    update public.production_batches set status='Cancelled' where id=batch.id returning * into batch;
    result:=to_jsonb(batch); subject:=batch.batch_code;
    message:=format('cancelled %s; its material is no longer set aside', batch.batch_code);

  when 'edit_batch' then
    select * into batch from public.production_batches where id=record_id for update;
    if not found or batch.status not in ('Queued','In Progress','Quality Check') then
      raise exception 'Only an unfinished batch can be changed.';
    end if;
    perform private.check_batch_revision(batch, p_data);
    if not batch.material_reserved and p_data ? 'product_id' and p_data ? 'raw_material_id' then
      select * into product from public.products where id=(p_data->>'product_id')::bigint and status <> 'Archived';
      if not found then raise exception 'Choose a product that is still sold.'; end if;
      select * into item from public.inventory where lower(sku)=lower(product.item_code);
      if not found then raise exception 'This product needs a matching shelf record.'; end if;
    end if;
    select * into mat from public.raw_materials
      where id=case when product.id is not null then (p_data->>'raw_material_id')::bigint else batch.raw_material_id end
      for update;
    if not found or mat.status='Archived' then raise exception 'Choose a material that is still in use.'; end if;
    perform private.whole_count(p_data, 'output_qty', 'The target pieces', 1);
    wanted := private.whole_count(p_data, 'material_qty', 'The material to set aside', 1);
    select mat.stock - coalesce(sum(b.raw_material_used_qty), 0) into free
      from public.production_batches b
      where b.raw_material_id = mat.id and b.id <> batch.id and b.status in ('Queued','In Progress','Quality Check') and b.material_reserved;
    if batch.material_reserved and wanted > free then
      raise exception 'Only % % of % are free after other batches. Set aside % or fewer.',
        greatest(free, 0), mat.unit, mat.name, greatest(free, 0);
    end if;
    if coalesce(p_data->>'assigned_staff_id','') !~ '^[0-9]{1,18}$'
       or not exists (select 1 from public.staff where id=(p_data->>'assigned_staff_id')::bigint
         and status='Active' and role in ('Admin','Manager','Production Staff')) then
      raise exception 'Choose an active production worker or manager.';
    end if;
    if nullif(p_data->>'order_id','') is not null and (p_data->>'order_id' !~ '^[0-9]{1,18}$'
       or not exists (select 1 from public.orders where id=(p_data->>'order_id')::bigint and status='Pending')) then
      raise exception 'Choose an order that is still waiting.';
    end if;
    new_notes := nullif(btrim(p_data->>'notes'), '');
    if char_length(coalesce(new_notes, '')) > 1000 then raise exception 'Keep the notes to 1,000 characters.'; end if;
    update public.production_batches set
      target_product_id=coalesce(product.id,target_product_id), inventory_id=coalesce(item.id,inventory_id),
      raw_material_id=mat.id, target_output_qty = (p_data->>'output_qty')::integer,
      raw_material_used_qty = wanted,
      assigned_staff_id = (p_data->>'assigned_staff_id')::bigint,
      order_id = nullif(p_data->>'order_id','')::bigint,
      notes = new_notes
      where id=batch.id returning * into batch;
    result:=to_jsonb(batch); subject:=batch.batch_code;
    message:=format('changed the details of %s: %s pieces, %s %s of %s set aside',
      batch.batch_code, batch.target_output_qty, batch.raw_material_used_qty, mat.unit, mat.name);

  when 'delete_batch' then
    select * into batch from public.production_batches where id=record_id for update;
    if not found then raise exception 'That batch no longer exists.'; end if;
    if batch.status not in ('Queued','Cancelled')
       or exists (select 1 from public.production_material_usage u where u.batch_id=batch.id)
       or exists (select 1 from public.production_defect_logs d where d.batch_id=batch.id)
       or exists (select 1 from public.stock_movements m where m.batch_id=batch.id) then
      raise exception 'Only a planned or cancelled batch that never moved stock can be deleted. Re-open or cancel it instead.';
    end if;
    delete from public.production_batches where id=batch.id;
    result:=jsonb_build_object('id', batch.id, 'deleted', true, 'batch_code', batch.batch_code);
    subject:=batch.batch_code; message:=format('deleted %s, entered by mistake', batch.batch_code);

  when 'reopen_batch' then
    select * into batch from public.production_batches where id=record_id for update;
    if not found or batch.status <> 'Completed' then raise exception 'Only a finished batch can be re-opened.'; end if;
    select * into mat from public.raw_materials where id=batch.raw_material_id for update;
    select * into item from public.inventory where id=batch.inventory_id for update;
    -- What this batch actually put on the shelf, from its own history, so a
    -- pack size changed since cannot change the answer. A batch finished
    -- before the history began falls back to the arithmetic it was finished by.
    select sum(m.quantity_change) into packs from public.stock_movements m
      where m.batch_id=batch.id and m.inventory_id=item.id and m.kind in ('production','production_undone');
    packs := coalesce(packs, batch.good_output_qty / greatest(item.pack_size, 1));
    next_loose := item.loose_pieces;
    if batch.shelf_pack_size is not null then
      if batch.shelf_pack_size <> greatest(item.pack_size,1) then
        raise exception 'The selling pack size changed. Correct the shelf count before reopening this batch.';
      end if;
      shelf_pieces := item.stock::bigint * batch.shelf_pack_size + item.loose_pieces - batch.good_output_qty;
      if shelf_pieces < 0 then raise exception 'Some of these pieces are no longer on the shelf.'; end if;
      packs := item.stock - shelf_pieces / batch.shelf_pack_size;
      next_loose := shelf_pieces % batch.shelf_pack_size;
    end if;
    owed := private.reserved_units(item.id);
    if item.stock - packs < owed then
      raise exception '% of these % are no longer free on the shelf: % on hand, % set aside for waiting orders. Correct the count instead.',
        greatest(packs - greatest(item.stock - owed, 0), 0), packs, item.stock, owed;
    end if;
    select coalesce(sum(u.quantity), 0) into used from public.production_material_usage u where u.batch_id=batch.id;
    perform private.set_stock_context('production_undone', reason, null, batch.order_id, null, batch.id);
    if packs <> 0 or next_loose <> item.loose_pieces then
      update public.inventory set stock=stock-packs, loose_pieces=next_loose where id=item.id;
    end if;
    for usage_row in select * from public.production_material_usage where batch_id=batch.id order by id loop
      update public.raw_material_lots set remaining=remaining+usage_row.quantity where id=usage_row.lot_id;
    end loop;
    if used > 0 then
      update public.raw_materials set stock=stock+used, updated_at=now() where id=mat.id;
    end if;
    delete from public.production_material_usage where batch_id=batch.id;
    delete from public.production_defect_logs where batch_id=batch.id;
    -- The material just returned is held for this batch again while it is re-checked.
    update public.production_batches set status='Quality Check', good_output_qty=0, damaged_qty=0,
      defect_reason=null, completed_by_staff_id=null, completed_at=null, shelf_pack_size=null,
      material_reserved=true
      where id=batch.id returning * into batch;
    result:=to_jsonb(batch); subject:=batch.batch_code;
    message:=format('re-opened %s: %s selling units of %s taken off the shelf, %s %s of %s returned',
      batch.batch_code, packs, item.name, used, mat.unit, mat.name);

  when 'cancel_supplier_order' then
    select * into po from public.raw_material_orders where id=record_id for update;
    if not found or po.status not in ('Ordered','Delivery Scheduled','In Transit') then
      raise exception 'Only a supplier order that has not been received can be cancelled.';
    end if;
    update public.raw_material_orders set status='Cancelled' where id=po.id returning * into po;
    result:=to_jsonb(po); subject:='PO-'||po.id;
    message:=format('cancelled supplier order #%s', po.id);

  when 'delete_supplier_order' then
    select * into po from public.raw_material_orders where id=record_id for update;
    if not found then raise exception 'That supplier order no longer exists.'; end if;
    if po.status = 'Arrived'
       or exists (select 1 from public.raw_material_lots l where l.order_id=po.id)
       or exists (select 1 from public.stock_movements m where m.supplier_order_id=po.id) then
      raise exception 'This order was received, so its stock and history stay. Cancel claims through the claim review instead.';
    end if;
    delete from public.raw_material_orders where id=po.id;
    result:=jsonb_build_object('id', po.id, 'deleted', true);
    subject:='PO-'||po.id; message:=format('deleted supplier order #%s, entered by mistake', po.id);

  when 'delete_recipe' then
    select * into recipe from public.production_recipes where id=record_id for update;
    if not found then raise exception 'That recipe was already removed.'; end if;
    delete from public.production_recipes where id=recipe.id;
    result:=jsonb_build_object('id', recipe.id, 'deleted', true);
    message:='removed a material recipe';

  else raise exception 'This correction is not supported.';
  end case;

  insert into public.activity_log(id,type,staff_name,actor_staff_id,description,subject,at)
    values(nextval('private.workshop_id_seq'),'stock',actor.name,actor.id,
      message||coalesce('. Reason: '||reason,'')||'. Done by '||actor.name||'.',subject,now());
  insert into private.workshop_requests values(p_request_id,actor.id,p_action,p_data,result);
  return result;
end $fn$;

commit;
