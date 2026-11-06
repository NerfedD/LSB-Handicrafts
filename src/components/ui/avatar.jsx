import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui Avatar on Base UI. Initials on --muted in --fg-2: 24px round in
 * table rows, 32px rounded-md in the sidebar, 40px on staff cards.
 */
const SIZES = {
  xs: "size-6 rounded-full text-[10px]",
  sm: "size-8 rounded-md text-xs",
  md: "size-10 rounded-full text-13",
  lg: "size-14 rounded-full text-lg",
};

function Avatar({ className, size = "xs", ...props }) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden bg-muted font-medium text-fg-2",
        SIZES[size],
        className
      )}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }) {
  return <AvatarPrimitive.Image className={cn("size-full object-cover", className)} {...props} />;
}

function AvatarFallback({ className, ...props }) {
  return <AvatarPrimitive.Fallback className={cn("flex size-full items-center justify-center", className)} {...props} />;
}

/** Up to two initials from a name, for the fallback. */
function initialsOf(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export { Avatar, AvatarImage, AvatarFallback, initialsOf };
