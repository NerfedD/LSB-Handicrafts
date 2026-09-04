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

-- Supabase Auth only ever authenticates on email, so a username has to be
-- turned into one BEFORE the password is checked - at which point the caller is
-- still anonymous and the staff policies below deny every read. This function
-- is the narrow hole that makes it possible: SECURITY DEFINER, so it runs as
-- its owner and sees the table, but it returns a single email and nothing else.
--
-- Worth being clear about the trade: the anon key is public, so anyone can call
-- this and learn the email behind a username they guess correctly. That is the
-- cost of username login on Supabase. It reveals no password and grants no
-- access - signing in still requires the password - but if staff emails are
-- meant to stay private, this should move to an Edge Function that does the
-- whole sign-in server-side instead. This is why it stays in `public`, and why
-- it is the one remaining entry in the security advisor's report.
--
-- Deliberately does NOT filter on status: a Blocked user must still resolve, so
-- they reach the app's "this account has been blocked" screen rather than being
-- told their username is wrong.
create or replace function public.email_for_username(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $fn$
  select email
  from public.staff
  where username is not null
    and lower(username) = lower(trim(p_username))
  limit 1;
$fn$;

revoke all on function public.email_for_username(text) from public;
grant execute on function public.email_for_username(text) to anon, authenticated;

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

create policy "Active staff can manage inventory"    on public.inventory    for all
  using (private.is_active_staff()) with check (private.is_active_staff());
create policy "Active staff can manage deliveries"   on public.deliveries   for all
  using (private.is_active_staff()) with check (private.is_active_staff());
create policy "Active staff can manage orders"       on public.orders       for all
  using (private.is_active_staff()) with check (private.is_active_staff());
create policy "Active staff can manage activity_log" on public.activity_log for all
  using (private.is_active_staff()) with check (private.is_active_staff());
create policy "Active staff can manage customers"    on public.customers    for all
  using (private.is_active_staff()) with check (private.is_active_staff());
create policy "Active staff can manage products"     on public.products     for all
  using (private.is_active_staff()) with check (private.is_active_staff());
create policy "Active staff can manage suppliers"    on public.suppliers    for all
  using (private.is_active_staff()) with check (private.is_active_staff());

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
  if new.role      is distinct from old.role
     or new.status is distinct from old.status
     or new.email  is distinct from old.email
     or new.id     is distinct from old.id then
    raise exception 'Only an administrator can change a staff role, status, email or id';
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
