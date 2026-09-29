/**
 * The single source of truth for navigation.
 *
 * WHY THIS FILE EXISTS. The app had two sidebars — one with 7 items and one
 * with 4 — plus a third hand-maintained copy of the same rules in
 * utils/permissions.js. Opening User Management swapped one for the other, so
 * the nav visibly changed out from under you, and the three lists had to be
 * edited in lockstep or they drifted. That drift is exactly how a non-admin was
 * once able to walk into the user-management screens.
 *
 * Now there is one tree. `views` is what makes it authoritative rather than
 * decorative: permissions.js derives its allow/deny sets from these same
 * arrays, so a nav entry cannot be hidden while the screen behind it stays
 * reachable.
 *
 * WHAT THE OVERHAUL CHANGED HERE:
 *
 *  - LABELS ARE PLAIN WORDS. "Inventory" and "Product / Item Profiles" were
 *    two entries for one question ("how many have we got"), and both are now
 *    "Products & stock". "User Management" is "Staff & accounts". A label
 *    naming the database table it opens is a label written for whoever built
 *    the system.
 *  - GROUPS ARE LABELS, NOT ACCORDIONS. There are two, MAIN and PEOPLE, and
 *    they are captions over a flat list. The collapsible groups they replace
 *    hid three of the seven destinations behind a disclosure triangle, which
 *    is a click and a guess to reach a screen that was always there.
 *  - ORDERS AND DELIVERIES ARE ROUTED. They were the last screens living in
 *    the unrouted legacy workspace, reachable only through a placeholder on
 *    the dashboard.
 *  - MY PROFILE IS NOT IN THE SIDEBAR. It lives in the header's account chip,
 *    with sign-out and the dashboard-view preference — the three things that
 *    are about the person rather than about the business.
 *
 * Deliberately plain data — no icon imports, no React. That keeps permissions
 * free of a `utils -> components` dependency; the sidebar maps `icon` names to
 * components itself.
 *
 * `views[0]` is where an entry navigates to. The rest are the screens that
 * belong to it and keep it lit.
 */

export const NAV_GROUPS = [
  { key: "main", label: "Sales" },
  { key: "stock", label: "Stock & production" },
  { key: "people", label: "People" },
];

/**
 * THE WORKSHOP IS THREE DESTINATIONS, NOT ONE WITH TABS. Raw materials,
 * purchasing and production used to sit behind a row of tabs inside "Raw
 * materials", so ordering material meant Raw materials -> Supplier deliveries
 * -> Order materials, and production was a tab called "Make list" that people
 * went looking for under Deliveries (whose board has a "Being made" column).
 * Each is its own entry now, under one caption, in the order stock moves:
 * bought in, held, made into products, sold.
 */
export const NAV_TREE = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: "LayoutDashboard",
    group: "main",
    views: ["dashboard"],
  },
  {
    key: "orders",
    label: "Orders",
    icon: "ShoppingCart",
    group: "main",
    count: "orders",
    views: ["orders", "order-detail", "order-form", "order-edit"],
  },
  {
    key: "deliveries",
    label: "Deliveries",
    icon: "Truck",
    group: "main",
    count: "deliveries",
    views: ["deliveries", "delivery-detail"],
  },
  {
    key: "raw-material-orders", label: "Purchasing", icon: "ClipboardList", group: "stock",
    views: ["raw-material-orders"],
  },
  {
    key: "raw-materials", label: "Raw materials", icon: "Layers", group: "stock",
    views: ["raw-materials", "raw-material-detail"],
  },
  {
    // "Damage & yield" is the production report, so it lives here as a tab
    // rather than as its own entry. VIEW_CAPABILITY below keeps it to
    // managers, which hideFrom on its old entry used to do.
    key: "production", label: "Production", icon: "Hammer", group: "stock",
    hideFrom: ["Sales Staff", "Delivery Staff"], views: ["production", "production-report"],
  },
  {
    key: "products",
    label: "Products & stock",
    // The word the icon rail and phone tab bar lead with when there is only
    // room for one -- a DELIBERATE choice, not `label.split(" ")[0]` picked
    // for you. Falls back to that split when omitted (see Shell's
    // `shortLabel`), which happens to agree here, but a label edit can no
    // longer silently change what the compact nav says.
    shortLabel: "Products",
    icon: "Package",
    group: "stock",
    // `count` names the nav count this entry shows. "products" is an ATTENTION
    // count (how many are running low), so it paints clay rather than white --
    // see Shell's NavItem.
    count: "products",
    views: ["products", "product-detail", "product-form"],
  },
  {
    key: "customers",
    label: "Customers",
    icon: "UserRound",
    group: "people",
    hideFrom: ["Production Staff"],
    views: ["customers", "customer-detail"],
  },
  {
    key: "suppliers",
    label: "Suppliers",
    icon: "Handshake",
    group: "people",
    hideFrom: ["Production Staff"],
    views: ["suppliers", "supplier-detail"],
  },
  {
    key: "staff",
    label: "Staff & accounts",
    shortLabel: "Staff",
    icon: "Users",
    group: "people",
    adminOnly: true,
    // The directory and the activity log have no nav entry of their own -- they
    // are reached from this screen and from the dashboard's "See all" -- but
    // they belong to this section, so opening either keeps it lit.
    views: ["staff", "manage-account", "assign-role", "directory", "activity"],
  },
];

/**
 * Which sections a role's phone tab bar leads with. The bar has room for four
 * before "More", and the right four depend on the job: a production worker
 * should not have to open "More" to reach production.
 */
export const PHONE_FIRST = {
  default: ["dashboard", "orders", "products", "deliveries"],
  "Sales Staff": ["dashboard", "orders", "customers", "products"],
  "Production Staff": ["dashboard", "production", "raw-materials", "products"],
  "Delivery Staff": ["dashboard", "deliveries", "orders", "raw-material-orders"],
};

/**
 * Screens with no nav entry, listed so the route gate and SECTION_OF still
 * know about them. All three are reached from the header's account chip.
 */
export const ACCOUNT_VIEWS = ["profile", "profile-edit", "change-password"];

const viewsOf = (item) => item.views;

/**
 * view key -> nav key. A customer detail screen keeps "Customers" lit.
 */
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

/** Screens that render without the shell — pre-auth, and the boot state. */
export const CHROMELESS_VIEWS = new Set([
  "checking-session",
  "login",
  "forgot-password",
  "reset-password",
]);

/**
 * Header copy, keyed by view.
 *
 * This lives here rather than on each page because the shell renders ABOVE the
 * lazy boundary — it has to know the title before the page's chunk exists.
 * Were the title supplied by the page, the header would sit blank for the whole
 * chunk download, which is the exact flash the persistent shell removed.
 *
 * `context` is the SECOND line, and it is not a breadcrumb any more. A
 * breadcrumb ("Dashboard / Product / Item Profiles") restates the sidebar,
 * which is on screen. What a list screen's second line is for is a count —
 * "148 products · 7 running low" — and what a detail screen's is for is which
 * record you are looking at. Anything the shell cannot know without the data is
 * left to the screen, which passes it up via `contextLine`.
 */
const VIEW_META = {
  "raw-materials": { title: "Raw materials", help: "Everything the workshop builds with. Stock comes in when a supplier order is received and goes out when a production batch is finished. Open a material to see every movement." },
  "raw-material-detail": { title: "Raw material details", help: "The count on hand, what batches have set aside, and every stock movement for this material with who made it and why." },
  "raw-material-orders": { title: "Purchasing", help: "Order raw materials from a supplier, then receive the delivery when it arrives. Only the usable units counted at receiving are added to stock." },
  production: { title: "Production", help: "Plan a batch, make it, check it and finish it. Material is set aside when a batch is planned and deducted only when it is finished; the good pieces are added to Products & stock at the same moment." },
  "production-report": { title: "Production report", help: "Good pieces, damaged pieces and yield across every finished batch, and damage found on supplier deliveries." },
  dashboard: { title: "Dashboard", help: "What needs attention today. Each line opens the screen where it can be dealt with." },

  products: { title: "Products & stock", help: "What is sold, its price and how many are on the shelf. Stock goes up when a production batch is finished and down when an order is completed or sent out." },
  "product-detail": { title: "Product details", help: "The shelf count, what waiting orders have set aside, and every stock movement for this product." },
  "product-form": { title: "Add a product", help: "Choose the kind first: it decides which measurements are asked for. The item code is made for you." },

  orders: { title: "Orders", help: "Customer orders. Stock is set aside while an order is waiting and taken off the shelf when it is completed or sent out." },
  "order-detail": { title: "Order details" },
  "order-form": { title: "Create an order" },
  // Its own key rather than a flag on order-form, so the heading is not lying
  // about what the screen is doing. Same tree, same permission as the rest of
  // orders -- see NAV_TREE above.
  "order-edit": { title: "Change this order" },

  deliveries: { title: "Deliveries", help: "Every delivery by stage. Goods leave the shelf when a delivery is marked as on the way. Production work is planned under Production." },
  "delivery-detail": { title: "Delivery details" },

  customers: { title: "Customers" },
  "customer-detail": { title: "Customer details" },

  suppliers: { title: "Suppliers" },
  "supplier-detail": { title: "Supplier details" },

  staff: { title: "Staff & accounts" },
  "manage-account": { title: "Manage one account" },
  "assign-role": { title: "What does this person do?" },
  directory: { title: "Who to call for what" },
  activity: { title: "What happened recently" },

  profile: { title: "My profile" },
  "profile-edit": { title: "Edit my details" },
  "change-password": { title: "Change password" },
};

export function metaForView(view) {
  return VIEW_META[view] ?? { title: "" };
}

/**
 * Each list screen's primary action: what it says and who may see it.
 *
 * It is drawn IN THE PAGE, beside the search and filters, not in the header.
 * Reviewers looked for "Add a product" and "Create order" on the screen they
 * were working on and did not find the header copy; the workshop screens
 * already put theirs in the page, so every screen now does it one way.
 *
 * `capability` hides it from a role the database would refuse (see
 * utils/permissions.js).
 */
export const PRIMARY_ACTION = {
  products: { label: "Add a product", icon: "PackagePlus", view: "product-form", capability: "manageCatalogue" },
  orders: { label: "Create order", icon: "ClipboardList", view: "order-form" },
  customers: { label: "Add a customer", icon: "UserPlus", action: "add-customer", capability: "editCustomers" },
  suppliers: { label: "Add a supplier", icon: "Handshake", action: "add-supplier", tone: "clay", capability: "manageSuppliers" },
  staff: { label: "Add a staff account", icon: "UserPlus", action: "add-staff", capability: "manageStaff" },
};
