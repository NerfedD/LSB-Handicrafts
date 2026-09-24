# LSB Handicrafts — Management System

The internal system LSB Handicrafts runs on: products and stock, raw materials and suppliers, production, orders and deliveries, returns, customers and loyalty, staff accounts and an activity log. LSB is a styrofoam decor maker in Davao City — event centrepieces, wall art, stage backdrops, custom sculptures.

React 19 + Vite + Tailwind in the browser, Supabase (Postgres, Auth, Edge Functions) behind it, deployed on Vercel.

## What it does

| Area | What staff can do |
| --- | --- |
| Products & stock | Catalogue with sizes, prices and a reorder point per product; stock on the shelf, set aside for orders and free to sell; running-low and run-out filters; record damage and put a damage record back if it was entered wrong; correct a count; full stock history per product; archive a product without losing its history. |
| Raw materials & suppliers | Add, correct and remove materials with their measurements and reorder points; order from a supplier; receive a delivery once, with damaged units and the supplier's reference; claims; stock history per material; what each supplier has supplied. |
| Production | A make list led by goods owed to customers; batches with material set aside, quality check, defects and yield. |
| Orders & deliveries | Write, change, finish, call off or re-open orders; deliveries with a five-stage board, short deliveries and follow-ups; print slip. |
| Returns | Refund or replace goods that came back, saying whether they can be sold again. |
| Customers | Contact details, whole-history totals, regulars, a call list of lapsed customers, and a configurable loyalty reward applied on new orders. |
| Staff | Accounts, roles, blocking, a directory, and an activity log written by the database. |

How each rule works, who may do what, and how records are removed safely: **[docs/workflows.md](docs/workflows.md)**.

## Getting started

Prerequisites: Node.js 22+, npm, and a Supabase project.

```bash
npm install
cp .env.example .env     # fill in the values below
npm run dev              # http://localhost:5173
```

| Variable | Needed | Meaning |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | yes | The project URL. |
| `VITE_SUPABASE_ANON_KEY` | yes | The anon or publishable key (it ships in the bundle; the database is the security boundary). |
| `VITE_OFFICE_PHONE` | before staff use it | The office number shown to a locked-out person. Without it the sign-in screen shows the mockup's placeholder. |
| `VITE_IDLE_TIMEOUT_MINUTES` | no | Sign out after this long idle; 30 if unset. |

The service-role key is never a `VITE_` variable: only the Edge Functions use it, from their own environment.

Set up the database from **[docs/database.md](docs/database.md)**: a fresh project runs `supabase/schema.sql`; an existing one applies the new files in `supabase/migrations/` in order. Also raise Auth → Providers → Email → minimum password length to 8, which is what the change-password screen requires.

## Deploying a change

1. Apply any new migrations first, oldest first (see [docs/database.md](docs/database.md#an-existing-project) — this release adds `20260924120000_stock_returns_loyalty.sql` and `20260924190000_material_crud_and_damage_undo.sql`).
2. Deploy any changed Edge Function.
3. `npm run build` and deploy `dist/` (Vercel; `vercel.json` rewrites every path to the app).
4. Ask staff to reload open tabs.

## Checks

```bash
npm run lint
npm test              # unit tests, and the real schema.sql run in PGlite
npm run build
npx playwright test   # browser tests on the installed Microsoft Edge
```

What each suite covers, what needs a real project, and how to run a session with a group of testers: **[docs/TESTING.md](docs/TESTING.md)**.

## Project layout

```
src/
  App.jsx          routing, the session, and every write
  components/      one folder per area; shared/ and ui/ are the design system
  hooks/           data loading (useSupabaseCollection), idle sign-out, URL state
  lib/             the Supabase client
  utils/           business rules with no React: stockLedger, orders, customers,
                   permissions, screenData, storageManager (reads/writes),
                   commands (database commands), copy (words on screen)
supabase/          schema.sql, migrations/, integrity_check.sql, seeds, functions/
tests/             Playwright specs and the stubbed Supabase they run against
docs/              workflows, database, testing
```

`PRODUCT.md` and `DESIGN.md` describe the users and the design system for the design tooling in `.impeccable/`; the original design handoff is in `Professional UI mockups project/`.

## Design rules

Two goals from the design handoff: **look professional** — like software a business runs on — and **be usable by every age on the floor**, including staff who are not confident with computers. Every screen follows six rules:

1. **Nothing under 16px** for readable text; table rows 62px, controls 44px or more. Only uppercase tracked signposts (a column header, a sidebar group label) are exempt.
2. **Plain words, not jargon.** "Can sign in: Yes", not "Status: Active". The mapping from stored value to words lives in `src/utils/copy.js`.
3. **Every icon has a word beside it.** The one exception is a dialog's close control.
4. **High contrast**, and focus rings that are visible. The ring is global in `src/index.css`.
5. **One question at a time.** Single-column forms in numbered bands, help text under the fields.
6. **Danger is spelled out.** A destructive confirm names the record, states the consequences and what survives, and its button says the verb.

## Performance on older computers

The app is built for the shop's older PCs and phones:

- Screens load only the tables they use; open orders and deliveries are always loaded, finished ones for the last 120 days, and older ones when somebody opens them or asks for them. The activity log loads 200 entries at a time. Customer totals are summed by the database.
- One background refresh a minute, only while the window is visible and only for the screen on show; returning to the window refreshes only data more than 30 seconds old; a refresh that changes nothing re-renders nothing.
- Every screen past sign-in is a separate chunk loaded on first use. The Supabase client is assembled from only the parts the app uses (no Realtime or Storage).
- Motion is opacity and transform only, with no blur or filter effects, and it respects reduced-motion settings.

## Known gaps

- **Real photography.** The sign-in brand panel and product photo slots are placeholders; the logo is 128px.
- **The "Write a new order" screen** follows the handoff's form vocabulary but has had no design pass of its own.
- **Order lines are JSON inside `orders.items`**, so a line's product link is checked by the database commands and `integrity_check.sql` rather than a foreign key.
- **Creating an order and its delivery** are two writes: if the delivery fails, the form keeps its entries and a retry finishes the same order rather than writing a second one.
- **Not yet audited:** a deployed-site security-header review and an automated accessibility scan.

### Deferred

- **A local or offline database** (working without the internet, syncing later) was discussed and postponed. Nothing in this release builds towards it; the app uses only the hosted Supabase project. See [docs/database.md](docs/database.md#deferred-a-local-database).
