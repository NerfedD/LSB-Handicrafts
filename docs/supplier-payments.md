# Supplier payments and recorded cash flow

## Scope and acceptance criteria

Implement the agreed first phase: supplier payments, refunds, outstanding balances,
and a cash-flow summary. Sales revenue remains separate. Inventory costing and
profit reporting are a later phase.

- Ordering or receiving materials does not confirm payment. Keep historical
  `paid_at` markers for reference; do not invent ledger entries from them.
- Managers and administrators record dated payments and refunds against supplier
  orders, including partial payments. Other roles cannot read or write this ledger.
- Every entry has an amount, method, date, reference (except cash), note and author.
  Retrying a request must not duplicate it. Entries and their activity log survive
  cancellation; orders with financial history cannot be deleted.
- A refund can reduce the supplier bill (returned/damaged goods), or return a
  payment without reducing the bill. The latter reopens the outstanding balance.
  Cancelled orders owe nothing and show any payment still awaiting refund.
- Card purchases settle the supplier but increase the recorded card balance.
  A separate card-bill payment reduces that balance and is a cash outflow.
  Card refunds reduce the card balance. All card activity is pooled; the app does
  not reconcile individual bank or card accounts.
- The dashboard shows customer collections/refunds, supplier cash payments/refunds,
  card-bill payments and their net recorded cash movement, by Manila calendar date.
  Card charges are excluded from cash movement. This is neither a bank balance
  nor profit, and excludes transactions not recorded in this app.
- Legacy inferred payments require reconciliation and explicit recording. Display
  this limitation beside the payment history rather than treating missing entries
  as proof that no payment happened.

## Implementation and verification

Use the existing React/Tailwind dialog, table, error and loading patterns. Keep
payment records in Postgres behind manager-only RLS and validated RPCs, with
fixed search paths, request IDs, row locks and an activity audit. No payment
processor or bank transfer is invoked by these actions.

Build order: database ledger and balance/summary RPCs → Purchasing payment/history
dialog → dashboard summary → workflow documentation and regression verification.

Commands: `npm test`, `npm run lint`, `npm run build`,
`npx playwright test tests/supplier-payments.spec.js`.

Database tests use `src/test/database.js` (real schema in PGlite). Test authorization,
validation, retry behavior, partial payments/refunds, cancellation, order edits,
card charges/repayments, cash-flow date bounds and clean/upgraded schema installs.
Browser tests exercise the payment flow, balances, errors and mobile layout.

For this checkout, exclude unrelated nested worktrees from lint:
`npm run lint -- --ignore-pattern 'work/**' --ignore-pattern '.claude/**' --ignore-pattern 'test-results-b/**'`.

## Using the feature

In Purchasing, open **Payments** on an order. Record the amount actually paid,
its method, date and reference; the remaining balance updates immediately.
**Payment or refund due** also finds received orders that still owe money and
cancelled orders awaiting repayment. Open Payments to review who recorded each
entry and why. A cancelled order retains every payment and refund.

For a supplier refund, choose whether the supplier also reduced the bill (for
example, returned goods), or only returned a payment that is still owed. A cash
refund of a card purchase is cash coming in; it does not repay the card balance.
Use **Record card-bill payment** when that bill is actually paid. The recorded
card balance includes only this app's supplier charges, refunds and repayments.

The dashboard and Purchasing show **Recorded cash flow** over Manila calendar
dates, including today. Purchases labelled **Ordered** are agreed order totals,
not confirmed cash spending. Payment records are immutable; keep receipts and
double-check the values before saving.

Deployment requires applying the new migration before deploying the frontend.
This work prepares and verifies the local change; it does not change a hosted DB.
