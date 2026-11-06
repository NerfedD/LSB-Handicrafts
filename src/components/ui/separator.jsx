import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";

import { cn } from "@/lib/utils";

function Separator({ className, orientation = "horizontal", ...props }) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn("shrink-0 bg-muted-strong", orientation === "vertical" ? "h-4 w-px" : "h-px w-full", className)}
      {...props}
    />
  );
}

export { Separator };
