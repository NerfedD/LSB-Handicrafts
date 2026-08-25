-- LSB Handicrafts — clean up + reseed the `staff` table
-- Run in Supabase SQL Editor (Project → SQL Editor → New query).
--
-- Background: the app used to auto-seed six placeholder employees (Maria
-- Santos, Juan Dela Cruz, ...) into this table the first time it was empty.
-- That's been removed from the code (see src/App.jsx) so it can't happen
-- again, but if you've already opened the app since running schema.sql,
-- those placeholder rows are probably sitting in your live table. Part 1
-- below removes them; part 2 adds real sample data you control.

-- 1) Remove old placeholder rows. Every row created by someone actually
--    signing in has a real email attached (see the sign-in bootstrap in
--    src/App.jsx) — the placeholder rows never did, so this only touches
--    the fake ones. Safe to run even if there aren't any (deletes 0 rows).
delete from public.staff where email is null;

-- 2) Add your own sample staff. Edit every row below before running —
--    these are placeholders too, just ones you're choosing on purpose.
--
--    - `role` must be one of: Admin, Manager, Sales Staff, Production
--      Staff, Delivery Staff (see ROLES in src/utils/staffData.js).
--    - `status` is 'Active' or 'Blocked'.
--    - `email` links a row to a real Supabase Auth user so "My Profile"
--      shows it when that person signs in — leave it null (as below) for
--      staff with no login of their own. Don't put your admin's email
--      (lsbhandicraft@email.com) on one of these: signing in already
--      auto-created a row for it (part 1 above deliberately left that row
--      alone), and `email` is unique, so reusing it here will fail the
--      insert. Edit that row directly in the table editor instead if you
--      want to rename it.
--    - `id` just needs to be unique and not clash with the big
--      millisecond-timestamp ids the app generates for sign-in bootstrap
--      rows — anything under 100000 is safe.
insert into public.staff (id, name, role, contact_number, status, email) values
  (1001, 'Juan Dela Cruz',   'Sales Staff',       '09281234567', 'Active',  null),
  (1002, 'Ramon Garcia',     'Production Staff',  '09391234567', 'Blocked', null),
  (1003, 'Ana Reyes',        'Delivery Staff',    '09451234567', 'Active',  null),
  (1004, 'Carlos Mendoza',   'Manager',           '09561234567', 'Active',  null)
on conflict (id) do update set
  name = excluded.name,
  role = excluded.role,
  contact_number = excluded.contact_number,
  status = excluded.status,
  email = excluded.email;
