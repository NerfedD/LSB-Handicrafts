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

-- Emails allowed to self-provision the very first Admin `staff` row (the
-- same list as VITE_ADMIN_EMAILS in .env — keep them in sync by hand).
-- Only used once per email: the moment that person has a `staff` row of
-- their own, current_staff_role() takes over and this table stops
-- mattering for them. RLS-locked with no policies below, so nobody can
-- read it directly over the API — only the security-definer function can.
create table if not exists public.admin_bootstrap_emails (
  email text primary key
);
insert into public.admin_bootstrap_emails (email)
values ('lsbhandicraft@email.com')
on conflict (email) do nothing;

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------
-- Both are `security definer`, so they can read admin_bootstrap_emails and
-- staff even though the policies below lock those tables down — without
-- this, a policy that queries staff (or this function queries staff)
-- would need staff's own SELECT policy to permit the read first, which is
-- exactly the recursive trap `security definer` + a fixed search_path
-- avoids.

-- The signed-in user's role, or null if they have no active `staff` row
-- (no row at all, or status = 'Blocked'). This is what every policy below
-- checks instead of the old "any signed-in user" check.
create or replace function public.current_staff_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role
  from public.staff
  where email = auth.jwt() ->> 'email'
    and status = 'Active'
  limit 1;
$$;
grant execute on function public.current_staff_role() to anon, authenticated;

-- Whether an email is on the one-time bootstrap-admin list.
create or replace function public.is_bootstrap_admin_email(check_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admin_bootstrap_emails where email = check_email
  );
$$;
grant execute on function public.is_bootstrap_admin_email(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
-- Previously every table just checked auth.role() = 'authenticated' —
-- true for ANY signed-in Supabase user, not just people this app actually
-- gave access to. That meant anyone who could get a valid session at all
-- (e.g. self-signup with the public anon key, same one shipped in this
-- app's own JS bundle) could read and write every table directly via the
-- REST API, completely bypassing the admin-email gate and role routing in
-- src/App.jsx — those only ever controlled what the UI showed, never what
-- the database allowed. The policies below check current_staff_role()
-- instead, so the database enforces the same thing the app already
-- pretends to.
alter table public.inventory enable row level security;
alter table public.deliveries enable row level security;
alter table public.orders enable row level security;
alter table public.activity_log enable row level security;
alter table public.staff enable row level security;
alter table public.admin_bootstrap_emails enable row level security;
-- No policies on admin_bootstrap_emails: it's unreadable over the API by
-- design, even to Admins. Only is_bootstrap_admin_email() can see inside it.

-- inventory / deliveries / orders / activity_log — only the AdminDashboard
-- screens touch these, and that dashboard is Admin-only (see App.jsx), so
-- these stay Admin-only end to end.
drop policy if exists "Authenticated users can manage inventory" on public.inventory;
drop policy if exists "Admins can manage inventory" on public.inventory;
create policy "Admins can manage inventory"
  on public.inventory for all
  using (public.current_staff_role() = 'Admin')
  with check (public.current_staff_role() = 'Admin');

drop policy if exists "Authenticated users can manage deliveries" on public.deliveries;
drop policy if exists "Admins can manage deliveries" on public.deliveries;
create policy "Admins can manage deliveries"
  on public.deliveries for all
  using (public.current_staff_role() = 'Admin')
  with check (public.current_staff_role() = 'Admin');

drop policy if exists "Authenticated users can manage orders" on public.orders;
drop policy if exists "Admins can manage orders" on public.orders;
create policy "Admins can manage orders"
  on public.orders for all
  using (public.current_staff_role() = 'Admin')
  with check (public.current_staff_role() = 'Admin');

drop policy if exists "Authenticated users can manage activity_log" on public.activity_log;
drop policy if exists "Admins can manage activity_log" on public.activity_log;
create policy "Admins can manage activity_log"
  on public.activity_log for all
  using (public.current_staff_role() = 'Admin')
  with check (public.current_staff_role() = 'Admin');

-- staff — split by operation instead of one blanket policy, because
-- INSERT needs a one-time carve-out that UPDATE/DELETE must not have (see
-- below). Every real write today (block/unblock, edit, delete, create,
-- assign role) only ever happens from Admin-only screens — RoleDashboardPage
-- (every other role's landing page) has no functionality wired up yet, so
-- restricting writes to Admins matches what the app actually does right
-- now. The one thing this does NOT yet handle: if a non-Admin role ever
-- gets a real "edit my own profile" screen, saveStaff's bulk-upsert-the-
-- whole-array pattern (see src/utils/storageManager.js) will need to
-- become a targeted single-row update before a "you can edit your own
-- row" policy could work — a blanket bulk upsert from a non-Admin would
-- still touch every other row and get rejected wholesale otherwise.
drop policy if exists "Authenticated users can manage staff" on public.staff;

-- Active staff see the whole directory. Everyone else (blocked, or no row
-- at all) sees only a row matching their own email, if one exists — not
-- the rest of the table. That one exception is what lets a blocked
-- person's own login flow still see their real status and show "This
-- account has been blocked" instead of a generic no-access message; it
-- doesn't expose anyone else's data, since RLS filters row-by-row.
drop policy if exists "Active staff can view staff" on public.staff;
create policy "Active staff can view staff"
  on public.staff for select
  using (
    public.current_staff_role() is not null
    or email = auth.jwt() ->> 'email'
  );

-- INSERT is the one exception: an Admin can add anyone (normal Create
-- User Account flow), OR someone can insert exactly one row for
-- themselves with role = 'Admin', but only if their email is on the
-- one-time bootstrap list above. Without that second branch, the very
-- first Admin could never get their own row created — current_staff_role()
-- is still null for them at that exact moment, since the row that would
-- make it non-null doesn't exist yet.
drop policy if exists "Admins can insert staff" on public.staff;
create policy "Admins can insert staff"
  on public.staff for insert
  with check (
    public.current_staff_role() = 'Admin'
    or (
      email = auth.jwt() ->> 'email'
      and role = 'Admin'
      and public.is_bootstrap_admin_email(auth.jwt() ->> 'email')
    )
  );

drop policy if exists "Admins can update staff" on public.staff;
create policy "Admins can update staff"
  on public.staff for update
  using (public.current_staff_role() = 'Admin')
  with check (public.current_staff_role() = 'Admin');

drop policy if exists "Admins can delete staff" on public.staff;
create policy "Admins can delete staff"
  on public.staff for delete
  using (public.current_staff_role() = 'Admin');
