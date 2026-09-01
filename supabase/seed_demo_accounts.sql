-- LSB Handicrafts — demo accounts, one per role
--
-- Five working logins for exercising each dashboard: Admin (#13), Sales Staff
-- (#23), Production Staff (#24), and the two roles with no design of their own
-- (Manager, Delivery Staff) which fall through to #13 with the admin panels
-- hidden.
--
-- The Auth users for these five ALREADY EXIST in this project and are
-- confirmed. This file only creates the `staff` rows that give them a name, a
-- role and a username — see add_staff_account.sql for why both halves are
-- needed: an Auth user with no staff row is refused at the gate in src/App.jsx.
--
-- If you are seeding a FRESH project, create the logins first:
--   Authentication → Users → Add User, with ✅ Auto Confirm User checked,
--   using the five emails below and whatever demo password you've agreed on.
--
-- `username` is what these accounts actually sign in with — LoginPage trades it
-- for the email through the email_for_username RPC (see schema.sql). Note the
-- production account signs in as "production" but its email is prod@email.com;
-- they don't have to match.

-- Re-runnable by delete-then-insert so a re-run also clears a row whose email
-- or username you've since changed, which ON CONFLICT (id) DO UPDATE would
-- leave behind as a duplicate — `username` is unique, so that stale row then
-- blocks the insert.
--
-- Run this in the SQL Editor, which connects as the table owner and so is not
-- subject to the staff policies in schema.sql. From the app's anon/authenticated
-- role these writes are admin-only (see is_admin_staff()).
delete from public.staff
where email in (
  'admin@email.com',
  'manager@email.com',
  'sales@email.com',
  'prod@email.com',
  'delivery@email.com'
);

-- ids in the 3000s: unique, well clear of the seeded admin (1) and the
-- millisecond-timestamp ids the app generates for accounts made in the UI.
insert into public.staff (id, name, role, contact_number, status, email, username) values
  (3001, 'Maria Santos',    'Admin',            '09171234501', 'Active', 'admin@email.com',    'admin'),
  (3002, 'Carlos Mendoza',  'Manager',          '09171234502', 'Active', 'manager@email.com',  'manager'),
  (3003, 'Juan Dela Cruz',  'Sales Staff',      '09171234503', 'Active', 'sales@email.com',    'sales'),
  (3004, 'Ramon Garcia',    'Production Staff', '09171234504', 'Active', 'prod@email.com',     'production'),
  (3005, 'Ana Reyes',       'Delivery Staff',   '09171234505', 'Active', 'delivery@email.com', 'delivery');

-- What each one should land on, as a check against src/utils/permissions.js:
--   admin       → Dashboard #13, full sidebar, all quick actions
--   manager     → Dashboard #13, NO staff roster / user counters / activity
--   sales       → Sales dashboard #23
--   production  → Production dashboard #24, no Customer or Supplier Profiles
--   delivery    → same as manager
-- None of the four non-admins should see User Management or the Staff Activity
-- Log, in the sidebar or on the My Profile tab bar.
