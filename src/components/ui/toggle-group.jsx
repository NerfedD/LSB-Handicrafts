import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui ToggleGroup on Base UI, drawn as the boards' segmented control:
 * a --muted track 2px inside with 28px items. The pressed item is a --card
 * chip with shadow-seg, neutral and never blue, and one highlight slides
 * between the options (.seg in index.css).
 *
 * `value` is a single string here, which is how every board uses it.
 */
function ToggleGroup({ className, value, onValueChange, options, label, ...props }) {
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      aria-label={label}
      value={[value]}
      onValueChange={(next) => {
        if (next.length) onValueChange?.(next[next.length - 1]);
      }}
      className={cn("seg rounded-md bg-muted p-0.5", className)}
      style={{ "--seg-count": options.length, "--seg-index": index }}
      {...props}
    >
      <span className="seg-ind" aria-hidden="true" />
      {options.map((option) => (
        <TogglePrimitive
          key={option.value}
          value={option.value}
          aria-label={option.ariaLabel}
          className={cn(
            "inline-flex h-7 items-center justify-center gap-1.5 whitespace-nowrap rounded px-2.5 text-13 font-medium text-muted-fg outline-none",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            "data-[pressed]:text-foreground [&_svg]:size-4"
          )}
        >
          {option.icon}
          {option.label}
        </TogglePrimitive>
      ))}
    </ToggleGroupPrimitive>
  );
}

export { ToggleGroup };
