-- Purchasing and production extension. Apply after schema.sql on existing installs.
-- All stock writes go through one authenticated transaction boundary. Public RPC
-- is an invoker; the privileged implementation lives outside the exposed schema.
create sequence if not exists private.workshop_id_seq start 4000000000000000;

create table if not exists public.raw_materials (
  id bigint primary key default nextval('private.workshop_id_seq'),
  sku text not null unique check (length(trim(sku)) > 0),
  name text not null check (length(trim(name)) > 0),
  material_type text not null default 'sheet' check (material_type in ('sheet','block','adhesive','wire')),
  density numeric check (density > 0), thickness_in numeric check (thickness_in > 0),
  length_ft numeric check (length_ft > 0), width_ft numeric check (width_ft > 0),
  unit text not null default 'sheet' check (length(trim(unit)) > 0),
  stock integer not null default 0 check (stock between 0 and 2000000000),
  low_stock_threshold integer not null default 20 check (low_stock_threshold between 0 and 2000000000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.raw_material_orders (
  id bigint primary key default nextval('private.workshop_id_seq'),
  supplier_id bigint not null references public.suppliers(id),
  raw_material_id bigint not null references public.raw_materials(id),
  quantity_ordered integer not null check (quantity_ordered between 1 and 2000000000),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  total_cost numeric generated always as (quantity_ordered::numeric * unit_price) stored,
  status text not null default 'Ordered' check (status in ('Ordered','Delivery Scheduled','In Transit','Arrived','Cancelled')),
  order_date date not null default current_date, expected_delivery_date date, actual_delivery_date date,
  quantity_arrived integer not null default 0 check (quantity_arrived between 0 and 2000000000),
  quantity_lost_transit integer not null default 0 check (quantity_lost_transit between 0 and quantity_arrived),
  quantity_usable integer generated always as (quantity_arrived - quantity_lost_transit) stored,
  transit_loss_reason text, carrier_notes text,
  claim_status text not null default 'None' check (claim_status in ('None','Needs review','Resolved')),
  claim_notes text, claim_reviewed_by bigint references public.staff(id), claim_reviewed_at timestamptz,
  received_by_staff_id bigint references public.staff(id), created_by_staff_id bigint not null references public.staff(id),
  created_at timestamptz not null default now(),
  check (quantity_lost_transit = 0 or length(trim(transit_loss_reason)) > 0)
);
create table if not exists public.production_recipes (
  id bigint primary key default nextval('private.workshop_id_seq'),
  product_id bigint not null references public.products(id),
  raw_material_id bigint not null references public.raw_materials(id),
  material_qty integer not null check (material_qty between 1 and 2000000000),
  output_qty integer not null check (output_qty between 1 and 2000000000),
  unique(product_id, raw_material_id)
);
create table if not exists public.production_batches (
  id bigint primary key default nextval('private.workshop_id_seq'),
  batch_code text not null unique,
  target_product_id bigint not null references public.products(id),
  inventory_id bigint not null references public.inventory(id),
  raw_material_id bigint not null references public.raw_materials(id),
  raw_material_used_qty integer not null check (raw_material_used_qty between 1 and 2000000000),
  target_output_qty integer not null check (target_output_qty between 1 and 2000000000),
  good_output_qty integer not null default 0 check (good_output_qty between 0 and 2000000000),
  damaged_qty integer not null default 0 check (damaged_qty between 0 and 2000000000),
  defect_reason text,
  status text not null default 'Queued' check (status in ('Queued','In Progress','Quality Check','Completed','Cancelled')),
  assigned_staff_id bigint not null references public.staff(id), order_id bigint references public.orders(id), notes text,
  created_by_staff_id bigint not null references public.staff(id), completed_by_staff_id bigint references public.staff(id),
  started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.raw_material_lots (
  id bigint primary key default nextval('private.workshop_id_seq'),
  raw_material_id bigint not null references public.raw_materials(id),
  order_id bigint unique references public.raw_material_orders(id),
  quantity integer not null check (quantity > 0), remaining integer not null check (remaining between 0 and quantity),
  source text not null, created_at timestamptz not null default now()
);
create table if not exists public.production_material_usage (
  id bigint primary key default nextval('private.workshop_id_seq'),
  batch_id bigint not null references public.production_batches(id),
  lot_id bigint not null references public.raw_material_lots(id),
  quantity integer not null check (quantity > 0), unique(batch_id,lot_id)
);
create table if not exists public.production_defect_logs (
  id bigint primary key default nextval('private.workshop_id_seq'),
  batch_id bigint not null unique references public.production_batches(id),
  product_id bigint not null references public.products(id),
  damaged_quantity integer not null check (damaged_quantity > 0), reason text not null,
  logged_by_staff_id bigint not null references public.staff(id), logged_at timestamptz not null default now()
);
-- Requests are replayable after a lost response; payload changes require a new key.
create table if not exists private.workshop_requests (
  request_id uuid primary key, actor_id bigint not null, action text not null, payload jsonb not null, result jsonb not null
);
alter table private.workshop_requests enable row level security;
revoke all on private.workshop_requests from public, anon, authenticated;

create index if not exists material_orders_material_idx on public.raw_material_orders(raw_material_id);
create index if not exists material_orders_supplier_idx on public.raw_material_orders(supplier_id);
create index if not exists batches_material_status_idx on public.production_batches(raw_material_id,status);
create index if not exists batches_product_idx on public.production_batches(target_product_id);
create index if not exists batches_inventory_idx on public.production_batches(inventory_id);
create index if not exists batches_staff_idx on public.production_batches(assigned_staff_id);
create index if not exists batches_order_idx on public.production_batches(order_id);
create index if not exists lots_material_idx on public.raw_material_lots(raw_material_id,id);
create index if not exists usage_lot_idx on public.production_material_usage(lot_id);
create index if not exists recipes_material_idx on public.production_recipes(raw_material_id);
create index if not exists defects_product_idx on public.production_defect_logs(product_id);
create index if not exists batches_completed_by_idx on public.production_batches(completed_by_staff_id);
create index if not exists batches_created_by_idx on public.production_batches(created_by_staff_id);
create index if not exists defects_logged_by_idx on public.production_defect_logs(logged_by_staff_id);
create index if not exists material_orders_reviewed_by_idx on public.raw_material_orders(claim_reviewed_by);
create index if not exists material_orders_created_by_idx on public.raw_material_orders(created_by_staff_id);
create index if not exists material_orders_received_by_idx on public.raw_material_orders(received_by_staff_id);

do $policies$
declare t text;
begin
  foreach t in array array['raw_materials','raw_material_orders','production_recipes','production_batches','raw_material_lots','production_material_usage','production_defect_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists "Active staff read workshop" on public.%I', t);
    execute format('create policy "Active staff read workshop" on public.%I for select to authenticated using ((select private.is_active_staff()))', t);
  end loop;
end $policies$;

create or replace function private.workshop_command(p_action text, p_data jsonb, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  actor public.staff; mat public.raw_materials; po public.raw_material_orders;
  batch public.production_batches; item public.inventory; product public.products;
  lot public.raw_material_lots; previous private.workshop_requests;
  result jsonb; record_id bigint; qty integer; damaged integer; good integer; reserved bigint;
  remaining_qty integer; take_qty integer; reason text; message text; subject text;
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
    select * into mat from public.raw_materials where id=po.raw_material_id for update;
    good:=qty-damaged;
    update public.raw_materials set stock=stock+good,updated_at=now() where id=mat.id;
    update public.raw_material_orders set status='Arrived',actual_delivery_date=(now() at time zone 'Asia/Manila')::date,
      quantity_arrived=qty,quantity_lost_transit=damaged,transit_loss_reason=case when damaged>0 then reason end,
      claim_status=case when qty<>quantity_ordered or damaged>0 then 'Needs review' else 'None' end,received_by_staff_id=actor.id
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
    update public.raw_materials set stock=stock-remaining_qty,updated_at=now() where id=mat.id;
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
    update public.inventory set stock=stock-qty where id=item.id;
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
grant usage on schema private to authenticated;
grant execute on function private.workshop_command(text,jsonb,uuid) to authenticated;
create or replace function public.workshop_command(p_action text,p_data jsonb,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $fn$
  select private.workshop_command(p_action,p_data,p_request_id);
$fn$;
revoke all on function public.workshop_command(text,jsonb,uuid) from public,anon;
grant execute on function public.workshop_command(text,jsonb,uuid) to authenticated;

-- Copy only catalog metadata. A manager explicitly transfers counted stock;
-- this prevents double-counting sheets already available to customer orders.
insert into public.raw_materials(sku,name,material_type,thickness_in,length_ft,width_ft,unit,low_stock_threshold)
select distinct on (upper(sku)) upper(sku),name,product_type,thickness_in,length_ft,width_ft,
  case when product_type='sheet' then 'sheet' else 'block' end,20
from public.inventory where product_type in ('sheet','block') order by upper(sku),id
on conflict(sku) do nothing;
