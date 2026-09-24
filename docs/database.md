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

Apply the migrations it has not had, oldest first. The hosted project `tvdtzsputfnapswpurlr` had everything up to `20260921213000_staff_revision_guard.sql` when this release was prepared; the one to apply is:

**`20260924120000_stock_returns_loyalty.sql`** — adds the stock-movement ledger, damage and count corrections (`stock_command`), replacements and server-checked refunds in `order_command`, supplier delivery references, `deliveries.order_id` (back-filled from the "Order #N - " text), the one-row-per-code index on stock, product archiving (`remove_product`), loyalty rules with validated order discounts, per-customer totals (`customer_order_stats`), and the role policies in [workflows.md](workflows.md#roles). It deletes and overwrites nothing except the documented back-fill.

Deployment order:

1. Run `supabase/integrity_check.sql` and read the report. Any duplicate stock codes leave the unique index uncreated (the migration says so and continues); stock rows without a catalogue entry are harmless to the migration but invisible in the app — correction A in the file fixes them.
2. Apply the migration (SQL editor, or `supabase db push` / MCP `apply_migration`).
3. Deploy the client (`npm run build`; Vercel serves `dist/` with the SPA rewrite in `vercel.json`).
4. Ask everyone to reload open tabs: an old tab would try to write stock counts directly, which the database now refuses.

The migration is safe to re-run. Rolling back the client alone is not safe after step 2 (old clients write stock directly); roll forward instead.

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
