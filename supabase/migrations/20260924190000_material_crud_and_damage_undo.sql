-- Raw material CRUD, and undoing a damage record that was entered wrong.
--
-- Non-destructive: it adds columns, constraints, functions and grants. No row
-- is deleted or overwritten. Safe to re-run.
-- Apply before deploying the matching client, then refresh open browser tabs.
-- Mirrored at the end of schema.sql (schemaInstall.test.js checks the copy).
--
-- NOTHING HERE CHANGES A FUNCTION'S SIGNATURE. An earlier migration may be run
-- again after this one -- the tests do exactly that to prove those files are
-- re-runnable -- and a second overload left behind by that would make every
-- existing call ambiguous, which fails far louder than a missing feature.

-- ============================================================
-- Raw materials carry a status and a revision, like every other record
-- ============================================================
-- A material that has been used is archived rather than deleted, so the
-- deliveries, batches and history that name it keep their meaning.
alter table public.raw_materials
  add column if not exists status text not null default 'Active',
  add column if not exists revision bigint not null default 0;
alter table public.raw_materials drop constraint if exists raw_materials_status_check;
alter table public.raw_materials add constraint raw_materials_status_check
  check (status in ('Active', 'Archived'));
create index if not exists raw_materials_status_idx on public.raw_materials (status);
drop trigger if exists raw_materials_revision on public.raw_materials;
create trigger raw_materials_revision before update on public.raw_materials
  for each row execute function private.bump_record_revision();

-- ============================================================
-- A movement can say which movement it reverses
-- ============================================================
alter table public.stock_movements
  add column if not exists reverses_movement_id bigint
    references public.stock_movements(id) on delete set null;
-- One reversal per movement. This index, not the screen, is what stops the
-- same damage record being undone twice and the stock going back twice.
create unique index if not exists stock_movements_reverses_idx
  on public.stock_movements (reverses_movement_id) where reverses_movement_id is not null;

-- `damage_undone` joins the kinds. The check is found by its definition rather
-- than by name, because the original was written inline by create table and
-- Postgres named it.
do $kinds$
declare c text;
begin
  for c in
    select con.conname from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public' and rel.relname = 'stock_movements'
      and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%kind%'
  loop
    execute format('alter table public.stock_movements drop constraint %I', c);
  end loop;
  alter table public.stock_movements add constraint stock_movements_kind_check
    check (kind in (
      'opening', 'sale', 'dispatch', 'cancellation', 'return', 'replacement',
      'damage', 'damage_undone', 'adjustment', 'delivery', 'production',
      'production_use', 'transfer'));
end $kinds$;

-- ============================================================
-- stock_command: damage, count corrections, and undoing damage
-- ============================================================
-- As before, plus `undo_damage`: a damage record entered wrong is not edited
-- away -- the ledger is append-only, and a history that can be rewritten is
-- worth nothing. The quantity goes back on the shelf as its own movement that
-- names the record it reverses, and the unique index above allows exactly one.
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
  orig public.stock_movements;
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

  if char_length(coalesce(note, '')) > 500 then raise exception 'Keep the note under 500 characters.'; end if;

  if p_action = 'undo_damage' then
    -- Putting stock back is a correction, so it sits with correcting a count
    -- rather than with recording damage: the person who mistyped asks for it.
    if actor.role not in ('Admin', 'Manager') then
      raise exception 'Only a manager or administrator can undo a damage record.';
    end if;
    if coalesce(p_data ->> 'movementId', '') !~ '^[0-9]{1,18}$' then
      raise exception 'Which damage record is not clear.';
    end if;
    select * into orig from public.stock_movements where id = (p_data ->> 'movementId')::bigint;
    if not found then raise exception 'That stock record no longer exists.'; end if;
    if orig.kind <> 'damage' then
      raise exception 'Only a damage record can be undone. Use "Correct the count" for anything else.';
    end if;
    -- Take the item's lock before asking whether this has already been undone.
    -- Asking first would let two requests both read "not yet", and the second
    -- would then fail on the unique index -- right, but with the database's
    -- words rather than these. Every writer takes this lock, so waiting here
    -- means the answer below is still true when it is acted on.
    if orig.inventory_id is not null then
      perform 1 from public.inventory where id = orig.inventory_id for update;
    elsif orig.raw_material_id is not null then
      perform 1 from public.raw_materials where id = orig.raw_material_id for update;
    end if;
    if exists (select 1 from public.stock_movements m where m.reverses_movement_id = orig.id) then
      raise exception 'That damage record has already been undone.';
    end if;
    amount := -orig.quantity_change;
    if amount < 1 then raise exception 'That damage record has nothing to put back.'; end if;

    -- No default note: the kind already reads "Damage record undone" in the
    -- history, and repeating it under every line says nothing twice. A note is
    -- carried only when somebody wrote one.
    perform private.set_stock_context('damage_undone', null, note);

    if orig.inventory_id is not null then
      select * into item from public.inventory where id = orig.inventory_id for update;
      if not found then raise exception 'That stock record no longer exists.'; end if;
      update public.inventory set stock = stock + amount where id = item.id returning * into item;
      result := jsonb_build_object('target', 'product', 'inventory', to_jsonb(item), 'undid', orig.id);
    elsif orig.raw_material_id is not null then
      select * into mat from public.raw_materials where id = orig.raw_material_id for update;
      if not found then raise exception 'That raw material no longer exists.'; end if;
      -- Material stock is also held as lots, and the two must agree, so what
      -- goes back opens a lot of its own rather than reopening a spent one.
      insert into public.raw_material_lots(raw_material_id, quantity, remaining, source)
        values (mat.id, amount, amount, 'Damage undone');
      update public.raw_materials set stock = stock + amount, updated_at = now()
        where id = mat.id returning * into mat;
      result := jsonb_build_object('target', 'material', 'material', to_jsonb(mat), 'undid', orig.id);
    else
      raise exception 'That damage record is not linked to an item.';
    end if;

    -- Written here rather than carried in the movement context, so the link
    -- does not depend on which version of the trigger is installed. The row is
    -- the one the trigger has just written for this item: every writer takes
    -- the item's lock first, so nothing else can have added one in between.
    -- The unique index on the column is what makes a second undo impossible.
    update public.stock_movements set reverses_movement_id = orig.id
      where id = (select max(m.id) from public.stock_movements m
        where m.inventory_id is not distinct from orig.inventory_id
          and m.raw_material_id is not distinct from orig.raw_material_id);

    insert into private.stock_requests(request_id, actor_id, action, payload, result)
      values (p_request_id, actor.id, p_action, p_data, result);
    return result;
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

-- ============================================================
-- Raw materials: correcting the details, and removing one safely
-- ============================================================
-- save_material used to update the name and the reorder point and nothing
-- else, so a code, a kind, a unit or a measurement typed wrong when the
-- material was added could never be put right. Every field is editable now.
--
-- Each one is written only when the payload carries its key, so a screen that
-- sends part of a material leaves the rest as it stands; a measurement is
-- cleared by sending it empty. The revision is checked when it is supplied,
-- the same optimistic check the product and order screens make.
create or replace function private.save_material(actor public.staff, p_data jsonb)
returns public.raw_materials language plpgsql security definer set search_path = '' as $fn$
declare
  mat public.raw_materials;
  record_id bigint := nullif(p_data ->> 'id', '')::bigint;
begin
  -- workshop_command checks this too before it gets here. Repeated rather than
  -- trusted, so the rule travels with the function that does the writing.
  if actor.role not in ('Admin', 'Manager') then
    raise exception 'Only a manager or administrator can change a raw material.';
  end if;
  if record_id is null then
    insert into public.raw_materials(sku, name, material_type, density, thickness_in,
      length_ft, width_ft, unit, low_stock_threshold)
    values (upper(btrim(p_data ->> 'sku')), btrim(p_data ->> 'name'), p_data ->> 'material_type',
      nullif(p_data ->> 'density', '')::numeric, nullif(p_data ->> 'thickness_in', '')::numeric,
      nullif(p_data ->> 'length_ft', '')::numeric, nullif(p_data ->> 'width_ft', '')::numeric,
      btrim(p_data ->> 'unit'), (p_data ->> 'low_stock_threshold')::integer)
    returning * into mat;
    return mat;
  end if;

  select * into mat from public.raw_materials where id = record_id for update;
  if not found then raise exception 'This material no longer exists.'; end if;
  if p_data ? 'expectedRevision'
     and mat.revision is distinct from nullif(p_data ->> 'expectedRevision', '')::bigint then
    raise exception using errcode = '40001',
      message = 'This material changed while you were editing it. Refresh it and look again.';
  end if;
  if mat.status = 'Archived' then
    raise exception 'This material is archived. Put it back in use before changing it.';
  end if;

  update public.raw_materials set
    sku = coalesce(nullif(upper(btrim(p_data ->> 'sku')), ''), mat.sku),
    name = coalesce(nullif(btrim(p_data ->> 'name'), ''), mat.name),
    material_type = coalesce(nullif(p_data ->> 'material_type', ''), mat.material_type),
    unit = coalesce(nullif(btrim(p_data ->> 'unit'), ''), mat.unit),
    density = case when p_data ? 'density'
      then nullif(p_data ->> 'density', '')::numeric else mat.density end,
    thickness_in = case when p_data ? 'thickness_in'
      then nullif(p_data ->> 'thickness_in', '')::numeric else mat.thickness_in end,
    length_ft = case when p_data ? 'length_ft'
      then nullif(p_data ->> 'length_ft', '')::numeric else mat.length_ft end,
    width_ft = case when p_data ? 'width_ft'
      then nullif(p_data ->> 'width_ft', '')::numeric else mat.width_ft end,
    low_stock_threshold = coalesce(nullif(p_data ->> 'low_stock_threshold', '')::integer,
      mat.low_stock_threshold),
    updated_at = now()
  where id = mat.id returning * into mat;
  return mat;
end;
$fn$;
revoke all on function private.save_material(public.staff, jsonb) from public, anon, authenticated;

-- Removing a raw material, the same way a product is removed: archived when
-- anything refers to it, so every delivery, batch and history entry that names
-- it keeps its meaning; deleted outright only when nothing does. Stock still on
-- the shelf counts as a reference -- a count is a fact about the workshop, and
-- deleting the record would throw it away silently.
create or replace function public.remove_material(p_material_id bigint, p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  mat public.raw_materials;
  referenced boolean;
begin
  if (select private.caller_role()) is distinct from 'Admin' then
    raise exception 'Only an administrator can remove a raw material.';
  end if;
  select * into mat from public.raw_materials where id = p_material_id for update;
  if not found then raise exception 'That raw material no longer exists.'; end if;
  if mat.revision is distinct from p_expected_revision then
    raise exception using errcode = '40001',
      message = 'This material changed. Refresh it before trying again.';
  end if;

  if exists (select 1 from public.raw_material_orders o where o.raw_material_id = mat.id
      and o.status in ('Ordered', 'Delivery Scheduled', 'In Transit')) then
    raise exception 'A supplier order for this material has not arrived yet. Receive or call off that order first.';
  end if;
  if exists (select 1 from public.production_batches b where b.raw_material_id = mat.id
      and b.status in ('Queued', 'In Progress', 'Quality Check')) then
    raise exception 'A batch on the floor is using this material. Finish or call off that batch first.';
  end if;

  referenced := mat.stock > 0
    or exists (select 1 from public.raw_material_orders o where o.raw_material_id = mat.id)
    or exists (select 1 from public.production_recipes r where r.raw_material_id = mat.id)
    or exists (select 1 from public.production_batches b where b.raw_material_id = mat.id)
    -- Lots cover production_material_usage too: a usage row must name a lot,
    -- and a lot must name this material.
    or exists (select 1 from public.raw_material_lots l where l.raw_material_id = mat.id)
    or exists (select 1 from public.stock_movements m where m.raw_material_id = mat.id
        and m.kind <> 'opening');

  if referenced then
    update public.raw_materials set status = 'Archived', updated_at = now() where id = mat.id;
    return jsonb_build_object('outcome', 'archived');
  end if;
  delete from public.raw_materials where id = mat.id;
  return jsonb_build_object('outcome', 'deleted');
end;
$fn$;
revoke all on function public.remove_material(bigint, bigint) from public, anon;
grant execute on function public.remove_material(bigint, bigint) to authenticated;

-- An archived material can be put back in use. Same hand as archiving it.
create or replace function public.restore_material(p_material_id bigint, p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare mat public.raw_materials;
begin
  if (select private.caller_role()) is distinct from 'Admin' then
    raise exception 'Only an administrator can put a raw material back in use.';
  end if;
  select * into mat from public.raw_materials where id = p_material_id for update;
  if not found then raise exception 'That raw material no longer exists.'; end if;
  if mat.revision is distinct from p_expected_revision then
    raise exception using errcode = '40001',
      message = 'This material changed. Refresh it before trying again.';
  end if;
  update public.raw_materials set status = 'Active', updated_at = now() where id = mat.id;
  return jsonb_build_object('outcome', 'restored');
end;
$fn$;
revoke all on function public.restore_material(bigint, bigint) from public, anon;
grant execute on function public.restore_material(bigint, bigint) to authenticated;

-- workshop_command, unchanged except that saving a raw material now goes
-- through private.save_material above, so adding one and correcting one are
-- the same rule in one place.
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
  insert into public.activity_log(id,type,staff_name,description,subject,at)
    values(nextval('private.workshop_id_seq'),'stock',actor.name,message||'. Approved by '||actor.name||'.',subject,now());
  insert into private.workshop_requests values(p_request_id,actor.id,p_action,p_data,result);
  return result;
end $fn$;
revoke all on function private.workshop_command(text,jsonb,uuid) from public,anon;
grant execute on function private.workshop_command(text,jsonb,uuid) to authenticated;
