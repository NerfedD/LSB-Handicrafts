-- Controlled inputs for purchasing, production and the catalogue, and product
-- photos.
--
-- Non-destructive: it adds a column, two tables, functions and triggers. No row
-- is deleted. One thing is rewritten on purpose: category labels that differ
-- only in capitals or spacing ("Styro Balls", "styro  balls ") are merged into
-- the spelling most products already use, because that duplication is exactly
-- what the category list exists to stop.
-- Safe to re-run. Apply before deploying the matching client.
-- Mirrored at the end of schema.sql (schemaInstall.test.js checks the copy).
--
-- NOTHING HERE CHANGES A FUNCTION'S SIGNATURE, for the reason given at the top
-- of 20260924190000_material_crud_and_damage_undo.sql.
--
-- ASSUMED LIMITS, where the business had not set one. They are generous on
-- purpose -- they exist to catch a typing slip, not to model the workshop:
--   measurements        more than 0; at most 240 inches or 200 feet; 3 decimals
--   density             more than 0; at most 25,000 kg/m³ (steel wire is ~7,850)
--   weight per unit     more than 0; at most 10,000 kg
--   money               0 to 100,000,000; 2 decimals (the products' own limit)
--   counts              whole numbers, 0 or 1 to 2,000,000,000 (the columns' limit)
--   codes               2 to 40 letters, digits and single hyphens (SS-100-4X8)
--   units               1 to 24 lower-case letters and spaces (sheet, roll, kg)
--   category names      1 to 60 characters, no control characters

-- ============================================================
-- Helpers
-- ============================================================
-- "Today" is the shop's today. The server runs in UTC, and eight hours of the
-- Philippine morning would otherwise still be "yesterday".
create or replace function private.shop_today()
returns date language sql stable set search_path = '' as $fn$
  select (now() at time zone 'Asia/Manila')::date;
$fn$;
revoke all on function private.shop_today() from public, anon;
grant execute on function private.shop_today() to authenticated;

-- Collapses runs of spaces and trims. Null for an empty label.
create or replace function private.tidy_label(p_text text)
returns text language sql immutable set search_path = '' as $fn$
  select nullif(btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g')), '');
$fn$;
revoke all on function private.tidy_label(text) from public, anon;
grant execute on function private.tidy_label(text) to authenticated;

-- A whole number from a form field, or a sentence saying what is wrong.
create or replace function private.whole_count(p_data jsonb, p_key text, p_label text,
  p_min integer default 0, p_max integer default 2000000000)
returns integer language plpgsql immutable set search_path = '' as $fn$
declare raw text := btrim(coalesce(p_data ->> p_key, ''));
begin
  if raw = '' then raise exception 'Enter %.', lower(p_label); end if;
  if raw !~ '^[0-9]{1,10}$' then
    raise exception '% must be a whole number, such as 12.', p_label;
  end if;
  if raw::bigint < p_min or raw::bigint > p_max then
    raise exception '% must be between % and %.', p_label, p_min,
      to_char(p_max, 'FM9,999,999,999');
  end if;
  return raw::integer;
end;
$fn$;
revoke all on function private.whole_count(jsonb, text, text, integer, integer) from public, anon;
grant execute on function private.whole_count(jsonb, text, text, integer, integer) to authenticated;

-- A measurement from a form field: blank is "not recorded", anything else must
-- be a positive number within the limit. Whole numbers need no decimal point.
create or replace function private.measure_value(p_data jsonb, p_key text, p_label text,
  p_max numeric, p_unit text)
returns numeric language plpgsql immutable set search_path = '' as $fn$
declare raw text := btrim(coalesce(p_data ->> p_key, ''));
begin
  if raw = '' then return null; end if;
  if raw !~ '^([0-9]{1,9}(\.[0-9]{1,3})?|\.[0-9]{1,3})$' then
    raise exception '% must be a number above 0, with at most 3 decimal places.', p_label;
  end if;
  if raw::numeric <= 0 or raw::numeric > p_max then
    raise exception '% must be more than 0 and no more than % %.', p_label,
      to_char(p_max, 'FM999,999'), p_unit;
  end if;
  return raw::numeric;
end;
$fn$;
revoke all on function private.measure_value(jsonb, text, text, numeric, text) from public, anon;
grant execute on function private.measure_value(jsonb, text, text, numeric, text) to authenticated;

-- ============================================================
-- A promised date is never set in the past
-- ============================================================
-- Checked on a new row, and on a row whose date is being CHANGED. A delivery
-- promised for last week keeps its date, and can still have its driver or its
-- address corrected, because the check only looks at a date somebody typed.
create or replace function private.guard_promised_date()
returns trigger language plpgsql set search_path = '' as $fn$
declare
  col text := tg_argv[0];
  promised date := nullif(to_jsonb(new) ->> col, '')::date;
  was date;
begin
  if tg_op = 'UPDATE' then was := nullif(to_jsonb(old) ->> col, '')::date; end if;
  if promised is not null and promised < private.shop_today()
     and (tg_op = 'INSERT' or promised is distinct from was) then
    raise exception 'The promised date (%) has already passed. Choose today or a later date.',
      to_char(promised, 'FMDD Mon YYYY');
  end if;
  return new;
end;
$fn$;
revoke all on function private.guard_promised_date() from public, anon;
grant execute on function private.guard_promised_date() to authenticated;

drop trigger if exists deliveries_guard_due_on on public.deliveries;
create trigger deliveries_guard_due_on before insert or update of due_on on public.deliveries
  for each row execute function private.guard_promised_date('due_on');
drop trigger if exists material_orders_guard_promised on public.raw_material_orders;
create trigger material_orders_guard_promised
  before insert or update of expected_delivery_date on public.raw_material_orders
  for each row execute function private.guard_promised_date('expected_delivery_date');

-- ============================================================
-- Product measurements are positive
-- ============================================================
-- A trigger rather than a check constraint, for the same reason as above: a
-- constraint is re-checked on every update of the row, so one old row with a
-- zero width would refuse a price change. This looks only at a value that is
-- being written for the first time or changed.
create or replace function private.guard_product_measurements()
returns trigger language plpgsql set search_path = '' as $fn$
declare
  k text;
  v numeric;
  was numeric;
  label text;
  top numeric;
begin
  foreach k in array array['diameter_in', 'thickness_in', 'length_ft', 'width_ft'] loop
    v := nullif(to_jsonb(new) ->> k, '')::numeric;
    was := case when tg_op = 'UPDATE' then nullif(to_jsonb(old) ->> k, '')::numeric end;
    continue when v is null or (tg_op = 'UPDATE' and v is not distinct from was);
    label := case k when 'diameter_in' then 'The width across' when 'thickness_in' then 'The thickness'
      when 'length_ft' then 'The length' else 'The width' end;
    top := case when k like '%\_in' then 240 else 200 end;
    if v <= 0 or v > top then
      raise exception '% must be more than 0 and no more than % %.', label, top,
        case when k like '%\_in' then 'inches' else 'feet' end;
    end if;
  end loop;
  return new;
end;
$fn$;
revoke all on function private.guard_product_measurements() from public, anon;
grant execute on function private.guard_product_measurements() to authenticated;

drop trigger if exists products_guard_measurements on public.products;
create trigger products_guard_measurements before insert or update on public.products
  for each row execute function private.guard_product_measurements();
drop trigger if exists inventory_guard_measurements on public.inventory;
create trigger inventory_guard_measurements before insert or update on public.inventory
  for each row execute function private.guard_product_measurements();

-- ============================================================
-- Categories: one list, one spelling each
-- ============================================================
create table if not exists public.product_categories (
  id bigint primary key default nextval('private.record_id_seq'),
  name text not null check (
    name = private.tidy_label(name) and char_length(name) between 1 and 60 and name !~ '[[:cntrl:]]'),
  created_at timestamptz not null default now()
);
-- The index, not the screen, is what makes "Styro Balls" and "styro balls" the
-- same category.
create unique index if not exists product_categories_name_key
  on public.product_categories (lower(name));

alter table public.product_categories enable row level security;
revoke all on public.product_categories from public, anon, authenticated;
grant select on public.product_categories to authenticated;
drop policy if exists "Active staff read categories" on public.product_categories;
create policy "Active staff read categories" on public.product_categories for select
  to authenticated using ((select private.is_active_staff()));

-- Every label already on a stock row becomes a category, spelt the way most of
-- the rows spell it (ties go to the first alphabetically), and the rows that
-- spelt it differently are brought into line.
with labels as (
  select private.tidy_label(category) as label, count(*) as uses
  from public.inventory where private.tidy_label(category) is not null
  group by 1
), ranked as (
  select label, row_number() over (partition by lower(label) order by uses desc, label) as rank
  from labels
)
insert into public.product_categories (name)
select label from ranked where rank = 1
on conflict ((lower(name))) do nothing;

update public.inventory i set category = c.name
from public.product_categories c
where lower(private.tidy_label(i.category)) = lower(c.name) and i.category is distinct from c.name;
-- The catalogue row carries the same label in `size` (see saveProduct).
update public.products p set size = c.name
from public.product_categories c
where lower(private.tidy_label(p.size)) = lower(c.name) and p.size is distinct from c.name;

-- A stock row always carries a category from the list, in the list's spelling.
-- The screens offer only the list; this catches every other writer (seed
-- scripts, the SQL editor) and files an unknown label as a new category rather
-- than refusing the write.
create or replace function private.canonical_category()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare found_name text;
begin
  new.category := coalesce(private.tidy_label(new.category), 'Uncategorised');
  if char_length(new.category) > 60 or new.category ~ '[[:cntrl:]]' then
    raise exception 'Keep the category name to 60 characters, without line breaks.';
  end if;
  select c.name into found_name from public.product_categories c
    where lower(c.name) = lower(new.category);
  if found_name is null then
    insert into public.product_categories (name) values (new.category)
      on conflict ((lower(name))) do nothing;
  else
    new.category := found_name;
  end if;
  return new;
end;
$fn$;
revoke all on function private.canonical_category() from public, anon, authenticated;
drop trigger if exists inventory_canonical_category on public.inventory;
create trigger inventory_canonical_category before insert or update of category on public.inventory
  for each row execute function private.canonical_category();

-- Adding, renaming and removing a category. Managers and administrators, the
-- same hands that edit products.
create or replace function public.category_command(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  who text := private.caller_role();
  cat public.product_categories;
  clash public.product_categories;
  wanted text := private.tidy_label(p_data ->> 'name');
  users integer;
begin
  if who is null or who not in ('Admin', 'Manager') then
    raise exception 'Only a manager or administrator can change the category list.';
  end if;
  if p_action in ('add', 'rename') then
    if wanted is null then raise exception 'Write a name for the category.'; end if;
    if char_length(wanted) > 60 then raise exception 'Keep the category name to 60 characters.'; end if;
    if wanted ~ '[[:cntrl:]]' then raise exception 'The category name cannot contain line breaks or tabs.'; end if;
  end if;
  if p_action in ('rename', 'remove') then
    if coalesce(p_data ->> 'id', '') !~ '^[0-9]{1,18}$' then raise exception 'Which category is not clear.'; end if;
    select * into cat from public.product_categories where id = (p_data ->> 'id')::bigint for update;
    if not found then raise exception 'That category no longer exists. Refresh the list.'; end if;
  end if;

  if p_action = 'add' then
    select * into clash from public.product_categories where lower(name) = lower(wanted);
    if found then
      -- Not an error: whoever asked for it gets the category they meant.
      return jsonb_build_object('category', to_jsonb(clash), 'created', false);
    end if;
    insert into public.product_categories (name) values (wanted) returning * into cat;
    return jsonb_build_object('category', to_jsonb(cat), 'created', true);

  elsif p_action = 'rename' then
    select * into clash from public.product_categories
      where lower(name) = lower(wanted) and id <> cat.id;
    if found then
      raise exception 'There is already a category called "%". Move its products instead of renaming.', clash.name;
    end if;
    update public.product_categories set name = wanted where id = cat.id returning * into clash;
    update public.inventory set category = wanted where lower(category) = lower(cat.name);
    update public.products set size = wanted where lower(size) = lower(cat.name);
    return jsonb_build_object('category', to_jsonb(clash), 'previous', cat.name);

  elsif p_action = 'remove' then
    select count(*) into users from public.inventory where lower(category) = lower(cat.name);
    if users > 0 then
      raise exception '% % in "%". Move % to another category first.', users,
        case when users = 1 then 'product is' else 'products are' end, cat.name,
        case when users = 1 then 'it' else 'them' end;
    end if;
    delete from public.product_categories where id = cat.id;
    return jsonb_build_object('removed', cat.id);
  end if;
  raise exception 'That category action is not supported.';
end;
$fn$;
revoke all on function public.category_command(text, jsonb) from public, anon;
grant execute on function public.category_command(text, jsonb) to authenticated;

-- ============================================================
-- Product photos
-- ============================================================
-- One photo per product, stored as a data URL the browser has already resized
-- (at most 800 × 800). A table rather than file storage because this app ships
-- without the Storage client, and because a row is saved, permission-checked
-- and removed with its product in the same way as everything else here.
create table if not exists public.product_images (
  product_id bigint primary key references public.products(id) on delete cascade,
  data_url text not null check (
    data_url ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$'
    and char_length(data_url) <= 1500000),
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.product_images enable row level security;
revoke all on public.product_images from public, anon, authenticated;
grant select on public.product_images to authenticated;
drop policy if exists "Active staff read product photos" on public.product_images;
create policy "Active staff read product photos" on public.product_images for select
  to authenticated using ((select private.is_active_staff()));

-- Sets, replaces or (with a null photo) removes a product's photo.
create or replace function public.save_product_image(p_product_id bigint, p_data_url text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  who text := private.caller_role();
  actor text;
  saved public.product_images;
begin
  if who is null or who not in ('Admin', 'Manager') then
    raise exception 'Only a manager or administrator can change a product photo.';
  end if;
  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'That product no longer exists.';
  end if;
  if p_data_url is null then
    delete from public.product_images where product_id = p_product_id;
    return jsonb_build_object('product_id', p_product_id, 'removed', true);
  end if;
  if p_data_url !~ '^data:image/(jpeg|png|webp);base64,' then
    raise exception 'Choose a JPEG, PNG or WebP photo.';
  end if;
  if char_length(p_data_url) > 1500000 then
    raise exception 'That photo is too large. Choose one under 1 MB.';
  end if;
  select s.name into actor from public.staff s
    where lower(s.email) = lower((select auth.jwt()) ->> 'email') limit 1;
  insert into public.product_images (product_id, data_url, updated_at, updated_by)
    values (p_product_id, p_data_url, now(), actor)
  on conflict (product_id) do update
    set data_url = excluded.data_url, updated_at = excluded.updated_at, updated_by = excluded.updated_by
  returning * into saved;
  return jsonb_build_object('product_id', saved.product_id, 'updated_at', saved.updated_at,
    'updated_by', saved.updated_by, 'removed', false);
end;
$fn$;
revoke all on function public.save_product_image(bigint, text) from public, anon;
grant execute on function public.save_product_image(bigint, text) to authenticated;

-- ============================================================
-- Raw materials: weight, and every field checked
-- ============================================================
alter table public.raw_materials add column if not exists weight_kg numeric;
alter table public.raw_materials drop constraint if exists raw_materials_weight_check;
alter table public.raw_materials add constraint raw_materials_weight_check
  check (weight_kg is null or (weight_kg > 0 and weight_kg <= 10000));

-- As in 20260924190000, plus: a code is generated when none is given and must
-- follow the code format when one is typed; the unit is one lower-case word or
-- phrase; every measurement and count says exactly what is wrong with it. A
-- code or unit that was saved before these rules is left alone until somebody
-- changes it, so correcting an old material's price point never fails on its
-- code.
create or replace function private.save_material(actor public.staff, p_data jsonb)
returns public.raw_materials language plpgsql security definer set search_path = '' as $fn$
declare
  mat public.raw_materials;
  record_id bigint;
  v_sku text := upper(coalesce(private.tidy_label(p_data ->> 'sku'), ''));
  v_name text := private.tidy_label(p_data ->> 'name');
  v_kind text := nullif(btrim(coalesce(p_data ->> 'material_type', '')), '');
  v_unit text := lower(private.tidy_label(p_data ->> 'unit'));
  v_threshold integer;
  prefix text;
  n integer := 1;
begin
  if actor.role not in ('Admin', 'Manager') then
    raise exception 'Only a manager or administrator can change a raw material.';
  end if;
  if coalesce(p_data ->> 'id', '') <> '' and p_data ->> 'id' !~ '^[0-9]{1,18}$' then
    raise exception 'Which material is not clear.';
  end if;
  record_id := nullif(p_data ->> 'id', '')::bigint;

  if record_id is not null then
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
  end if;

  if record_id is null and v_name is null then raise exception 'Write the material name.'; end if;
  if char_length(coalesce(v_name, '')) > 200 then raise exception 'Keep the material name to 200 characters.'; end if;
  if v_name ~ '[[:cntrl:]]' then raise exception 'The material name cannot contain line breaks or tabs.'; end if;

  if record_id is null and v_kind is null then v_kind := 'sheet'; end if;
  if v_kind is not null and v_kind not in ('sheet', 'block', 'adhesive', 'wire') then
    raise exception 'Choose a kind of material from the list.';
  end if;

  if v_unit is null and record_id is null then raise exception 'Choose the unit the material is counted in.'; end if;
  if v_unit is not null and (record_id is null or v_unit <> lower(mat.unit))
     and (v_unit !~ '^[a-z]+( [a-z]+)*$' or char_length(v_unit) > 24) then
    raise exception 'Write the unit in letters only, such as sheet, roll or kg (24 characters at most).';
  end if;

  if v_sku = '' then
    if record_id is null then
      prefix := 'RM-' || case coalesce(v_kind, 'sheet') when 'sheet' then 'SHT' when 'block' then 'BLK'
        when 'adhesive' then 'ADH' else 'WIR' end;
      loop
        v_sku := prefix || '-' || lpad(n::text, 3, '0');
        exit when not exists (select 1 from public.raw_materials where upper(sku) = v_sku);
        n := n + 1;
      end loop;
    else
      v_sku := null;
    end if;
  elsif record_id is not null and v_sku = upper(mat.sku) then
    -- The code it already has, however it was typed then.
    v_sku := mat.sku;
  else
    if v_sku !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' or char_length(v_sku) not between 2 and 40 then
      raise exception 'Use 2 to 40 letters, numbers and single hyphens for the material code, such as SS-100-4X8.';
    end if;
    if exists (select 1 from public.raw_materials where upper(sku) = v_sku and id is distinct from record_id) then
      raise exception 'The code % is already used by another material.', v_sku;
    end if;
  end if;

  if record_id is null or coalesce(p_data ->> 'low_stock_threshold', '') <> '' then
    v_threshold := private.whole_count(p_data, 'low_stock_threshold', 'The low-stock warning level', 0);
  end if;

  if record_id is null then
    insert into public.raw_materials(sku, name, material_type, density, weight_kg, thickness_in,
      length_ft, width_ft, unit, low_stock_threshold)
    values (v_sku, v_name, v_kind,
      private.measure_value(p_data, 'density', 'The density', 25000, 'kg/m³'),
      private.measure_value(p_data, 'weight_kg', 'The weight per unit', 10000, 'kg'),
      private.measure_value(p_data, 'thickness_in', 'The thickness', 240, 'inches'),
      private.measure_value(p_data, 'length_ft', 'The length', 200, 'feet'),
      private.measure_value(p_data, 'width_ft', 'The width', 200, 'feet'),
      v_unit, v_threshold)
    returning * into mat;
    return mat;
  end if;

  -- Each field is written only when the payload carries its key, so a screen
  -- that sends part of a material leaves the rest as it stands.
  update public.raw_materials set
    sku = coalesce(v_sku, mat.sku),
    name = coalesce(v_name, mat.name),
    material_type = coalesce(v_kind, mat.material_type),
    unit = coalesce(v_unit, mat.unit),
    density = case when p_data ? 'density'
      then private.measure_value(p_data, 'density', 'The density', 25000, 'kg/m³') else mat.density end,
    weight_kg = case when p_data ? 'weight_kg'
      then private.measure_value(p_data, 'weight_kg', 'The weight per unit', 10000, 'kg') else mat.weight_kg end,
    thickness_in = case when p_data ? 'thickness_in'
      then private.measure_value(p_data, 'thickness_in', 'The thickness', 240, 'inches') else mat.thickness_in end,
    length_ft = case when p_data ? 'length_ft'
      then private.measure_value(p_data, 'length_ft', 'The length', 200, 'feet') else mat.length_ft end,
    width_ft = case when p_data ? 'width_ft'
      then private.measure_value(p_data, 'width_ft', 'The width', 200, 'feet') else mat.width_ft end,
    low_stock_threshold = coalesce(v_threshold, mat.low_stock_threshold),
    updated_at = now()
  where id = mat.id returning * into mat;
  return mat;
end;
$fn$;
revoke all on function private.save_material(public.staff, jsonb) from public, anon, authenticated;

-- ============================================================
-- workshop_command: every field checked before anything moves
-- ============================================================
-- private.workshop_command casts form fields straight to integers, so "1.5"
-- came back as the database's own "invalid input syntax" and an archived or
-- used-up material could still be picked for a new batch or order. These checks
-- run first and say, in words, what to change. A request that has already been
-- saved is not re-checked: its retry replays the first answer, even on a later
-- day when its promised date would now be in the past.
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
        where b.raw_material_id = mat.id and b.status in ('Queued', 'In Progress', 'Quality Check');
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
revoke all on function private.workshop_precheck(text, jsonb, uuid) from public, anon;
grant execute on function private.workshop_precheck(text, jsonb, uuid) to authenticated;

-- Correcting a supplier order before it leaves the supplier: the quantity and
-- the agreed price can be put right, not only the date and the notes, so a
-- typo no longer means cancelling and ordering again. The supplier and the
-- material cannot be changed -- that is a different order. It runs in the same
-- transaction as workshop_command, which then saves the date and notes, writes
-- the activity entry and records the request; anything refused there undoes
-- this too. It does nothing for a request already saved (the retry replays).
create or replace function private.amend_supplier_order(p_data jsonb, p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $fn$
declare
  who text := private.caller_role();
  po public.raw_material_orders;
begin
  if coalesce(p_data ->> 'id', '') !~ '^[0-9]{1,18}$' then return; end if;
  if not (p_data ? 'quantity_ordered' or p_data ? 'unit_price') then return; end if;
  if p_request_id is not null
     and exists (select 1 from private.workshop_requests where request_id = p_request_id) then
    return;
  end if;
  -- workshop_command refuses the rest in its own words.
  if who is null or who not in ('Admin', 'Manager') then return; end if;
  select * into po from public.raw_material_orders where id = (p_data ->> 'id')::bigint for update;
  if not found or po.status not in ('Ordered', 'Delivery Scheduled') then return; end if;
  update public.raw_material_orders set
    quantity_ordered = case when p_data ? 'quantity_ordered'
      then private.whole_count(p_data, 'quantity_ordered', 'The quantity ordered', 1) else quantity_ordered end,
    unit_price = case when p_data ? 'unit_price' then (p_data ->> 'unit_price')::numeric else unit_price end
  where id = po.id;
end;
$fn$;
revoke all on function private.amend_supplier_order(jsonb, uuid) from public, anon;
grant execute on function private.amend_supplier_order(jsonb, uuid) to authenticated;

create or replace function public.workshop_command(p_action text, p_data jsonb, p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $fn$
begin
  perform private.workshop_precheck(p_action, p_data, p_request_id);
  if p_action = 'save_order' then
    perform private.amend_supplier_order(p_data, p_request_id);
  end if;
  return private.workshop_command(p_action, p_data, p_request_id);
end;
$fn$;
revoke all on function public.workshop_command(text, jsonb, uuid) from public, anon;
grant execute on function public.workshop_command(text, jsonb, uuid) to authenticated;
