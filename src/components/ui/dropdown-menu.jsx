import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { Check } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * shadcn/ui DropdownMenu on Base UI: the account menu, the workspace switcher
 * and table row actions. A --card popover with a 6px radius, 4px inside,
 * shadow-menu, 32px items with a 16px icon, and a full-bleed separator. It
 * drops 4px from its trigger (lsb-drop).
 */
function DropdownMenu(props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger(props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({ className, align = "start", side = "bottom", sideOffset = 4, alignOffset = 0, children, ...props }) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner className="z-50 outline-none" align={align} side={side} sideOffset={sideOffset} alignOffset={alignOffset}>
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "lsb-drop min-w-[10rem] rounded-md border border-border bg-popover p-1 text-sm text-foreground shadow-menu outline-none",
            className
          )}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

const itemClass = cn(
  "relative flex h-8 cursor-default select-none items-center gap-2 rounded px-2 text-sm outline-none",
  "data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
  "[&_svg]:size-4 [&_svg]:shrink-0"
);

function DropdownMenuItem({ className, variant, onSelect, onClick, ...props }) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(itemClass, variant === "destructive" && "text-danger-fg data-[highlighted]:bg-danger-bg", className)}
      onClick={(event) => {
        onClick?.(event);
        onSelect?.(event);
      }}
      {...props}
    />
  );
}

function DropdownMenuGroup(props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuLabel({ className, ...props }) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      className={cn("px-2 py-1.5 text-xs font-medium text-muted-fg", className)}
      {...props}
    />
  );
}

/** A plain heading inside the menu that is not tied to a group. */
function DropdownMenuHeader({ className, ...props }) {
  return <div className={cn("px-2 py-1.5", className)} {...props} />;
}

function DropdownMenuSeparator({ className, ...props }) {
  return <MenuPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-border-subtle", className)} {...props} />;
}

function DropdownMenuRadioGroup(props) {
  return <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

function DropdownMenuRadioItem({ className, children, ...props }) {
  return (
    <MenuPrimitive.RadioItem className={cn(itemClass, "pr-8", className)} {...props}>
      {children}
      <MenuPrimitive.RadioItemIndicator className="absolute right-2 flex">
        <Check aria-hidden="true" />
      </MenuPrimitive.RadioItemIndicator>
    </MenuPrimitive.RadioItem>
  );
}

function DropdownMenuCheckboxItem({ className, children, ...props }) {
  return (
    <MenuPrimitive.CheckboxItem className={cn(itemClass, "pr-8", className)} {...props}>
      {children}
      <MenuPrimitive.CheckboxItemIndicator className="absolute right-2 flex">
        <Check aria-hidden="true" />
      </MenuPrimitive.CheckboxItemIndicator>
    </MenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuShortcut({ className, ...props }) {
  return <span className={cn("ml-auto text-xs tracking-wider text-muted-fg", className)} {...props} />;
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuHeader,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
  DropdownMenuShortcut,
};
