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
  { key: "main", label: "Main" },
  { key: "people", label: "People" },
];

export const NAV_TREE = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: "LayoutDashboard",
    group: "main",
    views: ["dashboard"],
  },
  {
    key: "products",
    label: "Products & stock",
    icon: "Package",
    group: "main",
    // `count` names the nav count this entry shows. "products" is an ATTENTION
    // count (how many are running low), so it paints clay rather than white --
    // see Shell's NavItem.
    count: "products",
    views: ["products", "product-detail", "product-form"],
  },
  {
    key: "orders",
    label: "Orders",
    icon: "ShoppingCart",
    group: "main",
    count: "orders",
    views: ["orders", "order-detail", "order-form"],
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
  dashboard: { title: "Dashboard" },

  products: { title: "Products & stock" },
  "product-detail": { title: "One product" },
  "product-form": { title: "Add a product" },

  orders: { title: "Orders" },
  "order-detail": { title: "One order" },
  "order-form": { title: "Write a new order" },

  deliveries: { title: "Deliveries" },
  "delivery-detail": { title: "One delivery" },

  customers: { title: "Customers" },
  "customer-detail": { title: "One customer" },

  suppliers: { title: "Suppliers" },
  "supplier-detail": { title: "One supplier" },

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
 * Which screen a header's primary action belongs to, and what it says.
 *
 * One primary per screen, its label a verb, and NO primary at all on the
 * screens where the main action lives in the content (a detail screen's own
 * buttons, a form's footer). An always-present header button would be a second
 * primary competing with those.
 */
export const PRIMARY_ACTION = {
  products: { label: "Add a product", icon: "PackagePlus", view: "product-form" },
  orders: { label: "Write a new order", icon: "ClipboardList", view: "order-form" },
  customers: { label: "Add a customer", icon: "UserPlus", action: "add-customer" },
  suppliers: { label: "Add a supplier", icon: "Handshake", action: "add-supplier", tone: "clay" },
  staff: { label: "Add a staff account", icon: "UserPlus", action: "add-staff" },
};
