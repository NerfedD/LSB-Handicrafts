import { forwardRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Text input.
 *
 * The class string below is the one that was hand-repeated in five screens
 * (CreateUserAccountPage, ManageUserAccountPage, UpdateProfilePage,
 * UserAccountsPage, StaffActivityLogPage) plus shared/ProfileForm -- same
 * height, radius, border and focus treatment, so every field looks unchanged.
 *
 * `aria-invalid` drives the error tone, which is how shared/ProfileForm already
 * did it. Keeping that contract means the form screens can pass their existing
 * validation state straight through.
 */
const Input = forwardRef(function Input({ className, type = "text", ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-[46px] w-full rounded-[10px] border border-[#17263a29] bg-white px-4 text-sm text-ink",
        "placeholder:text-[#5f687599] transition",
        "focus:border-brand focus:outline-none focus:ring-2 focus:ring-ring/30",
        "disabled:cursor-not-allowed disabled:bg-[#17263a08] disabled:text-muted",
        "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/25",
        className
      )}
      {...props}
    />
  );
});

const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[92px] w-full rounded-[10px] border border-[#17263a29] bg-white px-4 py-3 text-sm text-ink",
        "placeholder:text-[#5f687599] transition",
        "focus:border-brand focus:outline-none focus:ring-2 focus:ring-ring/30",
        "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/25",
        className
      )}
      {...props}
    />
  );
});

export { Input, Textarea };
