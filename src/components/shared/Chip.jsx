import { cloneElement, isValidElement } from "react";

import { initialsOf } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useStaffPhoto } from "./staffPhotos";

/**
 * An icon in a bordered box, the way the boards frame icons: neutral, never
 * tinted. `size` sm 28px, md 32px, lg 36px, xl 40px.
 */
const BOX = { sm: "size-7 [&_svg]:size-4", md: "size-8 [&_svg]:size-4", lg: "size-9 [&_svg]:size-5", xl: "size-10 [&_svg]:size-5" };

export default function IconChip({ icon, size = "md", className }) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 items-center justify-center rounded-md border border-border bg-card text-fg-2 shadow-xs", BOX[size] ?? BOX.md, className)}
    >
      {isValidElement(icon) ? cloneElement(icon, { "aria-hidden": true }) : icon}
    </span>
  );
}

/** Initials in a --muted circle: 24px in table rows, 32px and 40px elsewhere. */
const AVATAR = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-10 text-13", lg: "size-14 text-lg" };

/**
 * A person's initials, or their photo. `photo={false}` for customers: their
 * name could match a member of staff, and a customer has no photo here.
 */
export function Avatar({ name, size = "xs", className, photo = true }) {
  const src = useStaffPhoto(photo ? name : null);
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-fg-2", AVATAR[size] ?? AVATAR.xs, className)}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : initialsOf(name)}
    </span>
  );
}

/** A code or identifier: monospace 12px muted, as the boards print item codes. */
export function Mono({ children, className }) {
  return <span className={cn("font-mono text-xs text-muted-fg", className)}>{children}</span>;
}
