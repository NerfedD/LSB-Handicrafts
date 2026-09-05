---
target: "all screens: products, orders, deliveries, dashboards"
total_score: 32
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:C:\\Users\\Edd Vincent Patnugot\\OneDrive\\Documents\\New folder\\LSB-Handicrafts\\src\\components (products, orders, deliveries, dashboards)"
timestamp: 2026-09-05T08-31-15Z
slug: c-components-products-orders-deliveries-dashboards
closed: true
---
Method: dual-agent (A: independent design-review sub-agent · B: independent detector/browser-evidence sub-agent, run in parallel and isolated from each other)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Stage tracker, "on the shelf now" figures, delivery board columns, refund suggested-amount all state live derived truth, not cached labels. |
| 2 | Match Between System and Real World | 4 | "Free to sell," "Set aside for orders," "It arrived" — `copy.js` consistently replaces DB literals with the business's own vocabulary; confirmed live on every screen captured. |
| 3 | User Control and Freedom | 3 | Deliveries has a real, well-labeled "Move back" undo. Refund/Price-Adjustment dialogs have no equivalent once submitted — a wrong disposition or reason code becomes a permanent activity-log entry with no correction path visible. |
| 4 | Consistency and Standards | 3 | Strong everywhere except `OrderFormPage`'s dense grid and the money-dialogs' "Cancel" label (the system elsewhere argues for a positive dismiss verb). Detector corroborates a broader drift: 39 confirmed off-ramp font sizes concentrated in `dashboard.jsx`, `Shell.jsx`, and `Chip.jsx` (the last propagates into 5 consumer files). |
| 5 | Error Prevention | 2 | `RefundDialog` opens with its confirm button reading "Give back ₱0.00" fully enabled; `PriceAdjustmentDialog`'s confirm is live even when new price equals old. Both are certain to fail validation on first press — nothing is disabled proactively. |
| 6 | Recognition Rather Than Recall | 4 | `RecordDeliveredDialog` and `RefundDialog` both pre-fill "all of it" and show live before/after math. |
| 7 | Flexibility and Efficiency of Use | 2 | The large-text dashboard preference branches before the Production-role check in `DashboardPage.jsx`, so a Production Staff member who prefers large text can never reach their make-list dashboard — permanently traded for the generic tile screen. |
| 8 | Aesthetic and Minimalist Design | 4 | Confirmed live across every captured screen — one elevated card per screen, restrained palette, zero decorative clutter. `OrderFormPage` is the one exception, and it reads as under-designed rather than cluttered. |
| 9 | Help Users Recognize, Diagnose, and Recover from Errors | 4 | The blocked-account sign-in screen names the cause, reassures ("Your password was correct"), and gives a concrete next step plus a phone number — house style applied correctly to an error path. |
| 10 | Help and Documentation | 2 | A "Help" button sits in every header, but the screen most likely to raise a question — `OrderFormPage` — gets no more explanation than any other, and silently has no path to add a line for anything outside the existing catalogue. |
| **Total** | | **32/40** | **Good** |

Zero heuristics scored n/a — this is an Operate-mode admin tool, so Flexibility/Efficiency and Help/Documentation apply and were scored, not waived.

## Design Specificity Verdict

**LLM assessment**: This is a genuine, internally consistent design system, not a generic template — evaluated against its own documented rules (`DESIGN.md`, `README.md`), not generic best practice. The evidence: one accent color (cobalt) really is spent once per screen everywhere reviewed; the `lift` shadow appears exactly once per dashboard; status pills carry a dot/glyph in every instance seen; the StageTracker's transparent-not-gray future connector is implemented exactly as documented. `ProductFormPage.jsx` is the strongest evidence of house-style fluency (numbered bands, adaptive fields, a genuinely helpful aside, the `Row` exception used correctly).

Against that same bar, `OrderFormPage.jsx` is a measurable, citable regression — PRODUCT.md's own admission that it "deserves a design pass" undersells it. The line-item row is a literal three-column dense grid (`sm:grid-cols-[minmax(0,2fr)_100px_140px]`) at desktop/tablet widths, a direct violation of the system's own Named Rule ("there is deliberately no two-column layout primitive here... the sole exception is a genuinely paired two-value Row") — Item/Quantity/Price are not one decision the way diameter+category are.

**Deterministic scan**: `impeccable detect --json` returned exit code 0 (no blocking findings) and 112 advisory `design-system-font-size` findings — the only rule that fired anywhere in the scanned scope (products, orders, deliveries, dashboards, and the shared ui/shared/layout components underneath them). Cross-referencing every finding's value against DESIGN.md's own documented type ramp and its explicitly-called-out "supporting sizes" (13–15px for hints/context lines/mono identifiers): **73 of 112 (65%) use a value DESIGN.md itself already documents as intentional** — these read as false positives the detector's font-ramp rule doesn't currently carve out. The remaining **39 findings use genuinely undocumented sizes** (e.g. 52px/26px/17px in `ProductDetailPage.jsx`; 28px/19px/17px in `OrderDetailPage.jsx`/`OrderFormPage.jsx`; 11 undocumented sizes in `shared/dashboard.jsx` alone: 19, 22, 24, 26, 28, 29, 30, 32, 40, 56px; 10.5–11.5px nav-rail labels in `Shell.jsx`). `Chip.jsx`'s 7 findings are one root cause, not seven — they propagate into `Callout.jsx`, `ConfirmDialog.jsx`, `FactTable.jsx`, `dashboard.jsx`, and `forms.jsx` as consumers.

**Visual overlays**: No native browser tool is exposed in this session, so per the documented fallback both assessments hand-rolled Playwright against this repo's own stubbed-Supabase test harness (`tests/stubSupabase.js` + `tests/fixtures.js`) rather than a detect.js-injected live overlay. That produced real, verified evidence instead of a rendered overlay: 21 full-page screenshots (desktop 1440×960 + phone 390×844) from Assessment A across products/orders/deliveries/dashboards including the write-a-new-order form, refund and price-adjustment dialogs, and the blocked-account sign-in state; 13 more from Assessment B plus per-screen console capture (zero errors/warnings/exceptions across all 9 screens it walked, beyond three benign Vite/DevTools notices before sign-in) and deterministic a11y counts (0 icon-only buttons, 0 images missing alt, 0 unlabeled inputs across all 9 screens, after correctly excluding a Radix Select's hidden native mirror element as a false positive). No user-visible in-browser overlay exists from this run; the screenshots themselves are the artifact — saved under the OS temp directory, not the repo.

## Overall Impression

The implemented system is unusually disciplined for what it claims to be, and the evidence backs the claim up: zero console errors across nine live screens, zero accessibility-countable defects (icon-only buttons, missing alt text, unlabeled inputs) anywhere tested, and a palette/shadow/status vocabulary that holds its own rules under live inspection, not just in the source. The single biggest opportunity is that the one screen carrying the most real-world weight — writing a new order, the core daily task for a business built on custom, made-to-order decor — is also the one screen that visibly breaks the system's own layout rule and cannot represent the business's own core product line (a line item for anything not already in the catalogue). Fixing `OrderFormPage` is not a polish pass; it is closing the one place this system still asks staff to reach for paper.

## What's Working

1. **`RecordDeliveredDialog.jsx` / the delivery manifest flow** — pre-fills "all of it," states the shortfall consequence *before* the button is pressed ("A second delivery will be raised… only what actually went out comes off the shelf"), confirmed live. Heuristics 1 and 9 done exactly right.
2. **`DeliveryBoardPage.jsx`** — the five-column board with a stated combined-filter summary and a single "Clear filters" escape hatch; live capture confirms the tone-striped columns, the amber "2 days late" flag, and the "the rest of an order" badge all reading correctly together.
3. **Zero live defects on the accessibility/console floor** — across every one of the 9 screens Assessment B walked with a real browser and a console listener, nothing threw, nothing logged an error, and every icon-only-looking control, image, and form field passed a real DOM check. That is not a design opinion; it is a measured fact about the shipped system.

## Priority Issues

**[P0] `OrderFormPage.jsx` cannot add a line for anything outside the existing product catalogue.**
Why it matters: LSB's own product purpose names custom sculptures, stage backdrops, and made-to-order pieces as core business, and `OrderDetailPage.jsx` clearly renders `item.notes/description/reason` for such lines elsewhere in the same data model — implying they're expected to exist. The order-writing screen that's supposed to replace paper cannot represent that work at all, which means staff still reach for paper for exactly the orders this system exists to capture.
Fix: Add a "Something not in the catalogue" line option with a free-text name and a manual price, gated the same way negotiated pricing is already handled.
Suggested command: `/impeccable shape` (this is new interaction design, not a styling fix)

**[P1] `OrderFormPage.jsx`'s line-item row is a dense 3-column grid at desktop/tablet widths.**
Why it matters: violates the system's own Named Rule against dense multi-column forms — the one documented exception (`Row`, for two genuinely paired values) doesn't cover Item/Quantity/Price. It's also the one place this rule breaks in the entire reviewed scope, on the highest-traffic screen.
Fix: restack Item / How many / Price as stacked `Field`s inside the line card (as it already does below `sm`), or promote the trio to its own numbered sub-step with the running sum still visible.
Suggested command: `/impeccable layout`

**[P1] `RefundDialog` and `PriceAdjustmentDialog` open with a fully enabled, primary-styled confirm button in a guaranteed-invalid state.**
Why it matters: "Give back ₱0.00" and an active "Save the new price" when new equals old both look ready to press and are certain to error on first click — exactly the moment a nervous, first-time user reads an enabled button as "this is safe to press."
Fix: disable the confirm button until `givingBack > 0` / `difference !== 0` respectively.
Suggested command: `/impeccable harden`

**[P1] The large-text dashboard preference silently forecloses the Production role's make-list dashboard.**
Why it matters: `DashboardPage.jsx` branches on `dashboardView === LARGE` before the `isProduction` check, so a Production Staff account that has chosen large text (plausibly correlated with the low-vision persona the preference exists for) can never see the one dashboard variant built for their job — permanently trading it for the generic six-tile navigator. The same branch order likely does the same thing to Sales' follow-up dashboard (unverified in this pass).
Fix: thread `role` into `LargeTextDashboard` and add a production-specific (and sales-specific) large-text variant, or at minimum a make-list-shaped tile carrying the live shortfall count.
Suggested command: `/impeccable harden`

**[P2] Shared components carry ~39 font sizes off DESIGN.md's own documented type ramp.**
Why it matters: detector-confirmed, not a matter of opinion — `shared/dashboard.jsx` alone has 11 undocumented sizes (19, 22, 24, 26, 28, 29, 30, 32, 40, 56px), `Shell.jsx`'s nav-rail labels sit at 10.5–11.5px, and `Chip.jsx`'s drift propagates into 5 consumer files. This is the one place the system's own consistency claim (Heuristic 4) has real, measured gaps rather than a one-off.
Fix: reconcile each value against the documented ramp — either fold it into an existing step or add it to DESIGN.md deliberately, then re-run the detector to confirm zero genuine (non-supporting-size) findings remain.
Suggested command: `/impeccable typeset`

## Persona Red Flags

**Alex (Power User)**: The desktop line-item grid is the one place Alex might actually prefer density, but there's no review/summary step before "Write this order" to double-check a multi-line order's totals — everything is visible, nothing is presented as a final check the way `OrderDetailPage`'s totals block is. On a tablet/phone, the deliveries board's stacked full-width columns mean scrolling past "Not sent yet" and "Being made" to reach "On the way" — slower than the desktop board's side-by-side scan.

**Jordan (First-Timer)**: Exactly the persona who presses `RefundDialog`'s inviting solid-red "Give back ₱0.00" or `PriceAdjustmentDialog`'s cobalt "Save the new price" on first look and gets an error that reads as "I did something wrong" rather than "the button shouldn't have looked ready." `OrderFormPage`'s bare, aside-less card also gives Jordan none of the reassurance `ProductFormPage` gives ("the code is made for you") — nothing explains what "Price each: ₱0.00" means before a product is picked.

**Sam (Accessibility-Dependent / large-text preference)**: Directly hit by the P1 dashboard issue — choosing large text as a Production Staff member trades away the one dashboard variant built for their job. Everywhere else, large-text mode is genuinely well served (56px hero numbers, 96px destination tiles, confirmed live) — this is a structural gap, not a pattern of neglect.

## Minor Observations

- `ProductListPage`'s "Not tracked" vs. the phone card's "Stock not tracked" differ slightly in wording for the same state — likely harmless, confirmed live.
- `OrderFormPage`'s `Row` for "Promised for" / "Who is taking it" is a *correct* use of the paired-values exception — worth noting because it shows the line-item grid looks like an oversight, not a misunderstanding of the rule, on the same screen.
- The shortage warning ("more than we have on the shelf") on `OrderFormPage` renders after the "Add another item" button rather than near it, so a user tabbing straight through can miss it.
- Money dialogs use "Cancel" as the dismiss label, inconsistent with the system's own stated preference (`ConfirmDialog.jsx`'s doc comment) for a positive dismiss verb on any consequential action — cosmetic but easy to fix alongside the P1 default-state issue on the same two dialogs.
- `RefundDialog`/`PriceAdjustmentDialog` auto-focus their numeric input on open — good for keyboard users, but combined with the P1 issue it means the first available keyboard action sits inside a field whose current value is already "wrong."

## Questions to Consider

- If writing a new order is the single most-used screen in the system, why is it the one with the least design investment — and does it deserve to jump the queue ahead of everything else found here?
- The system's whole premise is trusting scale and words over subtlety for a low-confidence user — is a fully-enabled "Give back ₱0.00" button actually in that spirit, or is it asking a nervous user to trust a control that hasn't earned it yet?
- If "large text" is an accessibility preference rather than a role, should any role's functional dashboard be allowed to disappear behind it?
