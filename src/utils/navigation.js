/**
 * The single source of truth for navigation.
 *
 * One tree, read by the sidebar, the command menu, the route table and the
 * permission checks. `views` is what makes it authoritative rather than
 * decorative: permissions.js derives its allow/deny sets from these same
 * arrays, so a nav entry cannot be hidden while the screen behind it stays
 * reachable. Hiding an entry and denying its screens are the same edit.
 *
 * Structure, labels, icons and order follow the AppSidebar board
 * (design/admin-dashboard/AppSidebar.dc.html): five captioned groups, with
 * Production and Settings opening a sub-menu. A sub-item names its `parent`;
 * the parent itself is not a screen, only a disclosure, so it carries no
 * views and no permissions of its own. It is shown when any of its children
 * is.
 *
 * Deliberately plain data -- no icon imports, no React. That keeps
 * permissions free of a `utils -> components` dependency; the sidebar maps
 * `icon` names (Phosphor's) to components itself.
 *
 * `views[0]` is where an entry navigates to. The rest are the screens that
 * belong to it and keep it lit.
 */

export const NAV_GROUPS = [
  { key: "overview", label: "Overview" },
  { key: "operations", label: "Operations" },
  { key: "people", label: "People" },
  { key: "contacts", label: "Contacts" },
  { key: "system", label: "System" },
];

/** The two disclosures. `count` names the nav count the parent shows. */
export const NAV_PARENTS = {
  production: { key: "production", label: "Production", icon: "Hammer", group: "operations", count: "batches", countLabel: "unfinished batches" },
  settings: { key: "settings", label: "Settings", icon: "Gear", group: "system" },
};

export const NAV_TREE = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: "SquaresFour",
    group: "overview",
    views: ["dashboard"],
  },
  {
    key: "orders",
    label: "Orders",
    icon: "Receipt",
    group: "operations",
    count: "orders",
    countLabel: "open",
    views: ["orders", "order-detail", "order-form", "order-edit"],
  },
  {
    key: "products",
    label: "Inventory",
    icon: "Package",
    group: "operations",
    // An ATTENTION count: how many products are running low or out.
    count: "products",
    countLabel: "running low",
    views: ["products", "product-detail", "product-form"],
  },
  {
    key: "deliveries",
    label: "Deliveries",
    icon: "Truck",
    group: "operations",
    count: "deliveries",
    countLabel: "open",
    views: ["deliveries", "delivery-detail"],
  },
  {
    key: "production",
    label: "Batches",
    parent: "production",
    group: "operations",
    hideFrom: ["Sales Staff", "Delivery Staff"],
    views: ["production"],
  },
  {
    key: "raw-materials",
    label: "Raw materials",
    parent: "production",
    group: "operations",
    views: ["raw-materials", "raw-material-detail"],
  },
  {
    key: "raw-material-orders",
    label: "Purchasing",
    parent: "production",
    group: "operations",
    views: ["raw-material-orders"],
  },
  {
    // VIEW_CAPABILITY below keeps it to managers as well.
    key: "production-report",
    label: "Production report",
    parent: "production",
    group: "operations",
    hideFrom: ["Sales Staff", "Delivery Staff"],
    views: ["production-report"],
  },
  {
    key: "staff",
    label: "User Management",
    icon: "Users",
    group: "people",
    adminOnly: true,
    count: "accounts",
    countLabel: "accounts",
    views: ["staff", "manage-account", "assign-role"],
  },
  {
    key: "directory",
    label: "Staff Directory",
    icon: "IdentificationCard",
    group: "people",
    adminOnly: true,
    count: "people",
    countLabel: "people",
    views: ["directory"],
  },
  {
    key: "customers",
    label: "Customers",
    icon: "Storefront",
    group: "contacts",
    hideFrom: ["Production Staff"],
    count: "customers",
    views: ["customers", "customer-detail"],
  },
  {
    key: "suppliers",
    label: "Suppliers",
    icon: "Factory",
    group: "contacts",
    hideFrom: ["Production Staff"],
    count: "suppliers",
    views: ["suppliers", "supplier-detail"],
  },
  // Settings. General, Notifications and editing roles have no backend yet:
  // their screens are built to the design with nothing to save to, so their
  // controls are disabled (see components/settings). They are kept to
  // administrators, like the activity log beside them.
  {
    key: "settings-general",
    label: "General",
    parent: "settings",
    group: "system",
    adminOnly: true,
    views: ["settings-general"],
  },
  {
    key: "settings-roles",
    label: "Roles and permissions",
    parent: "settings",
    group: "system",
    adminOnly: true,
    views: ["settings-roles"],
  },
  {
    key: "settings-notifications",
    label: "Notifications",
    parent: "settings",
    group: "system",
    adminOnly: true,
    views: ["settings-notifications"],
  },
  {
    key: "activity",
    label: "Activity log",
    parent: "settings",
    group: "system",
    adminOnly: true,
    views: ["activity"],
  },
];

/**
 * Screens with no nav entry, listed so the route gate still knows about
 * them. Reached from the sidebar's account menu.
 */
export const ACCOUNT_VIEWS = ["profile"];

const viewsOf = (item) => item.views;

/** view key -> nav key. A customer detail screen keeps "Customers" lit. */
export const SECTION_OF = Object.fromEntries(
  NAV_TREE.flatMap((item) => item.views.map((view) => [view, item.key]))
);

/**
 * Derived, never hand-written.
 *
 * `adminOnly` and `hideFrom` feed the route gate as well as the sidebar, so
 * hiding an entry and denying its screens are the same edit.
 */
export const ADMIN_ONLY_VIEWS = new Set(
  NAV_TREE.filter((item) => item.adminOnly).flatMap(viewsOf)
);

export const DENIED_BY_ROLE = (() => {
  const out = {};
  for (const item of NAV_TREE) {
    for (const role of item.hideFrom ?? []) {
      for (const view of viewsOf(item)) (out[role] ??= new Set()).add(view);
    }
  }
  return out;
})();

/**
 * Screens that need more than their section does. Everybody can look at
 * products and orders; changing a product or rewriting an order is a
 * manager's job. Capability names are the ones in utils/permissions.js.
 */
export const VIEW_CAPABILITY = {
  "product-form": "manageCatalogue",
  "order-edit": "handleMoney",
  "production-report": "viewReports",
};

/** Screens that render without the shell -- pre-auth, and the boot state. */
export const CHROMELESS_VIEWS = new Set([
  "checking-session",
  "login",
  "forgot-password",
  "reset-password",
]);

/**
 * The breadcrumb and help copy, keyed by view.
 *
 * This lives here rather than on each page because the shell renders ABOVE
 * the lazy boundary: it has to know the title before the page's chunk
 * exists. `help` is what the command menu's "Help on this page" says.
 */
const VIEW_META = {
  "raw-materials": { title: "Raw materials", help: "Everything the workshop builds with. Stock comes in when a supplier order is received and goes out when a production batch is finished. Open a material to see every movement." },
  "raw-material-detail": { title: "Raw material", help: "The count on hand, what batches have set aside, and every stock movement for this material with who made it and why." },
  "raw-material-orders": { title: "Purchasing", help: "Order raw materials from a supplier, then receive the delivery when it arrives. Only the usable units counted at receiving are added to stock." },
  production: { title: "Batches", help: "Plan a batch, make it, check it and finish it. Material is set aside when a batch is planned and deducted only when it is finished; the good pieces are added to Inventory at the same moment." },
  "production-report": { title: "Production report", help: "Good pieces, damaged pieces and yield across every finished batch, and damage found on supplier deliveries." },
  dashboard: { title: "Dashboard", help: "What needs attention today. Each line opens the screen where it can be dealt with." },

  products: { title: "Inventory", help: "What is sold, its price and how many are on the shelf. Stock goes up when a production batch is finished and down when an order is completed or sent out." },
  "product-detail": { title: "Product", help: "The shelf count, what waiting orders have set aside, and every stock movement for this product." },
  "product-form": { title: "Add product", help: "Choose the kind first: it decides which measurements are asked for. The item code is made for you." },

  orders: { title: "Orders", help: "Customer orders. Stock is set aside while an order is waiting and taken off the shelf when it is completed or sent out." },
  "order-detail": { title: "Order" },
  "order-form": { title: "New order" },
  "order-edit": { title: "Edit order" },

  deliveries: { title: "Deliveries", help: "Every delivery by stage. Goods leave the shelf when a delivery is marked as on the way. Production work is planned under Production." },
  "delivery-detail": { title: "Delivery" },

  customers: { title: "Customers" },
  "customer-detail": { title: "Customer" },

  suppliers: { title: "Suppliers" },
  "supplier-detail": { title: "Supplier" },

  staff: { title: "User Management" },
  "manage-account": { title: "Account details" },
  "assign-role": { title: "Change role" },
  directory: { title: "Staff Directory" },
  activity: { title: "Activity log" },

  "settings-general": { title: "General" },
  "settings-roles": { title: "Roles and permissions" },
  "settings-notifications": { title: "Notifications" },

  profile: { title: "Your profile" },
  "not-found": { title: "Page not found" },
};

export function metaForView(view) {
  return VIEW_META[view] ?? { title: "" };
}

/**
 * The breadcrumb for a view: { section, sectionView, page }.
 *
 * A list screen reads "Group / Entry" (Operations / Orders); a sub-item reads
 * "Parent / Entry" (Production / Batches); a record reads "Entry / record"
 * (Orders / #2048), where the entry links back to its list. `record` is the
 * record's name when the caller has it.
 */
export function crumbForView(view, record) {
  if (ACCOUNT_VIEWS.includes(view)) {
    return { section: "Account", sectionView: view === "profile" ? null : "profile", page: metaForView(view).title };
  }
  const item = NAV_TREE.find((entry) => entry.views.includes(view));
  if (!item) return { section: "", page: metaForView(view).title };
  if (view !== item.views[0]) {
    return { section: item.label, sectionView: item.views[0], page: record || metaForView(view).title };
  }
  if (item.parent) return { section: NAV_PARENTS[item.parent].label, page: item.label };
  return { section: NAV_GROUPS.find((group) => group.key === item.group)?.label ?? "", page: item.label };
}

/**
 * Each list screen's primary action: what it says and who may see it.
 * Drawn in the PageHeader, the one primary button on the view. `capability`
 * hides it from a role the database would refuse (see utils/permissions.js).
 */
export const PRIMARY_ACTION = {
  products: { label: "Add product", capability: "manageCatalogue" },
  orders: { label: "New order" },
  customers: { label: "Add customer", capability: "editCustomers" },
  suppliers: { label: "Add supplier", capability: "manageSuppliers" },
  staff: { label: "Add user", capability: "manageStaff" },
};
