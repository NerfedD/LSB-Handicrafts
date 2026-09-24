-- LSB Handicrafts — Supabase schema
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Safe to re-run: every statement is guarded with IF NOT EXISTS / OR REPLACE.
-- Also safe on an EMPTY project: every object is created before anything refers
-- to it (src/utils/schemaInstall.test.js applies this file twice to a fresh
-- database to keep it that way).

-- Helpers and request logs live in `private`, which PostgREST does not expose
-- (see the Row Level Security section). Created first: the id sequence below
-- lives there too.
create schema if not exists private;

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
-- These are NOT NULL with defaults on purpose, so a client that predates a
-- column can still write a row without naming it.
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

-- One stock row per code is enforced by a case-insensitive unique index added
-- in 20260924120000_stock_returns_loyalty.sql (created only when the existing
-- data allows it; supabase/integrity_check.sql lists any duplicates).

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
-- a stranger and this data. "Signed in" is NOT a sufficient bar: if Supabase
-- sign-ups are left open, anyone can create an auth user for themselves. Access
-- is gated on having an Active row in `staff`, which only an existing admin can
-- hand out (through the admin-accounts Edge Function).
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

-- Workshop purchasing and production. workshop_command is redefined by
-- 20260924120000_stock_returns_loyalty.sql further down.
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

-- ============================================================
-- Orders know which customer record they belong to
-- ============================================================
-- BUG-15: orders found their customer by name, so renaming one lost their history.
--
-- `orders` stores customer_name and nothing else, and four separate places in
-- the app match on lower(trim(name)) to work out whose order it is: the index in
-- utils/customers, the summary beside it, the lookup that feeds the order screen
-- its customer, and the check that stops a customer being deleted while an order
-- of theirs is still waiting. Correct a spelling on a customer card and all four
-- stop finding their orders at once -- the orders are still there, the thread
-- back to the person is what breaks. Two customers who genuinely share a name
-- have the opposite problem: they have always shared a history.
--
-- README.md and PRODUCT.md both carried this as a known gap whose fix "needs a
-- foreign key and data migration". This is that.
--
-- LINKED WHERE IT IS CERTAIN, NAME-MATCHED WHERE IT IS NOT. The order form takes
-- the customer as free text with a datalist of suggestions, deliberately, so a
-- walk-in can be served without being enrolled first. An order can therefore name
-- somebody who is not a customer record at all, and those rows have no id to
-- carry. So the name match does not go away -- it stops being the only thing
-- holding the two together.
--
-- The backfill links only where exactly ONE customer bears the name. Two people
-- called the same thing stay unlinked rather than be guessed between: picking
-- wrong here would attach one person's spending to another, which is worse than
-- the gap being closed.

alter table public.orders
  add column if not exists customer_id bigint
  references public.customers(id) on delete set null;

-- ON DELETE SET NULL, not CASCADE and not RESTRICT. Removing a customer must not
-- delete their orders and must not be blocked by them; the order survives and
-- falls back to the name it already stores, which is exactly how every order
-- behaved before this column existed.

update public.orders o
set customer_id = c.id
from (
  select lower(trim(name)) as key, min(id) as id, count(*) as n
  from public.customers
  group by lower(trim(name))
) c
where o.customer_id is null
  and c.n = 1
  and c.key = lower(trim(o.customer_name));

-- Partial: the rows worth looking up by customer are the linked ones, and an
-- index over a column that is null for every walk-in is mostly empty pages.
create index if not exists orders_customer_id_idx
  on public.orders (customer_id)
  where customer_id is not null;

-- Who an order belongs to is the same kind of decision as what is on it, and
-- the screens reserve both for a manager. customer_name was already guarded;
-- the id has to be guarded with it, or the rename it is meant to survive could
-- simply be done against the id instead.
create or replace function public.orders_guard_money_update()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if (select auth.jwt()) is null then return new; end if;

  if private.is_manager_or_admin() then return new; end if;

  if new.total_amount      is distinct from old.total_amount
     or new.refunded_amount   is distinct from old.refunded_amount
     or new.refund_history    is distinct from old.refund_history
     or new.price_adjustments is distinct from old.price_adjustments then
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

drop trigger if exists orders_guard_money_update on public.orders;
create trigger orders_guard_money_update
  before update on public.orders
  for each row execute function public.orders_guard_money_update();

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

-- QA integrity guards: keep in sync with 20260921122520_qa_integrity_guards.sql
-- Apply before deploying the matching client; refresh existing browser tabs.
-- Catalogue and contact forms carry the revision at the time editing began.
create or replace function private.bump_record_revision()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  new.revision := old.revision + 1;
  return new;
end;
$fn$;
revoke all on function private.bump_record_revision() from public, anon, authenticated;

do $migration$
declare target text;
begin
  foreach target in array array['customers', 'suppliers', 'products', 'inventory'] loop
    execute format('alter table public.%I add column if not exists revision bigint not null default 0', target);
    execute format('drop trigger if exists %I on public.%I', target || '_revision', target);
    execute format('create trigger %I before update on public.%I for each row execute function private.bump_record_revision()', target || '_revision', target);
  end loop;
end;
$migration$;

-- Existing events cannot retrospectively be authenticated. New events are
-- written only by trusted database code, in the same transaction as the change.
alter table public.activity_log add column if not exists source text not null default 'legacy';
alter table public.activity_log alter column source set default 'server';
alter table public.activity_log add column if not exists actor_staff_id bigint;
drop policy if exists "Active staff insert activity_log" on public.activity_log;
revoke insert, update, delete, truncate on public.activity_log from public, anon, authenticated;

create or replace function private.audit_record_change()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare
  actor_id bigint;
  actor_name text;
  before_row jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  after_row jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  item jsonb;
  event_kind text;
  event_subject text;
  event_description text;
  change_amount numeric;
  changed_fields text;
begin
  if tg_op = 'UPDATE' and (before_row - 'revision' - 'updated_at') = (after_row - 'revision' - 'updated_at') then
    return new;
  end if;
  select id, name into actor_id, actor_name from public.staff
    where lower(email) = lower(auth.jwt()->>'email') and status = 'Active' limit 1;
  -- System operations and self-deletion still have a truthful actor label.
  actor_name := coalesce(actor_name, nullif(auth.jwt()->>'email', ''), 'System');
  item := case when tg_op = 'DELETE' then before_row else after_row end;
  event_kind := case tg_table_name
    when 'customers' then 'customer' when 'suppliers' then 'supplier'
    when 'products' then 'product' when 'inventory' then 'stock'
    when 'orders' then 'order' when 'deliveries' then 'delivery' else 'account' end;
  event_subject := case tg_table_name
    when 'products' then item->>'item_code'
    when 'inventory' then item->>'sku'
    else event_kind || ':' || (item->>'id') end;
  event_description := case tg_op when 'INSERT' then 'added ' when 'DELETE' then 'removed ' else 'updated ' end
    || event_kind || ' ' || coalesce(nullif(item->>'name', ''), '#' || (item->>'id'));
  if tg_op = 'UPDATE' then
    select string_agg(k, ', ' order by k) into changed_fields
      from jsonb_object_keys(after_row) as fields(k)
      where k not in ('revision', 'updated_at') and before_row->k is distinct from after_row->k;
    event_description := event_description || ' (changed: ' || coalesce(changed_fields, 'record') || ')';
    if tg_table_name = 'inventory' then
      change_amount := (after_row->>'stock')::numeric - (before_row->>'stock')::numeric;
    elsif tg_table_name = 'orders' and before_row->'total_amount' is distinct from after_row->'total_amount' then
      event_kind := 'price';
      change_amount := (after_row->>'total_amount')::numeric - (before_row->>'total_amount')::numeric;
      event_description := event_description || ': ' || coalesce(before_row->>'total_amount', '0') || ' to ' || coalesce(after_row->>'total_amount', '0');
    end if;
  end if;
  insert into public.activity_log(type, staff_name, actor_staff_id, description, subject, amount, at, source)
    values(event_kind, actor_name, actor_id, event_description, event_subject, change_amount, clock_timestamp(), 'server');
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$fn$;
revoke all on function private.audit_record_change() from public, anon, authenticated;

do $migration$
declare target text;
begin
  foreach target in array array['customers', 'suppliers', 'products', 'inventory', 'orders', 'deliveries', 'staff'] loop
    execute format('drop trigger if exists audit_record_change on public.%I', target);
    execute format('create trigger audit_record_change after insert or update or delete on public.%I for each row execute function private.audit_record_change()', target);
  end loop;
end;
$migration$;

-- One sign-in entry per authenticated session. No caller-supplied actor,
-- description, timestamp, or event kind is accepted by this endpoint.
create table if not exists private.audited_sessions (session_id uuid primary key);
revoke all on private.audited_sessions from public, anon, authenticated;
create or replace function public.record_session_activity()
returns void language plpgsql security definer set search_path = '' as $fn$
declare actor_id bigint; actor_name text; session_key uuid; inserted_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  session_key := nullif(auth.jwt()->>'session_id', '')::uuid;
  select id, name into actor_id, actor_name from public.staff
    where lower(email) = lower(auth.jwt()->>'email') and status = 'Active' limit 1;
  if actor_id is null or session_key is null then
    raise exception 'An active staff session is needed.' using errcode = '42501';
  end if;
  insert into private.audited_sessions values(session_key) on conflict do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 1 then
    insert into public.activity_log(type, staff_name, actor_staff_id, description, at, source)
      values('sign-in', actor_name, actor_id, 'signed in', clock_timestamp(), 'server');
  end if;
end;
$fn$;
revoke all on function public.record_session_activity() from public, anon;
grant execute on function public.record_session_activity() to authenticated;

-- Staff revision guard: keep in sync with 20260921213000_staff_revision_guard.sql
-- Staff rows carry privilege, so a lost update here is not just a lost edit.
--
-- Admin screens save a WHOLE row: App.updateSelectedAccount sends
-- { ...current, ...changes }, where `current` is this browser's copy. That copy
-- is refreshed on a 30-second timer, but a screen opened before a change still
-- holds the old status and role. So one administrator blocking a departing
-- employee could be undone by another administrator saving a name correction
-- from a screen opened a minute earlier -- it writes back status = 'Active' and
-- nothing reports it. The block evaporates silently.
--
-- staff was given an audit trigger by 20260921122520 but no revision, the one
-- audited table without one. This closes that gap. The bump function and the
-- update predicate are the same ones the other six tables already use.
alter table public.staff add column if not exists revision bigint not null default 0;
drop trigger if exists staff_revision on public.staff;
create trigger staff_revision before update on public.staff
  for each row execute function private.bump_record_revision();

-- update_own_profile deliberately does NOT take a revision, and its arity is
-- not changed: it is granted by exact signature, so a new parameter would
-- revoke the grant from every client still calling the old shape. It writes two
-- columns -- your own name and contact number -- on your own row, chosen
-- server-side, so it cannot carry another screen's stale status or role. The
-- trigger above still bumps the revision, which is what makes an administrator
-- screen held open over your own profile edit go stale rather than overwrite it.

-- Admin remediation: keep in sync with 202609140001_admin_remediation.sql (minus its begin/commit)
-- A blocked caller may read their own status, without seeing other staff.
drop policy if exists "Active staff can read staff" on public.staff;
create policy "Active staff can read staff" on public.staff for select
  using (private.is_active_staff() or lower(email) = lower((select auth.jwt()) ->> 'email'));

-- Provisioning metadata is supplied only by the Auth Admin API. Public sign-up
-- cannot write raw_app_meta_data. A failing staff insert rolls back Auth creation.
create or replace function public.provision_staff_from_auth()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare details jsonb := new.raw_app_meta_data -> 'lsb_staff';
begin
  if details is null then return new; end if;
  insert into public.staff (id, name, role, contact_number, status, email, username)
  values (
    (extract(epoch from clock_timestamp()) * 1000000)::bigint,
    details ->> 'name', details ->> 'role', coalesce(details ->> 'contactNumber', ''),
    'Active', lower(new.email), nullif(trim(details ->> 'username'), '')
  );
  return new;
end;
$fn$;
revoke all on function public.provision_staff_from_auth() from public, anon, authenticated;
drop trigger if exists provision_lsb_staff on auth.users;
create trigger provision_lsb_staff after insert on auth.users
  for each row execute function public.provision_staff_from_auth();

-- RLS authorizes deletion of the staff row first. Removing credentials in the
-- same transaction prevents partial deletion and refresh-token resurrection.
create or replace function public.remove_staff_credentials()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  delete from auth.users where lower(email) = lower(old.email);
  return old;
end;
$fn$;
revoke all on function public.remove_staff_credentials() from public, anon, authenticated;
drop trigger if exists remove_lsb_credentials on public.staff;
create trigger remove_lsb_credentials after delete on public.staff
  for each row execute function public.remove_staff_credentials();

alter table public.orders add column if not exists priority_position integer not null default 0;

create or replace function public.reorder_orders(p_ids bigint[])
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  if not private.is_active_staff() then
    raise exception 'You do not have permission to reorder orders.' using errcode = '42501';
  end if;
  -- Serializes priority writes while preserving independent stock/money writes.
  perform pg_advisory_xact_lock(7140914);
  if cardinality(p_ids) is distinct from (select count(distinct id) from unnest(p_ids) id)
    or exists (select 1 from unnest(p_ids) id where id is null)
    or exists (select 1 from unnest(p_ids) as requested(order_id) where not exists (select 1 from public.orders o where o.id = requested.order_id)) then
    raise exception 'The order list changed. Refresh it and try again.';
  end if;
  update public.orders o set priority_position = ranked.position::integer
    from unnest(p_ids) with ordinality as ranked(id, position) where o.id = ranked.id;
end;
$fn$;
revoke all on function public.reorder_orders(bigint[]) from public, anon;
grant execute on function public.reorder_orders(bigint[]) to authenticated;

-- Staff provisioning: keep in sync with 20260921160000_provision_staff_on_metadata.sql
-- Staff accounts could never be created through admin-accounts.
--
-- The Edge Function calls auth.admin.createUser() with the new person's details
-- in app_metadata, and its comment says "the database trigger inserts staff in
-- the same transaction as auth.users". That is the assumption that was wrong.
-- GoTrue does not carry custom app_metadata into the INSERT; it writes it in a
-- follow-up UPDATE of raw_app_meta_data. The trigger fired AFTER INSERT only,
-- read `new.raw_app_meta_data -> 'lsb_staff'` as null, and took its no-op path.
--
-- Nothing raised, so nothing appeared in the Postgres logs to explain it. The
-- function then looked for the staff row it was promised, did not find it,
-- correctly refused to leave an orphaned sign-in behind, deleted the auth user
-- and returned 503 -- whose message blames a missing migration. The migration
-- was installed the whole time. Account creation through this path had never
-- once completed.
--
-- The fix is to provision on whichever write actually carries the details, and
-- to make the insert idempotent so that being called twice is harmless. The
-- existence check is on the same lower(email) the insert writes, which is also
-- what the Edge Function selects on afterwards.
create or replace function public.provision_staff_from_auth()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare details jsonb := new.raw_app_meta_data -> 'lsb_staff';
begin
  if details is null then return new; end if;
  -- Fires on the INSERT and on the metadata UPDATE GoTrue makes straight after.
  -- Whichever one carries lsb_staff provisions the row; the other finds it
  -- already there and does nothing. An account created some other way -- by
  -- hand in the dashboard, or by the seed -- carries no lsb_staff at all and
  -- still takes the no-op path above, exactly as before.
  if exists (select 1 from public.staff where lower(email) = lower(new.email)) then
    return new;
  end if;
  insert into public.staff (name, role, contact_number, status, email, username)
  values (
    details ->> 'name', details ->> 'role', coalesce(details ->> 'contactNumber', ''),
    'Active', lower(new.email), nullif(trim(details ->> 'username'), '')
  );
  return new;
end;
$fn$;
revoke all on function public.provision_staff_from_auth() from public, anon, authenticated;

drop trigger if exists provision_lsb_staff on auth.users;
create trigger provision_lsb_staff
  after insert or update of raw_app_meta_data on auth.users
  for each row execute function public.provision_staff_from_auth();

-- Stock ledger, damage, replacements, loyalty and role boundaries: keep in sync with 20260924120000_stock_returns_loyalty.sql
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
