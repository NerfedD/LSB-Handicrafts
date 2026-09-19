-- LSB Handicrafts — Supabase schema
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Safe to re-run: every statement is guarded with IF NOT EXISTS / OR REPLACE.

-- The styro catalog: one row per size, so a 2" ball and a 4" ball are separate
-- rows with their own SKU, price and stock.
--
-- `product_type` decides which dimension columns mean anything — 'ball' uses
-- diameter_in, 'sheet'/'block' use thickness_in + length_ft + width_ft. The
-- unused ones stay null rather than 0, so "no width" never reads as "zero
-- width". `category` stays the free-text merchandising label the list filter
-- groups on.
--
-- `stock` and `reserved` count SELLING units, not pieces: a sheet sold by the
-- bundle stores 25 to mean 25 bundles. `pack_size` converts back to pieces for
-- display.
--
-- `max_stock` is the storage ceiling. `low_stock_threshold` is the reorder
-- floor the "Flag Low Stock" story alerts on — different numbers, both needed.
create table if not exists public.inventory (
  id bigint primary key,
  sku text not null,
  name text not null,
  category text not null,
  price numeric not null default 0,
  stock integer not null default 0,
  max_stock integer not null default 0,
  status text not null default 'In Stock',
  product_type text not null default 'other',
  diameter_in numeric,
  thickness_in numeric,
  length_ft numeric,
  width_ft numeric,
  unit text not null default 'piece',
  pack_size integer not null default 1,
  low_stock_threshold integer not null default 50,
  reserved integer not null default 0,
  is_cuttable boolean not null default false
);

-- For databases created before these columns existed. `create table if not
-- exists` above is a no-op on them, so the columns have to be added separately.
--
-- Every default below is chosen to leave existing rows behaving exactly as they
-- did: low_stock_threshold defaults to 50 because that was the hardcoded
-- threshold in ProductForm, and product_type defaults to 'other' so the four
-- pre-styro rows stay valid and simply show no dimension fields until edited.
--
-- These are NOT NULL with defaults on purpose. syncTable upserts whole rows, so
-- a NOT NULL column with no default would reject every write from a client that
-- predates it — silently, because syncTable only logs the failure.
alter table public.inventory
  add column if not exists max_stock integer not null default 0,
  add column if not exists product_type text not null default 'other',
  add column if not exists diameter_in numeric,
  add column if not exists thickness_in numeric,
  add column if not exists length_ft numeric,
  add column if not exists width_ft numeric,
  add column if not exists unit text not null default 'piece',
  add column if not exists pack_size integer not null default 1,
  add column if not exists low_stock_threshold integer not null default 50,
  add column if not exists reserved integer not null default 0,
  add column if not exists is_cuttable boolean not null default false;

-- Deliberately NOT added: `check (product_type in (...))` and `unique (sku)`.
-- A rejected upsert is invisible in this app (storageManager.syncTable catches
-- and logs it, and the caller discards the result), so one bad field would cost
-- the entire inventory write with nothing on screen. SKU duplicates are caught
-- client-side in ProductForm instead. Revisit once write failures surface.

create table if not exists public.deliveries (
  id bigint primary key,
  product text not null,
  size text,
  location text not null,
  amount numeric,
  status text not null default 'Not Yet Delivered',
    created_at timestamptz default now()
);

-- `items` is deliberately untyped jsonb: a line can be a catalog product, a
-- sheet cut to a customer's size, a carved custom shape, or a catalog product
-- at a negotiated price. They share the fields every reader needs (name,
-- quantity, unitPrice, lineTotal, stockUnits) and differ below that, so the
-- shape can grow without a migration. See src/utils/orderItems.js.
--
-- `stock_committed_at` is stamped when a Pending order is marked Completed and
-- its stock is actually deducted. Its presence is what stops a second
-- Pending -> Completed flip from deducting the same goods twice.
create table if not exists public.orders (
  id bigint primary key,
  customer_name text not null,
  items jsonb not null default '[]'::jsonb,
  total_amount numeric not null default 0,
  status text not null default 'Pending',
  created_at timestamptz default now(),
  stock_committed_at timestamptz
);

alter table public.orders
  add column if not exists stock_committed_at timestamptz;

create table if not exists public.activity_log (
  id bigint primary key,
  type text,
  title text,
  description text,
  amount numeric,
  status text,
  color text,
  date text
);

-- Staff / user-account directory. `email` links a row to the Supabase Auth
-- user who signed in with that address (see src/App.jsx) — it's how "My
-- Profile" knows which row belongs to the person currently logged in. Left
-- nullable because rows can exist before an account has ever signed in.
create table if not exists public.staff (
  id bigint primary key,
  name text not null,
  role text not null,
  contact_number text,
  status text not null default 'Active',
  email text,
  username text,
  -- Marks the permanent owner account. Deliberately NOT a sixth `role` value:
  -- role stays 'Admin', so every isAdminRole(role) === 'Admin' check in the
  -- client and every is_admin() check below keeps working untouched. What the
  -- flag adds is protection -- see the staff policies and guard trigger.
  is_super_admin boolean not null default false
);

alter table public.staff
  add column if not exists username text;

alter table public.staff
  add column if not exists is_super_admin boolean not null default false;

-- Supabase Auth stores and returns emails lowercased. This column was compared
-- with a plain `=`, so a row saved as 'FinalTest@gmail.com' never matched its
-- own JWT and that account was locked out of everything. Uniqueness is enforced
-- case-insensitively for the same reason.
alter table public.staff drop constraint if exists staff_email_key;
create unique index if not exists staff_email_lower_idx
  on public.staff (lower(email));

-- role and status were free text, so the client could persist any string.
alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff add constraint staff_role_check
  check (role in ('Admin','Manager','Sales Staff','Production Staff','Delivery Staff'));

alter table public.staff drop constraint if exists staff_status_check;
alter table public.staff add constraint staff_status_check
  check (status in ('Active','Blocked'));

alter table public.staff drop constraint if exists staff_contact_number_len;
alter table public.staff add constraint staff_contact_number_len
  check (contact_number is null or char_length(contact_number) <= 32);

-- ------------------------------------------------------------
-- A contact number has to be dialable
-- ------------------------------------------------------------
-- Nothing checked these for the life of the project, and it shows: a supplier
-- was saved as '0917 234 5a' and a staff account with a 23-digit number. A
-- phone number nobody can ring is a customer you cannot reach, and the app
-- never said a word about either.
--
-- The rule matches src/utils/phone.js exactly -- the punctuation people
-- actually type, and E.164's 7-to-15 digit bounds -- because a check here that
-- disagreed with the form would reject writes the screen had just approved.
--
-- EMPTY IS STILL ALLOWED. Whether the field is REQUIRED is the form's question,
-- and the two disagree on purpose: a customer must have a number, a staff
-- account need not.
--
-- NOT VALID, deliberately. The two bad rows above already exist, and only
-- somebody who knows the real numbers can fix them -- refusing to load them
-- would not help. New writes are checked from now on, and editing either record
-- forces the correction at the moment somebody is looking at it.
create or replace function public.contact_number_ok(value text)
returns boolean language sql immutable as $fn$
  select value is null
     or btrim(value) = ''
     or (
       char_length(value) <= 32
       and value ~ '^[0-9 ()+.-]+$'
       and char_length(regexp_replace(value, '[^0-9]', '', 'g')) between 7 and 15
     );
$fn$;

alter table public.customers drop constraint if exists customers_contact_number_shape;
alter table public.customers add constraint customers_contact_number_shape
  check (public.contact_number_ok(contact_number)) not valid;

alter table public.suppliers drop constraint if exists suppliers_contact_number_shape;
alter table public.suppliers add constraint suppliers_contact_number_shape
  check (public.contact_number_ok(contact_number)) not valid;

alter table public.staff drop constraint if exists staff_contact_number_shape;
alter table public.staff add constraint staff_contact_number_shape
  check (public.contact_number_ok(contact_number)) not valid;

alter table public.staff drop constraint if exists staff_name_len;
alter table public.staff add constraint staff_name_len
  check (char_length(trim(name)) between 1 and 120);

-- Usernames are compared case-insensitively at sign-in, so uniqueness has to be
-- enforced the same way — otherwise "JDelaCruz" and "jdelacruz" could both
-- exist and the lookup would have to pick one arbitrarily. Partial, because
-- accounts without a username are fine and shouldn't collide with each other.
create unique index if not exists staff_username_lower_idx
  on public.staff (lower(username))
  where username is not null;

-- Customer / product / supplier profile directories (Figma screens #14-#22).
-- These are reference records: name, how to reach them, and when the row last
-- changed. These are real timestamptz columns: they used to be text holding
-- DISPLAY strings in two different formats ("Apr 17, 2026" and "August 17,
-- 2026"), which made chronological ordering impossible -- every "recent
-- activity" panel was sorting alphabetically by month name.
create table if not exists public.customers (
  id bigint primary key,
  name text not null,
  contact_number text,
  email text,
  address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Distinct from `inventory`: that table tracks stock levels for the dashboard
-- workspace, this one is the catalog entry a staff member maintains by hand.
-- `low_stock_threshold` is the level at which inventory should raise an alert.
--
-- Carries the same styro dimension/unit columns as `inventory` so a catalog
-- entry can describe a real product, but no `stock`/`reserved` — this table has
-- no stock concept. `size` is no longer typed by hand; it holds a label derived
-- from the dimensions, kept as a column so existing readers keep working.
create table if not exists public.products (
  id bigint primary key,
  item_code text not null unique,
  name text not null,
  size text,
  unit_price numeric,
  low_stock_threshold integer,
  status text not null default 'Active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  product_type text not null default 'other',
  diameter_in numeric,
  thickness_in numeric,
  length_ft numeric,
  width_ft numeric,
  unit text not null default 'piece',
  pack_size integer not null default 1
);

alter table public.products
  add column if not exists product_type text not null default 'other',
  add column if not exists diameter_in numeric,
  add column if not exists thickness_in numeric,
  add column if not exists length_ft numeric,
  add column if not exists width_ft numeric,
  add column if not exists unit text not null default 'piece',
  add column if not exists pack_size integer not null default 1;

create table if not exists public.suppliers (
  id bigint primary key,
  name text not null,
  contact_person text,
  contact_number text,
  email text,
  address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- Record ids: assigned by the database, not by the browser
-- ============================================================
-- Every id above used to arrive from the client as Date.now(). That is a clock
-- reading, not an identifier, and it only ever worked because one person used
-- the system at a time.
--
-- Put two people on it -- a class of testers, or one shared demo account open
-- in thirty tabs -- and two "Save order" clicks landing in the same millisecond
-- produce the same primary key. The loser gets a duplicate-key error on a form
-- they filled in correctly. src/App.jsx carried an `id: Date.now() + 1` on the
-- stock row written beside a new product for exactly this reason: two inserts
-- in one function were reliably fast enough to collide, so the collision was
-- hand-patched instead of removed. Across separate browsers there is nothing to
-- hand-patch with.
--
-- A sequence cannot collide with itself, which is the whole point. The
-- purchasing/production tables added later already knew this and default to
-- private.workshop_id_seq; this brings the eight original tables in line.
--
-- WHY IT STARTS AT 2e12 rather than following workshop_id_seq's 4e15. These ids
-- are read aloud and typed by people -- "Order #..." appears on screen, in
-- toasts and on the printed slip -- so the digit count is a UI decision. 2e12
-- keeps new ids the same 13 digits as the timestamps already in the table,
-- where 4e15 would jump them to 16. It clears every existing row (all below
-- 1.79e12) and stays clear of Date.now() until 2033, so a browser tab left open
-- on the old build cannot collide with the sequence either.
create sequence if not exists private.record_id_seq start 2000000000000;

-- authenticated already holds USAGE on `private` (anon deliberately does not);
-- nextval additionally needs it on the sequence itself, or every insert from
-- the app fails with "permission denied for sequence".
grant usage, select on sequence private.record_id_seq to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'inventory', 'deliveries', 'orders', 'activity_log',
    'staff', 'customers', 'products', 'suppliers'
  ] loop
    execute format(
      'alter table public.%I alter column id set default nextval(''private.record_id_seq'')', t
    );
  end loop;
end $$;

-- ============================================================
-- text -> timestamptz migration
-- ============================================================
-- The `create table if not exists` blocks above declare these columns as
-- timestamptz, but that only helps a FRESH database. On one that already ran an
-- earlier version of this file, `create table if not exists` is a no-op and so
-- is `add column if not exists` — neither reconciles a column's TYPE. Without
-- the block below, an existing install keeps its `text` columns, the
-- `(created_at desc)` indexes further down get built over text, and the sort is
-- still lexicographic: 'August 30, 2026' outranks '2026-09-01T...' because
-- 'A' > '2'. That is the exact bug the timestamptz change was meant to fix.
--
-- Guarded on the current data_type so the file stays safe to re-run: on a
-- database where the columns are already timestamptz this whole block does
-- nothing (an unguarded `using nullif(col, '')` would fail there, because ''
-- is not a valid timestamptz).

-- Existing rows hold display strings in two formats ("Apr 17, 2026" and
-- "August 17, 2026"), both of which Postgres parses. Anything it can't parse
-- becomes null rather than aborting the migration on one bad row.
create or replace function public.try_timestamptz(value text)
returns timestamptz language plpgsql stable as $$
begin
  return nullif(btrim(value), '')::timestamptz;
exception when others then
  return null;
end $$;

do $$
declare
  target record;
begin
  for target in
    select * from (values
      ('deliveries', 'created_at'),
      ('orders',     'created_at'),
      ('orders',     'stock_committed_at'),
      ('customers',  'created_at'),
      ('customers',  'updated_at'),
      ('products',   'created_at'),
      ('products',   'updated_at'),
      ('suppliers',  'created_at'),
      ('suppliers',  'updated_at')
    ) as t(tbl, col)
  loop
    if exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = target.tbl
        and c.column_name = target.col
        and c.data_type in ('text', 'character varying')
    ) then
      -- Drop the old default first: a text default like ''::text can't be cast
      -- to timestamptz, and would take the ALTER down with it.
      execute format('alter table public.%I alter column %I drop default', target.tbl, target.col);
      execute format(
        'alter table public.%I alter column %I type timestamptz using public.try_timestamptz(%I)',
        target.tbl, target.col, target.col
      );
      -- stock_committed_at is deliberately left with no default: null is what
      -- means "stock has not been deducted for this order yet".
      if target.col <> 'stock_committed_at' then
        execute format('alter table public.%I alter column %I set default now()', target.tbl, target.col);
      end if;
      raise notice 'Migrated public.%.% to timestamptz', target.tbl, target.col;
    end if;
  end loop;
end $$;

drop function if exists public.try_timestamptz(text);

-- ============================================================
-- Numeric and integrity bounds
-- ============================================================
-- The class-test logs recorded: value "1213123213123" is out of range for type
-- integer. Nothing bounded the numeric form fields, so a typo in a quantity box
-- reached Postgres and rejected the entire write. 2,000,000,000 stays inside
-- int4; the money ceilings are simply larger than any real order.

alter table public.inventory drop constraint if exists inventory_stock_check;
alter table public.inventory add constraint inventory_stock_check
  check (stock >= 0 and stock <= 2000000000);

alter table public.inventory drop constraint if exists inventory_reserved_check;
alter table public.inventory add constraint inventory_reserved_check
  check (reserved >= 0 and reserved <= 2000000000);

alter table public.inventory drop constraint if exists inventory_max_stock_check;
alter table public.inventory add constraint inventory_max_stock_check
  check (max_stock >= 0 and max_stock <= 2000000000);

alter table public.inventory drop constraint if exists inventory_price_check;
alter table public.inventory add constraint inventory_price_check
  check (price >= 0 and price <= 100000000);

alter table public.inventory drop constraint if exists inventory_pack_size_check;
alter table public.inventory add constraint inventory_pack_size_check
  check (pack_size >= 1 and pack_size <= 100000);

alter table public.products drop constraint if exists products_unit_price_check;
alter table public.products add constraint products_unit_price_check
  check (unit_price is null or (unit_price >= 0 and unit_price <= 100000000));

alter table public.products drop constraint if exists products_pack_size_check;
alter table public.products add constraint products_pack_size_check
  check (pack_size >= 1 and pack_size <= 100000);

alter table public.products drop constraint if exists products_low_stock_check;
alter table public.products add constraint products_low_stock_check
  check (low_stock_threshold is null
         or (low_stock_threshold >= 0 and low_stock_threshold <= 2000000000));

alter table public.orders drop constraint if exists orders_total_amount_check;
alter table public.orders add constraint orders_total_amount_check
  check (total_amount >= 0 and total_amount <= 1000000000);

-- ============================================================
-- Indexes
-- ============================================================
-- staff_email_lower_idx (declared with the table above) is the hottest index in
-- this database: every RLS check on every table calls is_active_staff(), which
-- looks staff up by email. These support the list screens and the "most recent
-- first" ordering every dashboard panel does.
create index if not exists inventory_sku_idx        on public.inventory (sku);
create index if not exists products_status_idx      on public.products (status);
create index if not exists orders_created_at_idx    on public.orders    (created_at desc);
create index if not exists customers_created_at_idx on public.customers (created_at desc);
create index if not exists products_created_at_idx  on public.products  (created_at desc);
create index if not exists suppliers_created_at_idx on public.suppliers (created_at desc);

-- ============================================================
-- Row Level Security
-- ============================================================
-- The anon key is embedded in the published JavaScript bundle - that's normal
-- and unavoidable for a browser app, so RLS is the only thing standing between
-- a stranger and this data. "Signed in" is NOT a sufficient bar: Supabase
-- signups are open (CreateUserAccountPage needs them), so anyone can create an
-- auth user for themselves. Access is gated on having an Active row in `staff`,
-- which only an existing admin can hand out.
--
-- WHY THESE LIVE IN A `private` SCHEMA
-- RLS policy expressions are evaluated as the QUERYING user, so `authenticated`
-- must hold EXECUTE on every function a policy calls. A function in `public`
-- with that grant is also published at /rest/v1/rpc/<name> - which the Supabase
-- security advisor flags, and which revoking the grant would "fix" only by
-- breaking RLS outright. PostgREST does not expose `private`, so these stay
-- reachable from policies but not over HTTP.
--
-- SECURITY DEFINER makes them run as their owner, which bypasses RLS inside the
-- function body. That is what lets the `staff` policies call them without
-- recursing into themselves. `set search_path` pins schema resolution so an
-- elevated function can't be tricked into resolving `staff` elsewhere.
--
-- Each one wraps the JWT read as `(select auth.jwt())`. The scalar subselect is
-- evaluated once per statement instead of once per row - the fix for Supabase's
-- auth_rls_initplan performance warning.
--
-- All three compare on lower(email): Supabase returns lowercased emails, and a
-- plain `=` silently locked out every mixed-case staff row.
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_active_staff()
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.staff
    where lower(email) = lower((select auth.jwt()) ->> 'email')
      and status = 'Active'
  );
$fn$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.staff
    where lower(email) = lower((select auth.jwt()) ->> 'email')
      and status = 'Active' and role = 'Admin'
  );
$fn$;

-- Named for the CALLER, not the row, so it can never be confused with the
-- staff.is_super_admin column inside a policy expression.
create or replace function private.caller_is_super_admin()
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.staff
    where lower(email) = lower((select auth.jwt()) ->> 'email')
      and status = 'Active' and is_super_admin
  );
$fn$;

revoke all on function private.is_active_staff()       from public;
revoke all on function private.is_admin()              from public;
revoke all on function private.caller_is_super_admin() from public;
grant execute on function private.is_active_staff()       to authenticated;
grant execute on function private.is_admin()              to authenticated;
grant execute on function private.caller_is_super_admin() to authenticated;

-- public.email_for_username() USED TO LIVE HERE, AND IS DELIBERATELY GONE.
--
-- Supabase Auth only ever authenticates on email, so a username has to become
-- one before the password is checked - at which point the caller is still
-- anonymous and the staff policies below deny every read. That was bridged by a
-- SECURITY DEFINER function granted to `anon`: hand it a username, get the
-- email back.
--
-- The comment that stood here was honest that this was a trade, and named the
-- fix. Taking the trade seriously is what ended it. The anon key ships inside
-- the JS bundle, so the lookup was open to anyone who loaded the site, and
-- staff usernames are short words somebody would guess first try - one of them
-- is "admin". A stranger could POST a handful of guesses and leave with the
-- owner's personal email address: no password, no access, just a precise list
-- of who to phish for the account that reaches every screen in the system.
--
-- supabase/functions/sign-in now does the whole sign-in on the server, where
-- the service key stays, and answers a username nobody holds exactly as it
-- answers a wrong password. Nothing anonymous can ask who exists any more, so
-- the function is dropped rather than merely un-granted - an ungranted one is a
-- single `grant` away from being an open lookup again, and there is no caller
-- left to justify keeping it.
drop function if exists public.email_for_username(text);

alter table public.inventory    enable row level security;
alter table public.deliveries   enable row level security;
alter table public.orders       enable row level security;
alter table public.activity_log enable row level security;
alter table public.staff        enable row level security;
alter table public.customers    enable row level security;
alter table public.products     enable row level security;
alter table public.suppliers    enable row level security;

-- Legacy policy names, dropped so this file stays re-runnable.
drop policy if exists "Authenticated users can manage inventory"    on public.inventory;
drop policy if exists "Authenticated users can manage deliveries"   on public.deliveries;
drop policy if exists "Authenticated users can manage orders"       on public.orders;
drop policy if exists "Authenticated users can manage activity_log" on public.activity_log;
drop policy if exists "Authenticated users can manage staff"        on public.staff;
drop policy if exists "Active staff can manage staff"               on public.staff;
drop policy if exists "Admins can update staff"                     on public.staff;
drop policy if exists "Admins can delete staff"                     on public.staff;

drop policy if exists "Active staff can manage inventory"    on public.inventory;
drop policy if exists "Active staff can manage deliveries"   on public.deliveries;
drop policy if exists "Active staff can manage orders"       on public.orders;
drop policy if exists "Active staff can manage activity_log" on public.activity_log;
drop policy if exists "Active staff can manage customers"    on public.customers;
drop policy if exists "Active staff can manage products"     on public.products;
drop policy if exists "Active staff can manage suppliers"    on public.suppliers;

-- ------------------------------------------------------------
-- products, inventory, deliveries, orders: everyone works with them,
-- only an admin removes one
-- ------------------------------------------------------------
--
-- WHY THESE ARE NO LONGER `for all`. That form covers DELETE, so every one of
-- these five tables was handing every active staff account the right to remove
-- any row in it through a direct API call -- a Delivery Staff session could
-- have emptied the catalogue, the stock ledger or the orders table. The UI
-- offers no such button, but the UI is not the only way in: the anon key ships
-- in the JS bundle, so anyone holding a valid session can call PostgREST
-- directly. A missing button is not a permission.
--
-- Read, add and edit stay open to any active staff member, which is the whole
-- point of the app: counting stock, writing an order and moving a delivery on
-- are everybody's job. Only removal narrows, and it narrows to is_admin() --
-- exactly the split already spelled out for suppliers and customers below.
--
-- This is the same four-verb shape repeated four times rather than a loop,
-- because a policy is not a thing you can write once and apply to a list, and
-- because each table's DELETE is worth being able to read on its own line.
drop policy if exists "Active staff read products"   on public.products;
drop policy if exists "Active staff insert products" on public.products;
drop policy if exists "Active staff update products" on public.products;
drop policy if exists "Admins delete products"       on public.products;

create policy "Active staff read products"   on public.products for select
  using (private.is_active_staff());
create policy "Active staff insert products" on public.products for insert
  with check (private.is_active_staff());
create policy "Active staff update products" on public.products for update
  using (private.is_active_staff()) with check (private.is_active_staff());
-- Deleting a product also deletes its stock row (the catalogue entry and the
-- ledger row are one thing to the user -- see App.deleteProduct), which is why
-- both tables' DELETE ask for the same thing.
create policy "Admins delete products"       on public.products for delete
  using (private.is_admin());

drop policy if exists "Active staff read inventory"   on public.inventory;
drop policy if exists "Active staff insert inventory" on public.inventory;
drop policy if exists "Active staff update inventory" on public.inventory;
drop policy if exists "Admins delete inventory"       on public.inventory;

create policy "Active staff read inventory"   on public.inventory for select
  using (private.is_active_staff());
create policy "Active staff insert inventory" on public.inventory for insert
  with check (private.is_active_staff());
create policy "Active staff update inventory" on public.inventory for update
  using (private.is_active_staff()) with check (private.is_active_staff());
create policy "Admins delete inventory"       on public.inventory for delete
  using (private.is_admin());

drop policy if exists "Active staff read deliveries"   on public.deliveries;
drop policy if exists "Active staff insert deliveries" on public.deliveries;
drop policy if exists "Active staff update deliveries" on public.deliveries;
drop policy if exists "Admins delete deliveries"       on public.deliveries;

create policy "Active staff read deliveries"   on public.deliveries for select
  using (private.is_active_staff());
create policy "Active staff insert deliveries" on public.deliveries for insert
  with check (private.is_active_staff());
create policy "Active staff update deliveries" on public.deliveries for update
  using (private.is_active_staff()) with check (private.is_active_staff());
-- A delivery is a record that something was promised and something happened.
-- Deleting one destroys the only evidence of a run; moving it back a stage is
-- the recoverable answer, and that is an UPDATE.
create policy "Admins delete deliveries"       on public.deliveries for delete
  using (private.is_admin());

drop policy if exists "Active staff read orders"   on public.orders;
drop policy if exists "Active staff insert orders" on public.orders;
drop policy if exists "Active staff update orders" on public.orders;
drop policy if exists "Admins delete orders"       on public.orders;

create policy "Active staff read orders"   on public.orders for select
  using (private.is_active_staff());
create policy "Active staff insert orders" on public.orders for insert
  with check (private.is_active_staff());
-- UPDATE stays open to everyone because marking an order done is the ordinary
-- case. WHICH COLUMNS may change is a separate question, and it is answered by
-- orders_guard_money_update() further down -- refunds and price corrections are
-- manager/admin only regardless of this policy.
create policy "Active staff update orders" on public.orders for update
  using (private.is_active_staff()) with check (private.is_active_staff());
create policy "Admins delete orders"       on public.orders for delete
  using (private.is_admin());

-- ------------------------------------------------------------
-- activity_log: append only, for everybody
-- ------------------------------------------------------------
--
-- THE MISSING POLICIES ARE THE POINT. There is a SELECT policy and an INSERT
-- policy and there is deliberately NO policy for UPDATE and NO policy for
-- DELETE -- not for staff, not for admins, not for the superadmin. RLS denies
-- any verb it has no permissive policy for, so those two statements fail for
-- every caller who goes through PostgREST. That is what makes this table an
-- audit trail rather than a list of things somebody has not got round to
-- editing yet.
--
-- It matters because `for all` covered DELETE here too: any signed-in account
-- could have removed the record of what it had just done, which is precisely
-- the entry an audit trail exists to keep.
--
-- The table owner and the service role still bypass RLS entirely, so a genuine
-- correction remains possible from the SQL editor -- deliberately, because that
-- leaves a trace of its own and cannot be done from the app.
--
-- Nothing in the app wants either verb: utils/activityLog.js only ever calls
-- create(). If a screen ever needs to edit an entry, the honest answer is a
-- second entry saying so, not an UPDATE policy.
drop policy if exists "Active staff read activity_log"   on public.activity_log;
drop policy if exists "Active staff insert activity_log" on public.activity_log;

create policy "Active staff read activity_log"   on public.activity_log for select
  using (private.is_active_staff());
create policy "Active staff insert activity_log" on public.activity_log for insert
  with check (private.is_active_staff());

-- ------------------------------------------------------------
-- suppliers: everyone works with them, only an admin removes one
-- ------------------------------------------------------------
--
-- WHY THIS TABLE IS SPLIT OUT of the `for all` group above. `for all` covers
-- DELETE, so while suppliers sat in that list any active staff member could
-- remove a supplier row -- including a Delivery Staff account that has no
-- reason to. There was no delete button anywhere in the app, so nothing
-- exercised it; adding one makes the gap reachable, and a UI-only check is
-- not a permission. The four verbs are therefore spelled out separately and
-- DELETE alone asks for is_admin().
--
-- Read, add and edit stay open to any active staff member: knowing who to ring
-- for materials, and correcting a wrong phone number, is everybody's job.
--
-- A hard delete rather than an "archived" flag, because a supplier with
-- nothing pointing at it orphans no orders and no deliveries.
--
-- THAT IS NO LONGER UNCONDITIONAL. raw_material_orders.supplier_id references
-- this table -- `not null`, with no cascade -- so the database refuses to
-- remove a supplier that has purchasing history rather than taking the
-- purchase record with it. It is still the only reference to suppliers in the
-- schema, so once a supplier has no purchase orders the delete is as clean as
-- it ever was. The client disables the button and says why (see
-- SupplierDetailPage); this foreign key is what actually enforces it.
drop policy if exists "Active staff read suppliers"   on public.suppliers;
drop policy if exists "Active staff insert suppliers" on public.suppliers;
drop policy if exists "Active staff update suppliers" on public.suppliers;
drop policy if exists "Admins delete suppliers"       on public.suppliers;

create policy "Active staff read suppliers"   on public.suppliers for select
  using (private.is_active_staff());
create policy "Active staff insert suppliers" on public.suppliers for insert
  with check (private.is_active_staff());
create policy "Active staff update suppliers" on public.suppliers for update
  using (private.is_active_staff()) with check (private.is_active_staff());
create policy "Admins delete suppliers"       on public.suppliers for delete
  using (private.is_admin());

-- ------------------------------------------------------------
-- customers: same split, for a sharper reason
-- ------------------------------------------------------------
--
-- `orders` has NO foreign key to `customers` -- it carries customer_name as
-- text -- so the database will not stop a delete and will not cascade one
-- either. Past orders survive with the name on them. What a delete actually
-- destroys is the only record of how to REACH the person: phone, email,
-- address. That is not something a Sales Staff account should be able to do
-- to the customer list on a bad afternoon, and there is no undo.
--
-- The app additionally refuses while the customer has an order still open,
-- which the database cannot express in a policy -- it would need a subquery
-- over orders joined on a text name. That check lives in App.deleteCustomer
-- and on the screen. This policy is the part that stops the wrong ROLE; the
-- open-order rule is the part that stops the wrong MOMENT.
drop policy if exists "Active staff read customers"   on public.customers;
drop policy if exists "Active staff insert customers" on public.customers;
drop policy if exists "Active staff update customers" on public.customers;
drop policy if exists "Admins delete customers"       on public.customers;

create policy "Active staff read customers"   on public.customers for select
  using (private.is_active_staff());
create policy "Active staff insert customers" on public.customers for insert
  with check (private.is_active_staff());
create policy "Active staff update customers" on public.customers for update
  using (private.is_active_staff()) with check (private.is_active_staff());
create policy "Admins delete customers"       on public.customers for delete
  using (private.is_admin());

-- ------------------------------------------------------------
-- staff: the one table where "any active staff member" is too broad
-- ------------------------------------------------------------
-- Writing was letting a Sales Staff account change another person's role, block
-- them, or delete them outright. The UI stops that, but the UI is not the only
-- way in - the anon key is public, so anyone holding a valid session could call
-- the API directly. Reads stay open to all active staff (the dashboards and
-- directory list colleagues); writes are admin-only.
--
-- THE SUPERADMIN RULE. During class testing a lower admin deleted the owner
-- account outright, because the DELETE policy was a bare is_admin(). These
-- policies make that structurally impossible rather than merely hidden in the
-- UI: a superadmin cannot be deleted by anyone, cannot be created through an
-- INSERT, and (see the trigger below) cannot be modified or demoted except by
-- another superadmin. Admins also cannot delete their own account, which is how
-- an installation could otherwise be left with no administrator at all.
drop policy if exists "Active staff can read staff"                   on public.staff;
drop policy if exists "Admins can insert staff"                       on public.staff;
drop policy if exists "Admins update anyone, staff update themselves" on public.staff;
drop policy if exists "Admins delete non-superadmins"                 on public.staff;

create policy "Active staff can read staff" on public.staff for select
  using (private.is_active_staff());

create policy "Admins can insert staff" on public.staff for insert
  with check (private.is_admin() and not is_super_admin);

-- One UPDATE policy, not two. An earlier pair overlapped on every role and
-- action, which Supabase's multiple_permissive_policies advisor flagged: each
-- permissive policy has to be evaluated for every candidate row. Row-level
-- access only - which COLUMNS may change is the trigger's job.
create policy "Admins update anyone, staff update themselves" on public.staff for update
  using      (private.is_admin() or lower(email) = lower((select auth.jwt()) ->> 'email'))
  with check (private.is_admin() or lower(email) = lower((select auth.jwt()) ->> 'email'));

create policy "Admins delete non-superadmins" on public.staff for delete
  using (
    private.is_admin()
    and not is_super_admin
    and lower(email) is distinct from lower((select auth.jwt()) ->> 'email')
  );

-- Column-level guard.
--
-- RLS decides which ROWS you may write; this decides which COLUMNS, which RLS
-- cannot express - admins and ordinary staff are the same `authenticated`
-- database role, so column grants cannot separate them either. The UPDATE
-- policy above is deliberately permissive enough to let someone edit their own
-- row; without this trigger that same permission would let them set their own
-- role to 'Admin'.
create or replace function public.staff_guard_self_update()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  -- No JWT at all means the table owner or the service role: SQL editor,
  -- migrations, seeds. Those bypass RLS already, so guarding them here only
  -- blocks legitimate maintenance - including running this very file.
  if (select auth.jwt()) is null then return new; end if;

  -- A superadmin may change anything, including another superadmin.
  if private.caller_is_super_admin() then return new; end if;

  -- Nobody else may touch a superadmin's row at all: not the role, not the
  -- status, not the name. This is what stops a lower admin from blocking or
  -- demoting the owner account instead of deleting it.
  if old.is_super_admin then
    raise exception 'Only a super administrator can modify the super administrator account';
  end if;

  -- Nobody else may promote anyone, themselves included, to superadmin.
  if new.is_super_admin and not old.is_super_admin then
    raise exception 'Only a super administrator can grant super administrator access';
  end if;

  -- Ordinary admins keep their existing powers over ordinary staff.
  if private.is_admin() then return new; end if;

  -- Everyone else may edit only their own name and contact number.
  --
  -- USERNAME IS IN THIS LIST, and was not. A username is an identity, not a
  -- display preference: the sign-in Edge Function resolves one to an email
  -- before the password is checked, so it is half of how somebody signs in.
  -- (That resolution used to be email_for_username() here; see the note above
  -- the drop for why it moved off the browser entirely.) Without
  -- this line any non-admin could rename themselves to any name not yet taken
  -- -- including the one an administrator had just told a new hire to expect.
  -- The unique index stops two accounts HOLDING the same username; it has
  -- nothing to say about who may change one.
  if new.role        is distinct from old.role
     or new.status   is distinct from old.status
     or new.email    is distinct from old.email
     or new.username is distinct from old.username
     or new.id       is distinct from old.id then
    raise exception 'Only an administrator can change a staff role, status, email, username or id';
  end if;

  return new;
end;
$fn$;

revoke all on function public.staff_guard_self_update() from public, anon, authenticated;

drop trigger if exists staff_guard_self_update on public.staff;
create trigger staff_guard_self_update
  before update on public.staff
  for each row execute function public.staff_guard_self_update();

-- The one write a non-admin still needs: editing their own name and contact
-- number on My Profile.
--
-- It goes through a function rather than a self-update policy on purpose. A
-- policy permissive enough to let someone edit their own row would also let
-- them set their own role to 'Admin' - RLS gates which ROWS you may write, not
-- which COLUMNS. This updates exactly two columns on exactly the caller's own
-- row, decided server-side from their token, so there is no path from it to a
-- privilege change.
create or replace function public.update_own_profile(
  p_name text,
  p_contact_number text
)
returns void
language sql
security definer
set search_path = public
as $fn$
  update public.staff
  set name = coalesce(nullif(trim(p_name), ''), name),
      contact_number = p_contact_number
  where lower(email) = lower((select auth.jwt()) ->> 'email')
    and status = 'Active';
$fn$;

revoke all on function public.update_own_profile(text, text) from public, anon;
grant execute on function public.update_own_profile(text, text) to authenticated;

-- ============================================================
-- UI overhaul: what happened recently, and per-account preferences
-- ============================================================
-- Added for design_handoff_lsb_ui_overhaul. Both are additive and guarded, so
-- this file stays safe to re-run on a database that already has them.

-- ------------------------------------------------------------
-- activity_log becomes real
-- ------------------------------------------------------------
-- This table existed but nothing ever wrote to it: the "Recent Activity" panel
-- and the whole activity-log screen were rendering a hardcoded array of twelve
-- fake entries in src/utils/activityData.js, which is why the screen looked
-- identical on every install and why the dashboard's "Activity Entries: 12"
-- counter never moved.
--
-- The overhaul makes "What happened recently" a feed of sentences naming the
-- person who did the thing, and the product detail screen shows stock
-- movements. Both need three things the original seven columns cannot carry:
--
--   staff_name  who did it. `title` held an event NAME ("Order Deleted"), not a
--               person, and the feed's whole shape is "<person> <did what>".
--   subject     what it was done to, as a stable key -- an item code, an order
--               id -- so one record's own screen can filter the feed to itself
--               without string-matching a sentence.
--   at          when, as a real timestamp. `date` is text holding a display
--               string, so ordering by it sorts alphabetically by month name:
--               'August 30' outranks 'July 2' and 'April' outranks everything.
--               That is the same bug the customers/products/suppliers
--               timestamptz migration above fixed, in the one table it missed.
--
-- The original columns stay. Rows written by the legacy workspace screens are
-- still readable, they simply have nulls in the new ones, and the reader in
-- src/utils/activityLog.js falls back to `date` when `at` is null.
alter table public.activity_log
  add column if not exists staff_name text,
  add column if not exists subject    text,
  add column if not exists at         timestamptz default now();

-- Bounded like every other numeric column: `amount` carries a stock change
-- here, and an unbounded integer column is how a typo in a quantity box
-- rejected an entire write during class testing.
alter table public.activity_log drop constraint if exists activity_log_amount_check;
alter table public.activity_log add constraint activity_log_amount_check
  check (amount is null or (amount >= -2000000000 and amount <= 2000000000));

-- The feed is always "most recent first", and the product detail screen always
-- filters to one subject before ordering.
create index if not exists activity_log_at_idx      on public.activity_log (at desc);
create index if not exists activity_log_subject_idx on public.activity_log (subject, at desc);

-- ------------------------------------------------------------
-- deliveries.driver
-- ------------------------------------------------------------
-- Who is taking it out.
--
-- The deliveries board filters by driver and has a "No driver yet" chip, and
-- the order screen offers "Assign someone" on an order that has been waiting —
-- none of which can exist without somewhere to put the name. There was nowhere:
-- the table had product, size, location, amount and status.
--
-- Free text rather than a foreign key to `staff`, deliberately. Deliveries are
-- sometimes taken by somebody without a system account — an owner, a hired van
-- — and a constraint that made those undeliverable would be a constraint staff
-- worked around by writing the name into the location field.
alter table public.deliveries
  add column if not exists driver text;

-- ------------------------------------------------------------
-- deliveries.due_on
-- ------------------------------------------------------------
-- When it is expected to arrive.
--
-- The board's filters are "Late", "Due today" and "This week", and its default
-- view is today's work. None of that means anything against `created_at`, which
-- is when the delivery was RAISED — a delivery raised on Monday for Friday is
-- neither late on Tuesday nor due today.
--
-- A `date`, not a timestamptz: deliveries are promised for a day, not a minute,
-- and storing a time nobody supplied would make "due today" depend on what hour
-- the row happened to be created.
--
-- Nullable, because a delivery with no promised date is a real state — it is
-- simply one that never appears in the "late" or "due today" columns.
alter table public.deliveries
  add column if not exists due_on date;

-- The board groups by stage and its chips read the due date, so both are
-- indexed.
create index if not exists deliveries_status_idx on public.deliveries (status);
create index if not exists deliveries_due_on_idx on public.deliveries (due_on);

-- ------------------------------------------------------------
-- customers.kind
-- ------------------------------------------------------------
-- A business or a walk-in.
--
-- The customers screen splits on it — it is two of the chips and the line under
-- every name — and it cannot be derived from anything already stored. Guessing
-- it (from whether an email was filled in, say) would be worse than not having
-- it: sales staff would filter to "Businesses", not see a customer they know is
-- one, and stop trusting the filter.
--
-- Defaulted to 'walk-in' because that is the larger group and the safer wrong
-- answer: a business miscategorised as a walk-in is still found by name, where
-- the reverse pollutes the list a salesperson uses to plan calls.
alter table public.customers
  add column if not exists kind text not null default 'walk-in';

alter table public.customers drop constraint if exists customers_kind_check;
alter table public.customers add constraint customers_kind_check
  check (kind in ('business', 'walk-in'));

-- ------------------------------------------------------------
-- staff.dashboard_view
-- ------------------------------------------------------------
-- Which of the two dashboards a person sees: 'standard' (more on screen at
-- once) or 'large' (bigger words and buttons, fewer things per screen).
--
-- PER ACCOUNT, NOT GLOBAL. It changes only what that person sees, which is the
-- point -- the owner and the production floor do not have to agree, and nobody
-- has to be talked out of their preference. Defaulted to 'standard' so a new
-- account behaves exactly as before.
alter table public.staff
  add column if not exists dashboard_view text not null default 'standard';

alter table public.staff drop constraint if exists staff_dashboard_view_check;
alter table public.staff add constraint staff_dashboard_view_check
  check (dashboard_view in ('standard', 'large'));

-- Same reasoning as update_own_profile above, and the reason this is a separate
-- function rather than two more parameters on it: that function is granted by
-- exact signature, so changing its arity would revoke the grant from every
-- client still calling the old shape. One column, one function, one grant.
create or replace function public.set_own_dashboard_view(p_view text)
returns void
language sql
security definer
set search_path = public
as $fn$
  update public.staff
  set dashboard_view = p_view
  where lower(email) = lower((select auth.jwt()) ->> 'email')
    and status = 'Active'
    and p_view in ('standard', 'large');
$fn$;

revoke all on function public.set_own_dashboard_view(text) from public, anon;
grant execute on function public.set_own_dashboard_view(text) to authenticated;

-- ============================================================
-- Goods left behind, money given back, and prices put right
-- ============================================================
-- Three things that happen in this shop every week and that the schema had no
-- room for. All additive and guarded, so this file stays safe to re-run on a
-- database that already has them.
--
-- NOTHING HERE TRACKS PER-LINE QUANTITIES, and that is deliberate. How much of
-- each line has physically left the building, and how much was refunded, are
-- counters on the line objects inside `orders.items` -- which is untyped jsonb
-- and passed through wholesale by the mapper, so they cost no migration at all.
-- See the header of src/utils/stockLedger.js. What is below is only what SQL
-- reporting genuinely cannot dig out of jsonb: money, and history.

-- ------------------------------------------------------------
-- orders.backorder_status
-- ------------------------------------------------------------
-- Whether an order still owes the customer goods after part of it went out.
--
-- A CACHE, NOT THE TRUTH. The app never reads this column -- it derives the
-- answer from the line counters, for the same reason the stage tracker is
-- derived rather than stored: a word in a column and the lines it summarises
-- are two places that can disagree about one fact, and the column is the one
-- that will be wrong. It exists so a report can ask "how often are we sending
-- half an order?" without unpacking jsonb, exactly as inventory.reserved caches
-- a number the orders array is the real source of.
--
-- Defaulted to 'none' so every existing row reads as what it is: an order that
-- has never been split.
--
-- ------------------------------------------------------------
-- orders.refund_history / orders.refunded_amount
-- ------------------------------------------------------------
-- What went back, to whom, why, and what happened to the goods.
--
-- A LIST, NOT A FLAG, because a partial refund can happen more than once on one
-- order -- two sheets rejected on Tuesday, a third on Friday -- and a single
-- amount column would answer "how much" while losing every "why". Each entry
-- carries { id, amount, refundedAt, refundedByStaffId, reason, method,
-- restockedItems: [{ productId, quantity, disposition }] }.
--
-- `refunded_amount` is the running total kept beside it. Denormalised on
-- purpose: the orders list filters and totals on it, and summing a jsonb array
-- in a WHERE clause on every list read is a cost paid forever to avoid storing
-- one number.
--
-- ------------------------------------------------------------
-- orders.price_adjustments
-- ------------------------------------------------------------
-- Every time the total moved after the customer had already been told one.
--
-- APPEND ONLY, AND THE OLD FIGURE IS KEPT. Correcting a price used to mean
-- overwriting total_amount, which destroyed the only record of what the
-- customer was actually quoted -- so a disputed invoice had no evidence on
-- either side. Each entry carries { oldTotal, newTotal, difference, reason,
-- changedBy, changedAt } and the screen prints the most recent one as a banner.
--
-- One column, not two: an earlier draft of this work had `price_adjustments`
-- and a separate `audit_history` holding the same six fields. Two columns that
-- must agree are one column and a bug.
alter table public.orders
  add column if not exists backorder_status  text    not null default 'none',
  add column if not exists refund_history    jsonb   not null default '[]'::jsonb,
  add column if not exists price_adjustments jsonb   not null default '[]'::jsonb,
  add column if not exists refunded_amount   numeric not null default 0;

alter table public.orders drop constraint if exists orders_backorder_status_check;
alter table public.orders add constraint orders_backorder_status_check
  check (backorder_status in ('none', 'partial', 'resolved'));

-- Bounded like every other numeric column in this file. A refund cannot be
-- negative -- that is a charge, and it goes through the price correction path
-- where it is recorded as one.
alter table public.orders drop constraint if exists orders_refunded_amount_check;
alter table public.orders add constraint orders_refunded_amount_check
  check (refunded_amount >= 0 and refunded_amount <= 1000000000);

-- Partial: the overwhelming majority of orders never split, and an index over
-- 'none' repeated ten thousand times answers no question anybody asks.
create index if not exists orders_backorder_idx on public.orders (backorder_status)
  where backorder_status <> 'none';

-- ------------------------------------------------------------
-- deliveries.parent_delivery_id / deliveries.items_manifest
-- ------------------------------------------------------------
-- When part of an order is left behind, a second delivery is raised for the
-- rest. These are how the two runs know about each other, and what each one
-- actually carried.
--
-- A REAL FOREIGN KEY THIS TIME. An order finds its deliveries by matching the
-- free text in `product` ("Order #12 - Ana Reyes"), which is a weakness this
-- work deliberately did not widen: the follow-up run keeps that exact prefix so
-- every existing matcher goes on working untouched. But nothing forced the
-- run-to-run link to be a second parsed string, so it is not one.
--
-- Null on every original run, which is most of them.
--
-- `items_manifest` is what was actually loaded onto that van --
-- [{ productId, name, orderedQty, deliveredQty, backorderQty }] -- kept per
-- DELIVERY rather than per order, because it is a record of one departure. The
-- order's own line counters are the running total; this is the receipt.
alter table public.deliveries
  add column if not exists parent_delivery_id bigint references public.deliveries(id),
  add column if not exists items_manifest jsonb not null default '[]'::jsonb;

create index if not exists deliveries_parent_idx on public.deliveries (parent_delivery_id)
  where parent_delivery_id is not null;

-- ------------------------------------------------------------
-- The money guard
-- ------------------------------------------------------------
-- Only an administrator or a manager may refund, or change what an order costs.
--
-- WHY A TRIGGER AND NOT A POLICY. RLS decides which ROWS you may write, not
-- which COLUMNS -- and every member of staff needs UPDATE on public.orders to
-- mark one done, so the row permission cannot be narrowed without breaking the
-- ordinary case. Admins, managers and sales staff are all the same
-- `authenticated` database role, so column grants cannot separate them either.
-- This is the same problem, and the same answer, as staff_guard_self_update
-- above.
--
-- WHAT IT PROTECTS is exactly the four things that move money or rewrite what a
-- customer was told. Everything else on an order -- status, items, the
-- delivery stamp -- is untouched, so marking an order done and recording what
-- went out stay open to whoever is doing the work.
--
-- THIS IS THE PERMISSION. The Order screen hides the block from anyone else and
-- App.jsx refuses before it writes, but those are a courtesy and a guard
-- against a stale render. The anon key ships in the JS bundle; only this runs
-- on the server.
create or replace function private.is_manager_or_admin()
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.staff
    where lower(email) = lower((select auth.jwt()) ->> 'email')
      and status = 'Active' and role in ('Admin', 'Manager')
  );
$fn$;

revoke all on function private.is_manager_or_admin() from public;
grant execute on function private.is_manager_or_admin() to authenticated;

-- WHAT THE SCREENS RESERVE, THE DATABASE MUST RESERVE TOO. The UPDATE policy
-- above is is_active_staff() for both USING and WITH CHECK, deliberately --
-- marking an order done is the ordinary work of the shop. WHICH COLUMNS may
-- change is answered here, and it used to ask only about money, which left
-- three things open to any active account going straight to the API: rewriting
-- what is on an order, renaming who it is for, and calling it off. All three
-- are canHandleMoney() on screen (see OrderDetailPage), i.e. manager or admin.
--
-- `items` IS NOT COMPARED WHOLE, and that is the trap in fixing this. Marking
-- an order done legitimately rewrites items -- commitOrder stamps each line's
-- committedUnits, and a dispatch does the same -- so comparing the column would
-- block the one action this policy is deliberately open for. The app also
-- normalises lines on the way through (normalizeItem in src/utils/orderItems.js)
-- and ADDS keys while doing it: `kind` and a `price` mirror of unitPrice appear
-- on rows stored without them, and numbers held as strings come back as
-- numbers. Comparing the column would call all of that an edit and refuse
-- ordinary staff on exactly the rows with the oldest data.
--
-- So only the COMMERCIAL shape is compared -- which products, how many, at what
-- price -- read through ->> and cast to numeric, so 5 and "5" are one number
-- and an added key is invisible. The fulfilment counters staff are allowed to
-- move are not in the projection at all.
create or replace function private.order_num(value text)
returns numeric language sql immutable set search_path = '' as $fn$
  -- Never raises. Something that is not a number reads as 0 on both sides of
  -- the comparison, so it cannot by itself look like an edit.
  select case when value ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' then value::numeric else 0 end;
$fn$;

create or replace function private.order_line_shape(items jsonb)
returns jsonb language sql immutable set search_path = '' as $fn$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'p', nullif(line ->> 'productId', ''),
        'q', private.order_num(line ->> 'quantity'),
        -- unitPrice falling back to price is what normalizeItem does; matching
        -- it keeps a normalised line equal to the one it came from.
        'u', private.order_num(coalesce(nullif(line ->> 'unitPrice', ''), line ->> 'price'))
      )
      order by ord
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(
         case when jsonb_typeof(items) = 'array' then items else '[]'::jsonb end
       ) with ordinality as t(line, ord);
$fn$;

revoke all on function private.order_num(text)          from public, anon;
revoke all on function private.order_line_shape(jsonb)  from public, anon;
grant execute on function private.order_num(text)         to authenticated;
grant execute on function private.order_line_shape(jsonb) to authenticated;

create or replace function public.orders_guard_money_update()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  -- No JWT at all means the table owner or the service role: SQL editor,
  -- migrations, seeds. Those bypass RLS already, so guarding them here only
  -- blocks legitimate maintenance - including running this very file.
  if (select auth.jwt()) is null then return new; end if;

  if private.is_manager_or_admin() then return new; end if;

  if new.total_amount      is distinct from old.total_amount
     or new.refunded_amount   is distinct from old.refunded_amount
     or new.refund_history    is distinct from old.refund_history
     or new.price_adjustments is distinct from old.price_adjustments then
    -- Written for a person: humanizeError in src/utils/storageManager.js passes
    -- messages shaped like this straight through to the toast rather than
    -- replacing them with a generic one.
    raise exception 'Only an administrator or a manager can give money back or change what an order costs';
  end if;

  -- UNDOING A FINISHED ORDER IS THE SAME KIND OF DECISION as refunding one, so
  -- it is gated with them rather than left to whoever wrote the order.
  --
  -- Marking an order done stays open to everybody -- it is the ordinary work of
  -- the shop, and old.status is 'Pending' on that path, so this never fires for
  -- it. What this catches is the way BACK: Completed to anything else puts
  -- goods back on the shelf and contradicts what a customer was already told.
  if old.status = 'Completed' and new.status is distinct from old.status then
    raise exception 'Only an administrator or a manager can put a finished order back to waiting';
  end if;

  -- Calling an order off is the same decision as refunding it, and the screen
  -- already treats it that way.
  if old.status is distinct from 'Cancelled' and new.status = 'Cancelled' then
    raise exception 'Only an administrator or a manager can call off an order';
  end if;

  if private.order_line_shape(new.items) is distinct from private.order_line_shape(old.items) then
    raise exception 'Only an administrator or a manager can change what is on an order';
  end if;

  if new.customer_name is distinct from old.customer_name then
    raise exception 'Only an administrator or a manager can change who an order is for';
  end if;

  return new;
end;
$fn$;

revoke all on function public.orders_guard_money_update() from public, anon, authenticated;

drop trigger if exists orders_guard_money_update on public.orders;
create trigger orders_guard_money_update
  before update on public.orders
  for each row execute function public.orders_guard_money_update();

-- ============================================================
-- Order commands: one transaction per action
-- ============================================================
-- BUG-01, BUG-02, BUG-03, BUG-05: one transaction per order action.
--
-- WHAT WAS WRONG. Every stock-moving action on an order was a LOOP OF SEPARATE
-- WRITES from the browser: persistStockChanges() sent one PATCH per inventory
-- row, one after another, and then the order row was written separately. Three
-- distinct faults came out of that shape.
--
--   A failure half way through leaves the rest committed (BUG-01). Row one is
--   already saved when row two is refused, the order write never happens, the
--   person presses the button again -- and row one is deducted a SECOND time.
--   Stock 64 -> 60 -> 56, for one order that should have ended at 60.
--
--   Two people overwrite each other (BUG-02). Each browser worked out the new
--   stock from its own snapshot and sent it as an ABSOLUTE number, matched only
--   on id. Two orders completed at once against 64 left 56 instead of 52: the
--   later write carried a total that had never heard of the earlier one.
--
--   An empty shelf list looked like success (BUG-03). With inventory still
--   loading, the ledger mapped over nothing, the loop found nothing to write
--   and reported ok, and the order was stamped Completed with a commitment date
--   while not one unit moved.
--
-- WHAT THIS DOES INSTEAD. The browser still does the ledger arithmetic -- that
-- is where the tested rules live, and porting them here would put one rule in
-- two places that can disagree. What it sends is no longer a set of finished
-- totals but the DELTAS, and they are applied here: in one transaction, against
-- rows locked FOR UPDATE, as stock = stock + delta. Two sessions queue on the
-- lock instead of racing, a delta naming a row that does not exist aborts
-- everything rather than passing silently, and nothing commits unless all of it
-- does.
--
-- Shaped after private.workshop_command, which already does this for the
-- purchasing and production side: advisory lock on a request id, a dedup table
-- so a retried request replays its stored answer instead of running twice, row
-- locks, and a thin SECURITY INVOKER wrapper in public.
--
-- WHAT IS DELIBERATELY NOT HERE. Whether an order is fully settled is decided
-- by the browser and arrives inside the patch, rather than being recomputed in
-- SQL. outstandingOf() is one rule; a second copy of it here is how two copies
-- drift apart. This function checks STATUS, which is its own business, and
-- applies what it is handed.
--
-- The activity log stays a browser write, as it is today. It is a record of
-- what somebody did, not part of the money, and pulling it in here would have
-- every action logged twice until every call site had moved.

create table if not exists private.order_requests (
  request_id uuid primary key,
  actor_id   bigint not null,
  action     text   not null,
  payload    jsonb  not null,
  result     jsonb  not null,
  at         timestamptz not null default now()
);
alter table private.order_requests enable row level security;
revoke all on private.order_requests from public, anon, authenticated;

create or replace function private.order_command(p_action text, p_data jsonb, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  actor    public.staff;
  ord      public.orders;
  dlv      public.deliveries;
  previous private.order_requests;
  result   jsonb;
  delta       jsonb;
  product_id  bigint;
  moved_id    bigint;
  units       integer;
  left_on_shelf integer;
  order_id    bigint;
  delivery_id bigint;
  touched     bigint[] := '{}';
begin
  if auth.uid() is null then raise exception 'Please sign in again.'; end if;
  select * into actor from public.staff
    where lower(email) = lower(auth.jwt() ->> 'email') and status = 'Active';
  if actor.id is null then raise exception 'An active staff account is needed.'; end if;
  if p_request_id is null then raise exception 'A request reference is needed.'; end if;

  -- Replay protection. Retries of one request serialize here, before the record
  -- of it is read, so two arriving together cannot both find nothing.
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into previous from private.order_requests where request_id = p_request_id;
  if found then
    if previous.actor_id <> actor.id or previous.action <> p_action or previous.payload <> p_data then
      raise exception 'This request has changed. Close the form and try again.';
    end if;
    return previous.result;
  end if;

  order_id    := nullif(p_data ->> 'orderId', '')::bigint;
  delivery_id := nullif(p_data ->> 'deliveryId', '')::bigint;
  if order_id is null then raise exception 'Which order is not clear.'; end if;

  select * into ord from public.orders where id = order_id for update;
  if not found then raise exception 'That order no longer exists.'; end if;

  if delivery_id is not null then
    select * into dlv from public.deliveries where id = delivery_id for update;
    if not found then raise exception 'That delivery no longer exists.'; end if;
  end if;

  case p_action
    when 'complete' then
      if ord.status <> 'Pending' then
        raise exception 'Only an order that is still waiting can be marked done.';
      end if;
    when 'reopen' then
      if ord.status <> 'Completed' then
        raise exception 'Only a finished order can be put back to waiting.';
      end if;
    when 'cancel' then
      if ord.status = 'Cancelled' then
        raise exception 'This order has already been called off.';
      end if;
    when 'refund' then
      null;
    when 'dispatch' then
      -- BUG-05. A fully refunded order is Cancelled, and its delivery used to
      -- be left on the board as an ordinary job: the crew could load a van for
      -- goods nobody was sending and whose money had already gone back.
      if ord.status = 'Cancelled' then
        raise exception 'This order has been called off, so nothing can go out on it.';
      end if;
    when 'arrive' then
      if delivery_id is null then raise exception 'Which delivery is not clear.'; end if;
    else
      raise exception 'That order action is not supported.';
  end case;

  for delta in select * from jsonb_array_elements(coalesce(p_data -> 'deltas', '[]'::jsonb)) loop
    product_id := nullif(delta ->> 'productId', '')::bigint;
    units      := nullif(delta ->> 'delta', '')::integer;
    if product_id is null or units is null then
      raise exception 'A stock change on this order could not be read.';
    end if;

    if units <> 0 then
      update public.inventory
         set stock = stock + units
       where id = product_id
       returning id, stock into moved_id, left_on_shelf;

      -- No such row means the browser was working from a list it never loaded.
      -- Aborting here takes the order write with it, which is the whole point.
      if moved_id is null then
        raise exception 'One of the products on this order is not on the shelf list.';
      end if;
      if left_on_shelf < 0 then
        raise exception 'There is not enough of one of these products left to do that.';
      end if;
      touched := touched || moved_id;
    end if;
  end loop;

  -- Only keys actually present in the patch are written, so an action that does
  -- not touch money cannot blank it. The money guard trigger still fires on this
  -- UPDATE and still reads the real caller's JWT even though this runs SECURITY
  -- DEFINER, so refunds and cancellations stay manager-only exactly as before.
  update public.orders set
    items              = coalesce(p_data -> 'order' -> 'items', items),
    status             = coalesce(p_data -> 'order' ->> 'status', status),
    stock_committed_at = case when p_data -> 'order' ? 'stockCommittedAt'
                           then nullif(p_data -> 'order' ->> 'stockCommittedAt', '')::timestamptz
                           else stock_committed_at end,
    backorder_status   = coalesce(p_data -> 'order' ->> 'backorderStatus', backorder_status),
    refunded_amount    = coalesce((p_data -> 'order' ->> 'refundedAmount')::numeric, refunded_amount),
    refund_history     = coalesce(p_data -> 'order' -> 'refundHistory', refund_history),
    total_amount       = coalesce((p_data -> 'order' ->> 'totalAmount')::numeric, total_amount)
  where id = order_id
  returning * into ord;

  if delivery_id is not null and p_data ? 'delivery' then
    update public.deliveries set
      status         = coalesce(p_data -> 'delivery' ->> 'status', status),
      items_manifest = coalesce(p_data -> 'delivery' -> 'itemsManifest', items_manifest),
      driver         = coalesce(p_data -> 'delivery' ->> 'driver', driver)
    where id = delivery_id
    returning * into dlv;
  end if;

  result := jsonb_build_object(
    'order', to_jsonb(ord),
    'delivery', case when dlv.id is not null then to_jsonb(dlv) else null end,
    'inventory', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.id)
      from public.inventory i where i.id = any(touched)
    ), '[]'::jsonb)
  );

  insert into private.order_requests(request_id, actor_id, action, payload, result)
    values (p_request_id, actor.id, p_action, p_data, result);
  return result;
end $fn$;

revoke all on function private.order_command(text, jsonb, uuid) from public, anon;
grant execute on function private.order_command(text, jsonb, uuid) to authenticated;

create or replace function public.order_command(p_action text, p_data jsonb, p_request_id uuid)
returns jsonb language sql security invoker set search_path = '' as $fn$
  select private.order_command(p_action, p_data, p_request_id);
$fn$;
revoke all on function public.order_command(text, jsonb, uuid) from public, anon;
grant execute on function public.order_command(text, jsonb, uuid) to authenticated;


-- ============================================================
-- Auth hook: staff claims on the access token
-- ============================================================
-- Stamps the signed-in person's staff role onto their JWT.
--
-- WHY. App.jsx used to block its first paint on a network read of this table
-- just to learn the caller's role: getSession(), then a full read of `staff`,
-- and only then could it decide which screen to show. The user saw nothing
-- until that landed, and because `profile.role` fell back to null meanwhile, a
-- slow read could flash "You don't have access to this screen" at a legitimate
-- admin. Signing in paid the same cost a second time. With these claims the
-- role arrives WITH the session and routing happens on the first frame.
--
-- SCOPE, DELIBERATELY NARROW. Claims are frozen when the token is minted and
-- only change when it refreshes (~1 hour), so they are for ROUTING AND UI ONLY
-- and never an access decision. The RLS predicates above keep reading this
-- table on every statement, so blocking someone still takes effect instantly at
-- the data layer; the app additionally re-checks the live row once it loads and
-- signs out anyone a stale claim flattered. The worst a stale claim buys is a
-- moment of empty dashboard chrome -- never data.
--
-- CLAIM NAMES MATTER. `role` is reserved: PostgREST reads it to pick the
-- database role for the request, so overwriting it would break every query.
-- Hence staff_role / staff_status / is_super_admin.
--
-- ENABLING IT IS A DASHBOARD STEP, not a SQL one:
--   Authentication -> Hooks -> Customize Access Token (JWT) Claims
--   -> select public.custom_access_token_hook
-- Until that is switched on the claims are simply absent, and the app falls
-- back to its original read-then-route path. Nothing breaks either way.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $fn$
declare
  claims   jsonb;
  v_email  text;
  v_role   text;
  v_status text;
  v_super  boolean;
begin
  claims  := event->'claims';
  v_email := lower(trim(claims->>'email'));

  if v_email is not null and v_email <> '' then
    select s.role, s.status, s.is_super_admin
      into v_role, v_status, v_super
    from public.staff s
    where lower(s.email) = v_email
    limit 1;
  end if;

  claims := jsonb_set(claims, '{staff_role}',     coalesce(to_jsonb(v_role),   'null'::jsonb));
  claims := jsonb_set(claims, '{staff_status}',   coalesce(to_jsonb(v_status), 'null'::jsonb));
  claims := jsonb_set(claims, '{is_super_admin}', to_jsonb(coalesce(v_super, false)));

  return jsonb_set(event, '{claims}', claims);
end;
$fn$;

-- Only the Auth server may run it, and it needs to see the staff table to do so.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

grant select on table public.staff to supabase_auth_admin;

drop policy if exists "Auth admin can read staff for the token hook" on public.staff;
create policy "Auth admin can read staff for the token hook"
  on public.staff for select
  to supabase_auth_admin
  using (true);

-- ============================================================
-- REQUIRED - bootstrap the superadmin
-- ============================================================
-- The policies above gate everything on having an Active `staff` row, and only
-- someone who already has one can create more. That leaves the first admin
-- unable to create their own: signing in would appear to work, then every read
-- would come back empty and every write would be rejected.
--
-- SQL run here in the editor executes as the table owner and bypasses RLS, so
-- this is the way in. Do both steps:
--
-- 1) Authentication -> Users -> Add User
--      Email:    your admin email
--      Password: anything you'll remember
--      [x] Auto Confirm User   <- must be checked, or they can't sign in
--
-- 2) Edit the email/name below to match exactly, then run this file.
--
-- The conflict target is lower(email), matching staff_email_lower_idx.
insert into public.staff (id, name, role, contact_number, status, email, is_super_admin)
values (1, 'System Admin', 'Admin', '', 'Active', 'lsbhandicraft@email.com', true)
on conflict (lower(email)) do update set
  name           = excluded.name,
  role           = excluded.role,
  status         = excluded.status,
  is_super_admin = true;

-- Workshop purchasing and production (also shipped as production.sql for
-- existing installations). Keep this block in sync with that extension.
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
