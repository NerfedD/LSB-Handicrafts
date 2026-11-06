import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import useMediaQuery from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

/**
 * shadcn/ui Sidebar, variant="inset", collapsible="icon", drawn to the
 * AppSidebar and Sidebar · states boards.
 *
 * 15rem open and 3rem as icons, on --surface-2; the content sits in an inset
 * card 8px from the window edges. Ctrl+B or ⌘B toggles it, and so does the
 * rail along its right edge. Below 768px it opens as a Sheet from the left.
 * The open/closed choice is remembered per device.
 */
const SidebarContext = createContext(null);
const STORAGE_KEY = "lsb.sidebar";

const readOpen = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "collapsed";
  } catch {
    return true;
  }
};

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used inside SidebarProvider");
  return context;
}

export function SidebarProvider({ className, children, ...props }) {
  const isMobile = !useMediaQuery("(min-width: 768px)");
  const [open, setOpenState] = useState(readOpen);
  const [openMobile, setOpenMobile] = useState(false);

  const setOpen = useCallback((next) => {
    setOpenState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "expanded" : "collapsed");
    } catch {
      // The choice still applies for this session.
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    if (isMobile) setOpenMobile((value) => !value);
    else setOpen(!open);
  }, [isMobile, open, setOpen]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key.toLowerCase() === "b" && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  const value = useMemo(
    () => ({
      state: open ? "expanded" : "collapsed",
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
      collapsed: !open && !isMobile,
    }),
    [open, setOpen, isMobile, openMobile, toggleSidebar]
  );

  return (
    <SidebarContext.Provider value={value}>
      <TooltipProvider>
        <div
          data-slot="sidebar-wrapper"
          className={cn("flex min-h-svh w-full bg-sidebar text-sm text-foreground", className)}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}

export function Sidebar({ children, className }) {
  const { isMobile, openMobile, setOpenMobile, collapsed, toggleSidebar } = useSidebar();

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent aria-label="Navigation" className="w-sidebar">
          <SheetTitle>Navigation</SheetTitle>
          <div className="flex h-full flex-col overflow-y-auto">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      aria-label="Main navigation"
      data-state={collapsed ? "collapsed" : "expanded"}
      className={cn(
        "group/sidebar sticky top-0 z-[2] flex h-svh shrink-0 flex-col bg-sidebar text-fg-2 transition-[width] duration-200 ease-out",
        collapsed ? "w-sidebar-icon" : "w-sidebar",
        className
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">{children}</div>
      {/* SidebarRail */}
      <button
        type="button"
        aria-label="Toggle sidebar"
        title="Toggle sidebar (Ctrl+B)"
        tabIndex={-1}
        onClick={toggleSidebar}
        className="absolute inset-y-0 -right-2 z-[5] w-4 cursor-ew-resize bg-transparent active:scale-100"
      />
    </aside>
  );
}

export function SidebarHeader({ className, ...props }) {
  return <div data-slot="sidebar-header" className={cn("p-2", className)} {...props} />;
}

export function SidebarContent({ className, ...props }) {
  return <div data-slot="sidebar-content" className={cn("flex flex-1 flex-col px-2", className)} {...props} />;
}

export function SidebarFooter({ className, ...props }) {
  return <div data-slot="sidebar-footer" className={cn("relative p-2", className)} {...props} />;
}

export function SidebarGroup({ label, className, children }) {
  const { collapsed } = useSidebar();
  return (
    <div role="group" aria-label={label} className={cn("py-1", className)}>
      {!collapsed ? (
        <div className="flex h-8 items-center px-2 text-xs font-medium text-muted-fg">{label}</div>
      ) : null}
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{children}</ul>
    </div>
  );
}

export function SidebarMenuItem({ className, ...props }) {
  return <li data-slot="sidebar-menu-item" className={cn("relative", className)} {...props} />;
}

/**
 * A 32px row: 16px icon, label, count. Active, it is a solid --primary fill
 * with white text and the icon's fill weight; the sidebar itself stays
 * neutral. Collapsed, it is a 32px square with the label as a tooltip.
 */
export function SidebarMenuButton({ isActive, tooltip, className, children, ...props }) {
  const { collapsed } = useSidebar();
  const button = (
    <button
      type="button"
      data-active={isActive ? "" : undefined}
      className={cn(
        "relative flex h-8 items-center gap-2 rounded-md border-0 text-left text-sm outline-none",
        "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
        collapsed ? "w-8 justify-center p-0" : "w-full px-2",
        isActive ? "bg-primary font-medium text-on-primary" : "bg-transparent font-normal text-fg-2 hover:bg-muted hover:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
  if (!collapsed || !tooltip) return button;
  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function SidebarMenuBadge({ isActive, className, children }) {
  const { collapsed } = useSidebar();
  if (collapsed || children === undefined || children === null) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "min-w-5 rounded-md px-1.5 text-center text-xs font-medium leading-5",
        isActive ? "text-on-primary opacity-[0.85]" : "text-muted-fg",
        className
      )}
    >
      {children}
    </span>
  );
}

export function SidebarMenuSub({ className, ...props }) {
  return (
    <ul
      className={cn("m-0 ml-3.5 mt-0.5 flex list-none flex-col gap-0.5 border-l border-border-subtle py-0.5 pl-2.5 pr-0", className)}
      {...props}
    />
  );
}

export function SidebarMenuSubButton({ isActive, className, ...props }) {
  return (
    <button
      type="button"
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex h-7 w-full items-center rounded-md px-2 text-left text-13 outline-none",
        "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
        isActive ? "bg-primary font-medium text-on-primary" : "font-normal text-fg-2 hover:bg-muted hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}

/** The inset card the page sits in: --background, 1px --border, 8px radius, 8px off the edges. */
export function SidebarInset({ className, ...props }) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "relative m-2 flex min-w-0 flex-1 flex-col rounded-lg border border-border bg-background shadow-xs md:ml-0",
        className
      )}
      {...props}
    />
  );
}
