# QA prompt: bug hunt and bad-input testing

Paste everything in the block below into a new coding-agent chat opened in this repository (or give it to a human tester). It goes alongside the full acceptance runbook in [TESTING.md](TESTING.md). This prompt is about **breaking the app**: wrong input, misuse, odd sequences of actions, and regressions of bugs that were fixed before.

```text
You are a senior QA engineer doing an adversarial bug hunt on the LSB Handicrafts
management system (React 19 + Vite + Tailwind, Supabase Postgres/Auth/Edge
Functions). Your job is to FIND BUGS. Proving that the happy path works is not
the goal. Act like a careless, confused, impatient or malicious user.

=== 0. GROUND RULES ===
- First read: README.md, PRODUCT.md, docs/workflows.md, docs/TESTING.md,
  BUGS_AND_FIX_PLAN.txt, src/utils/validation.js, src/utils/phone.js,
  src/utils/password.js, src/utils/permissions.js, src/utils/navigation.js,
  src/utils/routes.js. These files define the EXPECTED behaviour. If code and
  docs disagree, report it as a finding. Do not decide on your own which one
  is right.
- Record the git commit, date/time (Asia/Manila), browser, viewport and environment
  (stubbed Playwright / PGlite / hosted staging).
- Do NOT change application code to make a test pass. Do NOT reset, seed or
  migrate a shared database. Do NOT run repair SQL. Do NOT use the service-role key
  to "prove" a permission. Use only synthetic data labelled with a run ID
  (e.g. QA-BUG-<yyyymmdd>-01). If staging or credentials are missing, do every
  local check you can and mark the hosted ones BLOCKED.
- You MAY add focused regression tests (Vitest in src/utils/*.test.js or
  Playwright in tests/*.spec.js) for each confirmed bug.
- Demo logins (if present on the target): admin, manager, sales, production,
  delivery. Never print passwords or keys.

=== 1. AUTOMATED BASELINE ===
Run and record exit code + pass/fail/skip counts for each:
  npm run lint
  npm test
  npm run build
  npx --no-install playwright test --workers=1 --reporter=list,html
Copy test-results/ and playwright-report/ to a run folder before any rerun.
Investigate every failure. A green rerun does not make a failure go away.

=== 2. FOR EVERY INPUT FIELD, TRY ALL OF THESE ===
For every form and dialog (product, raw material, category, supplier, supplier
order, receive delivery, customer, loyalty rules, order form, price fix, refund,
replacement, assign driver, record delivered, start/edit/complete batch, stock
change/damage/correct count, create staff account, change role, edit profile,
change password, login, forgot/reset password):
  a. Empty, then only spaces/tabs, then a leading/trailing-space version of a
     valid value.
  b. Max length, max+1, and a 5,000-character string. Also try newlines pasted
     into single-line fields.
  c. Unicode: emoji 🎉, accented names (Peña, Ñiño), Filipino/Chinese characters,
     right-to-left text, zero-width spaces (U+200B), non-breaking spaces.
  d. Injection-looking text: <script>alert(1)</script>, <img src=x onerror=alert(1)>,
     ' OR 1=1 --, "; DROP TABLE orders; --, {{7*7}}, ${7*7}. It must be stored and
     shown as plain text. It must never run, and must never break the layout,
     the print slip or search.
  e. Pasting text vs typing it. Autofill. Browser back after submit.
  f. Submitting twice fast (double-click, Enter + click, Enter held down).
  g. Cancel / Esc / click outside after typing. Then reopen: no stale values, no write.
  h. Bad input must show an error NEXT TO THE FIELD, in plain words, keep what
     was typed, and leave the database unchanged.

=== 3. FIELD-SPECIFIC BAD INPUTS (expected rules are in brackets) ===
Numbers / counts  [whole number, 0..2,000,000,000, no decimals, no e/+/-]
  0, -1, -0, 1.5, 1.0, 1e3, +5, 00012, " 12 ", 12abc, 2000000000, 2000000001,
  99999999999, NaN, Infinity, an empty string after deleting, scrolling the mouse
  wheel on a focused number box. Damage greater than the stock on the shelf. A
  count of 0 where at least 1 is required (order quantity, batch target, received qty).
Money  [0..100,000,000, at most 2 decimals; required prices accept 0]
  0, 0.00, .5, 0.005, 10.999, -10, 100000000, 100000000.01, 1,000 (comma),
  ₱100, "100 pesos", 1e2. Check totals are cent-exact (0.1 + 0.2 style errors),
  including discounts, refunds and price fixes.
Measurements  [optional; >0; at most 3 decimals; ≤240 in / ≤200 ft]
  0, 0.0001, 240, 240.001, 200 ft vs 201 ft, switching unit after typing.
Material code  [optional; 2–40 chars; A–Z 0–9 single hyphens; stored UPPER;
  unique case-insensitively]
  "A", 41 chars, "-AB", "AB-", "A--B", "a b", "ss-100-4x8" vs existing
  "SS-100-4X8", Unicode letters, a code that was used by a deleted material.
Unit  [letters + single spaces, ≤24, stored lower-case]
  "KG", "kg ", "k g", "kg2", "m²", 25 letters, "sheet  roll".
Names  [required, ≤200, punctuation allowed, runs of spaces folded]
  1/2", A&B, (high-density), "   ", 201 chars, duplicates of an existing name,
  a category that differs from an existing one only by case/spaces (must point
  back to the existing one).
Phone  [exactly 11 digits starting 09; +63 / 63 9… converted to 09…]
  09171234503 (valid), +63 917 123 4503 (→ 09171234503), 639171234503,
  0917-123-4503, (0917) 123 4503, 0917123450 (10), 091712345034 (12),
  08171234503, (02) 8888 8888 (landline, must be refused), 0917abc4503,
  a paste longer than 11 digits (must not silently cut off a valid number),
  empty (required for customers, optional for staff).
Email  user@, @x.com, user@x, "user @x.com", UPPER@CASE.COM vs lower-case
  duplicate, 300 chars.
Password  [≥8 chars, ≥1 digit, ≥1 capital]
  "Abcdefg" (7), "abcdefg1" (no capital), "ABCDEFGH" (no digit), "Abcdefg1"
  (valid), spaces only, 200 chars, confirm-password mismatch, same as old,
  pasting into the confirm field. The checklist must tick live and match what
  the server accepts.
Dates  [promised dates cannot be before today in Asia/Manila]
  yesterday, today, tomorrow, 31 Feb, year 1900 / 9999, a typed invalid date.
  Change the device timezone (e.g. UTC-10 and UTC+14) and retest around
  midnight Manila time. Editing driver/notes on a record whose date has already
  passed must still save.
Loyalty  [percentage at most 50; whole-number order threshold]
  0, 50, 50.5, 51, -5, 100, a blank threshold, and turning it off and on again.
Photos  [resized to 800px JPEG in browser]
  .txt renamed to .jpg, .gif, .svg containing script, a 0-byte file, a 50 MB
  image, a 10000×10000 image, cancelling the file picker, replacing then
  cancelling (old photo must stay).
Login  unknown username, correct username + wrong password, username with
  spaces/case changes, SQL-ish username, blocked user, rapid repeated attempts
  (must show "Too many sign-in attempts", and must never reveal whether a
  username exists).

=== 4. BUSINESS-LOGIC ABUSE (each must be refused, or apply exactly once) ===
- Orders: zero lines; quantity > free stock (should warn but still allow saving);
  editing an order after something already happened to it; calling off an
  already called-off order; reopening a not-finished order; marking done twice;
  refreshing during save; two tabs finishing the same order.
- Deliveries: dispatching more than ordered; short delivery then retrying;
  deleting a delivery that already left; follow-up must not charge twice.
- Refunds: amount > paid; refunding a unit already refunded; putting back on the
  shelf goods that never went out; a full refund must call the order off and a
  partial one must not change the status.
- Replacements: more than received minus already replaced; called-off order;
  replacement product with 0 on the shelf. Money and status must stay unchanged.
- Price fix: new total below what has already been refunded.
- Stock: correcting a count from a stale form (another tab changed it first);
  undoing the same damage record twice; damage with "Something else" and no note.
- Supplier orders: receiving twice; damaged > arrived; ordering an archived
  material; cancelling after it was received; deleting a received one.
- Production: batch with more material than is free; completing twice;
  re-opening when waiting orders hold the output; deleting a batch that moved stock.
- Removal: deleting a product/customer/supplier/material that has a waiting
  order or history (must archive or refuse); Admin deleting themselves or the owner;
  Admin blocking their own account with different email capitalisation.
- Loyalty: forcing a discount for an ineligible customer or above the maximum.

=== 5. ROLES AND DIRECT API ABUSE ===
For each role (Admin, Manager, Sales Staff, Production Staff, Delivery Staff,
blocked user, signed-out user):
- Visit every URL directly: /staff, /staff/1, /staff/1/role, /activity-log,
  /products/new, /products/1/edit, /orders/1/edit, /customers, /suppliers,
  production report, etc. Compare with the roles table in docs/workflows.md.
- Production Staff must not see customer contact details anywhere (order
  detail, delivery, print slip, search results, network responses).
- From DevTools, using the logged-in session's Supabase client, try:
  deleting rows, updating inventory.stock directly, inserting/updating/deleting
  stock_movements or activity_log, changing your own role/status/username,
  calling order_command/stock_command with a forged role or actor. All must be
  refused AND persisted data must be unchanged (re-read to confirm).
- Block, downgrade and delete an account while it is signed in on a second
  browser. Its next refresh/action must lose access.
- Idle timeout: leave the app idle past VITE_IDLE_TIMEOUT_MINUTES, then act.

=== 6. NAVIGATION, STATE AND RESILIENCE ===
- Malformed/missing URLs: /orders/abc, /orders/0, /orders/-1, /orders/999999,
  /orders/1/edit/extra, /products/new/x, /staff/1/delete, /%00, very long
  paths, query strings with script text. Expect a useful not-found state,
  never another record's data and never a blank crash.
- Refresh (F5) on every list, detail and edit screen; Back/Forward through forms.
- Password-reset link: valid, expired, reused, and opened while already signed
  in (regression BUG-06: must land on the "choose a new password" screen).
- Network: throttle to Slow 3G, go offline mid-save, kill the response after
  the server commits, then retry. Expect no duplicate order/product/delivery,
  no false "Saved" message, form input kept.
- Two sessions editing the same record: the second save must be refused with
  "this record changed" and keep the typed input.
- Watch the browser console the whole time. Any uncaught error, React warning,
  failed request or 500 is a finding.

=== 7. UI / ACCESSIBILITY HOUSE RULES (report violations as bugs) ===
- Type follows the design scale (14px body, 13px tables, 12px captions; nothing
  under 11px); controls are 32px and table rows 36px, as on the boards in
  design/admin-dashboard/. Anything that departs from the boards is a finding.
- An icon-only control has an accessible name and a tooltip; state is never
  conveyed by colour alone.
- Plain words: no raw database literals (e.g. "Pending", "status: active",
  snake_case) shown to users.
- Visible focus ring on every focusable element; keyboard-only use of every
  flow; Esc closes dialogs; focus returns to where it was.
- Destructive confirms name the record, state the consequences and what
  survives, and the button says the verb.
- Test at 1440×960, 768×1024, 390×844, 320×568, 200% zoom, dark mode and
  reduced motion. No horizontal page scroll, and no clipped buttons.
- Print an order slip with long names, many lines, discount and refund.

=== 8. REGRESSION CHECKS FROM BUGS_AND_FIX_PLAN.txt ===
Confirm each one is still fixed: BUG-01 (order stock deducted from the right
product), BUG-02/03 (atomic completion; delivery arrival completes the order),
BUG-04 (no duplicate IDs when two users create at once), BUG-05 (more than
1,000 rows still load), BUG-06 (reset link), BUG-07 (product size not replaced
by category), BUG-08 (blank reorder point does not become 0), BUG-09
(timestamps are ISO), BUG-10 (self-block with different email case), BUG-11/13
(delivery/customer linked by id), VULN-01..08 (RLS, append-only activity log,
no username/email enumeration, no admin email in the bundle, username change
guard, auth user deleted with staff, no public sign-up, no half-created accounts).
Search the built dist/ bundle for emails, service keys or secrets.

=== 9. REPORT ===
Write docs/testing-reports/<run-id>-bughunt.md with:
- Environment, commit, scope, and anything BLOCKED (with exact prerequisites).
- Automated results table (command, exit code, counts, evidence path).
- A findings table, one row per bug:
  | ID | Severity | Area | Role | Steps to reproduce | Input used |
  | Expected | Actual | Evidence (screenshot/console/network) | Regression test added? |
  Severity: Critical = unauthorized access/change, data loss, double stock or
  money; High = broken core flow or wrong totals; Medium = wrong validation or
  error handling; Low = cosmetic/copy/house-rule issue.
- A checklist of sections 2–8 with PASS / FAIL / BLOCKED / NOT RUN for each item.
- Before/after balances for any stock or money you touched.
- Verdict: PASS / FAIL / INCOMPLETE. Local green tests alone are NOT a PASS.
Do not claim anything passed that you did not actually execute.
```
