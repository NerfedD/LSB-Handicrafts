# Whole-website testing and data integrity

Use this runbook to test the complete LSB Handicrafts workflow, not just whether pages load. A passing run proves allowed actions persist, forbidden actions change nothing, and stock, money and history agree after reload. The checklist below is acceptance coverage to execute; its presence does **not** mean it already has automated coverage or has passed.

Business expectations: [workflows.md](workflows.md). Database setup: [database.md](database.md). Check the current `src/utils/navigation.js`, `src/utils/permissions.js` and database enforcement when features change; report disagreements rather than silently adopting whichever result passes.

## Run scope and preparation

1. Record the commit, local changes, date/time (Asia/Manila), app URL, browser, database environment and tester. Use a unique run label such as `QA-20260930-01` for fixture names; respect individual code formats.
2. Use Node.js 22+ and the lockfile dependencies (`npm ci` if dependencies are missing). The browser suite expects installed Microsoft Edge. Run commands from the repository root.
3. Local unit/database and stubbed browser tests need no hosted staff credentials. Hosted acceptance needs a confirmed disposable/staging project, matching schema/migrations and deployed Edge Functions. Confirm the project's identity without printing keys or passwords. Never treat a configured `.env` as proof it points to staging.
4. Prepare one active account per role, plus a disposable blocked account, two independent browser sessions, a customer, supplier, category, two products (including a pack), and two materials. Include empty, stocked, reserved, archived and historically referenced records. Use synthetic contact details and a tester-controlled inbox for recovery mail.
5. Before hosted writes, save the read-only integrity report and relevant starting balances. Maintain a fixture register of IDs and dependencies. Do not reset, seed, migrate, delete real records or change Auth settings as an incidental testing step.
6. If staging, credentials, email access or browser tooling is unavailable, continue independent local checks and mark the affected cases **BLOCKED**. Never substitute a stub result for hosted evidence.

## Execution order

1. Run the automated checks below, recording each exit code and summary separately.
2. Walk the shared UI and CRUD matrix, including reload and cancellation checks.
3. Run the numerical journeys and integrity checks, then permissions and concurrent-session cases on staging.
4. Repeat the integrity report, account for fixture changes, and write the report using the template below.
5. Clean up only the run's disposable fixtures through supported workflows. Keep referenced records archived/cancelled and retain their history. Record intentional leftovers; cleanup must not bypass business rules.

## Automated checks

```bash
npm run lint          # ESLint
npm test              # unit tests + database tests (Vitest)
npm run build         # production build
npx --no-install playwright test --workers=1   # browser tests (installed Microsoft Edge)
```

| Suite | Where | What it proves | What it cannot |
| --- | --- | --- | --- |
| Unit | `src/utils/*.test.js` | Field rules shared by the forms (`validation.test.js`: whole numbers, measurements, money, codes, units, local "today"), stock arithmetic (partial deliveries, returns, legacy orders), order totals, permissions table, customer totals and loyalty maths, what the reorder point puts on the make list, routing, phone rules, retry identity. | Anything a screen does. |
| Database | `src/utils/*Database.test.js`, `schemaInstall.test.js`, `qaAudit.test.js` | The **real** `supabase/schema.sql` running in PGlite (in-process Postgres) with Supabase's roles and JWT functions stubbed (`src/test/database.js`): fresh install and re-run, every migration mirrored, stock movements, damage and count corrections, undoing a damage record, supplier receipts, correcting and removing a raw material, replacements, refund validation, cancelling, archiving, role policies, loyalty validation, audit triggers, stale-save refusal; material codes and units, measurement limits, promised dates, used-up and archived materials, categories and product photos (`controlsDatabase.test.js`). | Lock contention between separate connections (PGlite has one), hosted Auth, real network grants. |
| Browser | `tests/*.spec.js` | Every screen end to end against a stubbed Supabase (`tests/stubSupabase.js`, fixtures in `tests/fixtures.js`), including lost responses, retries, stale saves, roles, phone widths and print; `inventory-controls.spec.js` walks purchasing, raw materials, production, categories and photos (upload, reload, replace, remove) and the checks shown beside each field. | The real database: the stub applies the same rules in JavaScript. |

Browser tests start the dev server on port 5199 themselves and run one worker at a time: the stub and sign-in fixtures are not built to be shared between parallel workers. Check that any existing server on that port belongs to this checkout, because the config reuses it. `npx playwright install` is not needed; the config drives installed Edge (`channel: "msedge"`). A different browser requires an explicitly configured run and must be recorded in the report.

For a browser run with an HTML report:

```bash
npx --no-install playwright test --workers=1 --reporter=list,html
npx --no-install playwright show-report
```

Failure traces/screenshots are in `test-results/`; the optional HTML report is in `playwright-report/`. Copy evidence needed for a report to a separate run folder before another browser run overwrites it. Redact credentials, tokens and personal information from all evidence.

### Existing test entry points

Use these to locate coverage and reproduce failures; focused runs do not replace the full suite.

| Area | Existing files |
| --- | --- |
| Navigation, sessions, permissions, shared UI | `tests/smoke.spec.js`, `tests/remediation.spec.js`, `src/utils/routes.test.js`, `src/utils/permissions.test.js`, `src/utils/permissionsDatabase.test.js` |
| Catalogue, materials, categories, photos, field validation | `tests/inventory-controls.spec.js`, `src/utils/controlsDatabase.test.js`, `src/utils/validation.test.js` |
| Stock, damage, returns, loyalty | `tests/stock-returns-loyalty.spec.js`, `src/utils/stockLedger.test.js`, `src/utils/stockDatabase.test.js`, `src/utils/customers.test.js` |
| Orders, retries, stale records | `tests/bug-report.spec.js`, `tests/qa-audit.spec.js`, `src/utils/orders.test.js`, `src/utils/orderDatabase.test.js`, `src/utils/commands.test.js`, `src/utils/storageManager.test.js`, `src/utils/qaAudit.test.js` |
| Purchasing, batches, reports | `tests/production.spec.js`, `src/utils/production.test.js`, `src/utils/makeList.test.js`, `src/utils/schemaInstall.test.js` |
| Phone input, small screens, print, themes/motion | `tests/phone.spec.js`, `tests/slip.spec.js`, `tests/motion.themes.spec.js`, `src/utils/phone.test.js` |

## Shared website functionality

Run each applicable check on every list, detail, form and dialog, using both populated and empty data.

| ID | Exercise | Expected result |
| --- | --- | --- |
| UI-01 | Open every view in `NAV_TREE` and `ACCOUNT_VIEWS`, including dashboard variants, production report, staff directory and activity log. Follow each dashboard alert and primary action. | Correct screen, selected navigation and record; counts agree with the corresponding filtered lists; no stale selection from a previous form. |
| UI-02 | Search, combine/clear filters, change tabs, paginate or load more where offered; test no matches and old records. | Correct results without duplicates or missing eligible records. Customer totals cover full history, even beyond the recent 120-day order window; activity can load beyond its initial 200 entries. |
| UI-03 | Reload list/detail/edit URLs; use Back/Forward; open valid deep links, missing IDs and malformed paths. | Valid records and supported query state survive; invalid/missing records give a useful state, never another record's data. Login redirect follows the application's routing contract. |
| UI-04 | Cancel and close each form/confirmation, then reopen it; submit invalid and valid values. | Cancellation performs no write; errors appear beside fields, preserve inputs and permit correction; successful saves survive full reload and a second session. |
| UI-05 | Simulate slow/failed reads and writes, then retry; inspect browser console and network errors. | Loading, empty and error states are distinct; no false success, duplicate write or lost form input; failed optimistic updates roll back. Unexpected errors are reported. |
| UI-06 | Use keyboard only, Tab/Shift+Tab, Enter and Escape; open/close dialogs; inspect labels, focus, errors and contrast. | Actions work without a mouse, focus is visible and returns sensibly, dialogs contain focus, errors are understandable. Record manual accessibility results separately from any automated scan. |
| UI-07 | Repeat main workflows at 1440×960, tablet width and 390×844 (also a narrow 320px viewport), at 200% zoom, in supported themes and reduced motion. | No clipped essential controls or page-wide overflow; readable text, usable touch controls, phone navigation and preserved confirmation feedback. |
| UI-08 | Print an order before/after price correction and refund, including long names and multiple lines. | Slip shows current quantities, prices, discount/refund totals and balance; app navigation is hidden in print; no clipped content. Default fixture fits A4; long content paginates legibly. |
| UI-09 | Leave a visible screen open while session B edits data; switch away and return. | Refresh follows the current visible-screen polling rules (about one minute; returning refreshes data older than 30 seconds), without losing unsaved input. No live-push behavior is assumed. |

## CRUD and lifecycle acceptance matrix

For **every row**, test allowed and denied roles, cancel, invalid input, failed save/retry, persisted readback after reload, and related history. CRUD means create/read/update/delete where supported; archive, cancel or reverse are the expected alternatives where permanent deletion is forbidden. Do not invent a delete action to satisfy this checklist.

| ID / area | Create and read | Update | Delete / lifecycle and integrity expectations |
| --- | --- | --- | --- |
| CRUD-01 Products & stock | Add each supported product type, dimensions, price, pack size, category and opening count; find it in list/detail/order picker. | Change allowed details and reorder point; catalogue and inventory stay linked; editing details alone does not move stock. | Admin removes an unreferenced product or archives a referenced one; waiting-order references block removal. Restore archived products. History remains readable; no orphan catalogue/stock half. |
| CRUD-02 Categories | Add a category; reject case/spacing duplicates. | Rename and verify all linked products use the canonical spelling. | Remove an empty category; reject removal while products reference it. |
| CRUD-03 Product photos | Upload an image and reload list/detail/form. | Replace image; cancel replacement; simulate product save succeeding but image save failing, then retry. | Remove photo and reload; cancelled removal retains it; retry does not duplicate product or stock. Product deletion removes its image. |
| CRUD-04 Stock actions | Record damage with a valid reason; inspect movement and actor. | Correct physical count with a reason; reject stale counts; reject damage beyond stock or invalid quantities. | Undo one damage entry once; second undo fails with no change. Original and reversal remain visible; ordinary users cannot edit/delete movements. |
| CRUD-05 Raw materials | Add with manual/automatic code, unit, measurements and threshold; test needs-ordering, out-of-stock and archived filters. | Correct all supported details, including code/unit; enforce uniqueness and revision; details do not alter stock or lots. | Admin deletes only unreferenced empty material, otherwise archives; in-transit receipts or active batches block removal. Restore; archived material is absent from new-order/batch/recipe choices. |
| CRUD-06 Suppliers | Add supplier and contact details; search/detail and supplied-material history. | Edit details, validate contact fields and stale saves. | Admin deletes unused supplier; purchase history prevents deletion and remains intact. |
| CRUD-07 Purchasing & claims | Order materials; verify quantity × unit price and no stock increase. Receive normal, short, excess and damaged deliveries with receipt reference. | Edit before dispatch where permitted; progress supported states, correct notes/dates and settle a claim. | Cancel only before it leaves supplier; received order cannot be received again. Usable arrival creates one lot; claim settlement changes neither receipt quantities nor stock. |
| CRUD-08 Production & recipes | Create/update a recipe through supported controls; start a batch, inspect make-list priority and material reservation. | Move Planned → In production → Quality check → Completed; record actual material used, good output and defects; recipe scales required material. | Cancel a planned batch and release reservations. Completion applies material consumption, product yield and defects atomically once. No unsupported history deletion. Check manager-only report and weighted yield. |
| CRUD-09 Customers | Add with valid phone/contact data; search and open history, regulars and lapsed-customer lists. | Rename/edit customer; linked orders retain identity and whole-history totals; reject stale edits. | Admin deletes only without waiting orders; historical orders and name snapshots remain. Contact visibility follows role rules. |
| CRUD-10 Loyalty | Enable/disable rules; set qualifying finished-order count and percentage; inspect eligible/ineligible saved customers. | Change rules; new order offers only eligible reward; backend rejects excess/ineligible discount and unauthorized price fix. | Turning reward off prevents new rewards without rewriting old order discounts. Percent maximum is 50%; discount applies to items under business rules. |
| CRUD-11 Orders | Create catalogue, agreed-price, cut-to-size, custom and mixed orders; with/without saved customer and delivery. Check totals, stock units and detail/print. | Manager edits an untouched order; finish, cancel and reopen where allowed; reject stale or invalid transitions. | Orders are never deleted. Cancellation removes only unsent delivery and releases appropriate reservation/commitment. Order save followed by delivery failure retries the same order. |
| CRUD-12 Deliveries | Create linked delivery; check every stage of the five-stage board and detail. | Assign driver, address, notes and promised date; dispatch, record full/short arrival and follow-up; retry and reload. | Only unsent deliveries can be removed by managers. Dispatch deducts only goods sent, once; follow-up tracks remainder with no second charge and correct parent/order links. |
| CRUD-13 Refunds & replacements | On eligible orders, refund part/all and replace with same/different product; test sellable and discarded returns. | Reject excess return quantity, excess refund, unavailable replacement, cancelled order and forged history/actor. | Use append-only return history; no silent deletion/edit. Full refund calls order off, partial refund preserves status; replacement changes neither money nor order status. |
| CRUD-14 Staff & directory | Admin creates disposable staff account; sign in in session B; inspect directory and role. | Edit details/role, block/unblock; check stale save and provisioning failure/retry. | Admin cannot delete owner/self. Delete disposable user and verify login fails and existing session loses protected application access; history retains actor name. |
| CRUD-15 Profile & password | View own profile and correct account identity. | Edit profile/contact details, change password; test validation, reload, old/new credentials in a fresh session. | Sign out and idle expiry remove protected access. No ordinary user can edit another user's role through profile requests. |
| CRUD-16 Activity & stock history | Successful audited actions show correct actor, time, action and record; load/filter available history. | Database supplies audit identity; failed actions leave no partial business mutation. | Direct insert/update/delete attempts from normal sessions cannot forge or erase activity/movements. Document intended login-audit deduplication separately from business-action counts. |

### Validation boundaries

For relevant forms and direct staging requests, test blank/whitespace, zero, negative, fractional whole counts, malformed numeric text, limit, just-over-limit, duplicate normalized values and long text. Rejected input must leave **all related rows and balances unchanged**.

- Money: two decimals maximum; purchasing unit price 0–100,000,000. Check exact totals and rounding against integer-cent calculations, including discounts and refunds.
- Product sizes: positive and within the applicable 240-inch or 200-foot limit; quantities/pack sizes use valid whole units. Distinguish pieces from selling packs.
- Material codes: optional generated code or 2–40 characters under the current letter/digit/single-hyphen rule, case-insensitive uniqueness, uppercase storage. Test generated-code uniqueness after removal. Units: supported choice or valid custom unit, maximum 24 characters, lowercase storage. Valid punctuation in names must survive.
- Phone: accepted Philippine mobile formats normalize correctly (including supported `+63` input); short, long, alphabetic and landline inputs fail under current field rules.
- Promised dates: yesterday/today/tomorrow in Asia/Manila, including a device in another timezone; unchanged past dates permit unrelated edits, newly entered past dates fail.
- Security text: enter harmless HTML/script-like text in names/notes and confirm it renders as text, not executable markup. Check photo type/size failures for useful errors and preserved prior photo.

## Numerical end-to-end journeys

Use fresh fixtures for each journey, no fees/discounts unless specified, and no unrelated orders on their products. At each step compare UI, persisted records and movement history; repeat the action's request where indicated to prove exactly-once effects.

| ID | Steps | Expected balances |
| --- | --- | --- |
| FLOW-01 Sale, refund, replacement | Open product P with 20 selling units at ₱100. Order 4; finish it. Refund 1 sellable unit for ₱100. Replace 1 further unit, discarding the returned unit and sending 1 P. | Pending: shelf 20, reserved 4, free 16. Finished: shelf 16, reserved 0, total ₱400. Refund: shelf 17, refunded ₱100, net after refund ₱300. Replacement: shelf 16; total/refund/status unchanged. Each stock change appears once. |
| FLOW-02 Short delivery | Fresh P shelf 20; order 10 at ₱100. Send 6 and record short arrival, then send the remaining 4 on its follow-up and finish. | First trip shelf 14, outstanding/reserved 4, free 10. Final shelf 10, outstanding/reserved 0. Combined dispatched quantity 10; order total stays ₱1,000; no duplicate charge, deduction or follow-up on retry. |
| FLOW-03 Supplier to production | Fresh material M at 0 and P at 0, pack size 1. Order 10 M at ₱50; receive 10 with 2 damaged. Complete a valid batch consuming 3 M and producing 5 good P and 1 defect. | Ordering adds no stock; ordered cost ₱500. Receipt adds 8 M to one lot and flags claim. Completion leaves M/lot balance 5 and P shelf 5; report records 1 defect and yield 5/6 (83.33% at two decimals). Retries leave balances unchanged. |
| FLOW-04 Damage and count | Fresh P shelf 10; damage 2, undo damage, attempt second undo, then count-correct to 9 with reason. Repeat on a material. | 10 → 8 → 10 → rejected/no change → 9. Separate original/reversal/correction entries. Material lot sums match each balance, including reversal/correction lots. |
| FLOW-05 Cancel and reopen | Fresh P shelf 10; create waiting order for 3, cancel it. With a separate fresh order for 3, finish, reopen, then finish again. | Cancel waiting: shelf stays 10 and reservation returns to 0. Finish/reopen/finish: shelf 7 → 10 → 7, with reservations restored only while waiting. Replaying a request never applies an extra delta. |
| FLOW-06 Loyalty and history | Set fixture rule to 3 finished orders and 10%. Give saved customer 2 then 3 qualifying finished orders. Create eligible 2 × ₱100 order without extras; disable reward afterward. | No reward at 2; at 3 eligible order discount ₱20 and total ₱180. Disabling does not change that order. Reload and compare customer totals with all persisted qualifying orders, including old records and refunds under current business rules. |

## Data-integrity verification

Run `supabase/integrity_check.sql` read-only before and after hosted acceptance. Save **every check name and count**, even zero counts. The file includes commented repair examples: do not execute them during an audit.

| ID | Invariant and verification |
| --- | --- |
| DATA-01 | One catalogue/stock pair per normalized code, no unexpected orphan product, stock, image or category reference. Active order JSON lines point to existing stock; custom non-stock lines are exempt. |
| DATA-02 | Product balance equals baseline plus this run's signed movement deltas; each movement's resulting count agrees with sequence. Existing legacy stock may predate the ledger, so do not assume summing all movements from zero is valid. |
| DATA-03 | Reservation equals eligible pending outstanding units; free stock is shelf minus reservation. For modern stock lines, outstanding = max(0, stockUnits − committedUnits − voidedUnits); counters are nonnegative and committed + voided does not exceed ordered units. Test legacy records with the compatibility rules in `stockLedger.js`, not an invented zero default. |
| DATA-04 | Material stock equals sum of lot remaining quantities, no negative lots; consumption is oldest-lot-first. Batch reservations do not physically consume lots; completion consumes exactly actual use and cancellation releases reservation. Transfers decrease selling stock and increase material stock by matching units, and refuse reserved selling stock. |
| DATA-05 | Refund total equals sum of refund-history amounts and never exceeds order total; returned/restocked units cannot exceed eligible delivered units. Replacements preserve financial totals and account for both outgoing and sellable incoming stock. |
| DATA-06 | Delivery/order/parent links are valid; follow-up quantities reconcile with original outstanding units. A finished journey has no unaccounted goods or duplicate stock commit. Historical display text is not the only linkage. |
| DATA-07 | Receipt usable = arrived − damaged; one receipt per supplier order and one stock application per receipt. Batch completion records good selling packs, defects and actual lot use together; claims do not alter stock. |
| DATA-08 | Archive/delete rules preserve referenced history and snapshots. Customer deletion nulls allowed links while retaining order identity text; staff removal does not erase historical actors. No cascading loss of orders or ledger history. |
| DATA-09 | Customer stats and dashboard/report totals reconcile with source rows using documented status/refund rules; weighted yield uses total good ÷ total output, not mean batch percentages. Include more history than the UI initially loads. |
| DATA-10 | Successful updates advance supported revisions; stale updates do not overwrite newer values. Failed commands leave stock, lots, financial values and history unchanged; replayed successful requests do not duplicate effects. |

The SQL report is a starting point, not proof of all ten invariants: add targeted **read-only** reconciliation queries based on the current schema and run's fixture IDs. Keep queries and before/after values as evidence. Permission checks must use real ordinary-user sessions; an administrator SQL-editor query cannot prove RLS enforcement.

On clean fixtures, every mandatory anomaly count should be zero. On an existing staging dataset, distinguish pre-existing defects from new ones and record affected IDs and impact. Historical unlinked orders and optional customer-name links may require review rather than indicate new corruption. Do not ignore pre-existing harmful anomalies merely because their counts stayed unchanged. A SQL error is a failed/blocked check, never a clean report.

## Roles, authentication and hosted security

Use the [roles table](workflows.md#roles) as the expected action matrix. Run each restricted action as an allowed and a denied role; record role-by-case results. Also test anonymous, blocked and deleted users.

| ID | Hosted check | Expected result |
| --- | --- | --- |
| AUTH-01 | Correct/incorrect username and password, unknown user, blocked user, reload with session, sign-out, idle timeout and expired session. | Intended sign-in works; denied login fails clearly without revealing credentials; protected pages/data cannot be retrieved without active access. |
| AUTH-02 | Forgot/reset password with tester-controlled inbox; valid, expired and reused recovery links; password mismatch/length; fresh login afterward. | Valid recovery updates password; invalid recovery cannot change credentials. If inbox unavailable, mark BLOCKED. |
| AUTH-03 | Open restricted deep links and invoke corresponding API/RPC requests as each role, including forged role/actor fields. | Both page gate and backend enforce permissions; a hidden button alone is insufficient. Denied mutation leaves data unchanged. |
| AUTH-04 | Block, downgrade or delete a disposable account while its second session remains open, then read/write using its existing access token. | Backend enforces current staff access even before UI catches up; invalid session cannot keep acting. Auth user deletion alone is not evidence that an old token lost application access. |
| AUTH-05 | Attempt direct stock writes, audit/movement edits and private request-log reads using ordinary/anonymous sessions. | No unauthorized data returned or changed; permission error or zero affected rows is checked against persisted state. No service-role credential is used to claim permission coverage. |
| AUTH-06 | Exercise deployed `sign-in`, `admin-accounts` and `delete-staff-auth-user`, including unauthorized callers and partial provisioning failure. | Username resolution, confirmed-user creation and deletion work; admin operations reject non-admin callers; retries do not leave duplicate/orphan staff/Auth identities. |

## Retries, conflicts and atomicity

Use the stub for deterministic network-failure UI tests and staging with **two independent connections** for real contention. PGlite's single connection cannot prove concurrent locking.

| ID | Scenario | Expected result |
| --- | --- | --- |
| RACE-01 | A and B open the same editable order, delivery, product, customer, supplier, material, staff or loyalty rules; A saves, then B saves its older revision. | B is refused, keeps input and can reload/reconcile; A's changes survive. Include staff block and stock count changed after a form opened. |
| RACE-02 | Drop a response after the server commits; retry with the same request ID for order, stock and workshop commands. Repeat with changed payload under that ID. | Original result replays without double movement/history; changed payload is refused. Use a new ID only for a new intended action. |
| RACE-03 | Concurrently receive the same supplier order, finish one batch, undo one damage entry or complete/dispatch the same order. | Exactly one business effect; other calls replay or fail safely. No duplicate receipt, reversal, output or ledger delta. |
| RACE-04 | Two independent valid actions compete for the last stock/material units. | Serialized results respect available quantities and reservations; no negative balance, lost update or partial transaction. Record each request and final balances. |
| RACE-05 | Fail delivery creation after order creation; fail stock/photo save after product save; retry more than once. | Form retains data and reuses the created identity; no duplicate order/product/delivery and no false complete-success message. |
| RACE-06 | Submit a command with an invalid dependent item after a valid one, or force a known constraint failure in an isolated fixture. | Entire command rolls back: no partial stock, lot, batch, order, return or financial change. Do not install failure triggers in a shared project. |

## Checks that need a real project

Run these on a staging project after applying a migration or deploying functions:

- `supabase/verify_production.sql` in the SQL editor: purchasing, receiving and production with role boundaries, inside a transaction that ends in `ROLLBACK`. (`npm test` also runs it against the schema in PGlite.)
- `supabase/integrity_check.sql`: the data report (read-only).
- Sign in as each demo role and check what each can see and do against the roles table in [workflows.md](workflows.md#roles).
- Create a staff account, sign in with it from another browser, block it, and confirm the other session loses access on its next refresh. Delete it and confirm the login is gone.
- Record damage on a product, correct a count, receive a supplier delivery, and replace goods on a delivered order; each appears in the stock history with your name.

`verify_production.sql` is an executable SQL acceptance script, not a production site or a complete hosted test suite. Run the whole file so its final rollback is reached; if execution aborts with a transaction open, roll it back. PostgreSQL sequence values can advance even when fixture rows roll back. Do not use this script as permission to run other writes against production.

## Results, evidence and completion criteria

Write a run report to `docs/testing-reports/<run-id>.md`. Use **PASS**, **FAIL**, **BLOCKED**, **NOT RUN**, or **N/A** (with reason) for each checklist ID and each CRUD/role subcase. If only part of a row was exercised, list the subcases; do not mark the whole row passed. Reference a saved automated result only when it actually asserts the case.

```markdown
# Test run <run-id>
- Commit/local changes:
- Time/timezone, tester:
- App URL, confirmed environment/project, schema/migration state:
- Browser/viewports and available roles:
- Scope and limitations:

## Automated results
| Command | Exit code | Passed/failed/skipped | Evidence |
| --- | --- | --- | --- |

## Acceptance results
| Case/subcase | Role | Local stub / staging | Status | Expected vs actual | Evidence |
| --- | --- | --- | --- | --- | --- |

## Integrity before/after
| Check | Before | After | Affected fixture IDs | Explanation |
| --- | --- | --- | --- | --- |

## Defects
| Severity | Case | Reproduction steps | Expected / actual | Evidence | Retest |
| --- | --- | --- | --- | --- | --- |

## Fixture cleanup and retained records
## Blocked / not-run work and exact prerequisites
## Verdict: PASS / FAIL / INCOMPLETE
```

- **Critical:** unauthorized access or mutation, corruption, lost records, double money/stock application. **High:** broken core workflow or incorrect totals. **Medium/Low:** localized functionality/usability defects, according to impact.
- **PASS:** all required suites and applicable acceptance subcases pass, including hosted integrity, permissions and contention; no unresolved defects. Justified N/A cases are recorded.
- **FAIL:** any required assertion fails; list other blocked/unrun cases too. **INCOMPLETE:** no confirmed failure but required hosted/manual checks are blocked or unrun. An entirely green local suite alone is not full-site acceptance.
- Save original failures even if a retry passes. For a separately authorized fix, retest its reproduction and affected regressions. Never weaken expectations, disable constraints or omit tests to make the verdict green.

## Copy-ready prompt to run this plan

Paste this into a new coding-agent chat opened in this repository:

```text
Run the full LSB Handicrafts website acceptance audit in docs/TESTING.md.

Read repository instructions, that runbook, docs/workflows.md and the current
test/configuration files. Record the commit and preserve all existing edits.
Create a unique run ID and a report at docs/testing-reports/<run-id>.md.

Execute npm run lint, npm test, npm run build, and
npx --no-install playwright test --workers=1 --reporter=list,html.
Record actual exit codes, counts, skipped tests and failure evidence. Preserve
browser artifacts before reruns. Inspect failures rather than assuming that
a green rerun erases them. Install lockfile dependencies only if needed.

Then execute the runbook's shared UI checks, all CRUD/lifecycle subcases,
validation boundaries, numerical journeys, data-integrity invariants,
role/authentication matrix, and retry/concurrency cases. Use browser interaction
for UI acceptance and persisted readback for data effects. Distinguish stubbed
browser tests, PGlite database tests, and actual hosted staging evidence.

Use only a verified disposable/staging environment for hosted writes and only
synthetic fixtures labelled with this run ID. Confirm target identity without
exposing secrets. Do not reset/seed/migrate a shared database, touch production
business data, change Auth limits, deploy, or execute integrity repair SQL.
If staging or credentials are missing, finish independent local checks and
mark dependent cases BLOCKED with the exact prerequisites needed.

Save the read-only integrity report before and after hosted work; reconcile
stock, lots, reservations, orders, deliveries, refunds, replacements, customer
totals and audit history using the runbook's expected values. Test denied API
actions using ordinary role sessions, not a service-role key. Use independent
staging sessions for actual concurrency. Verify rejected actions change nothing
and retried actions apply once. Track and clean up only this run's fixtures
through supported archive/cancel/delete workflows; preserve referenced history.

Audit and report; do not change application behavior or weaken tests to pass.
For a confirmed coverage gap, add a focused regression test when feasible and
run it, preserving the original evidence. Do not claim a case passed without
executing it. Report each case and relevant role/CRUD subcase as PASS, FAIL,
BLOCKED, NOT RUN or justified N/A. Include reproduction steps and severity for
defects, evidence links, before/after balances, cleanup and remaining work.

Finish with a concise PASS / FAIL / INCOMPLETE verdict and a link to the report.
Green local automation alone must not be described as full-site acceptance.
```

## Testing with other people

Notes for putting the app in front of a group — classmates, shop staff, anyone who did not build it — with sign-ins that need no real email.

### The logins

The demo seed defines the following usernames and backing addresses; verify that the target project actually has them. Supabase Auth signs in with an email address, but nobody has to receive mail for ordinary sign-in:

| Username | Role | Address behind it |
| --- | --- | --- |
| `admin` | Admin | `admin@email.com` |
| `manager` | Manager | `manager@email.com` |
| `sales` | Sales Staff | `sales@email.com` |
| `production` | Production Staff | `prod@email.com` |
| `delivery` | Delivery Staff | `delivery@email.com` |

- **Accounts are created already confirmed.** `admin-accounts` calls `auth.admin.createUser({ email_confirm: true })`. An account made by hand in the dashboard needs **Auto Confirm User** ticked, or it can never sign in.
- **People type a username.** The `sign-in` Edge Function resolves it server-side; the browser is never told the address.
- **Forgot password** is the one flow that sends mail. Reset a tester's password from the dashboard instead.

### Check the logins first

```bash
LSB_DEMO_PASSWORD='the-demo-password' node scripts/check-logins.mjs
```

The command above uses Bash syntax. In PowerShell, with `LSB_DEMO_PASSWORD` already supplied securely in the process environment, run:

```powershell
node scripts/check-logins.mjs
```

One `PASS`/`FAIL` line per account, through the same Edge Function the browser uses. This script reads the project URL/key from the root `.env` and performs real sign-ins; verify the target first. The password comes from the environment and must not be committed or included in the test report.

### The sign-in rate limit

Inspect the target project's current Authentication rate-limit settings before a group session. Username sign-ins go through the `sign-in` function and can compete for shared capacity. Do not assume a fixed ceiling or change limits as part of the ordinary audit. `node scripts/check-logins.mjs --burst 30` sends an additional 30 real attempts; use it only for an explicitly scoped staging rate-limit exercise, away from other testers.

### Several people, several devices

- Each browser has its own session; signing out on one leaves the others alone.
- Changes made elsewhere appear within a minute on the screen you are on, or when you come back to the window if what it shows is older than 30 seconds. There is no live push.
- Two people changing the same record: the second save is refused with "this record changed", and the form keeps what they typed. Stock and money actions queue behind each other in the database instead.
- A new account can take up to 30 seconds to sign in (the `sign-in` function caches the roster). A changed role applies at once in the database; the screens catch up on the next refresh.
