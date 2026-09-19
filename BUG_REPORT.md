# Bug report

Reviewed: 2026-09-19. Base commit: `2d43e52`, with the existing uncommitted changes included in the review.

**16 findings: 8 high priority and 8 medium priority. All remain open. No application, database, or existing test fixes were made.**

This review covered order and delivery workflows, stock accounting, refunds, product and customer forms, routing, account creation, the data layer, and relevant Supabase policies. Findings were checked against the older `BUGS_AND_FIX_PLAN.txt`; some previously documented problems remain and are identified below. This is not a claim that every possible defect has been found.

## Verification

| Check | Result |
| --- | --- |
| `npm run lint` | Passed. |
| `npm test` | 74 tests passed across 5 files. |
| `npm run build -- --outDir test-results/bug-audit/dist` | Passed. Vite reported its existing large-chunk advisory. |
| `npx --no-install playwright test --output test-results/bug-audit/browser` | 65 passed; 3 failed. All three failures are described in BUG-16. |
| Targeted diagnostic probes | 14 scenarios successfully reproduced the observed behavior or client request contract. Temporary probes and artifacts are under the ignored `test-results/bug-audit/` directory. |

Browser checks used the repository's in-memory Supabase stub. No live business records, Auth accounts, database policies, or deployed functions were changed. The stub does not enforce PostgreSQL constraints or RLS; the authorization finding is based on the checked-in SQL, and the account-phone finding combines an observed browser request with the function's validation code. Hosted deployment state was not verified.

Source locations below refer to the files as reviewed. P1 means high priority because records, stock, or authorization can become incorrect; P2 means medium priority for other workflow, reporting, and test failures.

## Findings at a glance

| ID | Priority | Finding |
| --- | --- | --- |
| BUG-01 | P1 | Failed order saves leave stock changed; retries deduct again. |
| BUG-02 | P1 | Concurrent saves overwrite stock deductions. |
| BUG-03 | P1 | Orders can complete before inventory has loaded. |
| BUG-04 | P1 | Editing cut-item orders changes their stock consumption. |
| BUG-05 | P1 | Fully refunded, cancelled orders can still be dispatched. |
| BUG-06 | P1 | Database guards do not enforce all manager-only order changes. |
| BUG-07 | P1 | Main collections silently stop at the API row limit. |
| BUG-08 | P1 | Refunds of legacy completed orders do not restore returned stock. |
| BUG-09 | P2 | A price corrected to zero is displayed and printed as a positive total. |
| BUG-10 | P2 | An arrived delivery leaves its fully fulfilled order waiting. |
| BUG-11 | P2 | Follow-up delivery manifests record cumulative quantities as that run's load. |
| BUG-12 | P2 | Dashboard's Add a product action can edit an existing product. |
| BUG-13 | P2 | Refreshing an order-edit page loses the order being edited. |
| BUG-14 | P2 | Account creation rejects phone formatting accepted by the form. |
| BUG-15 | P2 | Renaming customers disconnects their order history. |
| BUG-16 | P2 | Print content causes three existing browser tests to fail. |

### BUG-01 — Failed order saves leave stock changed; retries deduct again

**Locations:** `src/App.jsx:1480`, `src/App.jsx:1507`, `src/App.jsx:1547`. The same save sequence also appears in cancellation, reopening, refunds, and delivery dispatch.

**Cause:** `persistStockChanges()` writes inventory rows individually before the order update. A later failure leaves earlier writes committed. There is no transaction or rollback connecting these requests.

**Reproduce:** Start with 64 units and fixture order #1042 requiring 4. Allow the inventory PATCH, but reject the following order PATCH. Then retry **Mark as done** after the rejection is removed.

**Observed:** The first attempt leaves stock at 60 while the order remains Pending. The successful retry deducts another 4, leaving 56. Correct stock after completing this one order is 60.

**Impact:** A normal retry after a connection or database error can permanently corrupt stock. A failure partway through a multi-item inventory update also leaves a partial result. Confirmed in the browser with an injected order-write failure. Related to the older report's BUG-02.

### BUG-02 — Concurrent saves overwrite stock deductions

**Locations:** `src/utils/storageManager.js:460`, `src/utils/stockLedger.js:152`, `src/App.jsx:1547`, `src/App.jsx:1606`.

**Cause:** Stock is calculated from each browser's snapshot and saved as an absolute number. Updates match only the row ID; they do not check that the snapshot is current. Refund and price-adjustment histories are also rewritten from browser snapshots.

**Reproduce:** Open two independent sessions while stock is 64. Complete one order for 4 units and another for 8 units concurrently, delaying both inventory writes until both browsers have calculated their payloads.

**Observed:** Both orders become Completed, but stock ends at 56 instead of 52. The last write replaces the other deduction. Depending on write order, it could instead end at 60.

**Impact:** Simultaneous users can lose stock movements. By the same full-row update mechanism, concurrent refunds can overwrite a refund total/history entry; that extension was established by code inspection, not a separate refund concurrency run. The stock case was reproduced. Already acknowledged in `docs/TESTING.md` and the older BUG-02.

### BUG-03 — Orders can complete before inventory has loaded

**Locations:** `src/App.jsx:1944`, `src/App.jsx:2074`, `src/App.jsx:2114`, `src/components/orders/OrderDetailPage.jsx:164`, `src/utils/stockLedger.js:182`.

**Cause:** The order list/detail waits for orders, but its completion action does not wait for inventory. The completion function accepts the current inventory array, including an empty array from an unfinished or failed load.

**Reproduce:** Hold the inventory GET response, let orders load, open order #1042, and press **Mark as done**.

**Observed:** The order becomes Completed, its line records `committedUnits: 4`, and a commitment date is saved. Actual stock remains 64 because no inventory row was available to update.

**Expected:** A stock-changing action must not claim completion when the stock records needed to perform it are unavailable.

**Impact:** Slow or failed inventory reads can produce completed orders with no stock deduction. The saved commitment marker also causes subsequent completion logic to treat the stock as already handled. Reproduced with a delayed inventory response.

### BUG-04 — Editing cut-item orders changes their stock consumption

**Locations:** `src/components/orders/OrderFormPage.jsx:82`, `src/components/orders/OrderFormPage.jsx:269`, `src/components/orders/OrderFormPage.jsx:284`.

**Cause:** `seedLines()` does not retain a cut line's stock conversion. Saving reconstructs it as a catalogue or negotiated line and sets `stockUnits` equal to the finished quantity. Notes are retained only for custom lines.

**Reproduce:** Open an editable Pending order containing a cut line for 12 finished pieces made from 3 parent stock units. Choose **Change this order**, then save without changing the line.

**Observed:** `stockUnits` changes from 3 to 12, `kind` changes from `cut` to `catalog`, and the cutting notes disappear.

**Impact:** An unrelated order edit can quadruple the reservation and eventual stock deduction in this example, while discarding production instructions. Reproduced through the order editor.

### BUG-05 — Fully refunded, cancelled orders can still be dispatched

**Locations:** `src/App.jsx:1606`, `src/App.jsx:1716`, `src/App.jsx:1758`, `src/App.jsx:1782`.

**Cause:** A full refund sets the order status to Cancelled but does not remove or stop its unstarted deliveries. Advancing a delivery checks for a linked order, not whether that order has been cancelled.

**Reproduce:** Fully refund order #1042 using **Give all of it back** while delivery #2042 is Ready To Go. Open that delivery and advance it to On The Way.

**Observed:** The order remains Cancelled and fully refunded, but the delivery advances to On The Way successfully.

**Expected:** A cancelled order's scheduled delivery must not remain an ordinary dispatchable job.

**Impact:** Staff can send goods for an order that has already been cancelled and refunded. Reproduced through the normal refund and delivery controls.

### BUG-06 — Database guards do not enforce all manager-only order changes

**Locations:** `src/App.jsx:1235`, `src/App.jsx:1323`, `supabase/schema.sql:657`, `supabase/schema.sql:1187`.

**Cause:** The UI reserves order editing and cancellation for Admin/Manager. The orders UPDATE policy permits every active staff member, while `orders_guard_money_update()` checks money fields and transitions away from Completed. It does not reject changes to `items`, `customer_name`, or a Pending-to-Cancelled transition.

**Reproduction scenario:** In an isolated database using the supplied schema, authenticate as Sales Staff, Production Staff, or Delivery Staff. Update a Pending order's status to Cancelled, or change its line items while leaving the guarded money fields unchanged.

**Code-established result:** Those changes satisfy the supplied RLS predicate and do not enter a rejecting branch of the guard. The UI's manager-only rule is therefore not enforced by the checked-in database code.

**Impact:** A lower-privilege staff session can bypass the intended order controls through the API. This was confirmed by tracing the policy and trigger, not by changing a hosted record. Supabase documents that UPDATE authorization depends on the policy's `USING` and `WITH CHECK` predicates; neither predicate here checks the relevant staff role. [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)

### BUG-07 — Main collections silently stop at the API row limit

**Locations:** `src/utils/storageManager.js:362`, `src/utils/storageManager.js:530`; the username roster has a similar unpaginated read at `supabase/functions/sign-in/index.ts:138`.

**Cause:** The shared loader issues one ascending-ID SELECT and treats that response as the entire table. It neither pages through the results nor checks for truncation. Supabase's default project response limit is 1,000 rows, though a project's configured limit may differ. [Supabase documentation on the project row limit](https://supabase.com/docs/reference/python/select)

**Reproduce:** Supply a table with 1,001 records and an API response capped at the first 1,000. Call `productsCollection.load([])`.

**Observed:** It returns `{ ok: true }` with 1,000 records, and makes no second request. This was reproduced with a capped mock response; the live project's configured limit was not inspected.

**Impact:** Later records vanish from lists and detail lookups. Missing Pending orders also understate reservations, and missing activity entries make the log incomplete. All eight original collections share this loader. The separate workshop loader already paginates and is not the affected path. Previously documented as BUG-05 in the older report.

### BUG-08 — Refunds of legacy completed orders do not restore returned stock

**Locations:** `src/utils/stockLedger.js:102`, `src/utils/stockLedger.js:304`, `src/components/orders/RefundDialog.jsx:54`.

**Cause:** Legacy completed orders can have `stockCommittedAt` without per-line `committedUnits`. `uncommitOrder()` explicitly handles this older shape, but `handleRefundStock()` interprets the missing counter as zero. The refund form likewise treats it as zero and omits the return-disposition choice.

**Reproduce:** Use a Completed order with a commitment date and a line for 3 units, but no `committedUnits`. With stock at 5, refund 2 units with disposition `restock`.

**Observed:** Stock stays at 5 rather than increasing to 7. The line's `voidedUnits` nevertheless increases to 2.

**Impact:** Returned goods from older completed orders are not added back to sellable inventory even though the refund proceeds. Reproduced by calling the actual domain function in the browser. The checked-in fixtures also include completed orders in this legacy shape.

### BUG-09 — A price corrected to zero is displayed and printed as a positive total

**Locations:** `src/utils/orders.js:258`, especially line 266; `src/components/orders/PriceAdjustmentDialog.jsx:69`; `src/components/orders/OrderSlip.jsx:59`.

**Cause:** The price-correction dialog accepts zero, but `orderTotals()` uses the stored total only when it is greater than zero. A valid zero falls back to the sum of items and delivery.

**Reproduce:** Open the 600-peso order #1042, correct its price to 0 with a reason, and inspect the totals or print slip.

**Observed:** The saved `total_amount` is 0, but the print slip's **Total to pay** remains 600 pesos. The screen uses the same calculation.

**Impact:** A fully discounted order can still be presented to the customer with an amount due. Reproduced through the price-correction dialog and print DOM.

### BUG-10 — An arrived delivery leaves its fully fulfilled order waiting

**Locations:** `src/App.jsx:1716`, `src/App.jsx:1797`, `src/utils/orders.js:178`, `src/utils/orders.js:271`.

**Cause:** Dispatch records the commitment, and arrival updates only the delivery. Neither transition marks a fully fulfilled order Completed. Meanwhile, the progress tracker treats an arrived delivery as finished.

**Reproduce:** Send all 4 units on delivery #2042, then press **It arrived**.

**Observed:** Delivery status is Delivered and stock correctly changes from 64 to 60, but order #1042 remains Pending.

**Impact:** The order still contributes to waiting counts and customer open-order indicators while its progress tracker says it is delivered. A separate **Mark as done** action is required. Reproduced end to end. This is the remaining status issue from the older BUG-03; its old claim that this normal dispatch path never deducts stock is no longer accurate.

### BUG-11 — Follow-up manifests record cumulative quantities as that run's load

**Locations:** `src/components/deliveries/RecordDeliveredDialog.jsx:88`, `src/components/deliveries/RecordDeliveredDialog.jsx:136`, `src/utils/stockLedger.js:262`.

**Cause:** The dialog initializes quantities to the whole order's cumulative ceiling. That value is appropriate for the stock helper's cumulative target, but it is also copied directly into the individual delivery's `deliveredQty`.

**Reproduce:** Use fixture order #1046: 20 units ordered, 12 already sent on the first run, 8 outstanding. Advance follow-up delivery #2047 to On The Way with the default counts.

**Observed:** Only 8 additional units are deducted, but the second delivery's manifest records `deliveredQty: 20`. Together the two manifests report 32 delivered units against a 20-unit order.

**Impact:** Delivery records overstate what the follow-up vehicle carried, and the quantity input is misleading for a person counting that run's load. Reproduced through the follow-up delivery dialog.

### BUG-12 — Dashboard's Add a product action can edit an existing product

**Locations:** `src/App.jsx:1984`, `src/App.jsx:2027`, `src/App.jsx:2058`, `src/App.jsx:895`.

**Cause:** The dashboard action changes the view without clearing `selectedProductId`. The product form and save handler interpret the retained selection as an edit. The equivalent Add action on the products list does clear the selection.

**Reproduce:** Open product SB-040, return to Dashboard, then choose **Add a product**.

**Observed:** The URL becomes `/products/1/edit`, and the form contains the existing Styro Ball 4 inch product.

**Impact:** Someone intending to add a new product can overwrite an existing catalogue entry. Reproduced through the dashboard action.

### BUG-13 — Refreshing an order-edit page loses the order being edited

**Locations:** `src/utils/routes.js:5`, `src/utils/routes.js:38`, `src/App.jsx:210`, `src/App.jsx:2155`.

**Cause:** `order-edit` has no record mapping or ID-bearing route. Navigation generates `/order-edit`, so refresh cannot recover `selectedOrderId`. The edit form still renders with an undefined order.

**Reproduce:** Open order #1042, choose **Change this order**, and refresh the browser.

**Observed:** Before refresh, the customer is Liza Villanueva. After refresh, the edit form's customer field is blank. `updateOrder()` has no selected order and returns without saving.

**Impact:** Refreshing or reopening the edit URL loses the record and leaves an unusable editing screen. Reproduced through navigation and reload. Other ID-bearing routes passing the current tests do not cover this route.

### BUG-14 — Account creation rejects phone formatting accepted by the form

**Locations:** `src/components/staff/CreateAccountDialog.jsx:154`, `src/components/staff/CreateAccountDialog.jsx:177`, `supabase/functions/admin-accounts/index.ts:30`, `supabase/functions/admin-accounts/index.ts:36`.

**Cause:** The frontend accepts spaces, brackets, hyphens, and a plus sign through its shared phone rules. It sends the phone string unchanged. The account-creation Edge Function requires 7–15 digits with no formatting characters.

**Reproduce:** Create an otherwise valid staff account with phone `0917 555 0201` or `+63 917 555 0201`.

**Evidence:** The browser accepted `0917 555 0201` and sent exactly that string in `contactNumber`. The function's regex rejects it before account creation. The Edge Function was inspected, not called against live Auth.

**Impact:** Normal phone formatting causes account creation to fail even though the form accepted the field. Existing browser account tests use empty phone numbers and do not catch this mismatch.

### BUG-15 — Renaming customers disconnects their order history

**Locations:** `src/utils/customers.js:41`, `src/utils/customers.js:53`, `src/App.jsx:718`, `src/App.jsx:2105`.

**Cause:** Orders are associated with customers by a lowercased name, not customer ID. Saving a customer name updates the customer record alone.

**Reproduce:** Create an order for a saved customer, then change that customer's name. Open their history again.

**Observed:** The same customer ID goes from one matching order to zero when only its name changes. Two distinct customers with the same name receive the same matching history.

**Impact:** Order counts, spend, open-order indicators, and contact lookup become incorrect. The order itself is not deleted; the association is lost. Reconfirmed with the actual customer-summary functions. This is already acknowledged in `README.md`, `PRODUCT.md`, and the older report's BUG-13.

### BUG-16 — Print content causes three existing browser tests to fail

**Locations:** `tests/smoke.spec.js:310`, `tests/smoke.spec.js:448`, `tests/smoke.spec.js:482`; print portal at `src/components/orders/OrderSlip.jsx:66`.

**Cause:** The tests use unscoped text locators. The print slip adds a second matching text node to the DOM, even while hidden on screen. Playwright rejects these locators because they match more than one element.

**Reproduce:** Run the existing Playwright suite with the current print-slip changes present.

**Observed failures:**

- **an order shows the stage tracker and totals** — `Total to pay` matches the screen and print slip.
- **an order that went out short says so, and the tracker agrees** — the price-correction reason matches both copies.
- **a refund is listed with what happened to the goods** — the refund reason matches both copies.

**Impact:** The browser test command exits unsuccessfully: 65 pass, 3 fail. These are test-selector regressions, not evidence that the corresponding on-screen content is missing. Failure screenshots and traces are under `test-results/bug-audit/browser/`. The existing tests were left unchanged.

## Review limits and unchanged state

The targeted probes exercised the existing application and utility functions with synthetic records, delayed responses, injected failures, and concurrent browser sessions. Successful diagnostic assertions confirm that the documented defects occur; they do not mean the defects were fixed.

The hosted schema, Edge Function deployment, Auth settings, email delivery, and real concurrent database transactions were not exercised. The SQL finding should be validated against the deployed policies before assuming hosted behavior is identical to the repository.

Original application, SQL, configuration, and test files were checked against content hashes captured during the review. No fixes were applied to them. This report is the review deliverable; diagnostic files and build/browser artifacts were confined to the ignored test-results directory.
