import { cn } from "@/lib/utils";

/**
 * Field label: 14/20 medium in --foreground, 6px above its control. The
 * help line under a field is 12/16 --muted-fg.
 */
function Label({ className, ...props }) {
  return (
    <label
      data-slot="label"
      className={cn("flex select-none items-center gap-2 text-sm font-medium text-foreground peer-disabled:opacity-60", className)}
      {...props}
    />
  );
}

function FieldHint({ className, ...props }) {
  return <p data-slot="field-hint" className={cn("mt-1.5 text-xs text-muted-fg", className)} {...props} />;
}

export { Label, FieldHint };
