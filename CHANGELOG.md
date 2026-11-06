# Changelog

## Unreleased — admin dashboard redesign

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
