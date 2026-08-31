import {
  Bell,
  ChevronDown,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  Truck,
  UserRound,
  Users,
} from "../icons";
import { avatarColorOf } from "../shared/avatarColors";
import { initialsOf } from "../../utils/staffData";

/**
 * Shell for the profile-management screens — Figma #13-#22 (node 158:8 is the
 * sidebar, 158:105 the header). Navy fixed sidebar on the left, warm #f2efe7
 * canvas with a white title bar on the right.
 *
 * This is deliberately a third layout rather than a change to either existing
 * one: AppShell (screens #1-#12) is a top-tab bar on a gradient, and
 * layout/Sidebar is the dark-mode workspace chrome. The design gives this
 * section its own chrome, so it gets its own component.
 *
 * `active` is the view key of the current screen, matched against nav items
 * and their sub-screens (a customer detail page keeps "Customer Profiles" lit).
 */

// Which nav item stays highlighted for each screen. Detail and form views
// aren't nav destinations themselves but belong to a section.
const SECTION_OF = {
  dashboard: "dashboard",
  workspace: "dashboard",
  accounts: "accounts",
  "manage-account": "accounts",
  "assign-role": "accounts",
  create: "accounts",
  customers: "customers",
  "customer-detail": "customers",
  "customer-form": "customers",
  products: "products",
  "product-detail": "products",
  "product-form": "products",
  suppliers: "suppliers",
  "supplier-detail": "suppliers",
  "supplier-form": "suppliers",
  activity: "activity",
  profile: "profile",
  "update-profile": "profile",
  credentials: "profile",
};

// `adminOnly` items are hidden from everyone else; `staffOnly` is the reverse.
// Admins reach their own record through User Management instead, which is why
// they don't get a My Profile entry (Figma 158:22 vs 164:8).
//
// `hideFrom` narrows an item further, for roles whose designed dashboard shows
// a shorter sidebar: Production Staff (Figma #24) get Dashboard, Product / Item
// Profiles and My Profile only. Roles not listed keep the full staff nav.
const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { key: "accounts", label: "User Management", Icon: Users, adminOnly: true },
  { key: "customers", label: "Customer Profiles", Icon: UserRound, hideFrom: ["Production Staff"] },
  { key: "products", label: "Product / Item Profiles", Icon: Package },
  { key: "suppliers", label: "Supplier Profiles", Icon: Truck, hideFrom: ["Production Staff"] },
  { key: "activity", label: "Staff Activity Log", Icon: History, adminOnly: true },
  { key: "profile", label: "My Profile", Icon: UserRound, staffOnly: true },
];

export default function ManagementShell({
  active,
  title,
  subtitle,
  profile,
  onNavigate,
  onSignOut,
  children,
}) {
  const isAdmin = profile?.role === "Admin";
  const section = SECTION_OF[active] ?? active;
  const items = NAV_ITEMS.filter(
    (item) =>
      !(item.adminOnly && !isAdmin) &&
      !(item.staffOnly && isAdmin) &&
      !item.hideFrom?.includes(profile?.role)
  );

  // Admins are labelled "Administrator" throughout the design rather than by
  // the raw "Admin" role string the staff table stores.
  const roleLabel = isAdmin ? "Administrator" : profile?.role;
  const initials = initialsOf(profile?.name);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f2efe7]">
      <aside className="flex w-[232px] shrink-0 flex-col overflow-y-auto border-r border-white/[0.06] bg-[#17263a]">
        <div className="flex shrink-0 items-center gap-2.5 border-b border-white/[0.07] px-5 pb-5 pt-6">
          <div className="flex size-[34px] shrink-0 items-center justify-center rounded-lg border border-white/[0.16] bg-white/10">
            <span className="text-[10.5px] font-extrabold tracking-[0.42px] text-white">
              LSB
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold tracking-[0.13px] text-white">
              LSB Handicrafts
            </p>
            <p className="text-[10.5px] tracking-[0.525px] text-white/[0.38]">
              MANAGEMENT SYSTEM
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
          <p className="pb-2 pl-2 text-[10px] font-bold uppercase tracking-[1.2px] text-white/25">
            Navigation
          </p>
          {items.map((item) => {
            const { key, label } = item;
            const Icon = item.Icon;
            const isActive = key === section;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onNavigate(key)}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-left text-[13.5px] tracking-[0.135px] transition ${
                  isActive
                    ? "bg-[#1746d12e] font-semibold text-white"
                    : "font-normal text-white/[0.62] hover:bg-white/[0.05] hover:text-white/85"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${isActive ? "" : "opacity-70"}`}
                />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-white/[0.07] px-3 py-4">
          <div className="flex items-center gap-2.5 rounded-lg px-3 py-2.5">
            <div
              className={`flex size-[34px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white shadow-[0_1px_3px_rgba(23,70,209,0.4)] ${avatarColorOf(
                profile?.name
              )}`}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-white/90">
                {profile?.name}
              </p>
              <p className="truncate text-[11.5px] text-white/40">{roleLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium text-white/[0.42] transition hover:bg-white/[0.05] hover:text-white/75"
          >
            <LogOut className="h-[15px] w-[15px] shrink-0" />
            Log Out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-[#17263a14] bg-white px-8 shadow-[0_1px_1.5px_rgba(23,38,58,0.04)]">
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-bold tracking-[-0.17px] text-[#17263a]">
              {title}
            </h1>
            <p className="truncate text-[12.5px] text-[#5f6875]">{subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            {/* Notifications aren't wired to anything yet — the design shows the
                unread dot, so it's drawn but the control is inert. */}
            <div
              className="relative flex size-9 items-center justify-center rounded-lg border border-[#17263a1a] text-[#17263a]"
              aria-hidden="true"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-[9px] top-[7px] size-1.5 rounded-full border border-white bg-[#1746d1]" />
            </div>
            <div className="flex items-center gap-2.5 rounded-3xl border border-[#17263a1a] py-1.5 pl-2 pr-3">
              <div
                className={`flex size-[26px] shrink-0 items-center justify-center rounded-full text-[9.5px] font-bold text-white ${avatarColorOf(
                  profile?.name
                )}`}
              >
                {initials}
              </div>
              <span className="whitespace-nowrap text-[13px] font-semibold text-[#17263a]">
                {roleLabel}
              </span>
              <ChevronDown className="h-3 w-3 shrink-0 text-[#5f6875]" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-8 pb-10 pt-7">{children}</main>
      </div>
    </div>
  );
}
