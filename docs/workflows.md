# How the business rules work

What the system does with stock, money and customers, and which database rule enforces each part. Screens are a courtesy; every rule below is enforced in `supabase/schema.sql`, whatever a browser sends.

## Stock: two ledgers, one history

- **Products** (`products` + `inventory`, joined on item code) are what customers buy. Counts are in *selling units*: a bundle of 10 sheets is 1.
- **Raw materials** (`raw_materials`, with `raw_material_lots`) are what the workshop consumes. A lot is one receipt; production uses the oldest lot first, and a material's count always equals the sum of its lots.
- **Reserved** stock is not stored. It is worked out from orders still waiting, so it can never drift. *Free to sell* = on the shelf − reserved.
- **Reorder point.** Every product and material has its own (`low_stock_threshold`). At or below it, the item shows as *Running low*, joins the make list or the *Needs ordering* filter, and appears on the manager's dashboard. Nothing free to sell is *Run out*. One rule (`stockState` in `src/utils/stockLedger.js`, `needsReorder` in `src/utils/production.js`) drives every pill, filter and count.

### Every change is recorded

A shelf count changes only through a database function, and a trigger writes a row to `stock_movements` for every change: what kind, how many, the count it left, who, when, why, and the order, supplier order or batch involved. The product and raw-material screens show this history.

| Kind | Written by |
| --- | --- |
| Opening count | Adding a product with a count |
| Sold / Sent out on a delivery | Marking an order done / dispatching a delivery |
| Put back from an order | Re-opening or calling off an order |
| Came back from a customer | A refund or replacement where the goods can be sold again |
| Sent out as a replacement | A replacement |
| Written off as damaged | *Record damage* |
| Count corrected | *Correct the count* |
| Delivered by a supplier | Receiving a supplier delivery (usable units only) |
| Made in / Used in the workshop | Finishing a production batch |
| Moved between stocks | Moving selling stock into raw materials |

The browser cannot write `inventory.stock` directly (a trigger refuses it) and cannot write `stock_movements` at all.

### Damaged stock and count corrections

`stock_command` handles both, for products and raw materials.

- **Record damage** (Admin, Manager, Production Staff): a whole number, at most what is on the shelf, and a reason from a fixed list (*Something else* needs a note). The units come off the shelf once. A retried request replays its first answer rather than deducting again.
- **Correct the count** (Admin, Manager): the number actually counted, plus a reason. The form carries the count it was opened against; if the shelf moved since, the correction is refused so nobody overwrites a change they have not seen.
- For raw materials, a decrease uses the oldest lots first and an increase opens a *Count correction* lot.

Damage found at other moments is handled where it happens: on a supplier delivery (not added to stock, flags a claim), in production quality check (defect log), or on a customer return (*Thrown away* — not put back on the shelf). None of these deducts stock that was never counted, so nothing is deducted twice.

## Suppliers and deliveries

1. A manager orders a material from a supplier (quantity, price, promised date, courier notes).
2. *Receive delivery* (any active staff) records what was unloaded, what was damaged and why, and the supplier's delivery-receipt or invoice number. Usable = arrived − damaged is added to stock as one new lot.
3. Each supplier order can be received once: a second submission is refused, and a retried one replays. A short, excess or damaged delivery flags a claim; a manager records how it was settled, which never rewrites the receipt or adds stock.
4. A supplier's screen lists what they have supplied, derived from their orders. A supplier with purchase history cannot be removed (foreign key).

## Production

The make list puts goods owed to customers first, then products at or below their reorder point. *Start batch* reserves material against other batches (a saved recipe fills in the usual amount). A batch moves Queued → In progress → Quality check → Completed; completing it, in one transaction, adds the good pieces (in whole selling packs), deducts the material actually used (oldest lots first), and logs damaged pieces with a reason. A queued batch can be cancelled, releasing its material. *Damage & yield* (managers) reports weighted yield and every defect with its material lots.

Moving selling stock into raw materials is an explicit manager action, refused while a waiting order needs that stock.

## Orders and deliveries

- Any active staff member can write an order and mark it done. A line is a catalogue product, an agreed price, a cut-to-size piece, or a custom piece (no stock).
- Stock moves only when goods leave: marking done or dispatching a delivery. Every stock-moving order action goes through `order_command`: one transaction, rows locked in a fixed order, the change sent as a delta, the order's `revision` checked so a stale screen is refused, and a request id so a retried click cannot move stock twice.
- A delivery links to its order by `deliveries.order_id` (the "Order #N - Name" text remains for display). A delivery that goes out short raises a follow-up for what was left behind, at no second charge.
- Managers can change an order only while nothing has happened to it, call it off (its unsent delivery comes off the board in the same transaction; one that already left stays), or put a finished order back to waiting.
- Orders are never deleted. A customer, product or supplier being removed never removes an order.

## Returns: refund or replacement

Both are Admin/Manager actions on the order screen, both are validated by `order_command`, and both appear in one *Returns* history on the order with who handled them and when (stamped by the database).

- **Refund:** how many of each line came back, what happened to them (*Back on the shelf* or *Thrown away*), the amount, how it was paid and why. Only goods that went out can go back on the shelf. The refund must add exactly its amount to the order's refunded total and never exceed what was paid. Giving back everything calls the order off; a partial refund never changes the status.
- **Replacement:** which line, how many came back (at most what the customer received on it), whether they can be sold again, why, and what goes out instead (normally the same product; another product and quantity can be chosen). Sellable returns go back on the shelf; the replacement comes off it once. No money moves and the order total and status are unchanged. Refused for a called-off order or when the replacement is not on the shelf.

## Customers and loyalty

- A customer's totals (orders, spent, last order, open orders) are summed over their whole history by the database view `customer_order_stats`. An order counts for a customer by `customer_id`, or by the name it was written under when it carries no id.
- **Regular:** at least *N* finished orders (default 3).
- **Loyalty reward:** off by default. A manager sets it on the Customers screen (*Loyalty rules*): after how many finished orders, and what percentage off the items (at most 50%). When an order is written for a saved customer who qualifies, the order form offers the reward and records it on the order (`discount_amount`, `promotion`). The database re-checks eligibility and the maximum when the discount is written; any other discount goes through *Fix the price* (managers).
- Contact details are visible to Admin, Manager, Sales and Delivery staff, and editable by Admin, Manager and Sales. A customer with an order still waiting cannot be removed; removing one keeps their past orders under their name.

## Removing records safely

| Record | What happens |
| --- | --- |
| Order | Never deleted. Called off instead. |
| Product | Archived (hidden from lists and the order form, all history kept, can be put back on sale) if anything refers to it; deleted, both halves in one transaction, only if nothing does. Refused while an order is waiting for it. Admin only. |
| Customer | Admin only, refused while an order is waiting; past orders keep the name. |
| Supplier | Admin only, refused once they have purchase history. |
| Delivery | Only one that never left, by a manager or admin (or automatically when its order is called off). |
| Staff account | Admin only; never the owner or yourself. Stock history keeps the person's name. |

## Roles

| | Admin | Manager | Sales | Production | Delivery |
| --- | :-: | :-: | :-: | :-: | :-: |
| See products, stock, orders, deliveries | ✓ | ✓ | ✓ | ✓ | ✓ |
| Write orders, mark done, move deliveries, receive supplier deliveries | ✓ | ✓ | ✓ | ✓ | ✓ |
| Add/edit products, prices, reorder points | ✓ | ✓ | | | |
| Correct a stock count | ✓ | ✓ | | | |
| Record damaged stock | ✓ | ✓ | | ✓ | |
| Refunds, replacements, price fixes, change/call off/re-open orders | ✓ | ✓ | | | |
| See customer contact details | ✓ | ✓ | ✓ | | ✓ |
| Add/edit customers | ✓ | ✓ | ✓ | | |
| Add/edit suppliers, order materials, settle claims | ✓ | ✓ | | | |
| Loyalty rules, damage & yield report | ✓ | ✓ | | | |
| Production batches | ✓ | ✓ | | ✓ | |
| Remove customers, suppliers, products | ✓ | | | | |
| Staff accounts, activity log | ✓ | | | | |

The same lists are in `src/utils/permissions.js` (screens) and `supabase/schema.sql` (enforcement); `src/utils/permissions.test.js` and `src/utils/permissionsDatabase.test.js` keep them in step.
