-- Which raw materials each supplier provides, set by a manager before any order
-- is placed. A material can have several suppliers, and a supplier several
-- materials, even though the shop mostly buys from one.
create table if not exists public.supplier_materials (
  id bigint primary key default nextval('private.workshop_id_seq'),
  supplier_id bigint not null references public.suppliers(id) on delete cascade,
  raw_material_id bigint not null references public.raw_materials(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (supplier_id, raw_material_id)
);

alter table public.supplier_materials enable row level security;
drop policy if exists "Active staff read supplier materials" on public.supplier_materials;
create policy "Active staff read supplier materials" on public.supplier_materials for select
  using (private.is_active_staff());
-- No write policies: changes go through set_supplier_materials.
revoke insert, update, delete on public.supplier_materials from anon, authenticated;
grant select on public.supplier_materials to authenticated;

create or replace function public.set_supplier_materials(p_supplier_id bigint, p_material_ids bigint[])
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  who text := private.caller_role();
  actor text;
  sup public.suppliers;
  ids bigint[] := coalesce(p_material_ids, '{}');
begin
  if who is null or who not in ('Admin', 'Manager') then
    raise exception 'Only a manager or administrator can change what a supplier provides.';
  end if;
  select * into sup from public.suppliers where id = p_supplier_id for update;
  if not found then raise exception 'That supplier no longer exists.'; end if;
  if exists (select 1 from unnest(ids) i where not exists (select 1 from public.raw_materials m where m.id = i)) then
    raise exception 'One of those materials no longer exists. Refresh and try again.';
  end if;

  delete from public.supplier_materials where supplier_id = sup.id and raw_material_id <> all (ids);
  insert into public.supplier_materials (supplier_id, raw_material_id)
    select sup.id, i from unnest(ids) i
    on conflict (supplier_id, raw_material_id) do nothing;

  select s.name into actor from public.staff s
    where lower(s.email) = lower((select auth.jwt()) ->> 'email') limit 1;
  insert into public.activity_log (id, type, staff_name, description, subject, at)
    values (nextval('private.workshop_id_seq'), 'stock', coalesce(actor, 'System'),
      format('%s now supplies %s material(s)', sup.name, cardinality(ids)), sup.name, now());

  return jsonb_build_object('supplier_id', sup.id,
    'rows', coalesce((select jsonb_agg(to_jsonb(sm) order by sm.id) from public.supplier_materials sm where sm.supplier_id = sup.id), '[]'::jsonb));
end;
$fn$;
revoke all on function public.set_supplier_materials(bigint, bigint[]) from public, anon;
grant execute on function public.set_supplier_materials(bigint, bigint[]) to authenticated;

-- Start from what the orders already show, so nothing looks unlinked on day one.
insert into public.supplier_materials (supplier_id, raw_material_id)
  select distinct supplier_id, raw_material_id from public.raw_material_orders
  where supplier_id is not null and raw_material_id is not null
on conflict (supplier_id, raw_material_id) do nothing;
