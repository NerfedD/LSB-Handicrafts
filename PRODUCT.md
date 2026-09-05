# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

LSB Handicrafts' own staff, across five roles: **Admin**, **Manager**, **Sales Staff**, **Production Staff**, and **Delivery Staff** (`supabase/schema.sql` staff_role_check). The shared trait across all of them, stated as an explicit design constraint: many are not confident computer users. The interface is read by the shop owner, office staff, and production/delivery crew on the floor, not by a technical operator.

- **Admin / Manager** — run the business side: products & stock, orders, deliveries, customers, suppliers, staff accounts, the activity log. Managers additionally handle refunds and price corrections (`canHandleMoney`); only Admins reach staff/user management (`ADMIN_ONLY_VIEWS` in `src/utils/navigation.js`).
- **Sales Staff** — work orders and customer follow-ups; have their own dashboard variant ("sales follow-ups").
- **Production Staff** — work from a "production make list" dashboard: what to build next.
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
- **Auth/session:** Supabase Auth with a role carried via a custom access-token hook; idle sign-out after a configurable timeout (default 30 min); a temporary email allowlist exists for admin access during setup.

## Capabilities and Constraints

- **Tech stack (existing, not open):** React 19 + Vite + Tailwind, Supabase (Postgres + Auth), deployed on Vercel.
- **Products and stock are one screen, two database tables.** `products` (catalogue) and `inventory` (stock ledger) join on item code (`src/utils/productStock.js`); the UI presents them as one form/story, the split is a database fact users are never asked to care about.
- **"Reserved" stock is derived, not stored-and-trusted.** Recomputed from pending orders on every read; `inventory.reserved` is a cache for SQL reporting only, not the source of truth.
- **Client-side permission checks are cosmetic, not the real boundary.** The anon key ships in the JS bundle. `src/utils/permissions.js` / `navigation.js` gate which screens are reachable and keep the UI honest, but the actual enforcement is Postgres RLS policies and guard triggers in `supabase/schema.sql` (e.g. refunds/price corrections are blocked server-side regardless of what the client believes).
- **Known open gap:** orders reference customers by name, not by id, because that's what the `orders` table stores today — two same-named customers are indistinguishable, and renaming a customer loses history. Fixing it needs a foreign key and data migration (not yet scheduled).
- **Known open gap:** the "Write a new order" screen was built from the design handoff's form vocabulary rather than a dedicated design of its own — the handoff shows the entry button, not the full screen. It works but hasn't had a design pass.

## Brand Commitments

- Name: **LSB Handicrafts**.
- A design handoff already exists and has been substantially built against: `Professional UI mockups project/design_handoff_lsb_ui_overhaul/` — a complete visual overhaul (design system + ~25 screens as `.dc.html` references and screenshots), created specifically against this codebase's real routes, roles, and data shapes. Treat it as the incumbent visual authority, not a competing proposal, until a redesign is explicitly requested.
- Two goals stated as binding on every design decision (from that handoff, restated in `README.md`): look professional — like software a business runs on; be usable by every age on the floor, including staff not confident with computers.
- Six house design rules currently enforced as acceptance criteria (`README.md`): nothing under 16px for readable text (table rows 62px, controls ≥44px, except uppercase tracked signposts read once); plain words over jargon (mapping lives in `src/utils/copy.js`, database literals untouched); every icon paired with a word (except a dialog's 44px close control); high-contrast, visible (not merely hinted) global focus rings (`src/index.css`); one question at a time — single-column forms in numbered bands, help text under fields, never a dense grid; destructive actions spelled out — name the record, state consequences and what survives, verb-labeled button, in their own outlined block, never a red icon in a table row.
- Logo asset exists at `Professional UI mockups project/design_handoff_lsb_ui_overhaul/assets/Logo-128.png` but is low-resolution (128px, tight for retina at 52px) — a known gap, not a decision to redo the mark.

## Evidence on Hand

- Real screens already exist as committed design references: `LSB Current UI.dc.html` (incumbent) and `LSB Handicrafts UI.dc.html` (overhaul target) plus ~20 annotated screenshots covering sign-in (including error/forgot-password states), all four dashboards, products/stock, orders, deliveries, customers/suppliers, staff, profile, dialogs/toasts, empty/loading/error states, dark mode, and phone/tablet layouts.
- **No real photography exists.** The sign-in brand panel (4:3, ~1600×1200) and product photo slots (1:1, 800×800) are honest dashed placeholders in the current build — do not fabricate product photos or a brand image; state the placeholder as a known gap when relevant.
- **No real customer/order/testimonial data** — only seed/demo data (`supabase/seed_*.sql`). Do not invent customer names, testimonials, or business metrics as if real.
- `BUGS_AND_FIX_PLAN.txt` at the repo root tracks known defects/fixes in progress — check it before assuming a rough edge is undiscovered.

## Product Principles

1. **Plain words over system internals.** Users see "Can sign in: Yes" and "Running low," never database status literals or table-name-shaped labels ("User Management" → "Staff & accounts"). If a label names the column it opens, rewrite it.
2. **One tree, not parallel copies.** Navigation, permissions, and screen access derive from a single source (`NAV_TREE`) rather than hand-maintained duplicates — the overhaul exists partly because drifted duplicates once let a non-admin reach admin screens. Any new gated feature should extend the tree, not add a side list.
3. **The database split is not the user's problem.** Where two tables represent one real-world thing to the user (products/inventory), or a value must be derived rather than trusted from a cache (reserved stock), the UI presents the single coherent concept and the derivation stays invisible.
4. **Client-side gating is a courtesy, not the lock.** Every sensitive action assumes the real boundary is server-side (RLS/triggers); UI permission checks exist to keep honest users from wandering into the wrong screen, not to stop a determined one.
5. **Danger is legible before it's committed.** No destructive or money-moving action ships without naming exactly what's affected, what's lost, and what survives, in its own visually distinct area — never a quick icon click in a list row.

## Accessibility & Inclusion

No diagnosed vision, motor, or reading impairment among staff is on record. The binding constraint is broad computer-confidence variance across ages and roles, already operationalized as the six house rules above (minimum text/target sizes, plain-language copy, icon+word pairing, visible global focus rings, single-column forms, spelled-out destructive confirmations). Treat those six rules as the accessibility requirement for this product, not a separate WCAG target layered on top — future work should default to strengthening them, not relaxing them for visual reasons.
