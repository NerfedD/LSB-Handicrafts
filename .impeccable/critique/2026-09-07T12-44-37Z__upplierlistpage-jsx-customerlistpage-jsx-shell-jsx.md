---
target: Suppliers, Customers + phone nav
total_score: 31
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Edd Vincent Patnugot\\OneDrive\\Documents\\New folder\\LSB-Handicrafts\\Suppliers, Customers + phone nav (SupplierListPage.jsx, CustomerListPage.jsx, Shell.jsx)"
timestamp: 2026-09-07T12-44-37Z
slug: upplierlistpage-jsx-customerlistpage-jsx-shell-jsx
---
# LSB Handicrafts — Design Critique: Suppliers, Customers, Phone Nav

Method: dual-agent (A: independent design-review sub-agent · B: detector + browser-evidence sub-agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2/4 | A chip or area filter that narrows a real list to zero results still shows the "database is empty" copy ("No customers yet"), not a "nothing matches this filter" state. |
| 2 | Match Between System and Real World | 4/4 | Fluent throughout — "Ask for Ramon," "Where they are," "No contact person on file." |
| 3 | User Control and Freedom | 3/4 | Search-clear and dialog-cancel work well, but once a chip filter is active there's no way to drop just that one dimension short of clearing everything. |
| 4 | Consistency and Standards | 3/4 | Suppliers and Customers — neighbors in the same nav group — use genuinely different filter mechanics (dropdowns + summary sentence vs. dropdowns + 7-chip radiogroup, no summary). |
| 5 | Error Prevention | 4/4 | Deletion is named in full, guarded server-side, and the reversible alternative is offered before the destructive button. |
| 6 | Recognition Rather Than Recall | 4/4 | Every filter and row action prints its own label; the phone "More" menu never silently drops a destination. |
| 7 | Flexibility and Efficiency of Use | 2/4 | No bulk actions, no click-to-sort, and Customers' mutually-exclusive chips can't express a compound question ("businesses with an open order"). |
| 8 | Aesthetic and Minimalist Design | 4/4 | The one-accent-per-screen rule is held rigorously. |
| 9 | Error Recovery | 4/4 | Form errors are specific and plain; a blocked delete explains itself in place. |
| 10 | Help and Documentation | 1/4 | Help is `hidden sm:inline-flex` (Shell.jsx) — literally absent below 640px, i.e. on the phone width this product is explicitly designed for. Where visible, it fires a static "ask whoever set this up for you" toast. |
| **Total** | | **31/40** | **Good (78%)** |

Both heuristics 7 and 10 were scored rather than marked n/a: this is a daily-use Operate tool for staff PRODUCT.md explicitly calls low computer-confidence, so both matter here.

## Design Specificity Verdict

**Design review:** Authored for this product, not a reskin. Clay (not cobalt) is spent specifically on suppliers because they sit on the "making" side of the business — the row icon chip, the tel: link color, and the primary button all agree — while Customers gets cobalt throughout. The supplier form field is labeled "Who do you ask for" to match what the list later prints, which is a label written backward from its own output. Customer filter chips are phrased as decisions ("Not ordered in a year," "Has an open order"), not categories. This reads as built against this business's actual Tuesday, not a template with labels swapped.

**Deterministic scan:** `impeccable detect --json` against all six in-scope files returned exit 0, `[]` — zero findings, zero advisories, confirmed genuine (no ignore rules, no inline suppressions, cross-checked with an unrelated file to confirm the binary isn't silently failing).

**Visual overlays:** The skill's generic overlay-injection flow assumes a static, unauthenticated page; this app sits behind a Supabase sign-in gate, so no reliable user-visible overlay was produced. Both sub-agents used the repo's own Playwright + stub-Supabase harness instead and captured real screenshots at desktop, tablet, and phone widths, including the phone "More" menu and a scrolled-to-bottom capture — a live reproduction of the empty-state bug below was captured this way, not inferred from source.

## Overall Impression

This is a well-built, product-specific system with a real accent-color language and disciplined destructive-action handling — the strongest part of the scope. The gap is smaller and more structural than stylistic: a filtered-to-zero list lies about why it's empty, and the one labeled "Help" affordance in the whole app is invisible on the exact device class (phone, ≤640px) the product's own design principles center. Both are fixable without touching the visual language at all.

## What's Working

1. **The clay/cobalt split is a real information channel.** It answers "which side of the business is this" before a word is read, held consistently down to the tel: link color — the kind of detail a category-interchangeable dashboard wouldn't bother with.
2. **The supplier removal flow executes the house destructive-confirmation rule correctly, end to end** — names the record, states what goes and what survives, offers "just leave it" before the confirm dialog even opens. Verified live.
3. **The responsive chrome holds its own rules under real inspection.** The 84px icon rail keeps a word under every icon with zero truncation at 900px, and Assessment B confirmed zero console errors and zero horizontal overflow at 390px across every screen and state tested, including the empty state.

## Priority Issues

**[P1] A zero-result filter reports "No customers yet" — a false empty-database state**
- **What:** Selecting a chip (Customers) or area filter (Suppliers) that narrows a real, populated list to zero results renders the same copy and CTA as a genuinely empty database. Confirmed in code: `EmptyState`'s `isSearch` flag (`PageStates.jsx`) only inspects the text query — `CustomerListPage.jsx` and `SupplierListPage.jsx` both pass `query={query.trim()}`, so a chip- or dropdown-only filter reaching zero rows leaves `isSearch` false and shows "No customers/suppliers yet" plus an "Add a…" button.
- **Why it matters:** It contradicts information already on screen (a chip's own "0" count, printed before it's even clicked) and tells a low-confidence user their data is gone. This is exactly the false-alarm PRODUCT.md's "danger is legible" principle warns against — except triggered by an ordinary filter click, not a real destructive action.
- **Fix:** Give `EmptyState` a third branch — filtered-to-zero (chip/dropdown active, no text query) — distinct from both "true empty" and "search miss," with copy like "Nothing matches this filter" and a "Show everyone" action instead of "Add a…".
- **Suggested command:** `/impeccable harden`

**[P1] Help is a static deflection, and doesn't exist at all on phone**
- **What:** The header's Help button carries `hidden sm:inline-flex` (`Shell.jsx`) — `sm` is a real 640px breakpoint in this project's Tailwind config, so Help is absent below it, confirmed by screenshot at 390px. Where visible, it fires a fixed toast — "Ask whoever set this up for you" — with no per-screen content.
- **Why it matters:** PRODUCT.md names low computer-confidence as the binding constraint and phone/tablet as the floor-staff device class. The one labeled help affordance disappears on exactly the device most likely used by the people who need it most, and offers nothing useful even when present.
- **Fix:** Give Help a permanent home at every breakpoint (the phone "More" menu or account chip are both already-built candidates), and give it screen-aware content instead of one static deflection line.
- **Suggested command:** `/impeccable onboard`

**[P2] The phone tab bar's four direct slots are role-blind**
- **What:** `BottomTabs` takes the first four `NAV_TREE` entries (Dashboard, Products, Orders, Deliveries) as direct tabs for every role; Customers and Suppliers always fall into "More," regardless of who's signed in.
- **Why it matters:** Sales Staff's stated job is "orders and customer follow-ups" — Customers is core to their day, yet costs two taps on their phone, while Deliveries (not their job) keeps a permanent direct slot.
- **Fix:** Let the direct four be role-aware — bias toward the sections a role's own `views` weight most heavily — rather than a static slice of `NAV_TREE`'s fixed order.
- **Suggested command:** `/impeccable adapt`

**[P2] The sticky "Add" bar and tab bar overlap the pager on phone**
- **What:** Verified against the actual CSS: `StickyCta` sits at `bottom-14` (56px, right above the 56px `BottomTabs`) with its own ~24px of padding around a button, so the two fixed elements together occupy roughly the bottom 130-140px of the viewport. `<main>`'s phone-width bottom padding is `pb-24` (96px) — short of what's needed to clear them.
- **Why it matters:** The pager is the only way to reach further records past one page; on a longer supplier or customer list, a touch user scrolled to the bottom can't reliably tap it.
- **Fix:** Increase `<main>`'s phone-width bottom padding to clear the combined sticky-CTA + tab-bar footprint with margin.
- **Suggested command:** `/impeccable adapt`

**[P2] Customers' filter row asks too much at once, and can't express a compound question**
- **What:** 7 mutually-exclusive chips plus 2 dropdowns plus search render simultaneously with no subgrouping; because the chips are single-select, "Businesses" and "Has an open order" can't be applied together.
- **Why it matters:** Fails this same methodology's own working-memory guidance (chunking, ≤4 minimal choices), and blocks a genuinely common daily question ("which business accounts still owe us goods") the UI has no way to represent.
- **Fix:** Group the chips visually (who they are vs. what to do about them), and reconsider whether every one needs to be mutually exclusive.
- **Suggested command:** `/impeccable layout`

## Persona Red Flags

**Jordan (Confused First-Timer)** — most relevant given PRODUCT.md's explicit low-computer-confidence constraint, likely on a phone per the product's own stated operating context.
- Taps "Regulars" on Customers and is told "No customers yet" — the exact moment that would make Jordan believe they broke something, when they filtered a real list to nothing.
- Taps "Help" hoping for guidance and gets "Ask whoever set this up for you" — except on their phone there is no Help button to tap at all.
- On a tablet-width (900px) Suppliers table, the "Open" action column scrolls off the right edge with no visible hint the table can scroll sideways — Jordan has no reason to suspect a row even has an action.

**Sam (Accessibility-Dependent User)**
- Focus rings are genuinely solid — verified live across inputs, dropdowns, table links, sidebar, and header controls, a real strength, not a hint.
- `FilterChips` applies `role="radiogroup"`/`role="radio"` but each chip is an independently focusable native button with no arrow-key roving-tabindex — a screen reader announces radiogroup semantics implying arrow-key navigation the component doesn't deliver, landing Sam with 7 extra Tab stops instead.

**Alex (Impatient Power User)**
- No bulk actions on either list.
- No click-to-sort table columns; a separate "Sort" dropdown stands in.
- Can't combine two real filter dimensions on Customers because the chips are exclusive — has to run two passes and reconcile by memory.

## Minor Observations

- Two controls share the identical accessible name "Clear the search box" simultaneously when the empty-search state is showing — the inline X in the search field and the separate empty-state button. Not wrong individually, but a naming collision worth a distinct label on one of them (e.g. "Clear search").
- The Suppliers table's "Open" column can scroll off-screen at tablet width (900px) with no scroll affordance — technically not the banned "sideways scroll on a phone," but a real discoverability gap.
- The header's unfiltered-total count ("2 suppliers") is deliberate by design and works as documented; worth re-confirming it stays legible once the empty-state fix above lands nearby.
- `Table`'s shared default `minWidth` is 860px; Suppliers overrides it to 820px with no comment explaining why.
- One screenshot caught the sidebar's `transition duration-150` mid-flight (old and new nav item both highlighted); a later capture of the same screen was correct — a capture-timing artifact, not a stuck state.

## Questions to Consider

1. If a filter can legitimately narrow a real list to zero — the chip even prints "0" before it's clicked — why does the empty state borrow the same copy as a genuinely empty database?
2. Suppliers and Customers sit one entry apart in the same "People" nav group but use two different filter mechanics — is that principled variation the content deserves, or drift the shared vocabulary should absorb?
3. The phone tab bar's four direct slots are fixed by list order, not by what the signed-in role actually does all day — for Sales Staff, is a permanent Deliveries tab pulling its weight over a buried Customers tab?
