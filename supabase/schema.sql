-- LSB Handicrafts — Supabase schema
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Safe to re-run: every statement is guarded with IF NOT EXISTS / OR REPLACE.

create table if not exists public.inventory (
  id bigint primary key,
  sku text not null,
  name text not null,
  category text not null,
  price numeric not null default 0,
  stock integer not null default 0,
  status text not null default 'In Stock'
);

create table if not exists public.deliveries (
  id bigint primary key,
  product text not null,
  size text,
  location text not null,
  amount numeric,
  status text not null default 'Not Yet Delivered',
  created_at text
);

create table if not exists public.orders (
  id bigint primary key,
  customer_name text not null,
  items jsonb not null default '[]'::jsonb,
  total_amount numeric not null default 0,
  status text not null default 'Pending',
  created_at text
);

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

-- Row Level Security: only signed-in users may read/write. The app also
-- enforces a temporary admin-email allowlist client-side (see
-- src/utils/adminAccess.js) — this RLS policy is the database-level backstop
-- so the anon key alone can never touch these tables without a session.
alter table public.inventory enable row level security;
alter table public.deliveries enable row level security;
alter table public.orders enable row level security;
alter table public.activity_log enable row level security;
alter table public.staff enable row level security;

drop policy if exists "Authenticated users can manage inventory" on public.inventory;
create policy "Authenticated users can manage inventory"
  on public.inventory for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can manage deliveries" on public.deliveries;
create policy "Authenticated users can manage deliveries"
  on public.deliveries for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can manage orders" on public.orders;
create policy "Authenticated users can manage orders"
  on public.orders for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can manage activity_log" on public.activity_log;
create policy "Authenticated users can manage activity_log"
  on public.activity_log for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can manage staff" on public.staff;
create policy "Authenticated users can manage staff"
  on public.staff for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
