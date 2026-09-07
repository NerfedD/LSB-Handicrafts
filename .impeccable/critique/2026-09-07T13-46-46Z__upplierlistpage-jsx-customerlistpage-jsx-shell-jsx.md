---
target: Suppliers, Customers + phone nav
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Edd Vincent Patnugot\\OneDrive\\Documents\\New folder\\LSB-Handicrafts\\Suppliers, Customers + phone nav (SupplierListPage.jsx, CustomerListPage.jsx, Shell.jsx)"
timestamp: 2026-09-07T13-46-46Z
slug: upplierlistpage-jsx-customerlistpage-jsx-shell-jsx
---
# LSB Handicrafts — Design Critique #2: Suppliers, Customers, Phone Nav

Method: dual-agent (A: independent design-review sub-agent · B: detector + browser-evidence sub-agent, run in isolation, no knowledge of the prior critique run)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | Loading/empty/error states and live-region status text are solid; docked for the sticky CTA silently vanishing with no equivalent until 834px+. |
| 2 | Match Between System and Real World | 4/4 | "Ask for Ramon," "Nothing here matches the filter you have on right now" — plain, task-native throughout. |
| 3 | User Control and Freedom | 3/4 | Search-clear focus restoration and "Clear filters"/"Show everyone" work well; the tablet table-scroll has zero escape/discovery affordance. |
| 4 | Consistency and Standards | 2/4 | The shared filter/list vocabulary genuinely holds — but a confirmed bug makes every nav item announce its name twice, baked into the shared nav component so it repeats everywhere. |
| 5 | Error Prevention | 3/4 | Destructive delete flow is exemplary; no prevention issue found in the two list screens themselves. |
| 6 | Recognition Rather Than Recall | 3/4 | Chip counts from the unfiltered set, icon+word pairing everywhere; docked slightly for rail/tab truncation depending on inferring the full word. |
| 7 | Flexibility and Efficiency of Use | 2/4 | No bulk actions, no shortcuts beyond native tab order — a real 2, not a shrug given the low-power-user audience. |
| 8 | Aesthetic and Minimalist Design | 4/4 | Clean, restrained, one accent per screen held faithfully. |
| 9 | Error Recovery | 3/4 | `ErrorState`/`EmptyState` copy is exemplary; not a 4 only because live network-failure rendering wasn't verified in-browser this round. |
| 10 | Help and Documentation | 2/4 | Help exists and is reachable everywhere (confirmed), but it's one generic entry point, not scoped to the current screen. |
| **Total** | | **29/40** | **Good (73%)** |

A different independent reviewer than last time scored this run — direct comparison to the prior 31/40 isn't strictly apples-to-apples on methodology. What matters more: Assessment B's browser evidence directly confirms both fixes from the last round now work correctly.

## Design Specificity Verdict

**Design review:** Authored for this product, not a reskin — the Suppliers/Customers table-vs-cards split is argued from how each list is actually used, not decoration; the empty-state taxonomy's code comments document real prior failures being deliberately engineered away. Specificity is strongest in copy and structure; the visual chrome itself is conventional admin-table language, appropriate for an Operate surface but meaning the product's character lives in words more than in anything visually distinctive.

**Deterministic scan:** `impeccable detect --json` against all six files: exit 0, `[]` — zero findings, cross-checked in both PowerShell and Git Bash.

**Visual overlays:** No reliable overlay again this round (auth-gated SPA); both sub-agents used the repo's Playwright + stub-Supabase harness and captured live screenshots and DOM/accessibility-tree evidence instead.

## What's Working — confirmed fixes from the last round

Both P1s from the previous critique are verified fixed, live:
- **Filtered-to-zero honesty**: Assessment B independently reproduced the Customers "Regulars" chip (0 matches, no search text) and confirmed the empty state now reads "Nothing matches that filter" / "Show everyone" — not the old false "No customers yet."
- **Help reachability**: Assessment B confirmed the header Help button is (as designed) invisible below 640px, and the account-menu "Help" item is visible and reachable at 390px.

Also holding up well: the destructive-delete flow (still the standout), the empty-state taxonomy's reasoning, and the one-accent-per-screen rule (clay/cobalt) confirmed live in fresh screenshots.

## Priority Issues

**[P1] Every nav item announces its name twice on the tablet rail and phone tab bar** — verified in code, confirmed programmatically by Assessment B via Playwright's accessible-name computation.
- **What:** `NavItem` (`Shell.jsx:299-301`) renders a visible short-label span plus an `sr-only desk:hidden` full-label span that stays in the accessibility tree at rail width — the button's computed accessible name becomes e.g. "Dashboard Dashboard." `BottomTabs`' direct phone tabs (`Shell.jsx:615-618`) do the same unconditionally, and the "More" button added last round follows the identical (pre-existing) convention, so it also reads "More More sections."
- **Why it matters:** This is the primary navigation, on the two device classes this product explicitly targets (tablet floor use, phone deliveries), for a screen-reader or voice-control user — every single destination reads twice.
- **Fix:** Drop the redundant `sr-only` span; give the button (or its visible short-label span) an `aria-label` set to the full `item.label` instead of concurrently exposing both.
- **Suggested command:** `/impeccable harden`

**[P1] Suppliers' table clips its only row action off-screen at tablet width, with no scroll cue** — verified: table `minWidth={820}` vs. measured ~766px available width in the 834-1279px icon-rail band.
- **What:** At 900px viewport, `SupplierListPage.jsx`'s table is wider than its card, forcing an internal horizontal scroll to reach "Open" — with zero visible scrollbar, fade edge, or hint that more content exists sideways.
- **Why it matters:** "Open" is the only interactive control in the row. A low-computer-confidence user on a shop tablet has no reason to suspect a sideways drag inside a card.
- **Fix:** Lower `minWidth` to fit the tablet band, add a scroll-edge affordance, or shift to the card layout slightly earlier than 834px.
- **Suggested command:** `/impeccable harden`

**[P2] Customers has 3 live filter axes (7 chips + area + sort) and no `ActiveFilterSummary`, unlike its sibling**
- **What:** Suppliers and the deliveries board both use `ActiveFilterSummary` to state a combined filter in one sentence; Customers doesn't, despite having more simultaneous filter dimensions.
- **Fix:** Wire the already-imported `ActiveFilterSummary` into `CustomerListPage.jsx`, matching the existing pattern.
- **Suggested command:** `/impeccable clarify`

**[P2] The "is this list filtered" convention diverges between the two screens**
- **What:** Suppliers checks `area !== "any"`; Customers checks `chip !== "all" || area !== "any"` — both individually correct today, but nothing stops the next list screen from picking a third convention.
- **Fix:** Extract a shared "is anything besides search narrowing this list" helper both screens call.
- **Suggested command:** `/impeccable audit`

**[P3] The rail/tab short-label strategy (`label.split(" ")[0]`) is fragile for future nav items**
- **What:** Works for the current seven items by coincidence of word order; a future entry like "Activity log" would silently truncate to "Activity" with no one deciding that was right.
- **Fix:** Add an explicit, overridable `shortLabel` field to the nav tree data.
- **Suggested command:** `/impeccable document`

## Persona Red Flags

**Sam (Accessibility-Dependent User)** — the duplicated-name bug (P1) is the headline: every nav destination stutters on every tap for a VoiceOver/NVDA user. The tablet table-clip (P1) also costs a low-vision keyboard user visual track of focus once it scrolls off-view.

**Jordan (Confused First-Timer)** — the zero-result empty state is exactly right now (confirmed live). But 7 chips + 2 dropdowns on Customers with no "start here" signal, and the undiscoverable tablet scroll-to-"Open," both land badly for this persona on the exact devices the product targets.

**Alex (Impatient Power User)** — no bulk actions, no shortcuts anywhere; reasonable given this audience skews low-confidence, but worth naming since Heuristic 7 scored a 2.

## Minor Observations

- A defensive `onClick={(e) => e.stopPropagation()}` on the supplier phone-card's tel: link (`SupplierListPage.jsx`) implies a card-level click handler that doesn't actually exist — harmless dead code, worth removing.
- `CustomerListPage.jsx`'s grid has no explicit `tab:` column step between `sm` and `desk` — not confirmed broken, but worth a visual check given the confirmed table issue on the same breakpoint band.
- Assessment B flagged a possible transient paint/compositing desync in `FilterChips`' selected-state highlight (stale highlight briefly visible in 3/4 screenshot attempts specifically when navigating Suppliers→Customers) — DOM state (`aria-checked`, computed styles) was correct in every direct check, so this reads as a Playwright screenshot-timing artifact rather than a confirmed defect. Flagged for awareness, not action.

## Questions to Consider

1. Suppliers stays a table while Customers stays cards at every width — is that split legible to staff as intentional, or does it read as unexplained inconsistency the first time someone moves between the two?
2. If working memory is the design's stated enemy, why does Customers carry 3 live filter axes when its closest sibling gets by on 2?
3. Both confirmed P1s live in the same 834-1000px tablet-rail band — is that seam between two well-tested layouts getting the same attention as full desktop and full phone?
