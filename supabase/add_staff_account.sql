-- LSB Handicrafts — add one real, fully working staff account
-- Two steps: create the actual login in Supabase Auth (Step 1, done in the
-- dashboard — SQL can't safely do this part), then link a `staff` row to it
-- so the app knows their name and role (Step 2, this SQL).
--
-- A `staff` row alone (like the ones in seed_staff.sql) is just a label —
-- it doesn't let anyone log in. An Auth user alone can log in but the app
-- will reject them at the gate (see src/App.jsx) because it has no `staff`
-- row to read a role from. You need both, matched by email, for someone to
-- actually get in.

-- ============================================================
-- STEP 1 — create the login (do this in the Supabase dashboard)
-- ============================================================
-- Project → Authentication → Users → Add User
--   Email:    (their real email — must match Step 2 below exactly)
--   Password: (a temporary password — tell them to change it once in)
--   ✅ Auto Confirm User   ← check this box
--
-- Checking "Auto Confirm User" is what makes them able to log in right
-- away, with no confirmation email to click. Skip that box and they'll be
-- stuck pending until they confirm.

-- ============================================================
-- STEP 2 — link a staff row to that login (run this part)
-- ============================================================
-- Edit every value below to match the person you just created in Step 1.
--   - `email` MUST exactly match what you typed into Add User above —
--     this is the only thing that connects the two.
--   - `role` must be one of: Admin, Manager, Sales Staff, Production
--     Staff, Delivery Staff (see ROLES in src/utils/staffData.js).
--   - `status` is 'Active' or 'Blocked'.
--   - `id` just needs to be unique — anything not already used in the
--     table is fine; under 100000 avoids clashing with the big
--     millisecond-timestamp ids the app generates on its own.
insert into public.staff (id, name, role, contact_number, status, email) values
  (2001, 'Employee Name', 'Sales Staff', '09171234567', 'Active', 'employee@example.com')
on conflict (id) do update set
  name = excluded.name,
  role = excluded.role,
  contact_number = excluded.contact_number,
  status = excluded.status,
  email = excluded.email;

-- That's it — they can log in immediately with the email/password from
-- Step 1, and land on the screen matching the role you set here (Admin
-- gets the full dashboard, everyone else gets their role's page).
