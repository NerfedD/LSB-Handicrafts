import { forwardRef } from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

const Label = forwardRef(function Label({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(
        "text-[13px] font-medium text-ink peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
});

/**
 * The label-plus-hairline heading used above each block of fields.
 *
 * Defined twice (CreateUserAccountPage, ManageUserAccountPage) and inlined
 * verbatim five more times across UpdateProfilePage, ViewProfilePage,
 * StaffActivityLogPage and UserAccountsPage. Same markup, one place.
 */
function SectionLabel({ className, children, ...props }) {
  return (
    <div className={cn("flex items-center gap-3", className)} {...props}>
      <span className="text-[11px] font-semibold uppercase tracking-[1.1px] text-muted">
        {children}
      </span>
      <span className="h-px flex-1 bg-[#17263a14]" />
    </div>
  );
}

export { Label, SectionLabel };
