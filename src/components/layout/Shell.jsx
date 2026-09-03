import { Suspense, useEffect, useRef } from "react";

import {
  Bell,
  BookUser,
  ChevronDown,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  Truck,
  UserRound,
  Users,
} from "../icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { avatarColorOf } from "../shared/avatarColors";
import { initialsOf } from "../../utils/staffData";
import { isAdminRole } from "../../utils/permissions";
import { GROUP_OF, NAV_TREE, SECTION_OF } from "../../utils/navigation";

/**
 * The application shell — one navy sidebar, one white title bar, one canvas.
 *
 * WHY THIS REPLACED TWO SHELLS. There used to be `ManagementShell` (7 nav
 * items, cream canvas, title bar) and `AppShell` (4 nav items, gradient canvas,
 * no title bar). Opening User Management swapped one for the other, so half the
 * nav disappeared, "User Management" was relabelled "User Accounts", and the
 * page title bar vanished — the nav appeared to rearrange itself mid-session.
 *
 * WHY IT IS MOUNTED ABOVE THE ROUTER. Each lazy page used to render its own
 * shell, so React unmounted and rebuilt the entire `<aside>` on every
 * navigation — even between two screens using the same shell. Sidebar scroll
 * position, focus and (now) group expand state were destroyed each time, and
 * because `<Suspense>` sat at the root, the first visit to any route blanked
 * the whole window. App.jsx renders this component once, outside `renderView()`,
 * and the Suspense boundary lives inside `<main>` below — so a chunk fetch
 * shows a spinner in the content area while the sidebar stays painted.
 *
 * `isAdmin` is derived here rather than passed in. AppShell defaulted it to
 * `false` on purpose so a screen that forgot to pass it got the SAFE subset;
 * deriving from the profile keeps that fail-closed property and removes eight
 * pass-through props.
 */

// The tree in utils/navigation.js is plain data so that utils/permissions.js
// can derive from it without pulling React or lucide into the permissions
// layer. Icons are resolved to components here instead.
const ICONS = {
  LayoutDashboard,
  Users,
  BookUser,
  History,
  UserRound,
  Package,
  Truck,
};

const ITEM_BASE =
  "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-[13.5px] tracking-[0.135px] transition";

function NavLeaf({ item, isActive, indented = false, onNavigate }) {
  const Icon = ICONS[item.icon];
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.views[0])}
      aria-current={isActive ? "page" : undefined}
      className={`${ITEM_BASE} ${indented ? "pl-11" : ""} ${
        isActive
          ? "bg-[#1746d12e] font-semibold text-white"
          : "font-normal text-white/[0.62] hover:bg-white/[0.05] hover:text-white/85"
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "" : "opacity-70"}`} />
      {item.label}
    </button>
  );
}

export default function Shell({
  view,
  title,
  subtitle,
  profile,
  openGroups = {},
  onToggleGroup,
  onNavigate,
  onSignOut,
  children,
}) {
  const isAdmin = isAdminRole(profile?.role);
  const section = SECTION_OF[view] ?? view;
  const activeGroup = GROUP_OF[section];

  // `<main>` is the scroll container and no longer remounts between views, so
  // without this a jump from a scrolled-down list to a short detail page would
  // land mid-page.
  const mainRef = useRef(null);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [view]);

  // Absent from `openGroups` means "follow the active screen"; present means
  // the user made a choice and it wins — which is what lets someone collapse
  // the very group they are inside.
  const isGroupOpen = (key) => openGroups[key] ?? key === activeGroup;

  const isVisible = (item) =>
    !(item.adminOnly && !isAdmin) && !item.hideFrom?.includes(profile?.role);

  const items = NAV_TREE.filter(isVisible)
    .map((i) => (i.children ? { ...i, children: i.children.filter(isVisible) } : i))
    // A group whose children are all filtered out must not render as an empty
    // parent.
    .filter((i) => !i.children || i.children.length > 0);

  // Admins are labelled "Administrator" throughout the design rather than by
  // the raw "Admin" role string the staff table stores.
  const roleLabel = isAdmin ? "Administrator" : profile?.role;
  const initials = initialsOf(profile?.name);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f2efe7]">
      <aside className="flex w-[232px] shrink-0 flex-col overflow-y-auto border-r border-white/[0.06] bg-[#17263a]">
        <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.07] px-5 pb-5 pt-6">
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

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          <p className="pb-2 pl-2 text-[10px] font-bold uppercase tracking-[1.2px] text-white/25">
            Navigation
          </p>

          {items.map((item) => {
            if (!item.children) {
              return (
                <NavLeaf
                  key={item.key}
                  item={item}
                  isActive={item.key === section}
                  onNavigate={onNavigate}
                />
              );
            }

            const open = isGroupOpen(item.key);
            const Icon = ICONS[item.icon];
            const holdsActive = item.key === activeGroup;

            return (
              <div key={item.key}>
                <button
                  type="button"
                  onClick={() => onToggleGroup?.(item.key, !open)}
                  aria-expanded={open}
                  aria-controls={`nav-group-${item.key}`}
                  className={`${ITEM_BASE} ${
                    holdsActive
                      ? "font-semibold text-white hover:bg-white/[0.05]"
                      : "font-normal text-white/[0.62] hover:bg-white/[0.05] hover:text-white/85"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${holdsActive ? "" : "opacity-70"}`}
                  />
                  <span className="flex-1">{item.label}</span>
                  {/* The blue pill stays exclusive to leaves, so exactly one row
                      is ever marked active. A group holding the active child is
                      signalled with weight and colour only. */}
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${
                      open ? "rotate-0" : "-rotate-90"
                    }`}
                  />
                </button>

                {open && (
                  <div
                    id={`nav-group-${item.key}`}
                    role="group"
                    className="flex flex-col gap-1 pt-1"
                  >
                    {item.children.map((child) => (
                      <NavLeaf
                        key={child.key}
                        item={child}
                        isActive={child.key === section}
                        indented
                        onNavigate={onNavigate}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* The footer is a menu, not a static block: Update Credentials has no
            nav entry of its own and was only ever reachable from AppShell's
            dropdown. Losing it would strand the screen. */}
        <div className="mt-auto shrink-0 border-t border-white/[0.07] p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-white/[0.05] data-[state=open]:bg-white/[0.07]"
              >
                <div
                  className={`flex size-[34px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white shadow-[0_1px_3px_rgba(23,70,209,0.4)] ${avatarColorOf(
                    profile?.name
                  )}`}
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-white/90">
                    {profile?.name || "Signed in"}
                  </p>
                  <p className="truncate text-[11.5px] text-white/40">
                    {roleLabel || "—"}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-white/40" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              sideOffset={8}
              className="w-[212px]"
            >
              <DropdownMenuItem className="gap-3" onSelect={() => onNavigate("profile")}>
                <UserRound className="h-4 w-4 shrink-0 text-[#5f6875]" />
                My Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-3"
                onSelect={() => onNavigate("credentials")}
              >
                <BookUser className="h-4 w-4 shrink-0 text-[#5f6875]" />
                Update Credentials
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-3" onSelect={onSignOut}>
                <LogOut className="h-4 w-4 shrink-0 text-[#5f6875]" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
              <span className="absolute right-2 top-2 size-2 rounded-full border border-white bg-[#1746d1]" />
            </div>
          </div>
        </header>

        {/* The Suspense boundary lives here, not at the root, so a lazy chunk
            fetch replaces only the content area. */}
        <main ref={mainRef} className="flex-1 overflow-y-auto px-8 pb-10 pt-7">
          <Suspense fallback={<ContentFallback />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}

function ContentFallback() {
  return (
    <div className="flex min-h-[320px] w-full items-center justify-center text-sm text-[#5f6875]">
      Loading…
    </div>
  );
}
