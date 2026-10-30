import { cn } from "@/lib/utils";

/** The keyboard hint: 20px, a 4px radius, --muted on a --border edge, 11px. */
function Kbd({ className, ...props }) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-5 items-center rounded border border-border bg-muted px-[5px] font-sans text-2xs font-medium text-muted-fg",
        className
      )}
      {...props}
    />
  );
}

export { Kbd };
