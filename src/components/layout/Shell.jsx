import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import logo from "../../assets/Logo-128.png";
import {
  CaretRight,
  CaretUpDown,
  Check,
  Factory,
  Gear,
  Hammer,
  IdentificationCard,
  MagnifyingGlass,
  Moon,
  Package,
  Plus,
  Question,
  Receipt,
  SidebarSimple,
  SignOut,
  SpinnerGap,
  SquaresFour,
  Storefront,
  Sun,
  Truck,
  User,
  UserPlus,
  Users,
  DownloadSimple,
} from "../icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuHeader,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { initialsOf } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import CommandMenu from "./CommandMenu";
import { canAccess } from "../../utils/permissions";
import { crumbForView, metaForView, NAV_GROUPS, NAV_PARENTS, NAV_TREE, SECTION_OF } from "../../utils/navigation";
import useTheme from "../../hooks/useTheme";

// The tree in utils/navigation.js is plain data so utils/permissions.js can
// derive from it without pulling React into the permissions layer. Icons
// resolve to components here instead.
const ICONS = { SquaresFour, Receipt, Package, Truck, Hammer, Users, IdentificationCard, Storefront, Factory, Gear };

/**
 * The signed-in shell, drawn to the AppSidebar, TopBar, Sidebar · states and
 * Search · Command ⌘K boards: SidebarProvider → Sidebar (inset, collapsible
 * to icons) → SidebarInset with the 48px top bar, then the page.
 *
 * Mounted once, outside the router, so the chrome is not rebuilt on every
 * navigation. Its own Suspense boundary sits inside the inset, so a lazy
 * screen loading never blanks the sidebar.
 */
export default function Shell({
  view,
  profile,
  /** The record a detail screen is showing, for the breadcrumb ("#2048"). */
  recordTitle,
  /** Counts for the nav badges, keyed by NAV_TREE's `count`. */
  navCounts = {},
  /** What the command menu's actions do: { onNewOrder, onAddUser, onExportUsers, onHelp }. */
  commands = {},
  onNavigate,
  onSignOut,
  children,
}) {
  const role = profile?.role;
  const [commandOpen, setCommandOpen] = useState(false);

  const items = useMemo(() => NAV_TREE.filter((item) => canAccess(role, item.views[0])), [role]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commandGroups = useMemo(() => {
    const pages = items.map((item) => ({
      key: `page-${item.key}`,
      label: item.key === "production" ? "Production · Batches" : item.label,
      icon: ICONS[item.icon] ?? ICONS[NAV_PARENTS[item.parent]?.icon] ?? SquaresFour,
      run: () => onNavigate(item.views[0]),
    }));
    pages.push({ key: "page-profile", label: "Your profile", icon: User, run: () => onNavigate("profile") });
    const actions = [
      commands.onAddUser && { key: "add-user", label: "Add user", icon: UserPlus, shortcut: "⇧⌘U", run: commands.onAddUser },
      commands.onNewOrder && { key: "new-order", label: "New order", icon: Plus, shortcut: "⇧⌘O", run: commands.onNewOrder },
      commands.onExportUsers && { key: "export-users", label: "Export users as CSV", icon: DownloadSimple, run: commands.onExportUsers },
      commands.onHelp && { key: "help", label: "Help on this page", icon: Question, run: commands.onHelp },
      { key: "log-out", label: "Log out", icon: SignOut, run: onSignOut },
    ].filter(Boolean);
    return [
      { label: "Pages", items: pages },
      { label: "Actions", items: actions },
    ];
  }, [items, commands, onNavigate, onSignOut]);

  // ⇧⌘U and ⇧⌘O, as the command menu lists them.
  useEffect(() => {
    const onKey = (event) => {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "u" && commands.onAddUser) {
        event.preventDefault();
        commands.onAddUser();
      } else if (key === "o" && commands.onNewOrder) {
        event.preventDefault();
        commands.onNewOrder();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commands]);

  return (
    <SidebarProvider>
      <AppSidebar items={items} view={view} profile={profile} navCounts={navCounts} onNavigate={onNavigate} onSignOut={onSignOut} />
      <SidebarInset>
        <TopBar crumb={crumbForView(view, recordTitle)} onNavigate={onNavigate} onSearch={() => setCommandOpen(true)} />
        <Content view={view} title={metaForView(view).title}>{children}</Content>
      </SidebarInset>
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} groups={commandGroups} />
    </SidebarProvider>
  );
}

/** The page area. A new view starts at the top, and its sections rise in once. */
// TRANSITIONAL: screens rebuilt to their board draw their own PageHeader
// (and h1). Until every screen is, the rest get their title here.
const REBUILT_VIEWS = new Set(["dashboard", "staff", "directory", "products"]);

function Content({ view, title, children }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: "start" });
    window.scrollTo({ top: 0 });
  }, [view]);
  return (
    <div ref={ref} className="min-w-0 flex-1">
      <Suspense fallback={<ContentFallback />}>
        <div key={view} className="min-w-0">
          {!REBUILT_VIEWS.has(view) && title ? (
            <h1 className="m-0 px-4 pt-4 text-xl font-semibold tracking-[-0.01em]">{title}</h1>
          ) : null}
          {children}
        </div>
      </Suspense>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function AppSidebar({ items, view, profile, navCounts, onNavigate, onSignOut }) {
  const { collapsed, isMobile, setOpenMobile } = useSidebar();
  const section = SECTION_OF[view];
  const activeItem = NAV_TREE.find((item) => item.key === section);
  const go = (next) => {
    onNavigate(next);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <WorkspaceSwitcher collapsed={collapsed} />
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => {
          const groupItems = items.filter((item) => item.group === group.key);
          if (groupItems.length === 0) return null;
          // Top-level entries in order, with each parent placed where its first child sits.
          const rows = [];
          for (const item of groupItems) {
            if (!item.parent) rows.push({ item });
            else if (!rows.some((row) => row.parent === item.parent)) {
              rows.push({ parent: item.parent, children: groupItems.filter((one) => one.parent === item.parent) });
            }
          }
          return (
            <SidebarGroup key={group.key} label={group.label}>
              {rows.map((row) =>
                row.item ? (
                  <NavItem
                    key={row.item.key}
                    item={row.item}
                    active={row.item.key === section}
                    count={row.item.count ? navCounts[row.item.count] : undefined}
                    onNavigate={go}
                  />
                ) : (
                  <NavParent
                    key={`${row.parent}-${activeItem?.parent === row.parent ? section : ""}`}
                    parent={NAV_PARENTS[row.parent]}
                    subItems={row.children}
                    activeKey={activeItem?.parent === row.parent ? section : null}
                    count={NAV_PARENTS[row.parent].count ? navCounts[NAV_PARENTS[row.parent].count] : undefined}
                    onNavigate={go}
                  />
                )
              )}
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <AccountMenu profile={profile} collapsed={collapsed} onNavigate={go} onSignOut={onSignOut} />
      </SidebarFooter>
    </Sidebar>
  );
}

function NavItem({ item, active, count, onNavigate }) {
  const Icon = ICONS[item.icon] ?? Package;
  const accessibleName = count ? `${item.label}, ${count}${item.countLabel ? ` ${item.countLabel}` : ""}` : item.label;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={item.label}
        aria-current={active ? "page" : undefined}
        aria-label={accessibleName}
        onClick={() => onNavigate(item.views[0])}
      >
        <Icon className="size-4 shrink-0" weight={active ? "fill" : "regular"} aria-hidden="true" />
        <SidebarLabel>{item.label}</SidebarLabel>
        <SidebarMenuBadge isActive={active}>{count}</SidebarMenuBadge>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * Production and Settings: a disclosure over their sub-items. Open, the
 * selected sub-item carries the fill; collapsed to icons, the parent fills
 * and opens the first sub-item it can.
 */
function NavParent({ parent, subItems, activeKey, count, onNavigate }) {
  const { collapsed } = useSidebar();
  // Opens on its own when one of its pages is showing (the parent is keyed
  // by the active page, so this resets on navigation); a click toggles it.
  const [open, setOpen] = useState(Boolean(activeKey));
  const Icon = ICONS[parent.icon] ?? Gear;
  const active = Boolean(activeKey);
  const id = `${parent.key}-sub`;

  if (collapsed) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={active}
          tooltip={parent.label}
          aria-label={parent.label}
          onClick={() => onNavigate(subItems[0].views[0])}
        >
          <Icon className="size-4 shrink-0" weight={active ? "fill" : "regular"} aria-hidden="true" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        aria-label={count ? `${parent.label}, ${count} ${parent.countLabel}` : parent.label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className={cn(active && "font-medium text-foreground")}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <SidebarLabel>{parent.label}</SidebarLabel>
        <SidebarMenuBadge>{count}</SidebarMenuBadge>
        <CaretRight
          className={cn("size-4 shrink-0 text-muted-fg transition-transform duration-200", open && "rotate-90")}
          aria-hidden="true"
        />
      </SidebarMenuButton>
      {open ? (
        <SidebarMenuSub id={id}>
          {subItems.map((item) => (
            <li key={item.key}>
              <SidebarMenuSubButton isActive={item.key === activeKey} onClick={() => onNavigate(item.views[0])}>
                {item.label}
              </SidebarMenuSubButton>
            </li>
          ))}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  );
}

function SidebarLabel({ children }) {
  return <span className="min-w-0 flex-1 truncate whitespace-nowrap">{children}</span>;
}

/** The workspace switcher. There is one workspace, so it is shown as chosen. */
function WorkspaceSwitcher({ collapsed }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Workspace: LSB Handicrafts"
        className={cn(
          "flex w-full items-center gap-2 rounded-md border-0 bg-transparent text-left text-inherit hover:bg-muted data-[popup-open]:bg-muted",
          collapsed ? "h-8 justify-center p-0" : "h-12 px-2"
        )}
      >
        <img src={logo} alt="" className="size-8 shrink-0 rounded-md object-cover" />
        {!collapsed ? (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold leading-[18px] text-foreground">LSB Handicrafts</span>
              <span className="whitespace-nowrap text-xs text-muted-fg">Management system</span>
            </span>
            <CaretUpDown className="size-4 shrink-0 text-muted-fg" aria-hidden="true" />
          </>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-fg">Workspace</div>
        <DropdownMenuItem>
          <img src={logo} alt="" className="size-5 rounded" />
          <span className="flex-1">LSB Handicrafts</span>
          <Check className="text-primary-text" aria-hidden="true" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The account menu at the foot of the sidebar: Profile, then Log out. */
function AccountMenu({ profile, collapsed, onNavigate, onSignOut }) {
  const name = profile?.name || "Signed in";
  const initials = initialsOf(name);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${name}`}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border-0 bg-transparent text-left text-inherit hover:bg-muted data-[popup-open]:bg-muted",
          collapsed ? "h-8 justify-center p-0" : "h-12 px-2"
        )}
      >
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted-strong text-xs font-medium text-foreground">
          {initials}
        </span>
        {!collapsed ? (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium leading-[18px] text-foreground">{name}</span>
              <span className="truncate text-xs text-muted-fg">{profile?.email}</span>
            </span>
            <CaretUpDown className="size-4 shrink-0 text-muted-fg" aria-hidden="true" />
          </>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-56">
        <DropdownMenuHeader className="flex items-center gap-2">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted-strong text-xs font-medium">
            {initials}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium leading-[18px]">{name}</span>
            <span className="text-xs text-muted-fg">{profile?.role || "No role yet"}</span>
          </span>
        </DropdownMenuHeader>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onNavigate("profile")}>
          <User aria-hidden="true" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>
          <SignOut aria-hidden="true" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* -------------------------------------------------------------------------- */

/** h-12: SidebarTrigger, a vertical Separator, the Breadcrumb, the ⌘K search and the theme switch. */
function TopBar({ crumb, onNavigate, onSearch }) {
  const { toggleSidebar } = useSidebar();
  return (
    <header className="flex min-h-12 flex-wrap items-center gap-2 border-b border-border py-2 pl-3 pr-4">
      <button
        type="button"
        aria-label="Toggle sidebar"
        title="Toggle sidebar (Ctrl+B)"
        onClick={toggleSidebar}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-fg-2 hover:bg-muted"
      >
        <SidebarSimple className="size-4" aria-hidden="true" />
      </button>
      <Separator orientation="vertical" className="mx-1" />
      <Breadcrumb className="flex-auto">
        <BreadcrumbList>
          {crumb.section ? (
            <>
              <BreadcrumbItem>
                {crumb.sectionView ? (
                  <BreadcrumbLink onClick={() => onNavigate(crumb.sectionView)}>{crumb.section}</BreadcrumbLink>
                ) : (
                  <span className="text-muted-fg">{crumb.section}</span>
                )}
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          ) : null}
          <BreadcrumbItem>
            <BreadcrumbPage>{crumb.page}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <button
        type="button"
        aria-label="Search pages and actions"
        aria-keyshortcuts="Control+K Meta+K"
        onClick={onSearch}
        className="flex h-8 min-w-[180px] flex-[0_1_260px] items-center gap-2 rounded-md border border-border bg-card pl-2.5 pr-1.5 text-left text-13 text-muted-fg shadow-xs hover:bg-surface-2"
      >
        <MagnifyingGlass className="size-4" aria-hidden="true" />
        <span className="flex-1">Search…</span>
        <Kbd>⌘K</Kbd>
      </button>
      <ThemeToggle />
    </header>
  );
}

/**
 * Sun / moon. Flips between light and dark through hooks/useTheme (which
 * also keeps "match this device", chosen on Your profile), and crossfades the
 * whole page for a moment while it does.
 */
function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const [, force] = useState(0);
  const dark =
    theme === "dark" ||
    (theme === "system" && typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  const flip = () => {
    const root = document.documentElement;
    root.classList.add("theme-anim");
    setTheme(dark ? "light" : "dark");
    setTimeout(() => {
      root.classList.remove("theme-anim");
      force((n) => n + 1);
    }, 300);
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={flip}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-fg-2 shadow-xs hover:bg-muted"
    >
      <span key={dark ? "sun" : "moon"} className="theme-icon">
        {dark ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
      </span>
    </button>
  );
}

function ContentFallback() {
  return (
    <div role="status" className="flex min-h-80 w-full items-center justify-center gap-2 text-13 text-muted-fg">
      <SpinnerGap className="size-4 animate-spin" aria-hidden="true" />
      Loading…
    </div>
  );
}
