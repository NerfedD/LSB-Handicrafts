import { forwardRef } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

import { cn } from "@/lib/utils";

/**
 * Menus.
 *
 * The account chip in the header (My profile / How your dashboard looks / Sign
 * out) and nothing else — the row kebab menu this originally replaced is gone,
 * because the handoff replaces per-row menus with named buttons. A kebab hides
 * what a row can do behind a guess; "Manage" says it.
 *
 * Items are 48px with 16px labels, and each carries an icon AND a word.
 */
const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuContent = forwardRef(function DropdownMenuContent(
  { className, sideOffset = 8, align = "end", ...props },
  ref
) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[15rem] overflow-hidden rounded-field border border-card bg-surface p-1.5 shadow-modal",
          "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
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
        "flex h-12 cursor-pointer select-none items-center gap-3 rounded-btn px-3.5",
        "text-[16px] font-bold outline-none transition duration-150",
        "focus:bg-tint-cobalt data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        destructive
          ? "text-red-text focus:bg-tint-red"
          : "text-ink",
        className
      )}
      {...props}
    />
  );
});

/**
 * A choice within the menu, with a check on the selected one.
 *
 * Used for "How your dashboard looks", which is reachable from the account
 * menu as well as from the profile screen — the handoff flags that burying the
 * preference on the profile screen alone may be too deep, so it is offered in
 * both places.
 */
const DropdownMenuRadioItem = forwardRef(function DropdownMenuRadioItem(
  { className, children, ...props },
  ref
) {
  return (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      className={cn(
        "flex min-h-12 cursor-pointer select-none items-start gap-3 rounded-btn px-3.5 py-2.5",
        "text-[16px] outline-none transition duration-150",
        "focus:bg-tint-cobalt data-[state=checked]:font-bold",
        className
      )}
      {...props}
    >
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
});

const DropdownMenuItemIndicator = DropdownMenuPrimitive.ItemIndicator;

const DropdownMenuLabel = forwardRef(function DropdownMenuLabel({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn(
        "px-3.5 pb-1.5 pt-2.5 text-[13px] font-extrabold uppercase tracking-[0.07em] text-muted",
        className
      )}
      {...props}
    />
  );
});

const DropdownMenuSeparator = forwardRef(function DropdownMenuSeparator({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={cn("my-1.5 h-px bg-rule", className)}
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuItemIndicator,
};
