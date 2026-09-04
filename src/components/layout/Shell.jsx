import { Suspense, useEffect, useMemo, useRef } from "react";

import logo from "../../assets/Logo-128.png";
import {
  ALargeSmall,
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Handshake,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Moon,
  Package,
  PackagePlus,
  ShoppingCart,
  Settings,
  Sun,
  Truck,
  UserPlus,
  UserRound,
  Users,
} from "../icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Avatar } from "../shared/Chip";
import { AlertBadge, CountBadge } from "../shared/StatusPill";
import { isAdminRole } from "../../utils/permissions";
import { NAV_GROUPS, NAV_TREE, PRIMARY_ACTION, SECTION_OF } from "../../utils/navigation";
import { DASHBOARD_VIEW } from "../../utils/constants";
import useTheme from "../../hooks/useTheme";
import { roleLabel } from "../../utils/copy";

/**
 * The application shell — one navy sidebar, one white header, one paper canvas.
 *
 * WHY IT IS MOUNTED ABOVE THE ROUTER. Each lazy page used to render its own
 * shell, so React unmounted and rebuilt the entire `<aside>` on every
 * navigation. Sidebar scroll position and focus were destroyed each time, and
 * because `<Suspense>` sat at the root, the first visit to any route blanked
 * the whole window. App.jsx renders this once, outside renderView(), and the
 * Suspense boundary lives inside `<main>` — so a chunk fetch shows a spinner in
 * the content area while the chrome stays painted.
 *
 * THREE LAYOUTS, ONE COMPONENT:
 *
 *   ≥1280px  the full 260px sidebar
 *   834px+   an 84px icon rail, each item an icon over a word
 *   <834px   a 56px bottom tab bar, five targets, icon over word
 *
 * All three are rendered and shown by media query rather than switched on a
 * measured width. A JS-measured layout flashes the wrong one on first paint
 * and again on every resize, and this chrome is the first thing on screen.
 *
 * NO ICON-ONLY TARGETS ANYWHERE, including the 84px rail and the tab bar. Rule
 * 3 has no exception for small screens — an unlabelled icon is a guess whatever
 * the viewport.
 *
 * `isAdmin` is derived here rather than passed in, which keeps the fail-closed
 * property the old shell had (a screen that forgot to pass it got the SAFE
 * subset) and removes eight pass-through props.
 */

// The tree in utils/navigation.js is plain data so utils/permissions.js can
// derive from it without pulling React or lucide into the permissions layer.
// Icons resolve to components here instead.
const ICONS = {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  UserRound,
  Handshake,
  Users,
  PackagePlus,
  ClipboardList,
  UserPlus,
};

/**
 * The one word a nav item shows when there is only room for one — the 84px
 * rail and the phone tab bar.
 *
 * "Products & stock" at 10.5px in an 84px column truncates to "Produc…", which
 * is the same as having no label at all. The first word survives, and the full
 * label is still announced to assistive tech, so nothing is actually lost.
 */
const shortLabel = (label) => label.split(" ")[0];

export default function Shell({
  view,
  title,
  /** The header's second line. Screens supply it because it is usually a count. */
  contextLine,
  profile,
  /** { products, orders, deliveries } — counts for the nav badges. */
  navCounts = {},
  alertCount = 0,
  dashboardView = DASHBOARD_VIEW.STANDARD,
  onNavigate,
  onSignOut,
  onSetDashboardView,
  onPrimaryAction,
  onOpenAlerts,
  onHelp,
  children,
}) {
  const isAdmin = isAdminRole(profile?.role);
  const section = SECTION_OF[view] ?? view;
  const [theme, setTheme] = useTheme();

  // `<main>` is the scroll container and no longer remounts between views, so
  // without this a jump from a scrolled-down list to a short detail screen
  // would land mid-page.
  const mainRef = useRef(null);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [view]);

  const items = useMemo(
    () =>
      NAV_TREE.filter(
        (item) =>
          !(item.adminOnly && !isAdmin) && !item.hideFrom?.includes(profile?.role)
      ),
    [isAdmin, profile?.role]
  );

  // The large-text view widens the sidebar and the header and grows the nav
  // type. Only the DASHBOARD differs between the two views otherwise -- but the
  // chrome has to grow with it, or a 40px greeting sits under a 23px title.
  const isLarge = dashboardView === DASHBOARD_VIEW.LARGE && view === "dashboard";

  const primary = PRIMARY_ACTION[view];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-paper dark:bg-dk-canvas">
      {/* ≥834px: the rail or the full sidebar. */}
      <Sidebar
        items={items}
        section={section}
        navCounts={navCounts}
        isLarge={isLarge}
        onNavigate={onNavigate}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          title={title}
          contextLine={contextLine}
          profile={profile}
          alertCount={alertCount}
          isLarge={isLarge}
          primary={primary}
          dashboardView={dashboardView}
          theme={theme}
          onSetTheme={setTheme}
          onNavigate={onNavigate}
          onSignOut={onSignOut}
          onSetDashboardView={onSetDashboardView}
          onPrimaryAction={onPrimaryAction}
          onOpenAlerts={onOpenAlerts}
          onHelp={onHelp}
        />

        {/* The Suspense boundary lives here, not at the root, so a lazy chunk
            fetch replaces only the content area. */}
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto px-4 pb-24 pt-6 tab:px-6 tab:pb-10 desk:px-7.5 desk:pt-7.5"
        >
          <Suspense fallback={<ContentFallback />}>
            <div className="mx-auto w-full max-w-[1200px]">{children}</div>
          </Suspense>
        </main>
      </div>

      {/* <834px: the bottom tab bar. */}
      <BottomTabs items={items} section={section} onNavigate={onNavigate} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Sidebar({ items, section, navCounts, isLarge, onNavigate }) {
  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col overflow-y-auto bg-navy text-white tab:flex",
        // The rail, then the full sidebar. 300px in the large-text view.
        "w-21 desk:w-65",
        isLarge && "desk:w-75"
      )}
    >
      {/* Brand block. On the rail the wordmark would not fit, so the logo
          stands alone and the app name is available to assistive tech. */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-3 border-b border-white/[0.14]",
          "justify-center px-3 py-4.5 desk:justify-start desk:px-5 desk:py-5.5"
        )}
      >
        <img
          src={logo}
          alt=""
          className={cn(
            "shrink-0 rounded-btn object-cover",
            isLarge ? "size-11 desk:size-13" : "size-11 desk:size-10.5"
          )}
        />
        <div className="hidden min-w-0 desk:block">
          <p
            className={cn(
              "font-extrabold leading-tight tracking-[-0.01em]",
              isLarge ? "text-[18px]" : "text-[16px]"
            )}
          >
            LSB Handicrafts
          </p>
          <p className="pt-0.5 text-[10.5px] font-bold uppercase tracking-[0.13em] text-white/[0.62]">
            Management system
          </p>
        </div>
        <span className="sr-only desk:hidden">LSB Handicrafts management system</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2 py-4 desk:gap-1 desk:px-3 desk:py-4.5">
        {NAV_GROUPS.map((group) => {
          const groupItems = items.filter((item) => item.group === group.key);
          if (groupItems.length === 0) return null;

          return (
            <div key={group.key} className="flex flex-col gap-0.5 desk:gap-1">
              {/* 10.5px uppercase at 0.14em. One of the two places type is
                  allowed below the 16px floor: a tracked uppercase caption is
                  read once as a signpost, not as a sentence. */}
              <p className="hidden px-2.5 pb-2 pt-5 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-white/50 first:pt-0 desk:block">
                {group.label}
              </p>
              {groupItems.map((item) => (
                <NavItem
                  key={item.key}
                  item={item}
                  active={item.key === section}
                  count={item.count ? navCounts[item.count] : undefined}
                  isLarge={isLarge}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function NavItem({ item, active, count, isLarge, onNavigate }) {
  const Icon = ICONS[item.icon] ?? Package;
  // "products" is the running-low count: a request, not a fact. Clay says so;
  // white-on-navy would read as neutral information.
  const attention = item.count === "products";

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.views[0])}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center rounded-field text-left transition duration-150",
        // Rail: a stacked icon over a word, 62px tall.
        "h-15.5 flex-col justify-center gap-1 px-1 text-[10.5px] font-bold leading-tight",
        // Full sidebar: a row, 52px (64px in the large-text view).
        "desk:h-13 desk:flex-row desk:gap-3.5 desk:px-3.5 desk:text-[16px]",
        isLarge && "desk:h-16 desk:rounded-tile2 desk:text-[20px]",
        active
          ? "bg-cobalt font-extrabold text-white shadow-nav desk:font-bold"
          : "font-semibold text-white/[0.86] hover:bg-white/10 hover:text-white"
      )}
    >
      <Icon
        className={cn("shrink-0", isLarge ? "size-6 desk:size-6.5" : "size-6 desk:size-5")}
        aria-hidden="true"
      />
      <span className="w-full truncate text-center desk:hidden">{shortLabel(item.label)}</span>
      <span className="hidden min-w-0 flex-1 truncate desk:block">{item.label}</span>
      <span className="sr-only desk:hidden">{item.label}</span>
      {count ? (
        <CountBadge count={count} attention={attention} className="hidden desk:inline-flex" />
      ) : null}
      {/* On the rail the count has nowhere to sit, so it is spoken rather than
          dropped: the number is why somebody would open that screen next. */}
      {count ? <span className="sr-only desk:hidden">{count} need attention</span> : null}
    </button>
  );
}

/* -------------------------------------------------------------------------- */

function Header({
  title,
  contextLine,
  profile,
  alertCount,
  isLarge,
  primary,
  dashboardView,
  theme,
  onSetTheme,
  onNavigate,
  onSignOut,
  onSetDashboardView,
  onPrimaryAction,
  onOpenAlerts,
  onHelp,
}) {
  const PrimaryIcon = primary ? ICONS[primary.icon] : null;

  return (
    <header
      className={cn(
        "flex shrink-0 items-center justify-between gap-4 border-b border-card bg-surface px-4 tab:px-6 desk:px-8",
        isLarge ? "h-22" : "h-19"
      )}
    >
      <div className="min-w-0">
        <h1
          className={cn(
            "truncate font-extrabold tracking-[-0.02em] text-ink",
            isLarge ? "text-[27px]" : "text-[23px]"
          )}
        >
          {title}
        </h1>
        {contextLine && (
          <p className="truncate pt-0.5 text-[14px] text-muted">
            {contextLine}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        {/* Help is a real control, not an afterthought: this system is used by
            people who will not ask a colleague twice. It is outlined so it does
            not compete with the screen's primary action beside it. */}
        <Button
          variant="outline"
          size="sm"
          onClick={onHelp}
          className="hidden sm:inline-flex"
        >
          <CircleHelp className="h-4.5 w-4.5" />
          Help
        </Button>

        {primary && (
          <Button
            variant={primary.tone === "clay" ? "clay" : "cobalt"}
            onClick={onPrimaryAction}
            className="hidden md:inline-flex"
          >
            {PrimaryIcon && <PrimaryIcon className="h-5 w-5" />}
            {primary.label}
          </Button>
        )}

        {/* Alerts lands on the products that need making, NOT on the activity
            log: the log is administrators-only, and a button in permanent
            chrome that turns half the staff away with "this screen is not part
            of your job" is a trap rather than an alert. */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenAlerts}
          className="hidden sm:inline-flex"
        >
          <Bell className="h-4.5 w-4.5" />
          Alerts
          <AlertBadge count={alertCount} />
        </Button>

        <AccountChip
          profile={profile}
          isLarge={isLarge}
          dashboardView={dashboardView}
          theme={theme}
          onSetTheme={onSetTheme}
          onNavigate={onNavigate}
          onSignOut={onSignOut}
          onSetDashboardView={onSetDashboardView}
        />
      </div>
    </header>
  );
}

/**
 * The account chip, far right.
 *
 * The sidebar used to carry this block, and moving it here is deliberate: the
 * sidebar is where you go to do the business's work, and who you happen to be
 * signed in as is not one of those places. It also frees the sidebar's foot,
 * which is where the nav count badges now have room to breathe.
 *
 * The menu carries the dashboard-view preference as well as the profile screen.
 * The handoff flags that burying that preference on the profile screen may be
 * too deep, and this is the cheap half of the answer — it costs one menu item
 * and does not need a first-run flow to be worth having.
 */
function AccountChip({
  profile,
  isLarge,
  dashboardView,
  theme,
  onSetTheme,
  onNavigate,
  onSignOut,
  onSetDashboardView,
}) {
  const name = profile?.name || "Signed in";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-3 rounded-field border-[1.5px] border-chip bg-surface pl-1.5 pr-3 transition duration-150",
            "hover:bg-wash data-[state=open]:bg-wash",
            isLarge ? "h-15" : "h-12"
          )}
        >
          <Avatar name={name} size={isLarge ? "lg" : "sm"} />
          <span className="hidden min-w-0 text-left lg:block">
            <span
              className={cn(
                "block truncate font-bold leading-tight text-ink",
                isLarge ? "text-[17px]" : "text-[14.5px]"
              )}
            >
              {name}
            </span>
            <span className="block truncate pt-px text-[12.5px] leading-tight text-muted">
              {roleLabel(profile?.role)}
            </span>
          </span>
          <ChevronDown className="h-4.5 w-4.5 shrink-0 text-muted" aria-hidden="true" />
          <span className="sr-only">Your account menu</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-[19rem]">
        <div className="px-3.5 pb-2 pt-2.5">
          <p className="text-[16.5px] font-extrabold text-ink">{name}</p>
          <p className="pt-0.5 text-[14px] text-muted">
            {roleLabel(profile?.role)}
          </p>
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => onNavigate("profile")}>
          <UserRound className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
          My profile
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>How your dashboard looks</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={dashboardView}
          onValueChange={(next) => onSetDashboardView?.(next)}
        >
          <DropdownMenuRadioItem value={DASHBOARD_VIEW.STANDARD}>
            <ViewMark selected={dashboardView === DASHBOARD_VIEW.STANDARD} />
            <span>
              <span className="block">Standard</span>
              <span className="block pt-0.5 text-[14px] font-normal text-muted">
                More on screen at once.
              </span>
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value={DASHBOARD_VIEW.LARGE}>
            <ViewMark selected={dashboardView === DASHBOARD_VIEW.LARGE} icon="large" />
            <span>
              <span className="block">Large text</span>
              <span className="block pt-0.5 text-[14px] font-normal text-muted">
                Bigger words and buttons.
              </span>
            </span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <p className="px-3.5 pb-1 pt-1.5 text-[13.5px] leading-[1.45] text-muted">
          This changes only what you see.
        </p>

        <DropdownMenuSeparator />
        {/*
          Light or dark is a PER-DEVICE choice, unlike the dashboard view above
          — a phone in a bright yard and a desktop in a back office want
          different answers for the same person. See hooks/useTheme.
        */}
        <DropdownMenuLabel>Light or dark</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(next) => onSetTheme?.(next)}>
          <DropdownMenuRadioItem value="system">
            <ThemeMark selected={theme === "system"} icon={<Settings className="h-4.5 w-4.5" />} />
            Match this device
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <ThemeMark selected={theme === "light"} icon={<Sun className="h-4.5 w-4.5" />} />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <ThemeMark selected={theme === "dark"} icon={<Moon className="h-4.5 w-4.5" />} />
            Dark
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut}>
          <LogOut className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeMark({ selected, icon }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden="true">
      {selected ? <Check className="h-5 w-5 text-cobalt dark:text-dk-cobalt" /> : <span className="text-muted-2">{icon}</span>}
    </span>
  );
}

function ViewMark({ selected, icon }) {
  return (
    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center" aria-hidden="true">
      {selected ? (
        <Check className="h-5 w-5 text-cobalt dark:text-dk-cobalt" />
      ) : icon === "large" ? (
        <ALargeSmall className="h-5 w-5 text-muted-2" />
      ) : (
        <LayoutDashboard className="h-4.5 w-4.5 text-muted-2" />
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The phone's bottom tab bar: five 56px targets, each an icon over a word.
 *
 * FIVE, and the first five the role can reach. A tab bar that scrolls is not a
 * tab bar, and a sixth item at phone width makes every label truncate — which
 * is the same as having no label.
 */
function BottomTabs({ items, section, onNavigate }) {
  const tabs = items.slice(0, 5);

  return (
    <nav
      aria-label="Sections"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 flex border-t border-card bg-surface tab:hidden"
    >
      {tabs.map((item) => {
        const Icon = ICONS[item.icon] ?? Package;
        const active = item.key === section;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.views[0])}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 transition duration-150",
              active ? "bg-tint-cobalt text-cobalt-deep" : "text-muted"
            )}
          >
            <Icon className="size-6 shrink-0" aria-hidden="true" />
            <span className="w-full truncate text-center text-[11.5px] font-bold">
              {shortLabel(item.label)}
            </span>
            <span className="sr-only">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ContentFallback() {
  return (
    <div className="flex min-h-80 w-full flex-col items-center justify-center gap-3">
      <LoaderCircle className="h-6 w-6 animate-spin text-muted" aria-hidden="true" />
      <p className="text-[15.5px] text-muted">Just a moment…</p>
    </div>
  );
}
