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
  created_at text
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
  created_at text,
  stock_committed_at text
);

alter table public.orders
  add column if not exists stock_committed_at text;

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
  email text unique
);

-- Customer / product / supplier profile directories (Figma screens #14-#22).
-- These are reference records: name, how to reach them, and when the row last
-- changed. `created_at` / `updated_at` are text for the same reason the columns
-- above are — the app formats dates for display and never sorts on them in SQL.
create table if not exists public.customers (
  id bigint primary key,
  name text not null,
  contact_number text,
  email text,
  address text,
  created_at text,
  updated_at text
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
  created_at text,
  updated_at text,
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
  created_at text,
  updated_at text
);

-- Row Level Security.
--
-- The anon key is embedded in the published JavaScript bundle — that's normal
-- and unavoidable for a browser app, so RLS is the only thing standing between
-- a stranger and this data. "Signed in" is NOT a sufficient bar: Supabase
-- signups are open (CreateUserAccountPage needs them), so anyone can create an
-- auth user for themselves. Access is therefore gated on having an Active row
-- in `staff`, which only an existing admin can hand out.
--
-- SECURITY DEFINER makes this function run as its owner, which bypasses RLS
-- inside the function body. That's what lets the `staff` policy call it without
-- recursing into itself. `set search_path` pins schema resolution so the
-- elevated function can't be tricked into resolving `staff` elsewhere.
create or replace function public.is_active_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.staff
    where email = auth.jwt() ->> 'email'
      and status = 'Active'
  );
$$;

alter table public.inventory enable row level security;
alter table public.deliveries enable row level security;
alter table public.orders enable row level security;
alter table public.activity_log enable row level security;
alter table public.staff enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.suppliers enable row level security;

drop policy if exists "Authenticated users can manage inventory" on public.inventory;
drop policy if exists "Active staff can manage inventory" on public.inventory;
create policy "Active staff can manage inventory"
  on public.inventory for all
  using (public.is_active_staff())
  with check (public.is_active_staff());

drop policy if exists "Authenticated users can manage deliveries" on public.deliveries;
drop policy if exists "Active staff can manage deliveries" on public.deliveries;
create policy "Active staff can manage deliveries"
  on public.deliveries for all
  using (public.is_active_staff())
  with check (public.is_active_staff());

drop policy if exists "Authenticated users can manage orders" on public.orders;
drop policy if exists "Active staff can manage orders" on public.orders;
create policy "Active staff can manage orders"
  on public.orders for all
  using (public.is_active_staff())
  with check (public.is_active_staff());

drop policy if exists "Authenticated users can manage activity_log" on public.activity_log;
drop policy if exists "Active staff can manage activity_log" on public.activity_log;
create policy "Active staff can manage activity_log"
  on public.activity_log for all
  using (public.is_active_staff())
  with check (public.is_active_staff());

drop policy if exists "Authenticated users can manage staff" on public.staff;
drop policy if exists "Active staff can manage staff" on public.staff;
create policy "Active staff can manage staff"
  on public.staff for all
  using (public.is_active_staff())
  with check (public.is_active_staff());

drop policy if exists "Active staff can manage customers" on public.customers;
create policy "Active staff can manage customers"
  on public.customers for all
  using (public.is_active_staff())
  with check (public.is_active_staff());

drop policy if exists "Active staff can manage products" on public.products;
create policy "Active staff can manage products"
  on public.products for all
  using (public.is_active_staff())
  with check (public.is_active_staff());

drop policy if exists "Active staff can manage suppliers" on public.suppliers;
create policy "Active staff can manage suppliers"
  on public.suppliers for all
  using (public.is_active_staff())
  with check (public.is_active_staff());

-- ============================================================
-- REQUIRED — bootstrap the first admin
-- ============================================================
-- The policies above gate everything on having an Active `staff` row, and only
-- someone who already has one can create more. That leaves the first admin
-- unable to create their own: signing in would appear to work, then every read
-- would come back empty and every write would be rejected.
--
-- SQL run here in the editor executes as the table owner and bypasses RLS, so
-- this is the way in. Do both steps:
--
-- 1) Authentication → Users → Add User
--      Email:   your admin email
--      Password: anything you'll remember
--      ✅ Auto Confirm User   ← must be checked, or they can't sign in
--
-- 2) Edit the email/name below to match exactly, then run this file.
--
-- The app's VITE_ADMIN_EMAILS bootstrap path can no longer create this row —
-- its INSERT is refused by the policies above. This is now the only route in.
insert into public.staff (id, name, role, contact_number, status, email) values
  (1, 'System Admin', 'Admin', '', 'Active', 'lsbhandicraft@email.com')
on conflict (id) do update set
  name = excluded.name,
  role = excluded.role,
  status = excluded.status,
  email = excluded.email;
