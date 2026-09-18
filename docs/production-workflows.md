# Raw materials, purchasing and production

Implemented from `SUPERPROMPT.md`. The new destinations are **Raw materials**, **Supplier deliveries**, **Make list**, and **Damage & yield**. The existing customer order and delivery workflows remain separate.

## First use

The migration copies the existing sheet/block **catalog details only** into raw materials. It never copies a shelf count into a second stock ledger. Seven material entries were created in the connected project, each starting at zero.

1. A manager opens **Raw materials** and checks the material codes and units.
2. For supplies already on the shelf, choose **Move selling stock here**. Enter the selling units to transfer; the confirmation shows the physical sheet/block count after multiplying by the pack size. The transaction deducts selling stock and adds a traceable material lot. A waiting customer order for that stock blocks the transfer.
3. For new supplies, use **Supplier deliveries → Order materials**. Choose an existing supplier, material, quantity and price. Set the promised date and courier/vehicle/driver contact when known.
4. Optionally save a recipe from **Make list**. A recipe such as 45 sheets for 100 pieces estimates material requirements, rounding up; workers can adjust a particular batch.

Sheets may still be sold to customers. The material stock represents supplies allocated to workshop use, while the existing products stock represents the separate sellable supply. Moving stock is an explicit counted event with an approving manager, not an automatic reclassification of historical sales.

## Receiving supplies

Orders progress through Ordered → Delivery scheduled → On the way → Arrived & verified. Staff enter the actual unloaded and damaged counts, then confirm usable stock. Missing, damaged or excess material flags a claim for manager review. A manager records the agreed outcome; this does not rewrite the receipt or silently add replacements.

Each supplier order is received once. A short delivery closes that receipt; log a separate replacement/follow-up order for later supplies. Cancel an order only before it leaves the supplier. No receipt or damage record can be deleted through these screens.

## Making and checking a batch

The make list prioritizes customer shortfalls and low-stock items. **Start batch** opens a form with the product and target prefilled; a saved recipe also fills the material estimate. Select the responsible worker, optionally link a waiting customer order, and add bespoke instructions.

Queued batches reserve material against other batches. **Begin making** moves to In progress; **Ready for quality check** moves to Quality check. Only then can the batch be completed. Cancelling a queued batch releases its allocation without changing stock. A batch already in progress must be accounted for through quality check rather than erased.

Completion saves the following in one database transaction:

- Good pieces added to finished inventory, converted to selling units using its pack size.
- Actual raw material consumption deducted, allowing for other active batches.
- Material lot usage, oldest received lot first, retained against the batch.
- Damaged pieces, cause, worker, completion time and activity entry.

Good pieces must fill whole selling packs. A zero-output failed run is supported, with its cause and material consumption recorded. The **Damage & yield** screen calculates weighted yield/damage percentages from all completed batches and shows defect records with their source material lots.

## Database and access

The complete extension is in `supabase/production.sql` and is also included at the end of `supabase/schema.sql`. Existing installations can run the extension after their base schema. Both scripts are rerunnable. The connected project has received migrations `raw_material_purchasing_production_and_defects` and `workshop_audit_indexes_and_readable_batch_codes`.

New tables have RLS and authenticated active-staff reads. Direct client writes are revoked. `public.workshop_command` is a security-invoker wrapper for a private, fixed-search-path implementation that checks the signed-in active staff record and role before every operation. Managers/admins control materials, purchasing, recipes, claims and stock transfers. Active staff can receive deliveries. Production staff/managers/admins control production batches.

Row locks protect stock and batch state. A request UUID records the actor, action, payload and result, allowing a retry after a lost response without applying stock movements twice. Changed payloads use a new request. Final receipt/batch status also blocks re-submission under a different UUID. Activity entries are part of the same transaction, with the actor taken from the database session.

`private.workshop_requests` intentionally has RLS with no client policies and no client table grants. The Supabase advisor's informational “RLS enabled, no policy” notice for that private table describes the intended deny-all behavior. Existing unrelated authentication advisor warnings were not changed by this feature. See the [Supabase advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Verification

`supabase/verify_production.sql` exercises the actual database transaction and role boundaries, using isolated fixtures inside a transaction that ends with `ROLLBACK`. It verifies 48 usable sheets from a 50/2 delivery, then 95 good pieces and 5 defects from a 100-piece batch consuming 45 sheets. It also checks duplicate requests, over-allocation, invalid counts, whole selling packs, failed writes and anonymous/role restrictions. It leaves no test staff, supplier orders or production batches behind; sequence gaps after tests are expected.

Local checks:

```sh
npm test
npm run lint
npm run build
npx playwright test
```

`tests/production.spec.js` verifies the browser interactions against a stubbed API. Database arithmetic and authorization are separately verified by the rollback SQL. The phone test measures readable text and touch controls and captures `test-results/workshop-phone.png`.

The frontend changes are in this working tree. No Vercel deployment is performed by the database migrations.
