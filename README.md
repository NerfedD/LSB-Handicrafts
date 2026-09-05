# LSB Handicrafts — Management System

The internal system LSB Handicrafts runs on: products and stock, orders, deliveries, customers, suppliers, staff accounts and an activity log. LSB is a styrofoam decor maker in Davao City — event centrepieces, wall art, stage backdrops, custom sculptures.

The interface follows the design handoff in `design_handoff_lsb_ui_overhaul/`, which set two goals for every decision:

1. **Look professional** — like software a business runs on.
2. **Be usable by every age on the floor** — the owner, office staff, and production and delivery staff who may not be confident with computers.

## The six rules

These are acceptance criteria, not preferences. Every screen obeys all six.

1. **Nothing under 16px** for readable text. Table rows are 62px, controls 44px or more. The only exceptions are uppercase tracked signposts — a column header, a sidebar group label — which are read once rather than as a sentence.
2. **Plain words, not jargon.** "Can sign in: Yes", not "Status: Active". "Running low", not "LOW". The mapping from stored value to display copy lives in `src/utils/copy.js`; the database literals are untouched.
3. **Every icon has a word beside it.** No icon-only buttons — a bare pencil or bin is a guess. The one exception is a dialog's close control, which gets a 44px target in a conventional position.
4. **High contrast**, and focus rings that are visible rather than hinted. The ring is global in `src/index.css`; nothing removes it.
5. **One question at a time.** Forms run down a single column in numbered bands with help text under the fields, never a dense grid.
6. **Danger is spelled out.** A destructive confirm names the record, states the consequences *and what survives*, and its button says the verb. Destructive actions live in their own outlined block — never a red icon in a table row.

## Screens

| Area | Screens |
|---|---|
| Signing in | Sign in with three named failure states, forgot password (3 steps), choose a new password |
| Dashboards | Standard, large-text, sales follow-ups, production make list |
| Products & stock | List with counted filters and stock bars, one product with its stock story and movements, add/edit a product |
| Orders | List, one order with a stage tracker, write a new order |
| Deliveries | Five-column board with a combined-filter summary, one delivery |
| Customers & suppliers | Customer cards with call-list filters, one customer, supplier list, one supplier |
| Staff | Accounts with "Can sign in", manage one account, what does this person do, who to call for what, what happened recently |
| My account | Profile with the dashboard-view preference, edit details, change password |

## Two things worth knowing

**Products and stock are one screen, two tables.** `products` is the catalogue and `inventory` is the stock ledger, joined on item code in `src/utils/productStock.js`. The split is a database fact; nobody using the system is asked to care about it, so one form writes both.

**"Reserved" is derived, never read from the column.** How much stock is spoken for is recomputed from pending orders on every read. The `inventory.reserved` column is a cache for SQL reporting; the orders are the source of truth.

## Tech

React 19 + Vite + Tailwind, Supabase (Postgres + Auth), deployed on Vercel.

## Project structure

```
src/
  components/
    account/       my profile, edit details, change password
    customers/     list, detail, form dialog
    dashboards/    the four dashboards
    deliveries/    board, detail, assign-driver dialog
    layout/        Shell (sidebar + header + tab bar), AuthLayout
    orders/        list, detail, order form
    products/      list, detail, form, record-what-we-made dialog
    shared/        the design system: tones, chips, pills, filters, forms,
                   page states, stage tracker, dashboard furniture
    staff/         accounts, manage, change role, directory, activity log
    ui/            shadcn-derived primitives — button, card, dialog, input,
                   label, select, dropdown-menu, table, sonner
  hooks/           useSupabaseCollection, useIdleTimeout, usePaged, useTheme
  lib/             Supabase clients
  utils/           copy, constants, navigation, permissions, and the domain
                   modules: productStock, orders, deliveries, customers,
                   dashboard, activityLog
supabase/          schema.sql (safe to re-run) and seed scripts
```

## Getting started

**Prerequisites:** Node.js, npm, and a Supabase project.

```bash
npm install
cp .env.example .env     # then fill in your Supabase URL and anon key
npm run dev
```

**Database:** run `supabase/schema.sql` in the Supabase SQL editor, then the seed scripts you want (`seed_profiles.sql`, `seed_staff.sql`, `seed_inventory.sql`). The schema file is guarded throughout and safe to re-run on an existing database — that is how migrations are applied here.

Two settings are worth doing at the same time:

- **Set `VITE_OFFICE_PHONE`.** Without it the sign-in screen falls back to the design mockup's placeholder, `(082) 000 0000`, which is not a real number. It is what a locked-out member of staff is told to ring.
- **Raise the Auth password minimum to 8** (Authentication → Providers → Email). The change-password screen requires 8 characters, a number and a capital; Supabase's own default is 6, and leaving them out of step means the server accepts a password the UI has just called incomplete.

Optionally enable the access-token hook (Authentication → Hooks → Customize Access Token → `public.custom_access_token_hook`) so the signed-in person's role travels with their session and the app can route on the first frame instead of waiting on a table read. Nothing breaks without it.

## What still needs a person

- **Real photography.** The sign-in brand panel (4:3, ~1600×1200) and the product photo slots (1:1, 800×800) are honest dashed placeholders.
- **A higher-resolution logo.** 128px is tight for retina at 52px.
- **The "Write a new order" screen** was built from the handoff's form vocabulary rather than a design of its own — the handoff shows the button, not the screen behind it. It works; it deserves a design pass.
- **Orders reference customers by name**, not by id, because that is what the `orders` table stores. Two customers with the same name are indistinguishable, and renaming a customer loses their history. Fixing it is a foreign key and a data migration.
