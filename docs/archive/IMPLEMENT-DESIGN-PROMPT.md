# Prompt: implement the new admin dashboard design

Paste everything below the line into a fresh coding session opened at the repo root.

---

## Your job

Rebuild the LSB Handicrafts app's interface so it **matches the new admin dashboard design exactly**. The design is finished and approved. Your job is to translate it into this React codebase, not to reinterpret it, restyle the current screens toward it, or "improve" it.

The failure this prompt exists to prevent is this: you open an existing screen, keep its layout, and swap colours and fonts until it looks "close". That is a redesign of the old screen, and it will be rejected. For every screen, **the design board decides the structure**: which sections exist, their order, what each one contains, the copy, the sizes and the states. The old JSX only supplies data, handlers and business rules.

## Sources of truth: read this first

| Question | Source | Location |
|---|---|---|
| What it looks like: layout, sections, components, copy, spacing, colours, type, icons, states, dark mode, motion | **The new design** | `design/admin-dashboard/*.dc.html`, `design/admin-dashboard/theme.css`, and the live canvas at https://claude.ai/artifact/QyaT4j52KzVt988Rxhpktv |
| What it does: data, Supabase calls, permissions, validation, routes, business rules | **The codebase** | `src/utils/*`, `src/hooks/*`, `src/lib/*`, `supabase/*`, and the handlers in `src/App.jsx` |

**Superseded. Do not use these for any visual decision.** They describe the previous overhaul (cobalt `#1462c8`, clay, paper `#f4f2ec`, Manrope, 10px radius, large type):

- `DESIGN.md`
- `Professional UI mockups project/` (the whole folder, including its README and `.dc.html` files)
- `.impeccable/design.json` and `.impeccable/critique/*`
- The colour, font and radius tokens currently in `tailwind.config.js` and `src/index.css`
- Comments in the code that justify the old look (for example "clay is the workshop's accent" or "cobalt, the one focus colour")

If one of these conflicts with the new design, the new design wins. Do not blend the two systems. When you finish, the old palette must be gone, not kept alongside the new one.

`PRODUCT.md` still describes the business, users and roles correctly. Use it for context about who does what, not for how screens look.

## How to read the design files

Each `design/admin-dashboard/X.dc.html` is one artboard. `canvas.json` lists every board with its title, and the board titles are numbered in screen order.

- **Inline `style="…"` values are the specification.** Turn them into Tailwind classes or tokens, but keep the values: heights (32px buttons, 36px table rows, 48px top bar), paddings, gaps, radii (6px controls, 8px cards), font sizes (14px body, 13px table and meta, 12px captions, 20px page title, 24px stat figures) and weights.
- **`var(--token, #hex)` names the semantic token.** The hex is the light value. Every token is defined for light and dark in `theme.css`. Use the token name, never the raw hex.
- **`<dc-import name="AppSidebar" …>` means a shared component.** Build it once in React (AppSidebar, TopBar, the dialogs, CommandMenu) and reuse it.
- **`<sc-for list="{{rows}}" as="r">` is a `.map()`.** **`<sc-if value="{{x}}">` is a conditional.** **`{{a.b}}` is a value computed in that board's `renderVals()`.**
- **The `renderVals()` sample data is placeholder data.** People like "Maria Santos" and orders like "#2048" are fake. Replace them with the app's real data from its existing hooks and utils. Use the sample only to understand the shape of each state: for example, which badge tone goes with which status, or what an empty or overdue row looks like.
- **Inline SVG icons are Phosphor icons drawn by hand.** Use the real `@phosphor-icons/react` component with the same name (House, Package, Truck, Hammer, Users, AddressBook, Storefront, Gear and so on).
- **Images:** the logo is `src/assets/Logo-128.png`. The three Login photos are `src/assets/workshop-bench.jpg`, `workshop-stock.jpg` and `workshop-store.webp`.

If something in the source is unclear, open the live canvas link and look at the rendered board before guessing.

## Foundation: the design brief the boards follow

- **Stack:** React 19, Vite, Tailwind, shadcn/ui on **Base UI** (the `render` prop, not `asChild`), "New York" style. Use 1px borders, `rounded-md`, `shadow-xs`. The repo currently uses Radix primitives and `lucide-react`. **Migrate `src/components/ui/*` to the shadcn Base UI versions, and swap every icon to Phosphor.** Do the icon swap through `src/components/icons.js` so call sites change once.
- **Icons:** Phosphor only. Use regular weight, and fill weight for the active nav item. Size 16px in menus and buttons, 20px in page headers.
- **Type:** Inter. Base 14px; tables and meta text 13px; use tabular numbers for figures.
- **Colour:** about 80% neutral zinc. Brand `#004E89` (`--primary`) is used **only** for the primary button, the active nav item (a solid fill with white text, and the sidebar itself stays neutral), the focus ring, links, and selected checkboxes, radios and switches. Status colours appear only in small muted badges (success, warning, danger tokens). The page background is `--background` `#F1FAEE`. Cards are white with `--border` `#d4d4d8`.
- **Layout:** SidebarProvider → Sidebar (inset, collapsible to icons, 15rem) → SidebarInset with an h-12 top bar (sidebar trigger, breadcrumb, ⌘K search, theme toggle).
- **Every view** is built from the same compact sections: PageHeader → StatCards (where shown) → FilterBar → DataTable or board → EmptyState. **There is one primary CTA per view.**
- **Dark mode:** port every token in `theme.css` into `src/index.css` under `:root` and `html.dark`. Wire the design's sun/moon toggle (TopBar) and the Theme radios (MyProfile) to the **existing** `src/hooks/useTheme.js`, which already handles light, dark and system per device. Keep its storage key. The design's own `theme.js` is canvas plumbing only, so don't port it.
- **Motion:** port the keyframes and rules in `theme.css` and the specs on the `Motion.dc.html` board. These cover dialog pop, menu drop, toast slide, the checkbox tick drawing in, the radio dot and switch thumb springing, the staggered rise of a page's sections, row hover tint, the theme crossfade, the sliding segmented-control highlight, and the dashboard stat count-up. Everything finishes in 320 ms or less, nothing loops, and `prefers-reduced-motion` cuts all of it.

## Screen map

Build each board into the component listed. Keep the existing view key, URL, data loading and handlers. **Rewrite the JSX from the board.**

| Board | Rebuild this | View key(s) |
|---|---|---|
| 1 · Login, 1b · Forgot password | `LoginPage.jsx`, `ForgotPasswordPage.jsx`, `layout/AuthLayout.jsx` (`ResetPasswordPage.jsx` in the same style) | login, forgot-password, reset-password |
| 2 · Dashboard | `dashboards/DashboardPage.jsx`, `shared/dashboard.jsx` | dashboard |
| 3 · User Management, 12 · Account details | `staff/StaffAccountsPage.jsx`, `staff/ManageAccountPage.jsx`, `staff/ChangeRolePage.jsx` | staff, manage-account, assign-role |
| 4 · Staff Directory | `staff/StaffDirectoryPage.jsx` | directory |
| 5 · Inventory, 19 · Product detail | `products/ProductListPage.jsx`, `products/ProductDetailPage.jsx` | products, product-detail |
| 6 · Deliveries, 18 · Delivery detail | `deliveries/DeliveryBoardPage.jsx` (table plus the Board option), `deliveries/DeliveryDetailPage.jsx` | deliveries, delivery-detail |
| 7 · Batches, 7b · Raw materials, 7c · Purchasing, 7d · Report | `production/WorkshopPage.jsx` and its editors | production, raw-materials, raw-material-orders, production-report |
| 14 · Customers, 15 · Suppliers | `customers/CustomerListPage.jsx`, `suppliers/SupplierListPage.jsx` | customers, suppliers |
| 16 · Orders, 17 · Order detail and edit | `orders/OrderListPage.jsx`, `orders/OrderDetailPage.jsx` (board 17 has the edit mode) | orders, order-detail, order-edit |
| 11 · Activity log | `staff/ActivityLogPage.jsx` | activity |
| 13 · Your profile | `account/MyProfilePage.jsx`, `account/ProfileSections.jsx` | profile |
| AppSidebar, TopBar, Sidebar · states, Search ⌘K | `layout/Shell.jsx` (sidebar, top bar, mobile sheet, command menu) | all views |
| Every `*Dialog` board, plus Toasts | The matching dialog (for example `AddCustomerDialog` → `customers/CustomerFormDialog.jsx`, `StockChangeDialog` → `products/StockChangeDialog.jsx`, `StartBatchDialog` → `products/StartBatchDialog.jsx`, `FinishBatchDialog` → `products/CompleteBatchDialog.jsx`, `MarkDeliveredDialog` → `deliveries/RecordDeliveredDialog.jsx`, `AssignDriversDialog` → `deliveries/AssignDriverDialog.jsx`, `ReceiveDeliveryDialog` → `suppliers/ReceiveSupplierDeliveryDialog.jsx`, `ConfirmDialog` → `shared/ConfirmDialog.jsx`, `AddUserDialog` → `staff/CreateAccountDialog.jsx`), and `ui/sonner.jsx` | — |
| Tokens, Component inventory, Motion | `src/index.css`, `tailwind.config.js`, `src/components/ui/*` | — |

**Navigation:** use the sidebar's structure, labels, icons and order from `AppSidebar.dc.html`:

- Dashboard, Orders, Inventory, Deliveries
- Production, with sub-items Batches, Raw materials, Purchasing and Report
- Users, Staff, Customers, Suppliers
- Settings

Keep `src/utils/navigation.js` as the single source of nav data, and keep its role hiding (`hideFrom`, `capability`, `can()`) exactly as it works today. Only the labels, icons and grouping change.

## Where the design and the app don't line up

**Features the app has but the design doesn't show.** Examples:

- the large-text dashboard
- the order priority board
- refund, replacement and price-adjustment dialogs
- loyalty rules and categories
- the order slip print view
- the customer, supplier and raw-material detail pages
- the full-page order form

**Keep every one of them working.** Rebuild their UI from the design's parts (PageHeader, cards, DataTable, the dialog pattern, badges, form fields as drawn on the dialog boards) so they look like they belong to the new system. Don't drop a feature, and don't invent a new visual pattern for one.

Creating an order is drawn as `NewOrderDialog.dc.html`. Use that layout. If the current form has fields the dialog doesn't, add them in the dialog's style and list them in your report.

**Screens the design has but the app has no backend for:** Settings · General, Settings · Notifications, and editing permissions in Settings · Roles. Activity has a backend; it moves under Settings in the nav.

- Build these screens to the design.
- Don't fake persistence: no localStorage pretending to be a database, and no Supabase migration.
- Show Roles as read-only from `src/utils/permissions.js`.
- Disable any control that has nothing to save to.
- List each one in your report so the user can decide.

**Copy:**

- Use the design's copy for page titles, descriptions, column headers, buttons, badges, empty states and dialog text.
- Keep the app's validation and error messages unless a board shows a replacement.
- Keep the sentence case and the one-word badges the boards use.

## Rules that keep this an implementation, not a redesign

1. **Board first, every time.** Before touching a screen, open its board and write down its sections from top to bottom, with each section's controls and states. Then build exactly that list, in that order. Only then wire the old component's data and handlers into it.
2. **Rewrite the JSX; don't patch it.** Moving the old markup around and changing classes is not allowed. Keep hooks, data calls, handlers and permission checks, and replace the rendered tree.
3. **Don't change what the design decided.** No extra sections, no added cards, no different column sets, no colour on things the design keeps neutral, no larger type, no extra CTA. If something in the design looks wrong or unworkable, build it as drawn and raise it in your report. Don't quietly "fix" it.
4. **Tokens only.** No raw hex in components. Every colour comes from the `theme.css` token names, mapped into Tailwind.
5. **Compare against the board.** For each screen, run the app (`npm run dev`) at 1440×900 in light and dark mode. Put it side by side with the rendered board on the canvas. Fix the differences: spacing, sizes, order, copy, states. Note in your report what you compared.
6. **Nothing old left.** By the end, these searches over `src/` must return nothing (the code comments describing the old look go too):
   - `cobalt`
   - `clay`
   - `paper`
   - `Manrope`
   - `lucide-react`
   - `#1462c8`
   - `#f4f2ec`
   - `@radix-ui`

   Then remove `lucide-react` and the `@radix-ui/*` packages from `package.json`.

## Don't touch

- `supabase/` (schema, migrations, functions)
- The business logic in `src/utils/*`, except `navigation.js` labels, icons and grouping
- Permissions behaviour
- Routes and URLs

If the design truly can't be built without a logic change, stop and ask.

## Order of work

Work on a new branch. Make one commit per phase, and check each phase before starting the next:

1. **Foundation.** Tokens (light and dark) in `index.css` and `tailwind.config.js`; Inter; Phosphor through `icons.js`; Base UI shadcn primitives (Button, Input, Label, Select, Dialog, AlertDialog, DropdownMenu, Checkbox, RadioGroup, Switch, Tabs, Tooltip, Sheet, Sidebar, Table, Badge, Sonner); and the motion CSS. Match the Component inventory and Tokens boards.
2. **Shell.** Sidebar (expanded, collapsed and mobile sheet, plus the states on Sidebar · states), TopBar, theme toggle, ⌘K command menu.
3. **Screens,** in board order: Login → Dashboard → Users → Staff → Inventory → Deliveries → Production (all four) → Customers → Suppliers → Orders → the detail screens → Settings → Profile.
4. **Dialogs and toasts,** every `*Dialog` board.
5. **App-only screens** restyled from the design's parts.
6. **Dark mode and motion pass** across everything.

After every phase:

- run `npm run lint`, `npm test` and `npx playwright test`;
- fix failures in the code, not by weakening tests;
- where a test asserts old copy, labels or styling that the design deliberately changed, update the assertion to the design's copy and say so in the commit;
- never delete a test or skip one.

## Done means

- Every board in `canvas.json` has a matching screen or component, built to the board, in light and dark mode.
- All existing features still work, and all tests pass.
- The searches in rule 6 come back empty.
- A short report lists:
  - the screens compared against their boards, and any remaining differences with the reason for each;
  - design-only screens left without a backend;
  - fields added to dialogs;
  - anything in the design you think needs the user's decision.
