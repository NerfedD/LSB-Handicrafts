/**
 * The single source of truth for navigation.
 *
 * WHY THIS FILE EXISTS. The app had two sidebars — layout/ManagementShell with
 * 7 items and layout/AppShell with 4 — plus a third hand-maintained copy of the
 * same rules in utils/permissions.js. Opening User Management swapped one for
 * the other, so the nav visibly changed out from under you, and the three lists
 * had to be edited in lockstep or they drifted. That drift is exactly how a
 * non-admin was once able to walk into the user-management screens.
 *
 * Now there is one tree. `views` is what makes it authoritative rather than
 * decorative: permissions.js derives its allow/deny sets from these same
 * arrays, so a nav entry cannot be hidden while the screen behind it stays
 * reachable.
 *
 * Deliberately plain data — no icon imports, no React. That keeps permissions
 * free of a `utils -> components` dependency; the sidebar maps `icon` names to
 * components itself.
 *
 * `views[0]` is where the entry navigates to. The rest are the detail screens
 * that belong to it and keep it lit.
 */

export const NAV_TREE = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: "LayoutDashboard",
    views: ["dashboard", "workspace"],
  },

  {
    key: "user-management",
    label: "User Management",
    icon: "Users",
    adminOnly: true,
    children: [
      {
        key: "accounts",
        label: "User Accounts",
        icon: "Users",
        views: ["accounts", "manage-account", "assign-role"],
      },
    ],
  },

  {
    key: "staff",
    label: "Staff",
    icon: "BookUser",
    adminOnly: true,
    children: [
      { key: "activity", label: "Staff Activity Log", icon: "History", views: ["activity"] },
      { key: "directory", label: "Staff Directory", icon: "BookUser", views: ["directory"] },
    ],
  },

  {
    key: "customers",
    label: "Customer Profiles",
    icon: "UserRound",
    hideFrom: ["Production Staff"],
    views: ["customers", "customer-detail"],
  },

  {
    key: "products",
    label: "Product / Item Profiles",
    icon: "Package",
    views: ["products", "product-detail"],
  },

  {
    key: "suppliers",
    label: "Supplier Profiles",
    icon: "Truck",
    hideFrom: ["Production Staff"],
    views: ["suppliers", "supplier-detail"],
  },

  {
    key: "profile",
    label: "My Profile",
    icon: "UserRound",
    views: ["profile", "update-profile", "credentials"],
  },
];

const leavesOf = (item) => item.children ?? [item];
const viewsOf = (item) => leavesOf(item).flatMap((leaf) => leaf.views);

/**
 * view key -> leaf nav key. Replaces the SECTION_OF maps both shells kept.
 * A customer detail screen keeps "Customer Profiles" lit.
 */
export const SECTION_OF = Object.fromEntries(
  NAV_TREE.flatMap((item) =>
    leavesOf(item).flatMap((leaf) => leaf.views.map((v) => [v, leaf.key]))
  )
);

/** leaf nav key -> parent group key. Drives which group auto-expands. */
export const GROUP_OF = Object.fromEntries(
  NAV_TREE.filter((i) => i.children).flatMap((g) =>
    g.children.map((c) => [c.key, g.key])
  )
);

/**
 * Derived, never hand-written.
 *
 * `adminOnly` and `hideFrom` feed the route gate. `staffOnly` deliberately does
 * not exist any more: it only ever trimmed the sidebar, and an admin must still
 * be able to open their own profile.
 */
export const ADMIN_ONLY_VIEWS = new Set(
  NAV_TREE.filter((i) => i.adminOnly).flatMap(viewsOf)
);

export const DENIED_BY_ROLE = (() => {
  const out = {};
  for (const item of NAV_TREE) {
    for (const role of item.hideFrom ?? []) {
      for (const v of viewsOf(item)) (out[role] ??= new Set()).add(v);
    }
  }
  return out;
})();

/** Views that render without the shell — pre-auth screens and the boot state. */
export const CHROMELESS_VIEWS = new Set([
  "checking-session",
  "login",
  "forgot-password",
  "reset-password",
]);

/**
 * Header-bar copy, keyed by view.
 *
 * This lives here rather than on each page because the shell renders ABOVE the
 * lazy boundary — it has to know the title before the page chunk exists. Were
 * the title supplied by the page, the header would sit blank for the whole
 * chunk download, which is the exact flash this refactor removes.
 *
 * The ManagementShell entries are the strings those pages already passed. The
 * eight ex-AppShell screens never had a header bar, so their copy is taken from
 * the page heading each one renders inline today (and that inline heading is
 * removed, so the title is not shown twice).
 */
const VIEW_META = {
  dashboard: { title: "Dashboard", subtitle: "Overview of your system" },
  workspace: { title: "Inventory Workspace", subtitle: "Inventory, deliveries and orders" },

  accounts: { title: "User Accounts", subtitle: "View and manage registered system users." },
  "manage-account": { title: "Manage User Account", subtitle: "User Management / Manage Account" },
  "assign-role": { title: "Assign Staff Role", subtitle: "User Management / Assign Role" },

  activity: { title: "Staff Activity Log", subtitle: "A record of staff actions and system activity." },
  directory: { title: "Staff Directory", subtitle: "Staff roles and contact information." },

  customers: { title: "Customer Profiles", subtitle: "Manage customer information and contact details." },
  "customer-detail": { title: "Customer Details", subtitle: "Customer Profiles / Customer Details" },

  products: { title: "Product / Item Profiles", subtitle: "Dashboard / Product / Item Profiles" },
  "product-detail": { title: "Product / Item Details", subtitle: "Product / Item Profiles / Details" },

  suppliers: { title: "Supplier Profiles", subtitle: "Dashboard / Supplier Profiles" },
  "supplier-detail": { title: "Supplier Details", subtitle: "Supplier Profiles / Supplier Details" },

  profile: { title: "My Profile", subtitle: "Your registered account information." },
  "update-profile": { title: "Update Profile", subtitle: "My Profile / Update Profile" },
  credentials: { title: "Update Credentials", subtitle: "My Profile / Update Credentials" },
};

// The only role-dependent header in the app: the Sales and Production
// dashboards each carried their own subtitle.
const DASHBOARD_SUBTITLE = {
  "Sales Staff": "Overview of your sales workspace.",
  "Production Staff": "Overview of your production workspace.",
};

export function metaForView(view, role) {
  const base = VIEW_META[view] ?? { title: "", subtitle: "" };
  if (view !== "dashboard") return base;
  return { ...base, subtitle: DASHBOARD_SUBTITLE[role] ?? base.subtitle };
}
