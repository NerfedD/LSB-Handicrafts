# Handoff: LSB Handicrafts — Management System UI Overhaul

## Overview

LSB Handicrafts is a styrofoam decor maker in Davao City (event centrepieces, wall art, stage backdrops, custom sculptures). Their internal management system covers products & stock, orders, deliveries, customers, suppliers, staff accounts and an activity log.

This handoff is a **complete visual overhaul** of that system — a new design system plus ~25 rebuilt screens. The existing app is a React + Vite + Tailwind + Supabase codebase (repo folder `LSB-Handicrafts`), and the overhaul was designed against that codebase's real routes, roles and data shapes.

**The two goals driving every decision:**
1. Look professional — like software a business runs on.
2. Be usable by every age on the floor — the owner, office staff, and production/delivery staff who may not be confident with computers.

## About the Design Files

The files in this bundle are **design references created in HTML**. They are prototypes showing intended look, layout, copy and behaviour — **not production code to copy directly.**

The task is to **recreate these designs inside the existing LSB-Handicrafts React codebase**, using its established patterns: React function components, Tailwind utility classes, the `@/components/ui/*` primitives, `lucide-react` icons via `src/components/icons.js`, the shared `StatusPill`, `ProfileTable` and `DashboardCards` components, and the navigation source of truth in `src/utils/navigation.js`.

Do not port the inline styles. Translate the documented values into Tailwind classes and extend `tailwind.config.js` with the tokens below.

**Important context about the existing codebase:** it currently contains **two conflicting visual systems** — the routed screens (`layout/Shell.jsx`, bright blue `#2196f3` sidebar, cream `#f2efe7` canvas) and an older unrouted inventory workspace (`components/views/*`, white/zinc cards, `blue-600`, its own dark mode). A comment in `tailwind.config.js` notes that two primaries are kept because unifying them is a decision nobody had made. **This overhaul is that decision.** Both old systems are replaced by the one documented here.

## Fidelity

**High-fidelity (hifi).** Final colors, typography, spacing, density and copy. Recreate the UI faithfully using Tailwind. Every hex value, size and height in this README is the intended value, not an approximation.

Two things are deliberately *not* final:
- **Imagery** — product/workshop photos are dashed placeholder slots. Real photography is needed.
- **Data** — all names, numbers and prices are realistic placeholders, not production data.

---

## Design Tokens

### Colors

| Token | Hex | Use |
|---|---|---|
| `navy` | `#0e2f5c` | Sidebar, section fills, primary avatars |
| `cobalt` | `#1462c8` | Primary buttons, links, active nav, focus rings |
| `cobalt-deep` | `#0e4b9c` | Link hover, text on cobalt tint |
| `clay` | `#b4531f` | Craft/production accent — production dashboard, supplier actions, stock icons |
| `clay-deep` | `#8a4318` | Text on clay tint |
| `paper` | `#f4f2ec` | App canvas |
| `paper-2` | `#faf9f5` | Table headers, card footers, form section bands |
| `ink` | `#111d2b` | Primary text, selected chip fill |
| `ink-2` | `#324054` | Body text inside tinted callouts |
| `muted` | `#4b5768` | Secondary text, icon default, table header text |
| `muted-2` | `#8a93a1` | Placeholder text, disabled |
| `green` | `#0f6b46` | Success, "can sign in", plenty in stock, confirm-forward buttons |
| `amber` | `#c07800` | "Running low" dot |
| `amber-text` | `#8a5000` / `#6b3f00` | Warning icon / warning text |
| `red` | `#a8332f` | Danger, run out, blocked, alert badge |
| `red-text` | `#7d2521` | Danger heading text |
| `purple` | `#6b3fa0` | Role/avatar variety only |

### Tints (surface behind a status or icon)

`cobalt` `#e8f1fd` · `clay` `#fdefe6` · `green` `#e6f2ec` · `amber` `#fdf3e4` · `red` `#fbeceb` · `purple` `#efeaf8` · `neutral` `#f0eee8`

Tint + matching `-text`/tone color is the standard pairing for every pill, icon chip and callout.

### Borders (alpha on ink)

| Value | Use |
|---|---|
| `#111d2b1f` | Card border (the default) |
| `#111d2b12` / `#111d2b14` | Row dividers, internal section rules |
| `#111d2b26` | Secondary button / chip border (1.5px) |
| `#111d2b29` | Secondary button border, slightly stronger |
| `#111d2b2e` | Input border (1.5px) |
| `#111d2b33` | Dashed image placeholder |
| Status chip borders | Tone at `40` alpha, e.g. `#8a500040`, `#a8332f40`, `#0f6b4640` |

### Typography

**Family:** Manrope (Google Fonts), weights 400/500/600/700/800. `-webkit-font-smoothing: antialiased`.
All numeric values use `font-variant-numeric: tabular-nums`. SKUs and IDs use `ui-monospace, Menlo, monospace`.

| Role | Size | Weight | Tracking |
|---|---|---|---|
| Page greeting (dashboard h2) | 29px | 800 | -0.025em |
| Page title (header h1) | 23px | 800 | -0.02em |
| Card/section heading | 18–18.5px | 800 | — |
| Row title / primary body | 16.5px | 700 | — |
| **Body minimum** | **16px** | 400–700 | — |
| Secondary body | 15–15.5px | 400–700 | — |
| Hint / meta | 14–14.5px | 400 | — |
| Mono meta (SKU) | 13.5px | 400 | — |
| Table column header | 13px | 800 | 0.07em, uppercase |
| Sidebar group label | 10.5px | 800 | 0.14em, uppercase |
| Big stat | 40px | 800 | -0.03em |
| Strip stat | 32px | 800 | -0.03em |
| Hero stat (large-text view) | 56px | 800 | -0.04em |
| Total to pay | 28px | 800 | -0.02em |

**Hard floor: nothing below 13px, and nothing below 16px for anything a user reads as a sentence.** The 13px exception is uppercase tracked table headers and sidebar group labels only.

### Density & sizing

| Element | Value |
|---|---|
| Sidebar width | 260px (standard) · 300px (large-text view) · 84px icon rail (tablet) |
| Header height | 76px (standard) · 88px (large-text view) |
| Sidebar nav item | 52px tall, 11px radius, 13px gap to icon (64px / 13px radius in large view) |
| Table row | min 62px, 15px vertical padding |
| Table header row | 14px vertical padding |
| Card padding | 18–24px |
| Main content padding | 24–30px horizontal, 24–30px top |
| **Tap target minimum** | **44px** — small controls 44px, buttons 46–52px, primary CTA 52–56px |
| Input height | 54–56px |
| Filter chip | 44px, pill radius |
| Filter dropdown / search | 52px, 11px radius |

### Radii

`9999px` pills/avatars · `10px` buttons · `11px` inputs, nav items, chips-as-buttons · `12–13px` inner tiles · `14px` cards · `16–18px` modals · `20px` large feature cards

### Shadows

| Use | Value |
|---|---|
| Card | `0 1px 2px rgba(17,29,43,.05)` |
| Attention card (lifted) | `0 1px 2px rgba(17,29,43,.05), 0 12px 32px -22px rgba(17,29,43,.4)` |
| Cobalt primary button | `0 2px 8px rgba(20,98,200,.28)` |
| Cobalt CTA (larger) | `0 3px 12px rgba(20,98,200,.32)` |
| Active sidebar item | `0 2px 8px rgba(0,0,0,.22)` |
| Modal | `0 20px 50px -18px rgba(17,29,43,.55)` |
| Toast | `0 12px 32px -14px rgba(17,29,43,.6)` |
| Focus ring | `border: 2px solid #1462c8` + `box-shadow: 0 0 0 4px #1462c826` |

### Dark mode palette

Applied to the two screens staff sit on all day (products list, order detail). Warm-neutral darks, never pure black.

| Token | Hex |
|---|---|
| Canvas | `#12161c` |
| Surface / card | `#1a2029` |
| Table header | `#20272f` |
| Icon chip | `#252c35` |
| Text | `#eef1f5` |
| Text secondary | `#c9d1da` |
| Text muted | `#a3adba` |
| Borders | `rgba(255,255,255,.07)` rows · `.09` cards · `.14` chips |
| Cobalt (brightened) | `#3b8ae5` — with `#08131f` text on it |
| Green | `#4dbb8c` |
| Amber | `#e0a04a` (tint `#2a2113`, text `#f0be74`) |
| Red | `#e0705f` (tint `#2b1717`, text `#f09b8e`) |

---

## The Six Rules

Every screen obeys all six. These came directly from the client's definition of "friendly for all ages" and should be treated as acceptance criteria.

1. **Nothing under 16px** for readable text. Rows 62px, controls 44px+.
2. **Plain words, not jargon.** See the copy table below.
3. **Every icon has a word beside it.** No icon-only buttons anywhere — a bare pencil or trash icon is a guess.
4. **High contrast.** Secondary text at `#4b5768` on white/paper. Focus rings visible, not hinted.
5. **One question at a time.** Forms run down a single column in numbered steps with help text under fields, not a dense grid.
6. **Danger is spelled out.** Destructive confirms name the thing ("Delete *Styro Ball 6 inch*?"), state consequences, and the button says the verb ("Yes, delete it"). Destructive actions live in their own outlined block, never as a red icon in a row.

### Copy rewrites (apply these throughout)

| Current codebase string | New string |
|---|---|
| Status: Active / Blocked | Can sign in: Yes / Blocked / Not set up |
| Low Stock | Running low |
| Out of Stock | Run out |
| In Stock | Plenty in stock |
| Total Users | People with accounts |
| Active Users | Currently able to sign in |
| Activity Entries | What happened recently |
| Quick Actions | Things you do often |
| Recent Activity | What happened recently |
| User Management | Staff & accounts |
| Inventory | Products & stock |
| Product/Item Profiles | Products & stock |
| Assign Staff Role | What does *name* do? |
| Update Credentials | Change password |
| "You don't have access to this screen." | "This screen is not part of your job" |
| "Are you sure? This cannot be undone." | "Delete *specific thing*?" + consequences |
| PHP 12.00 | ₱ 12.00 |

---

## Global Chrome

### Sidebar (`layout/Shell.jsx` replacement)

- 260px, `#0e2f5c`, full height, flex column.
- **Brand block** (top, 22px/20px padding, bottom border `rgba(255,255,255,.14)`): 42px logo at 10px radius, then "LSB Handicrafts" (16px/800) over "MANAGEMENT SYSTEM" (10.5px/800, 0.13em tracking, `rgba(255,255,255,.62)`).
- **Nav** (18px/12px padding, 3px gap): group labels "MAIN" and "PEOPLE". Items 52px, 11px radius, 19px icon + 16px label.
  - Active: `#1462c8` fill, weight 700, `0 2px 8px rgba(0,0,0,.22)`.
  - Inactive: transparent, weight 600, `rgba(255,255,255,.86)`.
  - Count badges right-aligned: attention counts use clay `#e0873f` with `#2b1405` text; neutral counts use `rgba(255,255,255,.18)`.
- Nav items: Dashboard · Products & stock · Orders · Deliveries — then PEOPLE: Customers · Suppliers · Staff & accounts.
- **No account block in the sidebar.** (Changed from the original design — see below.)

### Header

76px, white, bottom border `#111d2b1f`, 30–32px horizontal padding.

- **Left:** page title (23px/800/-0.02em) over a context line (14px, `#4b5768`) — either the date or a record count ("148 products · 7 running low").
- **Right, in this order:** Help (44px outlined) → primary action for the screen if any (48px cobalt) → Alerts (44px outlined, with count badge: `#a8332f` fill, white text, 22px min-width pill) → **account chip**.
- **Account chip:** 48px tall, `0 12px 0 6px` padding, 11px radius, 1.5px `#111d2b26` border, white fill. Contains a 36px avatar circle (role color, white 13.5px/800 initials), then name (14.5px/700) over role (12.5px, `#4b5768`), then an 18px chevron-down. This opens the account menu (sign out, my profile, view preference).
- Large-text view scales the chip to 60px with a 44px avatar and 17px name.

### The two dashboard views (a per-user preference, not a global choice)

Both ship. A user picks in **My profile → "How your dashboard looks"**, and the choice is per-account — it changes only what they see.

- **Standard** (default for a new account) — more on screen at once; best for someone who works in the system all day.
- **Large text** — bigger words and buttons, fewer things per screen; the same system at kiosk scale.

Only the **dashboard** differs. Every other screen is identical in both views.

Implementation: store as a user preference (e.g. `users.dashboard_view` = `'standard' | 'large'`), read it at layout level, and branch the dashboard route. **Open question flagged to the client:** the profile screen may be too buried for this preference — a first-run question at initial sign-in, or an item in the account menu, may be better.

---

## Screens

Each heading gives the option id used in the prototype file, so you can find it: open `LSB Handicrafts UI.dc.html` and jump to `#<id>`.

### Auth

**`2a` Sign in**
Two panels. Left 44%: `#0e2f5c`, brand block top, a 4:3 dashed image slot (workshop/product photo, 1600×1200) filling the middle, then an 18px/600 positioning sentence and "STAFF ACCESS ONLY" (12px/800, 0.13em). Right: centered 420px column — "Sign in" (34px/800/-0.03em), 16.5px subhead, then username/email and password inputs (56px, 11px radius, leading 20px icon, "Show" toggle with the word). Below: "Keep me signed in" checkbox (24px box, 6px radius) and "Forgot password?" underlined at 3px offset. Primary 56px cobalt "Sign in". Footer note gives the office phone number as a real escape hatch.

**`2b` Sign-in problems + forgot password**
Three error states, each a tinted callout with icon, an 16.5px/800 heading naming *what happened*, and a 15px line saying *what to do*:
- Wrong details (red tint) — mentions capitals, spaces, and the 5-try/15-minute lockout.
- Account blocked (amber tint) — states the password was correct, names who can unblock, offers a "Call the office" button.
- Not set up yet (cobalt tint) — password correct but no role assigned.

Forgot password is a 3-step flow with an 8px segmented progress bar; step 1 asks for the email and states the link lasts one hour.

### Dashboards

**`1b` Standard dashboard**
Greeting (29px/800) + a one-line summary of the day. Then:
1. **"Needs your attention"** card — the centrepiece. White, 14px radius, **5px left border in clay `#b4531f`**, lifted shadow. Header row with a 36px amber-tint warning icon chip, "Needs your attention" (19px/800), and a right-aligned "Updated 4 minutes ago". Then 3 rows, each: 46px tinted icon chip → a 17.5px/700 sentence title + 15px explanatory body → one 48px cobalt CTA whose label is a verb ("Restock these", "Open these orders", "Review the account"). This is the screen's teaching mechanism — a new user learns the system by reading it.
2. **Stat strip** — 4 equal cells in one bordered card, divided by 1px rules (not 4 separate cards). Each: 18px tone-colored icon + 14px/700 label, 32px/800 value, 13.5px hint.
3. **Two-column row** — "What happened recently" (activity feed, 36px tinted icon chip + sentence + timestamp) and "Things you do often" (4 stacked 56px buttons, first one cobalt).

**`1c` Large-text dashboard**
300px sidebar, 88px header, 20px nav labels, 26px nav icons. Content: "Good morning," (20px) over the user's name (40px/800). Then 3 hero stat cards (2px tone-tinted borders, 48px icon chip, **56px/800 value**, 16.5px hint). Then "WHERE DO YOU WANT TO GO?" (15px/800/0.1em) over 6 destination tiles in a 3-column grid — each 96px min-height, 60px icon chip at 15px radius, 21px/800 label, 15.5px hint. Nothing on this screen is below 15px.

**`2c` Sales staff dashboard**
Same shape as `1b`, cobalt-led, but the attention card is "Your follow-ups" and the work is orders and customers. Admin data (user counts, activity log) is simply **absent**, not disabled. 3 stat cards, then 3 action buttons (Write a new order / Add a customer / Look up a price).

**`2d` Production staff dashboard**
Clay-led. The attention card is a **"Make list — most urgent first"** table: product (name + mono SKU) · on shelf · needed · how urgent (tinted pill). Header band uses clay tint `#fdefe6`. Then 3 stat cards and two clay/outlined actions (Record what we made / Add a new product). The whole screen answers one question: what do we make next?

### Products & stock

**`2f` Products list** (shown with full sidebar + header chrome)
- **Filter row:** flex-wrap, 12px gap — search input (flex-1, min 280px, 52px) + "Kind: All" and "Sort: Name A–Z" dropdowns (52px; the label is 500 weight `#4b5768`, the value 700 ink, then a chevron).
- **Chip row:** 44px pills — `All 148` (selected: ink fill, white text) · `Plenty in stock 139` (white + 10px green dot) · `Running low 7` (amber tint/border/text + dot) · `Run out 2` (red tint/border/text + dot). Counts are always on the chip so nobody applies a filter to discover it's empty.
- **Table:** grid `1.6fr 160px 1fr 130px 200px`, 22px horizontal padding, 62px min rows.
  - Product cell: 44px neutral-tint icon chip (shape icon per kind) + name (16.5px/700) over `SKU · Category` (13.5px mono, muted).
  - Stock cell: 20px/800 tone-colored number + 14px status word, then a **9px stock bar** (max 170px, pill radius, `#111d2b14` track, tone fill at a percentage) — readable from across the room.
  - Price cell: 16.5px/700 over 13.5px unit ("each", "per sheet", "per bundle").
  - Actions: 44px outlined "View" and "Edit" — **icon + word**, never icon-only.
- **Footer:** `#faf9f5` band, "Showing 1–6 of 148 products" + 46px Previous/Next.

**`2g` Add a product**
Two columns (`1fr 320px`). Left is a single-column form in numbered bands:
- Band header "1. What is it?" (18.5px/800).
- Kind of product as 4 large 50px choice buttons with icons (Styro ball / sheet / block / Something else), selected = navy fill. Help text: "This decides which measurements we ask for next" — the form is adaptive.
- Product name (54px input) with help text "Write it the way staff say it out loud."
- Diameter + Category side by side.
- Band header "2. How is it sold and counted?" on a `#faf9f5` band: Price (with ₱ prefix), Sold by, How many on the shelf now, "Warn me when it drops below" — with help text tying it to the make list.
- Footer band: Cancel left; Save as draft + "Save this product" right.

Right column: a square dashed photo slot (800×800) and a cobalt-tint note explaining **the SKU is generated** from kind + size (`SB-04-001`) — "You never have to invent a code."

**`2h` One product**
Left 300px: photo card with mono SKU, then a fact table (Kind, Category, Diameter, Price, Warn level, Added).
Right: **stock story card** — "On the shelf right now" with a 52px/800 green number, warn-level line, and to the right two right-aligned figures (Set aside for orders / Free to sell) split by a vertical rule. Below, a 14px segmented bar (free-to-sell / set-aside / room-to-fill) with a three-item legend. Then a **Stock movements** table: when · what happened (+ "by whom") · change (green `+`, red `−`) · left.

### Orders & deliveries

**`2i` Orders list**
Chips: `All 62` · `Waiting 12` (amber) · `Done 46` · `Cancelled 4`. Table grid `110px 1.4fr 1fr 150px 150px 120px`: mono `#1043` · customer + date · "3 items" + a truncated item list · right-aligned total · **status as a labelled pill, not a dropdown** (changing status is a deliberate action on the order itself, so it can't be changed by accident from a list) · 44px "Open".

**`2j` Order detail**
- **Stage tracker** instead of a status word: 4 stages (Written · Being made · Ready to go · Delivered), each a 46px circle with a 2px border and a date beneath, joined by 4px connector rules. Done stages are green-filled, current is cobalt-filled, future is white with muted border and a `#111d2b00` transparent connector. Anyone can see what happens next.
- Line items table: item (+ note) · quantity · each · line total. Footer band: Items total, Delivery, rule, then "Total to pay" at 28px/800.
- Right column: customer card (46px navy avatar, contact rows with icons) and an amber **"Waiting 4 days"** callout with an "Assign someone" button.
- Header actions: Print (outlined) + "Mark as done" (green `#0f6b46`).

**`2k` Deliveries board**
A 5-column board, because a delivery is always in one of five places and moving it along is the whole job.
- **Filters:** search by delivery number or customer; `Due: Today` / `Driver: Anyone` / `Area: All of Davao` dropdowns.
- **Chips:** `Everything 48` · `Late 3` (red tint) · `Due today 4` (**selected**, ink fill) · `This week 17` · `No driver yet 6` · `Arrived 31`.
- **Active-filter summary bar** (cobalt tint, 11px radius): a filter icon, a sentence naming what's showing in bold ("Showing **deliveries due today** · **all of Davao** · **any driver**"), and one "Clear filters" button. Worth having because three dropdowns can silently combine into a confusing empty board.
- **Columns:** Not sent yet · Being made · Ready to go · On the way · Arrived. Each a card with a **4px top border in its tone**, an icon + 15px/800 name, a 24px/800 count, then stacked delivery cards (mono id, customer, detail, a calendar meta line) on `#faf9f5`. Empty columns show "Nothing due today" (14px, `#8a93a1`) — never blank space.
- The prototype is shown in a genuinely filtered state so the summary bar demonstrates its purpose.

**`2l` One delivery**
"Where it is now" card: 52px amber icon chip + 24px/800 stage name + when it left. Then **one big 56px green "It arrived"** button plus a 56px outlined "Move back" — moving it forward is a single deliberate action. Then "Where it is going" fact table and a self-writing "History" list.

### Customers & suppliers

**`2m` Customers**
**Cards, not a table** — a person is a face and a phone number, and sales staff use this standing at a counter.
- **Filters:** search by name/phone/business; `Area: Anywhere` and `Sort: Name A–Z`.
- **Chips:** `Everyone 312` (selected) · `Businesses 84` · `Walk-ins 228` · `Regulars 46` (green tint) · `Has an open order 23` (amber tint) · `New this month 8` · `Not ordered in a year 31`. The last is a call list, not just a filter.
- 3-column card grid: 48px initials avatar (per-customer color) + name (17px/800) + kind ("Business · events", "Walk-in"), then phone and city rows with icons, then a divider and a footer row with order count and an "Open →" button.

**`2n` One customer / suppliers list**
Customer detail: 60px avatar + name (23px/800) + "Business customer · on record since March 2024", two bordered stat tiles (Orders placed / Spent with us), then "Write them an order" (cobalt) + "Edit details". Below, a contact-details fact table with a leading icon per row.
Suppliers list uses the **same layout vocabulary** so learning one teaches the other — 64px rows, 46px clay-tint handshake chip, name + what they supply, right-aligned phone + city, "Open →". Clay "Add a supplier" button.

### Staff & accounts

**`2o` Staff accounts**
Table grid `1.5fr 1fr 170px 180px`. Person cell: 44px avatar + name with an optional inline badge ("Owner" cobalt tint, "New" amber tint) over email. Then "What they do" (role in plain words), then **"Can sign in"** as a tinted pill — `Yes` (green + check) / `Blocked` (red + x) / `Not set up` (amber + clock) — because that is what an administrator actually wants to know. Action: 44px "Manage".

**`2p` Manage one account**
- Top: a red-tint status callout — "Ana cannot sign in right now", when and by whom she was blocked, and the clarification that **her password still works**. One 50px green "Let Ana sign in again" button.
- "Her details" form: name, email (locked, `#f0eee8` fill, lock icon, help text "Email cannot be changed here — it is how she signs in"), phone, and a role row showing the current role with a "Change this" button.
- Footer band: Cancel + Save changes.
- **Bottom: destructive block** — its own card with a 1.5px `#a8332f45` border. Heading "Remove this account for good", then exactly what happens ("Ana disappears from the staff list and her sign-in stops working. Orders and stock records she made stay exactly as they are. This cannot be undone."), then a 50px outlined-red "Remove Ana Reyes". Never a red trash icon in a table row.

**`2q` Change role — "What does Ana do?"**
5 stacked radio cards (26px ring, 11px dot when selected; selected card gets a 2px cobalt border). Each names the role (17.5px/800) and **spells out what it unlocks** in a 15px sentence, with a 44px tinted icon chip on the right. Roles: Administrator · Manager · Sales staff · Production staff · Delivery staff.

**`2r` Staff directory + activity log**
Directory: 2-column read-only cards, framed as "Who to call for what" — 48px avatar, name, role, phone. No buttons.
Activity log: filter chips (Everything · Sign-ins · Stock changes · Price changes), a "TODAY" date group label, then 64px rows — 40px tinted icon chip, a sentence with the staff name bolded, right-aligned time. Export button in the header.

### My own account

**`2s` My profile + change password**
Profile: centered 88px avatar, name (25px/800), a role pill, and a sentence explaining what that role can do. Then a fact table (Email, Username, Phone, With LSB since). **Then the "How your dashboard looks" preference card** — two radio options (Standard / Large text) with plain descriptions and a note that it only changes what they see. Then "Edit my details" (cobalt) + "Change password".
Change password: current / new / confirm, with a **live 3-item requirement checklist** (green check + 700 weight when met, muted circle when not) and the confirm field labelled "Type the new password again — so we know there is no typo".

### Dialogs, empty states, problems

**`2t` Dialogs + toast**
- **Destructive confirm:** 50px red-tint icon chip, heading that **names the record** ("Delete "Styro Ball 6 inch"?"), body stating consequences and what survives, footer band with "Keep it" and "Yes, delete it".
- **Create dialog:** header with title + subhead + a 44px outlined close, single-column fields, role as a row of 46px choice buttons, footer "Cancel" + "Create the account".
- **Toast:** navy `#0e2f5c`, 13px radius, 38px green check chip, 16px/800 confirmation naming the person, a 14px follow-up line, and an underlined "View" action.

**`2u` Four failure states**
Each is centered, with a 76px icon circle, a 21px/800 heading, a max-320px 15.5px explanation, and **a way out**:
- **Nothing there** — "No products yet" + "Add a product".
- **Still loading** — skeleton rows (44px chip block, two bars at varying widths, a pill block) plus "Fetching your products…" with a spinner. Skeletons mirror the real row geometry.
- **Went wrong** — "We could not reach the system", reassurance that nothing was lost, "Try again" + "Go to dashboard".
- **Not allowed** — "This screen is not part of your job", naming the role, what it can't reach, and who to ask. Then "Back to dashboard".

**`2v` Dark mode**
Products list in dark. Same geometry, dark palette above. Selected chip inverts to `#eef1f5` with ink text; stock bar track becomes `rgba(255,255,255,.1)`.

**`2w` Phone (390px) + tablet (834px)**
- **Phone dashboard:** navy header with greeting + a 44px alerts button (9px dot badge, 1.5px navy ring). Content: the attention card (each item's CTA becomes a full-width 50px button), a 2-up stat grid, a compact "Recently" list. **Bottom tab bar:** 5 targets, 56px, each an icon over an 11.5px/700 word — never icon-only. Active tab gets a cobalt tint.
- **Phone products:** 50px search, a horizontal chip row, then **table rows become cards** — icon chip + name + mono meta, then the stat/bar/price row, then two 48px half-width View/Edit buttons. A sticky bottom bar holds the 56px "Add a product" CTA. **Nothing is ever a horizontal scroll.**
- **Tablet order detail:** the sidebar collapses to an **84px icon rail** with 62px items, each an icon over a 10.5px/700 word. The stage tracker goes horizontal-compact (40px circles, label + date beside).

---

## Interactions & Behavior

- **Navigation:** sidebar item → route. Active state from the current route; keep `src/utils/navigation.js` as the single source of truth and update its labels to the plain-language names.
- **Account chip** (header, far right) → menu with My profile, dashboard view preference, Sign out.
- **Filters:** chips are mutually exclusive within a row (a segmented filter); dropdowns are independent and combine with the active chip. Deliveries shows the combined result in the summary bar, with one Clear filters action resetting everything. Counts on chips should be computed from the unfiltered set.
- **Order status** is never editable from the list — only from the order detail, via the explicit "Mark as done" action.
- **Delivery stage** advances via the single large primary button on the detail screen ("It arrived"), with a secondary "Move back". Every advance writes a history entry automatically (what, when, who).
- **Destructive actions** always open the `2t` confirm dialog. The confirm button label is the verb, and the dialog names the record.
- **Product form** is adaptive: the "Kind of product" choice changes which measurement fields render (diameter for balls; width × length × thickness for sheets; three dimensions for blocks). SKU is generated, never user-entered.
- **Password requirements** validate live as the user types.
- **Focus:** every interactive element gets `2px #1462c8` border + `0 0 0 4px #1462c826` ring. Do not remove outlines.
- **Empty states** appear per-container, not per-page — e.g. individual board columns show "Nothing due today".
- **Responsive breakpoints:** ≥1280px full sidebar · 834–1279px 84px icon rail · <834px bottom tab bar, cards instead of tables, sticky bottom CTA.
- **Transitions:** keep them short and functional — 120–160ms ease for hover/press, 200ms for panel and dialog entry. No decorative motion.

## State Management

Matches the existing Supabase-backed app; the overhaul adds little.

- Per-screen: search string, active filter chip, dropdown selections, sort, page.
- Per-record: the open record id for detail routes.
- Dialogs: which dialog is open + its target record.
- Toasts: a queue of confirmations.
- **New:** `dashboardView: 'standard' | 'large'` — persisted per user account, read at layout level.
- Data fetching is unchanged: products, orders, deliveries, customers, suppliers, staff accounts, activity log. Chip counts need aggregate queries against the unfiltered set (or a single count query per filter).

## Assets

- **`assets/Logo-128.png`** — copied from `LSB-Handicrafts/src/assets/Logo-128.png`. Rendered at 42px (sidebar), 48px (auth), 52px (large-text sidebar), 38–44px (mobile/rail), always `object-fit: cover` with a 9–12px radius. A higher-resolution original would help; 128px is tight for retina at 52px.
- **Icons: `lucide`** — the codebase already deep-imports from `lucide-react` via `src/components/icons.js`. Keep that pattern. Icons used include: layout-dashboard, package, package-plus, package-check, package-open, shopping-cart, truck, users, user-round, user-plus, user-check, user-x, user-cog, handshake, clipboard-list, clipboard-check, hammer, boxes, box, square, circle, shapes, search, filter, chevron-down/left/right/up, arrow-left/right, eye, pencil, trash-2, plus, x, check, circle-check, circle-x, circle-alert, circle-help, triangle-alert, shield, shield-alert, badge-check, bell, mail, phone, map-pin, at-sign, lock, key-round, log-in, log-out, calendar, calendar-days, calendar-clock, clock, history, tag, wallet, save, printer, download, undo-2, rotate-cw, cloud-off, loader-circle, lightbulb, image-plus, notebook-pen, settings, list, list-checks, inbox, send, info, repeat, moon, building-2, a-large-small.
- **Image placeholders needing real photography:** the auth brand panel (4:3, ~1600×1200 workshop or product shot), the product form photo slot (1:1, 800×800), and the product detail photo (1:1, 800×800).

## Files

| File | What it is |
|---|---|
| `LSB Handicrafts UI.dc.html` | **The overhaul.** All ~25 screens. Turn 1 = the two dashboard views (`1b`, `1c`); turn 2 = every other screen, grouped by area. Open in a browser and use the `#<id>` anchors. |
| `LSB Current UI.dc.html` | The **existing** UI recreated faithfully from the repo (login, admin dashboard, legacy inventory workspace) — the before-and-after baseline. |
| `screenshots/` | A PNG of every screen, named by option id (see below). Rendered at 1× — read them alongside the README, but take **measurements from the README, not from the pixels**. |
| `assets/Logo-128.png` | The brand mark. |
| `support.js` | Runtime for the prototype files. Required for them to render; **not** something to port. |

### Screenshot index

| File | Screen |
|---|---|
| `1b-dashboard-standard.png` | Standard dashboard (default view) |
| `1c-dashboard-large-text.png` | Large-text dashboard |
| `2a-sign-in.png` | Sign in |
| `2b-sign-in-problems.png` | Three sign-in error states + forgot password step 1 |
| `2c-dashboard-sales.png` | Sales staff dashboard |
| `2d-dashboard-production.png` | Production staff dashboard |
| `2f-products-list.png` | Products & stock list (with full sidebar + header chrome) |
| `2g-add-a-product.png` | Add a product form |
| `2h-one-product.png` | Product detail + stock movements |
| `2i-orders-list.png` | Orders list |
| `2j-order-detail.png` | Order detail with stage tracker |
| `2k-deliveries-board.png` | Deliveries board, filtered state |
| `2l-one-delivery.png` | Delivery detail |
| `2m-customers.png` | Customers (card grid + filters) |
| `2n-customer-and-suppliers.png` | Customer detail + suppliers list |
| `2o-staff-accounts.png` | Staff accounts |
| `2p-manage-account.png` | Manage one account (incl. destructive block) |
| `2q-change-role.png` | Change role |
| `2r-directory-and-activity-log.png` | Staff directory + activity log |
| `2s-my-profile-and-password.png` | My profile (with view preference) + change password |
| `2t-dialogs-and-toast.png` | Destructive confirm, create dialog, toast |
| `2u-empty-loading-error-states.png` | Empty, loading, error, not-allowed |
| `2v-dark-mode.png` | Products list in dark mode |
| `2w-phone-and-tablet.png` | Phone dashboard, phone products, tablet order detail |

Both HTML files are self-contained design prototypes: static markup with placeholder data, no real interactivity or data layer. Read them as specification, not as source.

## Where This Came From

Design decisions were made against the real codebase, so a few notes carry over:

- `tailwind.config.js` currently defines two primaries with a comment saying unifying them is an unmade design decision. **This overhaul unifies them:** navy for chrome, cobalt for action, clay as the third accent that stops the palette reading as generic dashboard blue.
- `src/components/views/*` (InventoryList, OrdersList, Dashboard, Sidebar) is the older unrouted workspace with its own palette and dark mode. Those screens are **superseded** by `2f`, `2i`, `1b` and the new sidebar. Don't preserve their styling.
- `StatusPill.jsx` is already the app's one status chip — extend it with the new tint/tone pairs and the plain-language labels rather than adding new pill components.
- `ProfileTable.jsx` backs the customer/product/supplier list screens. `2m` moves customers to **cards**; suppliers and products stay tabular, so `ProfileTable` still earns its place.

## Open Questions For The Client

1. Where should the dashboard-view preference live? Profile screen (as designed) may be too buried — a first-run question or an account-menu item may be better.
2. Real product photography and a higher-resolution logo are needed.
3. Currency renders as `₱` rather than `PHP` throughout — confirm that's right for printed documents too.
