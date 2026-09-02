import { forwardRef } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

import { cn } from "@/lib/utils";

/**
 * Row kebab menu.
 *
 * Replaces the hand-rolled open/close state in UserAccountsPage, which tracked
 * `openMenu` by row id and had no outside-click handling, no Escape, no focus
 * management and no roving arrow-key navigation. Same visual treatment.
 */
const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuContent = forwardRef(function DropdownMenuContent(
  { className, sideOffset = 4, align = "end", ...props },
  ref
) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[10rem] overflow-hidden rounded-[10px] border border-[#17263a14] bg-white py-1",
          "shadow-[0_8px_24px_rgba(17,30,50,0.12)]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
});

const DropdownMenuItem = forwardRef(function DropdownMenuItem(
  { className, destructive = false, ...props },
  ref
) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        "flex cursor-pointer select-none items-center px-4 py-2.5 text-sm outline-none transition",
        "focus:bg-[#17263a08] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        destructive ? "text-danger" : "text-ink",
        className
      )}
      {...props}
    />
  );
});

const DropdownMenuLabel = forwardRef(function DropdownMenuLabel(
  { className, ...props },
  ref
) {
  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn(
        "px-4 py-2 text-[11px] font-semibold uppercase tracking-[1.1px] text-muted",
        className
      )}
      {...props}
    />
  );
});

const DropdownMenuSeparator = forwardRef(function DropdownMenuSeparator(
  { className, ...props },
  ref
) {
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={cn("my-1 h-px bg-[#17263a14]", className)}
      {...props}
    />
  );
});

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuPortal,
};
