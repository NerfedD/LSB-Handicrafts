import { forwardRef } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";

import { Check, ChevronDown, ChevronUp } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Select.
 *
 * Matches Input's geometry — 54px, 11px radius, 1.5px border, 16px text — so a
 * form reads as one column of same-sized controls rather than a stack of
 * near-misses.
 *
 * See shared/FilterSelect.jsx for the OTHER dropdown in this system: the 52px
 * filter control that prints its own label ("Kind: All"). That one is not a
 * form field and deliberately looks different, because a filter that looks
 * like a field invites people to type in it.
 */
const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = forwardRef(function SelectTrigger({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex h-13.5 w-full items-center justify-between gap-3 rounded-field border-[1.5px] border-field bg-surface px-4",
        "text-[16px] font-medium text-ink transition duration-150",
        "hover:border-chip2 focus:border-cobalt focus:outline-none focus:shadow-[0_0_0_4px_#1462c826]",
        "disabled:cursor-not-allowed disabled:bg-tint-neutral disabled:text-muted",
        "data-[placeholder]:text-muted-2 [&>span]:truncate",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4.5 w-4.5 shrink-0 text-muted" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});

const SelectContent = forwardRef(function SelectContent(
  { className, children, position = "popper", ...props },
  ref
) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        className={cn(
          "relative z-50 max-h-96 min-w-[9rem] overflow-hidden rounded-field border border-card bg-surface shadow-modal",
          "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1.5 data-[side=top]:-translate-y-1.5",
          className
        )}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center">
          <ChevronUp className="h-4 w-4 text-muted" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport
          className={cn(
            "p-1.5",
            position === "popper" && "w-full min-w-[var(--radix-select-trigger-width)]"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center">
          <ChevronDown className="h-4 w-4 text-muted" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

const SelectLabel = forwardRef(function SelectLabel({ className, ...props }, ref) {
  return (
    <SelectPrimitive.Label
      ref={ref}
      className={cn(
        "px-3 py-2 text-[13px] font-extrabold uppercase tracking-[0.07em] text-muted",
        className
      )}
      {...props}
    />
  );
});

/** 44px per option — a menu item is a tap target like anything else. */
const SelectItem = forwardRef(function SelectItem({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex h-11 w-full cursor-pointer select-none items-center rounded-btn pl-10 pr-3.5",
        "text-[16px] font-medium text-ink outline-none transition duration-150",
        "focus:bg-tint-cobalt data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute left-3.5 flex h-4.5 w-4.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4.5 w-4.5 text-cobalt dark:text-dk-cobalt" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});

const SelectSeparator = forwardRef(function SelectSeparator({ className, ...props }, ref) {
  return (
    <SelectPrimitive.Separator
      ref={ref}
      className={cn("-mx-1.5 my-1.5 h-px bg-rule", className)}
      {...props}
    />
  );
});

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
};
