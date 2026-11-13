# Changelog

## Unreleased — stock counted back where it really is

### Fixed
- **A delivery that comes back undelivered** can be recorded: *Came back undelivered* puts what it carried back on the shelf and the run back to *Ready to go*. Moving it back a step used to leave the goods deducted.
- **A run that goes out short** raises its follow-up in the same transaction, so goods can no longer be owed with nothing on the board to carry them; a line left behind entirely now counts as *Some left behind*.
- **Calling off or re-opening an order** is refused while one of its deliveries is on the way or has delivered: it used to put goods back on the shelf that were on a van or with the customer.
- **A refund after a replacement** no longer puts back on the shelf goods the replacement already swapped for a different product.
- **Stock promised to an earlier order** can no longer be taken by marking a later one done or sending it out; managers and administrators may still let a later order go first.
- **Printed delivery slips and run sheets** show how many of each line went on the van; the quantity column was blank.
- **Price corrections**: once anything has happened to an order its total moves only with a correction naming the old and new totals, stamped by the database with who made it.
- **Products**: one product per code in any capitalisation; a code cannot be changed by a direct write; archiving and putting back on sale are administrators' only, and a product or stock row is removed only through *Remove* (no direct delete).
- **Finishing a batch** is refused above twice the pieces planned; a manager changes the target first if that many really came out.
- **Production staff** no longer see the deliveries board (they could not read it) and write collected orders only; the database no longer lets them write deliveries blind.
- Order and delivery statuses are checked by the database.

### Database
- New migration `20261113120000_stock_and_delivery_corrections.sql`. Apply it before deploying this client.

## Earlier — orders and deliveries cannot be written round their commands

### Fixed
- **Orders could be finished or faked by a direct write.** Any signed-in account could go straight to the API and mark an order done with nothing taken off the shelf, or type "sent" counts into its lines so a later cancel or re-open put back goods that never left. The database now refuses: a browser may add a waiting order and correct what it says, and everything that has *happened* to an order changes only through `order_command`.
- **Deliveries could skip stages.** A delivery could be written straight to *Delivered*, and its record of what the van carried rewritten. Deliveries now move one stage at a time, an order's delivery goes out only through dispatch, and the manifest cannot be edited.
- **A refund could record money "given back" that was never received.** The database now works out how much of each refund is money handed back — never more than was paid beyond what the order still comes to — and the rest comes off what the customer owes. *Give money back* says the split before saving, and the order screen, the toast and the printed slip say which part was money.
- Refund, replacement and price-correction history can no longer be overwritten by a direct write, a manager's included.

### Database
- New migration `20261110120000_direct_write_guards.sql` (triggers and functions only; no row is changed). Apply it before deploying this client.

## Earlier — admin dashboard redesign

The whole interface now follows the boards in `design/admin-dashboard/`.

### Changed
- **New shell.** A collapsible sidebar (a sheet below 768px), a top bar and a command menu replace the old header and tab bar.
- **Every screen rebuilt to its board**: dashboard, products and stock, raw materials, purchasing, production, orders, deliveries, customers, suppliers, staff and roles, settings, activity, profile, sign-in and forgot-password.
- **Add product and New order are dialogs** over their lists; `/products/new` and `/orders/new` open the list with the dialog up. Editing stays on its own page.
- **One design language**: Inter at 14px, zinc neutrals with a single brand blue, light and dark themes from one token block (`src/index.css`). The old names, colours and breakpoints are gone.
- Browser tests (`npm run test:e2e`) were brought to the new design.

### Removed
- Unused UI primitives (`collapsible`, `radio-group`, `tabs`) and dead helpers left over from the old design (old status maps in `utils/copy.js`, `deliveryChips`, `daySummary`, `takenThisMonth`, `citiesOf`, `FormBand`, `FormFooter`, and others).

### Performance
- The two large sign-in photographs are WebP (about 690KB down to 290KB) and lazy-loaded, so phones, where the photo panel is hidden, no longer download them.

### Database
- No schema or migration changes. The newest migration remains `20261014120000_role_corrections.sql`.

### Docs
- `README.md`, `PRODUCT.md`, `DESIGN.md`, `docs/workflows.md`, `docs/TESTING.md` and `docs/QA-PROMPT.md` describe the new design; `DESIGN.md` is rewritten from the shipped tokens. The redesign prompt moved to `docs/archive/`.
