# Database: setup, migrations and deployment

The app is a static React bundle talking to one Supabase project (Postgres, Auth, Edge Functions). The anon key ships in the bundle, so **the database is the security boundary**: row level security, guard triggers and a few command functions decide what any signed-in person may read or change.

## Files

| File | What it is |
| --- | --- |
| `supabase/schema.sql` | The whole database. Installs on an empty project and is safe to run again on a live one. It contains every migration below (a unit test checks this). |
| `supabase/migrations/*.sql` | Each change since the schema was first deployed, in order. Apply only the new ones to an existing project. |
| `supabase/integrity_check.sql` | A read-only report of data that would break or is broken by the rules, with commented-out corrections. |
| `supabase/verify_production.sql` | A rollback-only acceptance test of purchasing, receiving and production against a real project. |
| `supabase/seed_*.sql`, `add_staff_account.sql` | Demo and bootstrap data. Never needed on a live project. |
| `supabase/functions/*` | Edge Functions: `sign-in` (username sign-in), `admin-accounts` (create a staff login), `delete-staff-auth-user` (remove a login). |

## A new project

1. Create the first administrator's login: Authentication → Users → Add user, with **Auto Confirm User** ticked.
2. Edit the bootstrap row near the end of `schema.sql`'s staff section (email and name) to match, then run `schema.sql` in the SQL editor.
3. Optionally run `seed_inventory.sql`, `seed_profiles.sql`, `seed_demo_accounts.sql` for demo data.
4. Deploy the Edge Functions (below) and set Auth → Providers → Email → minimum password length to 8.

## An existing project

Apply the migrations it has not had, **oldest first**. The hosted project `tvdtzsputfnapswpurlr` had everything up to `20260921213000_staff_revision_guard.sql` when this release was prepared; the ones to apply are:

**`20260924120000_stock_returns_loyalty.sql`** — adds the stock-movement ledger, damage and count corrections (`stock_command`), replacements and server-checked refunds in `order_command`, supplier delivery references, `deliveries.order_id` (back-filled from the "Order #N - " text), the one-row-per-code index on stock, product archiving (`remove_product`), loyalty rules with validated order discounts, per-customer totals (`customer_order_stats`), and the role policies in [workflows.md](workflows.md#roles). It deletes and overwrites nothing except the documented back-fill.

**`20260924190000_material_crud_and_damage_undo.sql`** — adds `status` and `revision` to raw materials, `remove_material` and `restore_material` (archive-or-delete, the same rule as products), a `save_material` that can correct every field rather than only the name and reorder point, and `undo_damage` in `stock_command` with the `reverses_movement_id` link and the unique index that allows exactly one undo per damage record. It adds columns, constraints and functions only.

**`20260929120000_controlled_inputs_and_photos.sql`** — the checks behind the purchasing, production and catalogue forms: `private.shop_today()` and the `guard_promised_date` trigger (no promised date before today on a new or changed date, on `deliveries.due_on` and `raw_material_orders.expected_delivery_date`); `guard_product_measurements` (positive, bounded sizes on products and stock rows, checked only on values being written); the `product_categories` list with its case-insensitive unique index, the `canonical_category` trigger and `category_command`; `product_images` with `save_product_image`; `raw_materials.weight_kg`; a `save_material` that generates a code when none is given and checks the code format, unit and every measurement; and `workshop_precheck`, called by `public.workshop_command` before anything moves, which explains a bad count or price in words and refuses archived or used-up materials and archived products. It rewrites one thing on purpose: category labels that differ only in capitals or spacing are merged into the most-used spelling. Everything else is additive.

**`20261014120000_role_corrections.sql`** — the way back from a mistake, by role (see [workflows.md](workflows.md#production)): `private.workshop_corrections`, reached through `public.workshop_command`, adds `batch_step_back`, `cancel_batch`, `edit_batch`, `delete_batch`, `reopen_batch`, `cancel_supplier_order`, `delete_supplier_order` and `delete_recipe`, each with the same locking, request replay and activity log as the other workshop actions; `private.reserved_units`, the database's copy of what waiting orders still hold; the `production_undone` stock-movement kind; `suppliers.status` with `remove_supplier` / `restore_supplier` (archive-or-delete, the products' rule) and a trigger refusing any other change to it; and a refusal of new supplier orders to an archived supplier. Additive apart from the deletions an administrator makes through it.

**`20261030120000_payments_settings_photos.sql`** — the features the admin dashboard design drew but had nowhere to keep. `order_payments` (one row per amount received against one order) with `record_payment` (sales, delivery staff and managers; several orders are settled oldest first; never more than is owed after refunds; replays a retried request) and `remove_payment` (managers), plus the `order_paid` view the lists read; `business_settings`, one row read by every active member of staff and changed only by an administrator (the letterhead on printed slips, VAT, the usual delivery fee and free-delivery amount, delivery areas, working hours), with a revision like `loyalty_rules`; `staff_photos` with `save_own_photo` (each person their own); and `sign_out_staff`, which ends every session of another account's login by deleting its rows from `auth.sessions`, for administrators only. **Check `sign_out_staff` once on the live project**: it relies on the `postgres` role being allowed to delete from `auth.sessions`. If the project refuses, the button says so and suggests blocking the account or signing them out from Authentication → Users instead. Additive: four tables, a view and their functions.

**`20261031120000_payment_terms.sql`** — how the business is actually paid. `customers.payment_term_days` (30 or 60, default 30) is a customer's usual term, and `orders.payment_term_days` is the order's: 30 or 60 days from delivery for a delivered order (no down payment), or null for one picked up and paid at the shop, in full or in part. After an order is written only a manager can change its term (`guard_order_term`). Orders that already had a delivery are given 30 days. Supplier orders get `payment_method` (`cod` or `card`) and `paid_at`, which a trigger stamps — on placing for card, on arrival for COD — and `set_supplier_payment` lets a manager correct the method until the delivery arrives. Additive apart from that back-fill of terms and of `paid_at` on orders already received. Apply after the payments migration.

**`20261101120000_notifications.sql`** — in-app notifications. `notifications` holds each person's alerts (they may only read theirs and mark them read); `notification_settings` holds each person's choice of events, saved through `save_notification_settings`, with no row meaning every event their role allows (`private.notification_events_for`). Triggers raise alerts as things happen — a new or cancelled order, a product or raw material crossing its warning level, a batch reaching quality check, a delivery arriving, an account being blocked — and leave out the person who caused it. `refresh_alerts()`, which the app calls at sign-in and every five minutes, raises late deliveries and overdue payments (30/60 days after delivery, still owed); each alert has a key so it is raised once. Email and text are not sent. Additive. Apply after the payment terms migration.

Order matters. Each file redefines the functions it touches with `create or replace`, so running an older one after a newer one puts the older definitions back. If that happens, re-run the later files; nothing is lost.

Deployment order:

1. Run `supabase/integrity_check.sql` and read the report. Any duplicate stock codes leave the unique index uncreated (the migration says so and continues); stock rows without a catalogue entry are harmless to the migration but invisible in the app — correction A in the file fixes them.
2. Apply the migrations, oldest first (SQL editor, or `supabase db push` / MCP `apply_migration`).
3. Deploy the client (`npm run build`; Vercel serves `dist/` with the SPA rewrite in `vercel.json`).
4. Ask everyone to reload open tabs: an old tab would try to write stock counts directly, which the database now refuses.

All three migrations are safe to re-run. Rolling back the client alone is not safe after step 2 (old clients write stock directly); roll forward instead.

## Edge Functions

```bash
supabase functions deploy sign-in
supabase functions deploy admin-accounts
supabase functions deploy delete-staff-auth-user
```

Keep JWT verification on for `admin-accounts` and `delete-staff-auth-user`; both also re-check that the caller is an active administrator. They read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the function environment — never put the service key in `.env`. Type-check with `npx --yes deno check --node-modules-dir=none --no-lock supabase/functions/<name>/index.ts`.

## How writes are made safe

- **One transaction per action.** Stock and money move only through `order_command`, `workshop_command` and `stock_command`. Each locks the rows it touches (in id order, to avoid deadlocks), applies changes as deltas, and commits all or nothing.
- **Retries cannot double-apply.** Each call carries a request id; the same id replays its stored answer, and the same id with a different payload is refused.
- **Stale screens cannot overwrite.** Orders, deliveries, products, stock rows, customers, suppliers, staff and the loyalty rules carry a `revision`; a save made from an older copy is refused.
- **The database writes the history.** Activity entries and stock movements are written by triggers and command functions with the caller taken from their token; the browser cannot insert, edit or delete either.
- **Request logs are private.** `private.order_requests`, `private.workshop_requests`, `private.stock_requests` and `private.audited_sessions` have row level security with no policies and no grants, on purpose. The Supabase advisor reports "RLS enabled, no policy" for them; that is the intended deny-all.

## Referential integrity

Foreign keys: orders → customers (set null on delete, the name stays); deliveries → orders (restrict), deliveries → their parent delivery; supplier orders → suppliers, materials, staff; lots → materials and supplier orders; batches → products, stock rows, materials, staff, orders; stock movements → stock rows, materials, orders, supplier orders, batches, staff (set null, with name snapshots). Order lines live in `orders.items` (JSON) and point at stock rows by id without a foreign key; a line pointing at a removed stock row keeps its own name and price, and `integrity_check.sql` counts them.

## Indexes for growing tables

Screens read open work plus a recent window rather than whole tables, so the indexes that matter are: `orders (created_at)` for open orders and by date, `orders (customer_id)`, `deliveries (created_at)` for undelivered ones and by date, `deliveries (order_id)`, `activity_log (at desc)`, and `stock_movements` by product, material, order, kind and date.

## Deferred: a local database

Running the app against a local or offline database, with synchronisation back to Supabase, was discussed and **postponed**. Nothing in this release builds towards it: the app talks only to the hosted Supabase project. PGlite in `devDependencies` is used only by the test suite to run `schema.sql` in-process; it is not an application database. A future local mode would need its own design for conflict resolution, because every stock and money rule above assumes one authoritative database.
