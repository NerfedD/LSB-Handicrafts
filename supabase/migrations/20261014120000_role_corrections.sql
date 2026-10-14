-- Corrections: undoing a mistake in production and purchasing, by role.
--
-- Until now a batch could only go forward. A planned batch could be cancelled,
-- but once it was in production nobody -- administrator included -- could
-- cancel it, step it back, fix its details, delete one entered by mistake or
-- undo one finished with the wrong counts. Supplier orders could not be called
-- off once on the way, recipes could not be removed, and a supplier with any
-- purchase history could never be removed. Each of those is a mistake staff
-- make, and each had no way back.
--
--   Production   step a batch back one stage; cancel a planned batch
--   Manager      also cancel a batch at any unfinished stage and change its
--                details; cancel a supplier order on the way; remove a recipe
--   Admin        also delete a batch or supplier order entered by mistake,
--                re-open a finished batch, remove or restore a supplier
--
-- The super administrator is an Admin here: its extra protections are about
-- its own account, not about records.
--
-- Additive: one column, one constraint widened, functions and a trigger. The
-- only rows it can delete are ones an administrator deletes through it, and
-- only when nothing refers to them; every correction is in the activity log.
-- Safe to re-run. Apply before deploying the matching client.
-- Mirrored at the end of schema.sql (schemaInstall.test.js checks the copy).

-- ============================================================
-- A re-opened batch has its own kind in the stock history
-- ============================================================
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
      'production_use', 'production_undone', 'transfer'));
end $kinds$;

-- ============================================================
-- What the waiting orders still need of one stock row
-- ============================================================
-- The database's copy of reservedByProduct in src/utils/stockLedger.js: the
-- units each Pending order still owes, line by line, never below zero.
create or replace function private.reserved_units(p_inventory_id bigint)
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
      cross join lateral jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) line
      where o.status = 'Pending' and line ->> 'productId' = p_inventory_id::text
    ) l
  ) s;
$fn$;
revoke all on function private.reserved_units(bigint) from public, anon;
grant execute on function private.reserved_units(bigint) to authenticated;

-- ============================================================
-- workshop_corrections
-- ============================================================
-- The same contract as workshop_command: one transaction against locked rows,
-- a request id that replays its first answer, and an activity-log line naming
-- who did it. Kept apart from workshop_command so the forward path is not
-- rewritten to add the way back.
create or replace function private.workshop_corrections(p_action text, p_data jsonb, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  actor public.staff; mat public.raw_materials; po public.raw_material_orders;
  batch public.production_batches; item public.inventory; recipe public.production_recipes;
  usage_row public.production_material_usage; previous private.workshop_requests;
  result jsonb; record_id bigint; reason text; message text; subject text;
  wanted integer; free bigint; packs bigint; used bigint; owed numeric; new_notes text;
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
    update public.production_batches
      set status = case when batch.status='Quality Check' then 'In Progress' else 'Queued' end,
          started_at = case when batch.status='In Progress' then null else started_at end
      where id=batch.id returning * into batch;
    result:=to_jsonb(batch); subject:=batch.batch_code;
    message:=format('moved %s back to %s', batch.batch_code, batch.status);

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
    select * into mat from public.raw_materials where id=batch.raw_material_id for update;
    perform private.whole_count(p_data, 'output_qty', 'The target pieces', 1);
    wanted := private.whole_count(p_data, 'material_qty', 'The material to set aside', 1);
    select mat.stock - coalesce(sum(b.raw_material_used_qty), 0) into free
      from public.production_batches b
      where b.raw_material_id = mat.id and b.id <> batch.id and b.status in ('Queued','In Progress','Quality Check');
    if wanted > free then
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
      target_output_qty = (p_data->>'output_qty')::integer,
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
    select * into item from public.inventory where id=batch.inventory_id for update;
    select * into mat from public.raw_materials where id=batch.raw_material_id for update;
    -- What this batch actually put on the shelf, from its own history, so a
    -- pack size changed since cannot change the answer. A batch finished
    -- before the history began falls back to the arithmetic it was finished by.
    select sum(m.quantity_change) into packs from public.stock_movements m
      where m.batch_id=batch.id and m.inventory_id=item.id and m.kind in ('production','production_undone');
    packs := coalesce(packs, batch.good_output_qty / greatest(item.pack_size, 1));
    owed := private.reserved_units(item.id);
    if item.stock - packs < owed then
      raise exception '% of these % are no longer free on the shelf: % on hand, % set aside for waiting orders. Correct the count instead.',
        greatest(packs - greatest(item.stock - owed, 0), 0), packs, item.stock, owed;
    end if;
    select coalesce(sum(u.quantity), 0) into used from public.production_material_usage u where u.batch_id=batch.id;
    perform private.set_stock_context('production_undone', reason, null, batch.order_id, null, batch.id);
    if packs <> 0 then
      update public.inventory set stock=stock-packs where id=item.id;
    end if;
    for usage_row in select * from public.production_material_usage where batch_id=batch.id order by id loop
      update public.raw_material_lots set remaining=remaining+usage_row.quantity where id=usage_row.lot_id;
    end loop;
    if used > 0 then
      update public.raw_materials set stock=stock+used, updated_at=now() where id=mat.id;
    end if;
    delete from public.production_material_usage where batch_id=batch.id;
    delete from public.production_defect_logs where batch_id=batch.id;
    update public.production_batches set status='Quality Check', good_output_qty=0, damaged_qty=0,
      defect_reason=null, completed_by_staff_id=null, completed_at=null
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

  insert into public.activity_log(id,type,staff_name,description,subject,at)
    values(nextval('private.workshop_id_seq'),'stock',actor.name,
      message||coalesce('. Reason: '||reason,'')||'. Done by '||actor.name||'.',subject,now());
  insert into private.workshop_requests values(p_request_id,actor.id,p_action,p_data,result);
  return result;
end $fn$;
revoke all on function private.workshop_corrections(text,jsonb,uuid) from public,anon;
grant execute on function private.workshop_corrections(text,jsonb,uuid) to authenticated;

-- ============================================================
-- Suppliers: archived rather than lost
-- ============================================================
alter table public.suppliers add column if not exists status text not null default 'Active';
alter table public.suppliers drop constraint if exists suppliers_status_check;
alter table public.suppliers add constraint suppliers_status_check check (status in ('Active', 'Archived'));

-- Archiving goes through remove_supplier, which knows what it means; a form
-- writing the column directly would skip every check below.
create or replace function private.guard_supplier_status()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  if current_user in ('authenticated', 'anon') and new.status is distinct from old.status then
    raise exception 'A supplier is removed or put back with "Remove supplier" or "Put back in use".';
  end if;
  return new;
end;
$fn$;
revoke all on function private.guard_supplier_status() from public, anon, authenticated;
drop trigger if exists suppliers_guard_status on public.suppliers;
create trigger suppliers_guard_status before update of status on public.suppliers
  for each row execute function private.guard_supplier_status();

-- The same rule as a product or a raw material: archived if anything refers to
-- it, deleted only if nothing does. Refused while an order is still coming.
create or replace function public.remove_supplier(p_supplier_id bigint, p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  sup public.suppliers;
  actor text;
begin
  if (select private.caller_role()) is distinct from 'Admin' then
    raise exception 'Only an administrator can remove a supplier.';
  end if;
  select * into sup from public.suppliers where id = p_supplier_id for update;
  if not found then raise exception 'That supplier no longer exists.'; end if;
  if sup.revision is distinct from p_expected_revision then
    raise exception using errcode = '40001',
      message = 'This supplier changed. Refresh it before trying again.';
  end if;
  if exists (select 1 from public.raw_material_orders o where o.supplier_id = sup.id
      and o.status in ('Ordered', 'Delivery Scheduled', 'In Transit')) then
    raise exception 'An order from this supplier has not arrived yet. Receive or cancel it first.';
  end if;
  select s.name into actor from public.staff s where lower(s.email) = lower(auth.jwt() ->> 'email');
  if exists (select 1 from public.raw_material_orders o where o.supplier_id = sup.id) then
    update public.suppliers set status = 'Archived', updated_at = now() where id = sup.id;
    insert into public.activity_log(id, type, staff_name, description, subject, at)
      values (nextval('private.workshop_id_seq'), 'stock', coalesce(actor, 'System'),
        format('%s is no longer used; their purchase history is kept', sup.name), sup.name, now());
    return jsonb_build_object('outcome', 'archived');
  end if;
  delete from public.suppliers where id = sup.id;
  return jsonb_build_object('outcome', 'deleted');
end;
$fn$;
revoke all on function public.remove_supplier(bigint, bigint) from public, anon;
grant execute on function public.remove_supplier(bigint, bigint) to authenticated;

create or replace function public.restore_supplier(p_supplier_id bigint, p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare sup public.suppliers;
begin
  if (select private.caller_role()) is distinct from 'Admin' then
    raise exception 'Only an administrator can put a supplier back in use.';
  end if;
  select * into sup from public.suppliers where id = p_supplier_id for update;
  if not found then raise exception 'That supplier no longer exists.'; end if;
  if sup.revision is distinct from p_expected_revision then
    raise exception using errcode = '40001',
      message = 'This supplier changed. Refresh it before trying again.';
  end if;
  update public.suppliers set status = 'Active', updated_at = now() where id = sup.id;
  return jsonb_build_object('outcome', 'restored');
end;
$fn$;
revoke all on function public.restore_supplier(bigint, bigint) from public, anon;
grant execute on function public.restore_supplier(bigint, bigint) to authenticated;

-- A new supplier order goes to a supplier still in use.
create or replace function private.refuse_archived_supplier(p_data jsonb, p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $fn$
declare supplier_name text;
begin
  if p_request_id is not null
     and exists (select 1 from private.workshop_requests where request_id = p_request_id) then
    return;
  end if;
  if nullif(p_data ->> 'id', '') is not null or coalesce(p_data ->> 'supplier_id', '') !~ '^[0-9]{1,18}$' then return; end if;
  select name into supplier_name from public.suppliers
    where id = (p_data ->> 'supplier_id')::bigint and status = 'Archived';
  if found then
    raise exception '% is no longer used. Put them back in use before ordering from them.', supplier_name;
  end if;
end;
$fn$;
revoke all on function private.refuse_archived_supplier(jsonb, uuid) from public, anon;
grant execute on function private.refuse_archived_supplier(jsonb, uuid) to authenticated;

-- ============================================================
-- The one entry point
-- ============================================================
create or replace function public.workshop_command(p_action text, p_data jsonb, p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $fn$
begin
  if p_action in ('batch_step_back', 'cancel_batch', 'edit_batch', 'delete_batch', 'reopen_batch',
                  'cancel_supplier_order', 'delete_supplier_order', 'delete_recipe') then
    return private.workshop_corrections(p_action, p_data, p_request_id);
  end if;
  perform private.workshop_precheck(p_action, p_data, p_request_id);
  if p_action = 'save_order' then
    perform private.refuse_archived_supplier(p_data, p_request_id);
    perform private.amend_supplier_order(p_data, p_request_id);
  end if;
  return private.workshop_command(p_action, p_data, p_request_id);
end;
$fn$;
revoke all on function public.workshop_command(text, jsonb, uuid) from public, anon;
grant execute on function public.workshop_command(text, jsonb, uuid) to authenticated;
