import { Select as SelectPrimitive } from "@base-ui/react/select";

import { CaretUpDown, Check } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * shadcn/ui Select on Base UI. The trigger is drawn like a field (32px, 6px
 * radius, --border, --card, shadow-xs) with a CaretUpDown on the right; the
 * list drops 4px from it (lsb-drop) as a 6px-radius --card popover.
 *
 * Pass `items` ({ value: label } or [{ value, label }]) to Select when the
 * label differs from the value, so the trigger shows the label.
 */
function Select(props) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup(props) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({ className, ...props }) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("min-w-0 flex-1 truncate text-left data-[placeholder]:text-muted-fg", className)}
      {...props}
    />
  );
}

function SelectTrigger({ className, children, size = "default", ...props }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "lsb-field flex items-center justify-between gap-1.5 whitespace-nowrap rounded-md border border-border bg-card pl-2.5 pr-2 text-sm text-foreground shadow-xs",
        "disabled:cursor-not-allowed disabled:opacity-50 data-[disabled]:opacity-50",
        size === "sm" ? "h-7 text-13" : "h-8",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="flex text-muted-fg">
        <CaretUpDown className="size-4" aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({ className, children, align = "start", sideOffset = 4, alignItemWithTrigger = false, ...props }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        className="z-50 outline-none"
        align={align}
        sideOffset={sideOffset}
        alignItemWithTrigger={alignItemWithTrigger}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "lsb-drop max-h-[var(--available-height)] min-w-[var(--anchor-width)] overflow-y-auto rounded-md border border-border bg-popover p-1 text-sm text-foreground shadow-menu outline-none",
            className
          )}
          {...props}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }) {
  return (
    <SelectPrimitive.GroupLabel
      className={cn("px-2 pb-1 pt-1.5 text-xs font-medium text-muted-fg", className)}
      {...props}
    />
  );
}

function SelectItem({ className, children, ...props }) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex h-8 cursor-default select-none items-center gap-2 rounded pl-2 pr-8 outline-none",
        "data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="min-w-0 flex-1 truncate">{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 flex">
        <Check className="size-4" aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }) {
  return <SelectPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-border-subtle", className)} {...props} />;
}

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator };
