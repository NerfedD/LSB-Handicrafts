# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

LSB Handicrafts' own staff, across five roles: **Admin**, **Manager**, **Sales Staff**, **Production Staff**, and **Delivery Staff** (`supabase/schema.sql` staff_role_check). The shared trait across all of them, stated as an explicit design constraint: many are not confident computer users. The interface is read by the shop owner, office staff, and production/delivery crew on the floor, not by a technical operator.

- **Admin / Manager** — run the business side: products, prices and stock counts, suppliers and purchasing, refunds, replacements and price corrections, loyalty rules, reports. Only Admins remove records and reach staff management and the activity log. The full table is in `docs/workflows.md`; the code is `can()` in `src/utils/permissions.js`, enforced again in `supabase/schema.sql`.
- **Sales Staff** — work orders and customer follow-ups; have their own dashboard variant ("sales follow-ups").
- **Production Staff** — work from a "production make list" dashboard: what to build next. They record damaged stock and run production batches, and do not see customer contact details.
- **Delivery Staff** — work the deliveries board and individual delivery records.

## Product Purpose

An internal management system for LSB Handicrafts, a styrofoam decor maker in Davao City (event centrepieces, wall art, stage backdrops, custom sculptures). It covers products & stock, orders, deliveries, customers, suppliers, staff accounts, and an activity log — replacing paper-based manual records (order books, paper stock counts, phone-call coordination) with one shared, role-aware system.

Success is staff of any age and computer confidence being able to run the business's real daily operations through it without a training session — the two goals the design handoff sets are literally the acceptance bar (see Product Principles).

## Positioning

Not a generic off-the-shelf inventory/CRM tool repurposed for a small manufacturer — it is built directly against LSB's actual workflow, roles, and data shapes (five specific staff roles with different dashboards; products and inventory as two tables joined on item code; reserved stock derived from live orders, not cached). A neighboring generic tool could not truthfully claim the same fit without being rebuilt around this business's particular process.

## Operating Context

- **Where:** a small manufacturing/decor business's shop floor and office in Davao City — not a call center or a large enterprise office.
- **Devices:** desktop/office use plus phone and tablet on the floor and for deliveries (`2w-phone-and-tablet.png` in the design handoff; responsive behavior is an explicit screen).
- **Status:** pre-launch. The app currently runs on seed data and demo accounts (`supabase/seed_demo_accounts.sql`, `seed_profiles.sql`, `seed_staff.sql`, `seed_inventory.sql`); no real customer, order, or stock data depends on it yet, so this is the point to get the interface right before staff start relying on it daily.
- **Prior system:** paper — order books, paper stock counts, phone calls for delivery coordination. This is the business's first digital system, not a migration from another app or spreadsheets.
- **Auth/session:** Supabase Auth; people sign in with a username through the `sign-in` Edge Function, and the app re-reads their staff row (role, blocked or not) on sign-in and on every refresh. Idle sign-out after a configurable timeout (default 30 min).

## Capabilities and Constraints

- **Tech stack (existing, not open):** React 19 + Vite + Tailwind, Supabase (Postgres + Auth), deployed on Vercel.
- **Products and stock are one screen, two database tables.** `products` (catalogue) and `inventory` (stock ledger) join on item code (`src/utils/productStock.js`); the UI presents them as one form/story, the split is a database fact users are never asked to care about.
- **"Reserved" stock is derived, not stored-and-trusted.** Recomputed from pending orders on every read; `inventory.reserved` is a cache for SQL reporting only, not the source of truth.
- **Client-side permission checks are cosmetic, not the real boundary.** The anon key ships in the JS bundle. `src/utils/permissions.js` / `navigation.js` gate which screens are reachable and keep the UI honest, but the actual enforcement is Postgres RLS policies and guard triggers in `supabase/schema.sql` (e.g. refunds/price corrections are blocked server-side regardless of what the client believes).
- **Orders are linked to a customer record by id** (`orders.customer_id`) whenever the name they were written under matches exactly one customer, so a rename keeps the history and two same-named customers keep theirs apart. An order taken for somebody not on file — the order form's customer field is free text by design — carries no id and is matched by name, exactly as before. A name matching *two* customers is deliberately left unlinked rather than guessed at.

## Brand Commitments

- Name: **LSB Handicrafts**.
- The design is the set of admin dashboard boards in `design/admin-dashboard/` (about 50 `.dc.html` screens, dialogs and reference sheets), and the app is built to them. Treat them as the visual authority; `DESIGN.md` summarises the tokens and rules. The earlier handoff in `Professional UI mockups project/` is kept for reference only.
- Two goals stated as binding on every design decision: look professional — like software a business runs on; be usable by every age on the floor, including staff not confident with computers.
- Six house design rules (`README.md`, "Design rules"): one type scale (14px body, 13px tables, 12px captions; controls 32px, rows 36px); plain words over jargon (mapping lives in `src/utils/copy.js`, database literals untouched); state never told by colour alone, with brand blue reserved for the primary action, active nav, links and focus; visible global focus rings in both themes (`src/index.css`); one question at a time — single-column forms, help text under fields; destructive actions spelled out — name the record, state consequences and what survives, verb-labeled button.
- Logo asset exists at `src/assets/Logo-128.png` but is low-resolution (128px, tight for retina at 52px) — a known gap, not a decision to redo the mark.

## Evidence on Hand

- Every screen, dialog and state has a committed design board in `design/admin-dashboard/` (sign-in and forgot-password, dashboard, inventory, orders, deliveries, production, purchasing, customers, suppliers, staff, settings, profile, dialogs, toasts, sidebar states, command menu, motion and tokens), in light and dark.
- **Photography is partial.** The sign-in panel shows three workshop photographs (`src/assets/workshop-*.webp`); product photo slots (1:1, 800×800) are honest dashed placeholders until each product has a picture — do not fabricate product photos; state the placeholder as a known gap when relevant.
- **No real customer/order/testimonial data** — only seed/demo data (`supabase/seed_*.sql`). Do not invent customer names, testimonials, or business metrics as if real.
- Known gaps and deferred work are listed at the end of `README.md` — check there before assuming a rough edge is undiscovered.

## Product Principles

1. **Plain words over system internals.** Users see "Can sign in: Yes" and "Running low," never database status literals or table-name-shaped labels ("User Management" → "Staff & accounts"). If a label names the column it opens, rewrite it.
2. **One tree, not parallel copies.** Navigation, permissions, and screen access derive from a single source (`NAV_TREE`) rather than hand-maintained duplicates — the overhaul exists partly because drifted duplicates once let a non-admin reach admin screens. Any new gated feature should extend the tree, not add a side list.
3. **The database split is not the user's problem.** Where two tables represent one real-world thing to the user (products/inventory), or a value must be derived rather than trusted from a cache (reserved stock), the UI presents the single coherent concept and the derivation stays invisible.
4. **Client-side gating is a courtesy, not the lock.** Every sensitive action assumes the real boundary is server-side (RLS/triggers); UI permission checks exist to keep honest users from wandering into the wrong screen, not to stop a determined one.
5. **Danger is legible before it's committed.** No destructive or money-moving action ships without naming exactly what's affected, what's lost, and what survives, in its own visually distinct area — never a quick icon click in a list row.

## Accessibility & Inclusion

No diagnosed vision, motor, or reading impairment among staff is on record. The binding constraint is broad computer-confidence variance across ages and roles, already operationalized as the six house rules above (minimum text/target sizes, plain-language copy, icon+word pairing, visible global focus rings, single-column forms, spelled-out destructive confirmations). Treat those six rules as the accessibility requirement for this product, not a separate WCAG target layered on top — future work should default to strengthening them, not relaxing them for visual reasons.
