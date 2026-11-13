# Changelog

## Unreleased — orders and deliveries cannot be written round their commands

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
